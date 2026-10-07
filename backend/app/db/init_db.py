import asyncio
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import engine, Base, AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.business import Business
from app.models.auth import Permission, Role, RolePermission, User, UserRole
from app.models.service import ServiceCategory, Service
from app.models.customer import Customer

PERMISSIONS_SEED = [
    ("dashboard.view", "View Dashboard Analytics", "dashboard", "Access high-level revenue and business analytics"),
    ("billing.view", "View Billing Records", "billing", "View bills and POS transaction lists"),
    ("billing.create", "Create New Bill / POS", "billing", "Conduct sales and process walk-in checkout"),
    ("billing.edit", "Edit Existing Bill", "billing", "Adjust line items or apply special discounts"),
    ("billing.cancel", "Cancel / Void Bill", "billing", "Void or refund previously completed transactions"),
    ("customers.view", "View Customers", "customers", "Search and inspect customer profiles"),
    ("customers.create", "Create Customer", "customers", "Register new walk-in customer records"),
    ("customers.edit", "Edit Customer Profile", "customers", "Update customer contact info and preferences"),
    ("customers.delete", "Delete Customer", "customers", "Remove customer profiles permanently"),
    ("services.view", "View Service Catalog", "services", "Browse salon service offerings and pricing"),
    ("services.create", "Create Service", "services", "Add new services to the salon menu"),
    ("services.edit", "Edit Service / Price", "services", "Modify service pricing, duration, or categories"),
    ("services.delete", "Delete Service", "services", "Archive or delete salon services"),
    ("employees.view", "View Staff Directory", "employees", "View staff directory and operational assignments"),
    ("employees.create", "Add Employee", "employees", "Create new staff accounts"),
    ("employees.edit", "Edit Employee & Role", "employees", "Modify staff details or change assigned roles"),
    ("employees.delete", "Deactivate Employee", "employees", "Deactivate staff accounts"),
    ("roles.view", "View Roles & Permissions", "roles", "Inspect role definitions and granted permissions"),
    ("roles.manage", "Manage Roles & Permissions", "roles", "Create or modify roles and grant permissions"),
    ("reports.view", "View Financial Reports", "reports", "View itemized financial and sales reports"),
    ("reports.export", "Export Data Reports", "reports", "Download CSV or PDF financial ledgers"),
    ("settings.view", "View Salon Settings", "settings", "View business configuration and GST rates"),
    ("settings.edit", "Edit Salon Settings", "settings", "Modify business profile, tax rates, and bill prefixes"),
    ("audit.view", "View Audit Trail", "audit", "Inspect system change history and sensitive operations")
]

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # 1. Business
        biz_res = await db.execute(select(Business).limit(1))
        biz = biz_res.scalar_one_or_none()
        if not biz:
            biz = Business(
                name="Trimz Salon",
                legal_name="Trimz Unisex Salon Private Limited",
                phone="+919800011223",
                email="owner@trimzsalon.com",
                address="100 Feet Road, Indiranagar, Bengaluru",
                city="Bengaluru",
                state="Karnataka",
                postal_code="560038",
                default_tax_rate=Decimal("5.00"),
                tax_name="GST",
                bill_prefix="TZ"
            )
            db.add(biz)
            await db.flush()

        # 2. Permissions
        perm_map = {}
        for code, name, module, desc in PERMISSIONS_SEED:
            p_res = await db.execute(select(Permission).where(Permission.code == code))
            p = p_res.scalar_one_or_none()
            if not p:
                p = Permission(code=code, name=name, module=module, description=desc)
                db.add(p)
                await db.flush()
            perm_map[code] = p

        # 3. Roles
        # Owner Role
        owner_role_res = await db.execute(
            select(Role).where(Role.business_id == biz.id, Role.name == "Owner")
        )
        owner_role = owner_role_res.scalar_one_or_none()
        if not owner_role:
            owner_role = Role(
                business_id=biz.id,
                name="Owner",
                description="Unrestricted administrative access to all salon operations",
                is_system=True
            )
            db.add(owner_role)
            await db.flush()
            for p in perm_map.values():
                db.add(RolePermission(role_id=owner_role.id, permission_id=p.id))

        # Receptionist Role
        rec_role_res = await db.execute(
            select(Role).where(Role.business_id == biz.id, Role.name == "Receptionist")
        )
        rec_role = rec_role_res.scalar_one_or_none()
        if not rec_role:
            rec_role = Role(
                business_id=biz.id,
                name="Receptionist",
                description="Front-desk walk-in billing and customer registration",
                is_system=False
            )
            db.add(rec_role)
            await db.flush()
            for code in ["billing.view", "billing.create", "customers.view", "customers.create", "customers.edit", "services.view"]:
                if code in perm_map:
                    db.add(RolePermission(role_id=rec_role.id, permission_id=perm_map[code].id))

        # Manager Role
        mgr_role_res = await db.execute(
            select(Role).where(Role.business_id == biz.id, Role.name == "Manager")
        )
        if not mgr_role_res.scalar_one_or_none():
            mgr_role = Role(
                business_id=biz.id,
                name="Manager",
                description="Day-to-day salon operations, reporting, inventory, and staff oversight",
                is_system=False
            )
            db.add(mgr_role)
            await db.flush()
            for code in [
                "dashboard.view", "billing.view", "billing.create", "billing.edit",
                "customers.view", "customers.create", "customers.edit",
                "services.view", "employees.view", "reports.view", "reports.export",
                "settings.view", "audit.view"
            ]:
                if code in perm_map:
                    db.add(RolePermission(role_id=mgr_role.id, permission_id=perm_map[code].id))

        # 4. Default Owner Account
        owner_res = await db.execute(
            select(User).where(User.business_id == biz.id, User.email == "owner@trimzsalon.com")
        )
        if not owner_res.scalar_one_or_none():
            owner_user = User(
                business_id=biz.id,
                name="Harshith (Owner)",
                email="owner@trimzsalon.com",
                phone="+919800011223",
                password_hash=get_password_hash("Owner123!"),
                is_owner=True,
                status="ACTIVE"
            )
            db.add(owner_user)
            await db.flush()
            db.add(UserRole(user_id=owner_user.id, role_id=owner_role.id))

        # Default Receptionist Account
        rec_user_res = await db.execute(
            select(User).where(User.business_id == biz.id, User.email == "receptionist@trimzsalon.com")
        )
        if not rec_user_res.scalar_one_or_none():
            rec_user = User(
                business_id=biz.id,
                name="Priya (Receptionist)",
                email="receptionist@trimzsalon.com",
                phone="+919811223344",
                password_hash=get_password_hash("Staff123!"),
                is_owner=False,
                status="ACTIVE"
            )
            db.add(rec_user)
            await db.flush()
            db.add(UserRole(user_id=rec_user.id, role_id=rec_role.id))

        # 5. Service Categories & Menu Services
        cats_to_seed = [
            ("Hair Cut & Styling", 1),
            ("Beard & Shaving", 2),
            ("Facial & Cleanup", 3),
            ("Hair Spa & Treatments", 4),
            ("Massage", 5),
            ("D-Tan", 6),
            ("Pedicure & Manicure", 7)
        ]
        cat_obj_map = {}
        for cname, order in cats_to_seed:
            c_res = await db.execute(
                select(ServiceCategory).where(ServiceCategory.business_id == biz.id, ServiceCategory.name == cname)
            )
            c = c_res.scalar_one_or_none()
            if not c:
                c = ServiceCategory(business_id=biz.id, name=cname, display_order=order)
                db.add(c)
                await db.flush()
            cat_obj_map[cname] = c

        # Services
        services_to_seed = [
            ("Hair Cut - Essential", "Hair Cut & Styling", Decimal("149.00"), 30, "Male"),
            ("Change of Style & Styling", "Hair Cut & Styling", Decimal("199.00"), 40, "Male"),
            ("Signature Haircut - Women", "Hair Cut & Styling", Decimal("349.00"), 45, "Female"),
            ("Layer Cut - Women", "Hair Cut & Styling", Decimal("799.00"), 60, "Female"),
            ("Beard Sculpt & Shaving", "Beard & Shaving", Decimal("79.00"), 20, "Male"),
            ("Classic Shave & Hot Towel", "Beard & Shaving", Decimal("69.00"), 20, "Male"),
            ("Charcoal Detox Facial", "Facial & Cleanup", Decimal("699.00"), 45, "Male"),
            ("Gold Glow Facial - Women", "Facial & Cleanup", Decimal("1499.00"), 60, "Female"),
            ("Hydra Facial Advance", "Facial & Cleanup", Decimal("2999.00"), 60, "Unisex"),
            ("Anti-Dandruff Spa Treatment", "Hair Spa & Treatments", Decimal("1999.00"), 60, "Unisex"),
            ("Head Oil Massage (30 min)", "Massage", Decimal("299.00"), 30, "Male"),
            ("D-Tan Deep Clean", "D-Tan", Decimal("799.00"), 30, "Male"),
            ("Classic Pedicure", "Pedicure & Manicure", Decimal("599.00"), 45, "Unisex")
        ]
        for sname, cname, price, duration, aud in services_to_seed:
            s_res = await db.execute(
                select(Service).where(Service.business_id == biz.id, Service.name == sname, Service.audience == aud)
            )
            if not s_res.scalar_one_or_none():
                svc = Service(
                    business_id=biz.id,
                    category_id=cat_obj_map[cname].id,
                    name=sname,
                    price=price,
                    duration_minutes=duration,
                    audience=aud,
                    commission_rate=Decimal("10.00")
                )
                db.add(svc)

        # 6. Sample Initial Customer
        cust_res = await db.execute(
            select(Customer).where(Customer.business_id == biz.id, Customer.phone == "+919876543210")
        )
        if not cust_res.scalar_one_or_none():
            c = Customer(
                business_id=biz.id,
                name="Aarav Mehta",
                phone="+919876543210",
                email="aarav@example.com",
                gender="Male",
                notes="Prefers hot towel finish"
            )
            db.add(c)

        await db.commit()

if __name__ == "__main__":
    asyncio.run(init_db())
    print("Database schema and seed initialized successfully!")
