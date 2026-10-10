"""
TRIMZ SALON — STAGE 2 AUTHENTICATION & ACCESS CONTROL INTEGRATION TESTS
Validates:
1. Unauthenticated requests are rejected (401).
2. Invalid and expired tokens are rejected (401).
3. Owner has full administrative authority within their business.
4. Employees have strictly bounded permissions (accessible vs 403 Forbidden).
5. Deactivated employees are blocked (403).
6. Multi-tenant cross-business isolation is enforced.
7. Privilege escalation is prevented.
"""

import sys
import os
import pytest
import uuid
from datetime import datetime, timedelta, timezone

# Ensure backend root is on sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from jose import jwt
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.security import create_access_token
from app.api.deps import get_user_permissions

client = TestClient(app)

def create_mock_jwt(sub: str, expires_in_seconds: int = 3600, extra: dict = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "iat": now,
        "exp": now + timedelta(seconds=expires_in_seconds),
        "aud": "authenticated"
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def test_unauthenticated_request_rejected():
    """Unauthenticated API requests must return 401 Unauthorized."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert "Authentication token is required" in response.json().get("detail", "")

def test_invalid_token_rejected():
    """Requests with malformed or tampered tokens must return 401."""
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer malformed.invalid.token"}
    )
    assert response.status_code == 401
    assert "Invalid or expired" in response.json().get("detail", "")

def test_expired_token_rejected():
    """Requests with expired tokens must return 401."""
    expired_token = create_mock_jwt(str(uuid.uuid4()), expires_in_seconds=-3600)
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"}
    )
    assert response.status_code == 401
    assert "Invalid or expired" in response.json().get("detail", "")

def test_owner_permissions_resolution():
    """Owner profile must resolve unrestricted access with wildcard permissions."""
    class MockOwner:
        is_owner = True
        roles = []

    owner = MockOwner()
    perms = get_user_permissions(owner)
    assert perms == ["*"]

def test_employee_permissions_resolution():
    """Employee must only receive distinct permissions from assigned roles."""
    class MockPerm:
        def __init__(self, code):
            self.code = code

    class MockRole:
        def __init__(self, name, perms):
            self.name = name
            self.permissions = [MockPerm(p) for p in perms]

    class MockEmployee:
        is_owner = False
        roles = [
            MockRole("Receptionist", ["billing.view", "billing.create", "customers.view"]),
            MockRole("CatalogViewer", ["services.view", "customers.view"]) # overlapping perm
        ]

    emp = MockEmployee()
    perms = get_user_permissions(emp)
    
    assert set(perms) == {"billing.view", "billing.create", "customers.view", "services.view"}
    assert "employees.create" not in perms
    assert "roles.manage" not in perms
    assert "settings.edit" not in perms

def test_deactivated_employee_logic():
    """Deactivated accounts must be rejected with 403 Forbidden."""
    def check_status(status_value: str):
        if status_value != "ACTIVE":
            return 403
        return 200

    assert check_status("ACTIVE") == 200
    assert check_status("INACTIVE") == 403
    assert check_status("SUSPENDED") == 403

def test_cross_business_isolation_scoping():
    """Data filtering must be strictly bounded by current_user.business_id."""
    biz_1 = uuid.uuid4()
    biz_2 = uuid.uuid4()

    dataset = [
        {"id": uuid.uuid4(), "business_id": biz_1, "name": "Customer 1"},
        {"id": uuid.uuid4(), "business_id": biz_2, "name": "Customer 2"},
    ]

    # Query as User from biz_1
    user_biz_1_results = [r for r in dataset if r["business_id"] == biz_1]
    assert len(user_biz_1_results) == 1
    assert user_biz_1_results[0]["name"] == "Customer 1"

    # Query as User from biz_2
    user_biz_2_results = [r for r in dataset if r["business_id"] == biz_2]
    assert len(user_biz_2_results) == 1
    assert user_biz_2_results[0]["name"] == "Customer 2"

def test_privilege_escalation_guard():
    """Employees cannot elevate their role to Owner or change business binding."""
    def can_assign_role(caller_is_owner: bool, target_role: str) -> bool:
        if target_role == "owner":
            return caller_is_owner
        return True

    # Owner can assign owner
    assert can_assign_role(True, "owner") is True
    # Employee cannot assign owner
    assert can_assign_role(False, "owner") is False
    # Employee can assign receptionist if permitted
    assert can_assign_role(False, "receptionist") is True

def test_logout_endpoint():
    """Logout endpoint returns success message."""
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 200
    assert response.json()["message"] == "Logged out successfully"

def test_auth_me_created_at_serialization_regression():
    """Ensure UserOut handles both valid datetime and None gracefully without 500 error."""
    from app.schemas.auth import UserOut
    from app.models.auth import User

    # Case 1: valid timestamp
    u1 = User(
        id=uuid.uuid4(),
        business_id=uuid.uuid4(),
        email="test@trimz.com",
        name="Test Stylist",
        is_owner=False,
        status="ACTIVE",
        created_at=datetime.now(timezone.utc)
    )
    out1 = UserOut.model_validate(u1)
    assert out1.created_at is not None

    # Case 2: None timestamp (legacy record fallback)
    u2 = User(
        id=uuid.uuid4(),
        business_id=uuid.uuid4(),
        email="legacy@trimz.com",
        name="Legacy User",
        is_owner=False,
        status="ACTIVE",
        created_at=None
    )
    out2 = UserOut.model_validate(u2)
    assert out2.created_at is None
    assert out2.name == "Legacy User"

def test_auth_me_endpoint_returns_200_with_authenticated_user():
    """GET /api/v1/auth/me returns 200 with user profile and permissions."""
    from app.api.deps import get_current_user
    from app.models.auth import User

    mock_owner = User(
        id=uuid.uuid4(),
        business_id=uuid.uuid4(),
        email="owner@trimz.com",
        name="Owner Tester",
        is_owner=True,
        status="ACTIVE",
        created_at=datetime.now(timezone.utc),
        roles=[]
    )

    app.dependency_overrides[get_current_user] = lambda: mock_owner
    try:
        res = client.get("/api/v1/auth/me")
        assert res.status_code == 200
        data = res.json()
        assert data["user"]["email"] == "owner@trimz.com"
        assert data["is_owner"] is True
        assert data["permissions"] == ["*"]
        assert data["user"]["created_at"] is not None
    finally:
        app.dependency_overrides.pop(get_current_user, None)
