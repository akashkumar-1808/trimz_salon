"""
TRIMZ SALON — ATOMIC CHECKOUT & UNIQUE NUMBER GENERATION TESTS
Covers:
1. extract_sequence_number unit tests for all formats (standard, modifiers, legacy, edge cases).
2. Sequential checkouts incrementing cleanly without gaps or reuse.
3. Concurrent checkout execution under simultaneous requests (asyncio.gather).
4. Collision avoidance when a candidate number (e.g., TZ-YYYYMMDD-0265) already exists.
5. Numbering continuity and persistence across application restart / re-initialization.
6. Idempotency guarantees preventing duplicate bills on retried checkouts.
7. Concurrent idempotent checkout requests sharing the same Idempotency-Key.
"""

import sys
import os
import uuid
import asyncio
from decimal import Decimal
from datetime import datetime, timezone
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.core.database import Base, get_db
from app.main import app
from app.models.business import Business
from app.models.auth import User
from app.models.service import Service, ServiceCategory
from app.models.sale import Sale, SaleItem, Payment
from app.models.invoice import Invoice
from app.services.sequence import extract_sequence_number, get_next_sale_and_invoice_numbers
from app.api.deps import get_current_user, require_permission


def test_extract_sequence_number_comprehensive():
    """Verify parsing and sequence extraction across all known and edge-case formats."""
    test_cases = [
        ("TZ-20261108-0265", 265),
        ("TRIMZ-202611-0265", 265),
        ("TZ-20261001-0007-DUP", 7),
        ("TZ-20261001-0007-DUP-2", 7),
        ("SALE-001", 1),
        ("INV-002", 2),
        ("INV-2026-999", 999),
        ("TRIMZ-202611-10000", 10000),
        ("0265", 265),
        (None, None),
        ("", None),
        ("   ", None),
        ("RANDOM_TEXT_NO_NUMBERS", None),
    ]
    for raw_input, expected in test_cases:
        actual = extract_sequence_number(raw_input)
        assert actual == expected, f"Failed for {raw_input}: expected {expected}, got {actual}"


from contextlib import asynccontextmanager

@asynccontextmanager
async def create_test_env():
    """Creates an isolated SQLite test database with seed business and catalog."""
    test_db_id = uuid.uuid4().hex[:8]
    test_db_file = f"scratch/test_checkout_{test_db_id}.db"

    engine = create_async_engine(f"sqlite+aiosqlite:///{test_db_file}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    test_biz_id = uuid.uuid4()
    test_user_id = uuid.uuid4()
    test_cat_id = uuid.uuid4()
    test_svc_id = uuid.uuid4()

    mock_user = User(
        id=test_user_id,
        business_id=test_biz_id,
        email="operator@trimz.test",
        name="Test Operator",
        is_owner=True,
        status="ACTIVE",
        created_at=datetime.now(timezone.utc)
    )

    async with session_maker() as session:
        biz = Business(
            id=test_biz_id,
            name="Trimz Test Salon",
            bill_prefix="TZ",
            currency="INR"
        )
        cat = ServiceCategory(
            id=test_cat_id,
            business_id=test_biz_id,
            name="Hair Cut",
            department="Men"
        )
        svc = Service(
            id=test_svc_id,
            business_id=test_biz_id,
            category_id=test_cat_id,
            name="Executive Cut",
            price=Decimal("450.00"),
            duration_minutes=30,
            audience="Male",
            is_active=True
        )
        session.add_all([biz, cat, svc])
        await session.commit()

    async def override_get_db():
        async with session_maker() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[require_permission("billing.create")] = lambda: mock_user

    try:
        yield {
            "engine": engine,
            "session_maker": session_maker,
            "db_file": test_db_file,
            "biz_id": test_biz_id,
            "user_id": test_user_id,
            "svc_id": test_svc_id,
            "mock_user": mock_user
        }
    finally:
        # Cleanup
        app.dependency_overrides.clear()
        await engine.dispose()
        if os.path.exists(test_db_file):
            try:
                os.remove(test_db_file)
            except Exception:
                pass


@pytest.mark.asyncio
async def test_sequential_checkout_numbering():
    """Verify that multiple checkouts increment sequentially without gaps or reuse."""
    async with create_test_env() as test_env:
        svc_id = str(test_env["svc_id"])
        now_utc = datetime.now(timezone.utc)
        expected_date = now_utc.strftime("%Y%m%d")
        expected_month = now_utc.strftime("%Y%m")

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            headers = {"Authorization": "Bearer test-token"}

            for i in range(1, 4):
                payload = {
                    "customer_name": f"Customer {i}",
                    "customer_phone": f"987654321{i}",
                    "overall_discount": 0.0,
                    "apply_tax": False,
                    "open_whatsapp": False,
                    "payments": [{"amount": 450.0, "payment_method": "UPI"}],
                    "items": [{
                        "service_id": svc_id,
                        "name": "Executive Cut",
                        "unit_price": 450.0,
                        "quantity": 1,
                        "item_type": "service"
                    }]
                }
                resp = await client.post("/api/v1/billing/checkout", json=payload, headers=headers)
                assert resp.status_code == 201
                data = resp.json()

                expected_sale_num = f"TZ-{expected_date}-{i:04d}"
                expected_inv_num = f"TRIMZ-{expected_month}-{i:04d}"

                assert data["sale"]["sale_number"] == expected_sale_num
                assert data["invoice"]["invoice_number"] == expected_inv_num


@pytest.mark.asyncio
async def test_concurrent_checkout_unique_numbering():
    """
    Simulate multiple simultaneous checkout requests.
    Verify all succeed with 201 and receive strictly unique sequential numbers.
    """
    async with create_test_env() as test_env:
        svc_id = str(test_env["svc_id"])
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            headers = {"Authorization": "Bearer test-token"}

            async def checkout_task(idx):
                payload = {
                    "customer_name": f"Concurrent Guest {idx}",
                    "customer_phone": f"91111111{idx:02d}",
                    "overall_discount": 0.0,
                    "apply_tax": False,
                    "open_whatsapp": False,
                    "payments": [{"amount": 450.0, "payment_method": "UPI"}],
                    "items": [{
                        "service_id": svc_id,
                        "name": "Executive Cut",
                        "unit_price": 450.0,
                        "quantity": 1,
                        "item_type": "service"
                    }]
                }
                return await client.post("/api/v1/billing/checkout", json=payload, headers=headers)

            # Launch 8 concurrent checkouts simultaneously
            tasks = [checkout_task(i) for i in range(1, 9)]
            responses = await asyncio.gather(*tasks)

            assert all(r.status_code == 201 for r in responses), "All concurrent checkouts must return 201"

            sale_numbers = [r.json()["sale"]["sale_number"] for r in responses]
            invoice_numbers = [r.json()["invoice"]["invoice_number"] for r in responses]

            # Verify all generated numbers are distinct
            assert len(sale_numbers) == len(set(sale_numbers)) == 8
            assert len(invoice_numbers) == len(set(invoice_numbers)) == 8

            # Verify sequence numbers are consecutive integers
            seqs = sorted([extract_sequence_number(s) for s in sale_numbers])
            assert seqs == list(range(1, 9))


@pytest.mark.asyncio
async def test_pre_existing_number_collision_prevention():
    """
    Reproduces the exact Render production bug:
    Pre-insert a sale and invoice with sequence 0265 (TZ-YYYYMMDD-0265).
    Ensure the next checkout safely identifies the collision and generates 0266.
    """
    async with create_test_env() as test_env:
        biz_id = test_env["biz_id"]
        svc_id = str(test_env["svc_id"])
        user_id = test_env["user_id"]
        now_utc = datetime.now(timezone.utc)
        date_str = now_utc.strftime("%Y%m%d")
        month_str = now_utc.strftime("%Y%m")

        colliding_sale_num = f"TZ-{date_str}-0265"
        colliding_inv_num = f"TRIMZ-{month_str}-0265"

        # Insert pre-existing colliding sale and invoice directly into DB
        async with test_env["session_maker"]() as session:
            # Create dummy customer
            from app.models.customer import Customer
            cust = Customer(
                id=uuid.uuid4(),
                business_id=biz_id,
                name="Pre-existing Customer",
                phone="9990009990"
            )
            session.add(cust)
            await session.flush()

            old_sale = Sale(
                id=uuid.uuid4(),
                business_id=biz_id,
                customer_id=cust.id,
                operator_id=user_id,
                sale_number=colliding_sale_num,
                status="COMPLETED",
                subtotal=Decimal("450.00"),
                total_amount=Decimal("450.00")
            )
            session.add(old_sale)
            await session.flush()

            old_inv = Invoice(
                id=uuid.uuid4(),
                business_id=biz_id,
                sale_id=old_sale.id,
                invoice_number=colliding_inv_num,
                status="ISSUED",
                subtotal=Decimal("450.00"),
                total_amount=Decimal("450.00"),
                currency="INR"
            )
            session.add(old_inv)
            await session.commit()

        # Now perform a new checkout through the API
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            headers = {"Authorization": "Bearer test-token"}
            payload = {
                "customer_name": "New Guest After 0265",
                "customer_phone": "9876500001",
                "overall_discount": 0.0,
                "apply_tax": False,
                "open_whatsapp": False,
                "payments": [{"amount": 450.0, "payment_method": "UPI"}],
                "items": [{
                    "service_id": svc_id,
                    "name": "Executive Cut",
                    "unit_price": 450.0,
                    "quantity": 1,
                    "item_type": "service"
                }]
            }

            resp = await client.post("/api/v1/billing/checkout", json=payload, headers=headers)
            assert resp.status_code == 201
            data = resp.json()

            # Must skip 0265 and generate 0266 without failing
            expected_sale_num = f"TZ-{date_str}-0266"
            expected_inv_num = f"TRIMZ-{month_str}-0266"
            assert data["sale"]["sale_number"] == expected_sale_num
            assert data["invoice"]["invoice_number"] == expected_inv_num


@pytest.mark.asyncio
async def test_numbering_persistence_after_application_restart():
    """
    Simulate application restart:
    1. Checkout #1 creates sequence 0001.
    2. Dispose engine & sessionmaker, and reinitialize (simulating process restart).
    3. Checkout #2 continues from sequence 0002 without collision or regression.
    """
    async with create_test_env() as test_env:
        svc_id = str(test_env["svc_id"])
        db_file = test_env["db_file"]
        mock_user = test_env["mock_user"]
        now_utc = datetime.now(timezone.utc)
        date_str = now_utc.strftime("%Y%m%d")

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            headers = {"Authorization": "Bearer test-token"}
            payload = {
                "customer_name": "Pre Restart Cust",
                "customer_phone": "9876511111",
                "overall_discount": 0.0,
                "apply_tax": False,
                "open_whatsapp": False,
                "payments": [{"amount": 450.0, "payment_method": "UPI"}],
                "items": [{
                    "service_id": svc_id,
                    "name": "Executive Cut",
                    "unit_price": 450.0,
                    "quantity": 1,
                    "item_type": "service"
                }]
            }
            resp1 = await client.post("/api/v1/billing/checkout", json=payload, headers=headers)
            assert resp1.status_code == 201
            assert resp1.json()["sale"]["sale_number"] == f"TZ-{date_str}-0001"

        # --- SIMULATE PROCESS RESTART ---
        # Dispose old engine
        await test_env["engine"].dispose()

        # Recreate engine and sessionmaker from the same sqlite DB file
        new_engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}")
        new_session_maker = async_sessionmaker(new_engine, expire_on_commit=False, class_=AsyncSession)

        async def new_override_get_db():
            async with new_session_maker() as session:
                yield session

        app.dependency_overrides[get_db] = new_override_get_db

        try:
            transport2 = ASGITransport(app=app)
            async with AsyncClient(transport=transport2, base_url="http://test") as client2:
                headers = {"Authorization": "Bearer test-token"}
                payload2 = {
                    "customer_name": "Post Restart Cust",
                    "customer_phone": "9876522222",
                    "overall_discount": 0.0,
                    "apply_tax": False,
                    "open_whatsapp": False,
                    "payments": [{"amount": 450.0, "payment_method": "UPI"}],
                    "items": [{
                        "service_id": svc_id,
                        "name": "Executive Cut",
                        "unit_price": 450.0,
                        "quantity": 1,
                        "item_type": "service"
                    }]
                }
                resp2 = await client2.post("/api/v1/billing/checkout", json=payload2, headers=headers)
                assert resp2.status_code == 201
                assert resp2.json()["sale"]["sale_number"] == f"TZ-{date_str}-0002"
        finally:
            await new_engine.dispose()


@pytest.mark.asyncio
async def test_idempotent_checkout_duplicate_prevention():
    """
    Verify that repeating checkout with the same Idempotency-Key:
    - Returns the original sale and invoice without generating new numbers.
    - Does not create duplicate database rows.
    """
    async with create_test_env() as test_env:
        svc_id = str(test_env["svc_id"])
        idemp_key = f"key-{uuid.uuid4()}"

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            headers = {
                "Authorization": "Bearer test-token",
                "Idempotency-Key": idemp_key
            }
            payload = {
                "customer_name": "Idempotent Cust",
                "customer_phone": "9876533333",
                "overall_discount": 0.0,
                "apply_tax": False,
                "open_whatsapp": False,
                "payments": [{"amount": 450.0, "payment_method": "UPI"}],
                "items": [{
                    "service_id": svc_id,
                    "name": "Executive Cut",
                    "unit_price": 450.0,
                    "quantity": 1,
                    "item_type": "service"
                }]
            }

            # 1st attempt
            resp1 = await client.post("/api/v1/billing/checkout", json=payload, headers=headers)
            assert resp1.status_code == 201
            data1 = resp1.json()
            orig_sale_id = data1["sale"]["id"]
            orig_sale_num = data1["sale"]["sale_number"]
            orig_inv_num = data1["invoice"]["invoice_number"]

            # 2nd attempt with identical Idempotency-Key
            resp2 = await client.post("/api/v1/billing/checkout", json=payload, headers=headers)
            assert resp2.status_code == 201
            data2 = resp2.json()

            assert data2["sale"]["id"] == orig_sale_id
            assert data2["sale"]["sale_number"] == orig_sale_num
            assert data2["invoice"]["invoice_number"] == orig_inv_num

        # Verify only 1 sale exists in database for this client_request_id
        async with test_env["session_maker"]() as session:
            res = await session.execute(
                select(func.count(Sale.id)).where(Sale.client_request_id == idemp_key)
            )
            assert res.scalar() == 1


@pytest.mark.asyncio
async def test_concurrent_idempotent_checkout_requests():
    """
    Verify that multiple simultaneous requests with the SAME Idempotency-Key
    do not crash and all resolve to the same sale.
    """
    async with create_test_env() as test_env:
        svc_id = str(test_env["svc_id"])
        shared_key = f"shared-concurrent-{uuid.uuid4()}"

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            headers = {
                "Authorization": "Bearer test-token",
                "Idempotency-Key": shared_key
            }
            payload = {
                "customer_name": "Shared Idemp Cust",
                "customer_phone": "9876544444",
                "overall_discount": 0.0,
                "apply_tax": False,
                "open_whatsapp": False,
                "payments": [{"amount": 450.0, "payment_method": "UPI"}],
                "items": [{
                    "service_id": svc_id,
                    "name": "Executive Cut",
                    "unit_price": 450.0,
                    "quantity": 1,
                    "item_type": "service"
                }]
            }

            tasks = [client.post("/api/v1/billing/checkout", json=payload, headers=headers) for _ in range(5)]
            responses = await asyncio.gather(*tasks)

            assert all(r.status_code == 201 for r in responses)

            sale_ids = {r.json()["sale"]["id"] for r in responses}
            sale_numbers = {r.json()["sale"]["sale_number"] for r in responses}

            assert len(sale_ids) == 1, "All concurrent idempotent checkouts must return identical sale ID"
            assert len(sale_numbers) == 1, "All concurrent idempotent checkouts must return identical sale number"

        # Verify exactly 1 database row was created
        async with test_env["session_maker"]() as session:
            res = await session.execute(
                select(func.count(Sale.id)).where(Sale.client_request_id == shared_key)
            )
            assert res.scalar() == 1
