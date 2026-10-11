import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, Table, func
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.business import GUID

class Permission(Base):
    __tablename__ = "permissions"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    code = Column(String(80), nullable=False, unique=True, index=True)
    name = Column(String(120), nullable=False)
    module = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id = Column(GUID, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    permission_id = Column(GUID, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Role(Base):
    __tablename__ = "roles"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    business_id = Column(GUID, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(80), nullable=False)
    slug = Column(String(80), nullable=False)
    description = Column(Text, nullable=True)
    is_system = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    permissions = relationship("Permission", secondary="role_permissions", lazy="selectin")

class UserRole(Base):
    __tablename__ = "user_roles"

    user_id = Column(GUID, ForeignKey("profiles.id", ondelete="CASCADE"), primary_key=True)
    role_id = Column(GUID, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class UserPermission(Base):
    __tablename__ = "user_permissions"

    user_id = Column(GUID, ForeignKey("profiles.id", ondelete="CASCADE"), primary_key=True)
    permission_id = Column(GUID, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Profile(Base):
    """
    Application profile table linked 1:1 with Supabase auth.users.
    Stores domain attributes, tenancy, and ownership status.
    Passwords and authentication are exclusively managed by Supabase Auth.
    """
    __tablename__ = "profiles"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    business_id = Column(GUID, ForeignKey("businesses.id", ondelete="RESTRICT"), nullable=False)
    email = Column(String(120), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    phone = Column(String(20), nullable=True)
    avatar_url = Column(Text, nullable=True)
    is_owner = Column(Boolean, nullable=False, default=False)
    has_custom_permissions = Column(Boolean, nullable=False, default=False)
    status = Column(
        ENUM("ACTIVE", "INACTIVE", "SUSPENDED", "PENDING", name="user_status", create_type=False),
        nullable=False,
        default="ACTIVE"
    )
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), server_default=func.now())

    roles = relationship("Role", secondary="user_roles", lazy="selectin")
    direct_permissions = relationship("Permission", secondary="user_permissions", lazy="selectin")

# Alias User to Profile for full backward compatibility across existing API routes
User = Profile
