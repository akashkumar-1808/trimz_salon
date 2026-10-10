-- ==============================================================================
-- TRIMZ SALON — STAGE 1 DATABASE FOUNDATION: CORE SCHEMA
-- Migration: 20261010000001_core_schema.sql
-- Description: Core tenancy, identity profiles, first-class RBAC tables,
--              customer directory, service catalog, and transactional spine
--              (sales, historical snapshots, payments, invoices, audit logs).
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

-- 3. BUSINESS BOUNDARY / TENANCY
CREATE TABLE IF NOT EXISTS public.businesses (
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
    default_tax_rate NUMERIC(5, 2) DEFAULT 5.00 CHECK (default_tax_rate >= 0),
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

-- 4. USER PROFILES (LINKED TO auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    email VARCHAR(120) NOT NULL,
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(20),
    avatar_url TEXT,
    is_owner BOOLEAN NOT NULL DEFAULT FALSE,
    status user_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_profiles_business_email UNIQUE (business_id, email)
);

CREATE INDEX IF NOT EXISTS idx_profiles_business ON public.profiles(business_id, status);

-- 5. ROLES AND PERMISSIONS (FIRST-CLASS RBAC)
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(80) NOT NULL UNIQUE,       -- E.g. 'billing.create', 'reports.view'
    name VARCHAR(120) NOT NULL,
    module VARCHAR(50) NOT NULL,            -- 'dashboard', 'billing', 'customers', etc.
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_permissions_code ON public.permissions(code);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON public.permissions(module);

CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,              -- 'Owner', 'Manager', 'Receptionist', 'Staff'
    slug VARCHAR(80) NOT NULL,              -- 'owner', 'manager', 'receptionist', 'staff'
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE, -- System roles cannot be deleted
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_roles_business_slug UNIQUE (business_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_roles_business ON public.roles(business_id);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);

-- 6. CUSTOMER DIRECTORY
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(20) NOT NULL,             -- Normalized E.164 (+919876543210)
    email VARCHAR(120),
    gender VARCHAR(20) DEFAULT 'Unspecified',
    date_of_birth DATE,
    notes TEXT,
    marketing_opt_in BOOLEAN NOT NULL DEFAULT TRUE,
    -- Summary metrics (derived from transactions)
    total_visits INT NOT NULL DEFAULT 0 CHECK (total_visits >= 0),
    total_spend NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_spend >= 0),
    loyalty_points INT NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0),
    last_visit_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_customers_business_phone UNIQUE (business_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(business_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(business_id, name);

-- 7. SERVICE CATALOG & CATEGORIES
CREATE TABLE IF NOT EXISTS public.service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_service_category_slug UNIQUE (business_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_service_categories_business ON public.service_categories(business_id, display_order);

CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.service_categories(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    duration_minutes INT NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
    audience VARCHAR(20) NOT NULL DEFAULT 'Unisex', -- 'Male', 'Female', 'Unisex'
    commission_rate NUMERIC(5, 2) DEFAULT 0.00 CHECK (commission_rate >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_services_business_slug UNIQUE (business_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(business_id, category_id, is_active);

-- 8. SALES (TRANSACTIONAL SPINE WITH FINANCIAL STATES)
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    operator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    sale_number VARCHAR(50) NOT NULL,
    client_request_id VARCHAR(100),         -- Idempotency key
    status sale_status NOT NULL DEFAULT 'COMPLETED',
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    discount_reason VARCHAR(150),
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    tax_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (tax_percentage >= 0),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_sales_number UNIQUE (business_id, sale_number),
    CONSTRAINT uq_sales_idempotency UNIQUE (business_id, client_request_id)
);

CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales(business_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales(business_id, customer_id);

-- 9. SALE ITEMS (MANDATORY HISTORICAL PRICE SNAPSHOTS)
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    item_type VARCHAR(20) NOT NULL DEFAULT 'service', -- 'service' or 'product'
    service_name_snapshot VARCHAR(150) NOT NULL,
    unit_price_snapshot NUMERIC(12, 2) NOT NULL CHECK (unit_price_snapshot >= 0),
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    total_price NUMERIC(12, 2) NOT NULL CHECK (total_price >= 0),
    commission_rate_snapshot NUMERIC(5, 2) DEFAULT 0.00 CHECK (commission_rate_snapshot >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);

-- 10. PAYMENTS (SEPARATING METHOD FROM PROVIDER)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_method payment_method_enum NOT NULL DEFAULT 'UPI',
    payment_provider VARCHAR(50),           -- 'Google Pay', 'PhonePe', 'Paytm', etc.
    status payment_status NOT NULL DEFAULT 'SUCCESS',
    transaction_reference VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_lookup ON public.payments(business_id, status, payment_method, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_sale ON public.payments(sale_id);

-- 11. INVOICES
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
    invoice_number VARCHAR(50) NOT NULL,
    status invoice_status NOT NULL DEFAULT 'ISSUED',
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    currency VARCHAR(5) NOT NULL DEFAULT 'INR',
    pdf_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_invoices_number UNIQUE (business_id, invoice_number),
    CONSTRAINT uq_invoices_sale UNIQUE (sale_id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_lookup ON public.invoices(business_id, created_at DESC);

-- 12. AUDIT LOGS (IMMUTABLE OPERATIONAL TRACEABILITY)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action VARCHAR(80) NOT NULL,            -- 'SALE_CREATED', 'ROLE_UPDATED', etc.
    entity_name VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    ip_address VARCHAR(45),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_lookup ON public.audit_logs(business_id, created_at DESC);

-- 13. AUTOMATIC updated_at TIMESTAMP TRIGGER
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- Apply to all tables with updated_at columns
CREATE TRIGGER trg_businesses_updated_at BEFORE UPDATE ON public.businesses
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON public.roles
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER trg_service_categories_updated_at BEFORE UPDATE ON public.service_categories
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER trg_services_updated_at BEFORE UPDATE ON public.services
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER trg_sales_updated_at BEFORE UPDATE ON public.sales
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
