-- ==============================================================================
-- TRIMZ SALON — PRODUCTION SUPABASE / POSTGRESQL SCHEMA
-- Migration: 20261007_init_trimz_schema.sql
-- Description: Core tenancy, identity, first-class RBAC, catalog,
--              transactional spine (sales, items, payments, invoices),
--              audit logs, and Row Level Security (RLS) policies.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS
DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE sale_status AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method_enum AS ENUM ('CASH', 'UPI', 'CARD', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE invoice_status AS ENUM ('ISSUED', 'VOID', 'REPLACED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. TENANCY / BUSINESS
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL DEFAULT 'Trimz Salon',
    legal_name VARCHAR(200) DEFAULT 'Trimz Unisex Salon Private Limited',
    phone VARCHAR(20) NOT NULL DEFAULT '+919800011223',
    email VARCHAR(100) DEFAULT 'contact@trimzsalon.com',
    address TEXT NOT NULL DEFAULT '100 Feet Road, Indiranagar, Bengaluru, Karnataka',
    city VARCHAR(100) NOT NULL DEFAULT 'Bengaluru',
    state VARCHAR(100) NOT NULL DEFAULT 'Karnataka',
    postal_code VARCHAR(20) NOT NULL DEFAULT '560038',
    country VARCHAR(10) NOT NULL DEFAULT 'IN',
    tax_name VARCHAR(50) DEFAULT 'GST',
    default_tax_rate NUMERIC(5, 2) DEFAULT 5.00,
    tax_registration_number VARCHAR(50) DEFAULT '29AAAAA0000A1Z5',
    currency VARCHAR(5) NOT NULL DEFAULT 'INR',
    currency_symbol VARCHAR(5) NOT NULL DEFAULT '₹',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    bill_prefix VARCHAR(10) NOT NULL DEFAULT 'TZ',
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. ROLES AND PERMISSIONS (FIRST-CLASS RBAC)
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(80) NOT NULL UNIQUE,       -- E.g. 'billing.create', 'reports.view'
    name VARCHAR(120) NOT NULL,
    module VARCHAR(50) NOT NULL,            -- 'dashboard', 'billing', 'customers', etc.
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,              -- 'Owner', 'Manager', 'Receptionist', 'Staff'
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE, -- System roles cannot be deleted
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_roles_business_name UNIQUE (business_id, name)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id)
);

-- 5. USERS / EMPLOYEE IDENTITY
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    supabase_auth_id UUID UNIQUE,           -- Linked to auth.users if Supabase Auth is active
    email VARCHAR(120) NOT NULL,
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255),             -- For self-contained FastAPI auth / fallback
    is_owner BOOLEAN NOT NULL DEFAULT FALSE, -- True only for the top-level Owner
    status user_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_business_email UNIQUE (business_id, email)
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

-- 6. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(20) NOT NULL,             -- Normalized E.164 (e.g. +919876543210)
    email VARCHAR(120),
    gender VARCHAR(20) DEFAULT 'Unspecified',
    date_of_birth DATE,
    notes TEXT,
    marketing_opt_in BOOLEAN NOT NULL DEFAULT TRUE,
    -- Summary cache fields (derived from sales)
    total_visits INT NOT NULL DEFAULT 0 CHECK (total_visits >= 0),
    total_spend NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_spend >= 0),
    loyalty_points INT NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0),
    last_visit_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_customers_business_phone UNIQUE (business_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(business_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(business_id, name);

-- 7. SERVICE CATALOG & CATEGORIES
CREATE TABLE IF NOT EXISTS service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_service_category_name UNIQUE (business_id, name)
);

CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    duration_minutes INT NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
    audience VARCHAR(20) NOT NULL DEFAULT 'Unisex', -- 'Male', 'Female', 'Unisex'
    commission_rate NUMERIC(5, 2) DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_service_business_name UNIQUE (business_id, name, audience)
);

CREATE INDEX IF NOT EXISTS idx_services_category ON services(business_id, category_id, is_active);

-- 8. SALES & SALE ITEMS (TRANSACTIONAL SPINE WITH HISTORICAL SNAPSHOTS)
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    operator_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    sale_number VARCHAR(50) NOT NULL,
    client_request_id VARCHAR(100),         -- Idempotency key
    status sale_status NOT NULL DEFAULT 'COMPLETED',
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    discount_reason VARCHAR(150),
    tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    tax_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (tax_percentage >= 0),
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    staff_name VARCHAR(120),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_sales_number UNIQUE (business_id, sale_number),
    CONSTRAINT uq_sales_idempotency UNIQUE (business_id, client_request_id)
);

CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(business_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(business_id, customer_id);

CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    item_type VARCHAR(20) NOT NULL DEFAULT 'service', -- 'service' or 'product'
    -- Mandatory historical snapshots
    service_name_snapshot VARCHAR(150) NOT NULL,
    unit_price_snapshot NUMERIC(10, 2) NOT NULL CHECK (unit_price_snapshot >= 0),
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    total_price NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
    commission_rate_snapshot NUMERIC(5, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);

-- 9. PAYMENTS (SEPARATING METHOD FROM PROVIDER)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    payment_method payment_method_enum NOT NULL DEFAULT 'UPI',
    payment_provider VARCHAR(50),           -- 'Google Pay', 'PhonePe', 'Paytm', etc.
    status payment_status NOT NULL DEFAULT 'SUCCESS',
    transaction_reference VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_lookup ON payments(business_id, status, payment_method, created_at DESC);

-- 10. INVOICES
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    invoice_number VARCHAR(50) NOT NULL,
    status invoice_status NOT NULL DEFAULT 'ISSUED',
    subtotal NUMERIC(10, 2) NOT NULL,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(5) NOT NULL DEFAULT 'INR',
    pdf_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_invoices_number UNIQUE (business_id, invoice_number),
    CONSTRAINT uq_invoices_sale UNIQUE (sale_id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_lookup ON invoices(business_id, created_at DESC);

-- 11. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(80) NOT NULL,            -- 'SALE_CREATED', 'ROLE_UPDATED', 'EMPLOYEE_CREATED'
    entity_name VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_date ON audit_logs(business_id, created_at DESC);

-- ==============================================================================
-- 12. SEED PERMISSIONS CATALOGUE
-- ==============================================================================
INSERT INTO permissions (code, name, module, description) VALUES
    ('dashboard.view', 'View Dashboard Analytics', 'dashboard', 'Access high-level revenue and business analytics'),
    ('billing.view', 'View Billing Records', 'billing', 'View bills and POS transaction lists'),
    ('billing.create', 'Create New Bill / POS', 'billing', 'Conduct sales and process walk-in checkout'),
    ('billing.edit', 'Edit Existing Bill', 'billing', 'Adjust line items or apply special discounts'),
    ('billing.cancel', 'Cancel / Void Bill', 'billing', 'Void or refund previously completed transactions'),
    ('customers.view', 'View Customers', 'customers', 'Search and inspect customer profiles'),
    ('customers.create', 'Create Customer', 'customers', 'Register new walk-in customer records'),
    ('customers.edit', 'Edit Customer Profile', 'customers', 'Update customer contact info and preferences'),
    ('customers.delete', 'Delete Customer', 'customers', 'Remove customer profiles permanently'),
    ('services.view', 'View Service Catalog', 'services', 'Browse salon service offerings and pricing'),
    ('services.create', 'Create Service', 'services', 'Add new services to the salon menu'),
    ('services.edit', 'Edit Service / Price', 'services', 'Modify service pricing, duration, or categories'),
    ('services.delete', 'Delete Service', 'services', 'Archive or delete salon services'),
    ('employees.view', 'View Staff Directory', 'employees', 'View staff directory and operational assignments'),
    ('employees.create', 'Add Employee', 'employees', 'Create new staff accounts'),
    ('employees.edit', 'Edit Employee & Role', 'employees', 'Modify staff details or change assigned roles'),
    ('employees.delete', 'Deactivate Employee', 'employees', 'Deactivate staff accounts'),
    ('roles.view', 'View Roles & Permissions', 'roles', 'Inspect role definitions and granted permissions'),
    ('roles.manage', 'Manage Roles & Permissions', 'roles', 'Create or modify roles and grant permissions'),
    ('reports.view', 'View Financial Reports', 'reports', 'View itemized financial and sales reports'),
    ('reports.export', 'Export Data Reports', 'reports', 'Download CSV or PDF financial ledgers'),
    ('settings.view', 'View Salon Settings', 'settings', 'View business configuration and GST rates'),
    ('settings.edit', 'Edit Salon Settings', 'settings', 'Modify business profile, tax rates, and bill prefixes'),
    ('audit.view', 'View Audit Trail', 'audit', 'Inspect system change history and sensitive operations')
ON CONFLICT (code) DO NOTHING;

-- ==============================================================================
-- 13. SEED DEFAULT BUSINESS, ROLES, AND INITIAL DATA
-- ==============================================================================
DO $$
DECLARE
    v_business_id UUID;
    v_owner_role_id UUID;
    v_manager_role_id UUID;
    v_receptionist_role_id UUID;
    v_staff_role_id UUID;
    v_cat_hair UUID;
    v_cat_beard UUID;
    v_cat_facial UUID;
    v_cat_spa UUID;
BEGIN
    -- Check if default business exists, else insert
    SELECT id INTO v_business_id FROM businesses WHERE name = 'Trimz Salon' LIMIT 1;
    IF v_business_id IS NULL THEN
        INSERT INTO businesses (name, legal_name, phone, email, address, city, state, postal_code, default_tax_rate, bill_prefix)
        VALUES ('Trimz Salon', 'Trimz Unisex Salon Private Limited', '+919800011223', 'owner@trimzsalon.com', '100 Feet Road, Indiranagar', 'Bengaluru', 'Karnataka', '560038', 5.00, 'TZ')
        RETURNING id INTO v_business_id;
    END IF;

    -- Roles for the business
    -- 1. Owner Role (All permissions)
    INSERT INTO roles (business_id, name, description, is_system)
    VALUES (v_business_id, 'Owner', 'Unrestricted administrative access to all salon operations', TRUE)
    ON CONFLICT (business_id, name) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO v_owner_role_id;

    -- Grant ALL permissions to Owner
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_owner_role_id, p.id FROM permissions p
    ON CONFLICT DO NOTHING;

    -- 2. Manager Role
    INSERT INTO roles (business_id, name, description, is_system)
    VALUES (v_business_id, 'Manager', 'Day-to-day salon operations, reporting, inventory, and staff oversight', FALSE)
    ON CONFLICT (business_id, name) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO v_manager_role_id;

    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_manager_role_id, p.id FROM permissions p
    WHERE p.code IN (
        'dashboard.view', 'billing.view', 'billing.create', 'billing.edit',
        'customers.view', 'customers.create', 'customers.edit',
        'services.view', 'employees.view', 'reports.view', 'reports.export',
        'settings.view', 'audit.view'
    )
    ON CONFLICT DO NOTHING;

    -- 3. Receptionist / Billing Staff Role
    INSERT INTO roles (business_id, name, description, is_system)
    VALUES (v_business_id, 'Receptionist', 'Front-desk walk-in billing, customer registration, and service catalog lookup', FALSE)
    ON CONFLICT (business_id, name) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO v_receptionist_role_id;

    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_receptionist_role_id, p.id FROM permissions p
    WHERE p.code IN (
        'billing.view', 'billing.create',
        'customers.view', 'customers.create', 'customers.edit',
        'services.view'
    )
    ON CONFLICT DO NOTHING;

    -- 4. Service Staff / Stylist Role
    INSERT INTO roles (business_id, name, description, is_system)
    VALUES (v_business_id, 'Service Staff', 'Assigned service viewing and customer service history', FALSE)
    ON CONFLICT (business_id, name) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO v_staff_role_id;

    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_staff_role_id, p.id FROM permissions p
    WHERE p.code IN ('services.view', 'customers.view')
    ON CONFLICT DO NOTHING;

    -- Service Categories
    INSERT INTO service_categories (business_id, name, display_order)
    VALUES 
        (v_business_id, 'Hair Cut & Styling', 1)
    ON CONFLICT (business_id, name) DO UPDATE SET display_order = EXCLUDED.display_order
    RETURNING id INTO v_cat_hair;

    INSERT INTO service_categories (business_id, name, display_order)
    VALUES 
        (v_business_id, 'Beard & Shaving', 2)
    ON CONFLICT (business_id, name) DO UPDATE SET display_order = EXCLUDED.display_order
    RETURNING id INTO v_cat_beard;

    INSERT INTO service_categories (business_id, name, display_order)
    VALUES 
        (v_business_id, 'Facial & Cleanup', 3)
    ON CONFLICT (business_id, name) DO UPDATE SET display_order = EXCLUDED.display_order
    RETURNING id INTO v_cat_facial;

    INSERT INTO service_categories (business_id, name, display_order)
    VALUES 
        (v_business_id, 'Hair Spa & Treatments', 4)
    ON CONFLICT (business_id, name) DO UPDATE SET display_order = EXCLUDED.display_order
    RETURNING id INTO v_cat_spa;

    -- Popular Services from Reference Catalog
    INSERT INTO services (business_id, category_id, name, price, duration_minutes, audience, commission_rate)
    VALUES
        (v_business_id, v_cat_hair, 'Hair Cut - Essential', 149.00, 30, 'Male', 10.00),
        (v_business_id, v_cat_hair, 'Change of Style & Styling', 199.00, 40, 'Male', 10.00),
        (v_business_id, v_cat_hair, 'Signature Haircut - Women', 349.00, 45, 'Female', 10.00),
        (v_business_id, v_cat_hair, 'Layer Cut - Women', 799.00, 60, 'Female', 12.00),
        (v_business_id, v_cat_beard, 'Beard Sculpt & Shaving', 79.00, 20, 'Male', 10.00),
        (v_business_id, v_cat_beard, 'Classic Shave & Hot Towel', 69.00, 20, 'Male', 10.00),
        (v_business_id, v_cat_facial, 'Charcoal Detox Facial', 699.00, 45, 'Male', 15.00),
        (v_business_id, v_cat_facial, 'Gold Glow Facial - Women', 1499.00, 60, 'Female', 15.00),
        (v_business_id, v_cat_spa, 'Anti-Dandruff Spa Treatment', 1999.00, 60, 'Unisex', 15.00),
        (v_business_id, v_cat_spa, 'Head Oil Massage (30 min)', 299.00, 30, 'Male', 10.00)
    ON CONFLICT DO NOTHING;

END $$;
