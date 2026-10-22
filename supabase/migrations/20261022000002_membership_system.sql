-- TRIMZ SALON — COMPLETE MEMBERSHIP MANAGEMENT & BENEFITS ENGINE MIGRATION
-- Migration: 20261022000002_membership_system.sql

-- 1. Membership Plans
CREATE TABLE IF NOT EXISTS public.membership_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    validity_months INTEGER NOT NULL DEFAULT 12,
    discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    min_spend NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    max_discount_cap NUMERIC(12, 2),
    perks_json JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_biz_plan_slug UNIQUE (business_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_membership_plans_biz ON public.membership_plans(business_id);

-- 2. Membership Benefits (Granular perks per plan)
CREATE TABLE IF NOT EXISTS public.membership_benefits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES public.membership_plans(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    benefit_type VARCHAR(50) NOT NULL, -- PERCENTAGE_DISCOUNT, FIXED_DISCOUNT, COMPLIMENTARY_SERVICE, CATEGORY_DISCOUNT
    discount_percent NUMERIC(5, 2),
    discount_amount NUMERIC(12, 2),
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL,
    usage_limit_type VARCHAR(50) NOT NULL DEFAULT 'UNLIMITED', -- UNLIMITED, TOTAL_MEMBERSHIP, PER_VISIT, PER_MONTH
    usage_limit_value INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_membership_benefits_plan ON public.membership_benefits(plan_id);

-- 3. Customer Memberships (Subscribers)
CREATE TABLE IF NOT EXISTS public.customer_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    plan_id UUID NOT NULL REFERENCES public.membership_plans(id) ON DELETE RESTRICT,
    membership_number VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, PAUSED, EXPIRED, CANCELLED
    start_date TIMESTAMPTZ NOT NULL,
    expiry_date TIMESTAMPTZ NOT NULL,
    original_duration_months INTEGER NOT NULL DEFAULT 12,
    purchase_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'UPI',
    payment_reference VARCHAR(100),
    plan_snapshot JSONB NOT NULL,
    notes TEXT,
    created_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_biz_membership_number UNIQUE (business_id, membership_number)
);

CREATE INDEX IF NOT EXISTS idx_customer_memberships_biz ON public.customer_memberships(business_id);
CREATE INDEX IF NOT EXISTS idx_customer_memberships_cust ON public.customer_memberships(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_memberships_status ON public.customer_memberships(status);
CREATE INDEX IF NOT EXISTS idx_customer_memberships_expiry ON public.customer_memberships(expiry_date);

-- 4. Membership Pause Logs
CREATE TABLE IF NOT EXISTS public.membership_pause_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membership_id UUID NOT NULL REFERENCES public.customer_memberships(id) ON DELETE CASCADE,
    paused_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    resumed_at TIMESTAMPTZ,
    paused_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resumed_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    paused_reason VARCHAR(255),
    resumed_reason VARCHAR(255),
    duration_days_extended INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_pause_logs_membership ON public.membership_pause_logs(membership_id);

-- 5. Membership Usage Ledger
CREATE TABLE IF NOT EXISTS public.membership_usage_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    membership_id UUID NOT NULL REFERENCES public.customer_memberships(id) ON DELETE RESTRICT,
    benefit_id UUID,
    benefit_name VARCHAR(150) NOT NULL,
    benefit_type VARCHAR(50) NOT NULL,
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    sale_item_id UUID REFERENCES public.sale_items(id) ON DELETE SET NULL,
    quantity_used INTEGER NOT NULL DEFAULT 1,
    discount_applied NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_reversal BOOLEAN NOT NULL DEFAULT FALSE,
    reversal_for_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_usage_ledger_membership ON public.membership_usage_ledger(membership_id);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_sale ON public.membership_usage_ledger(sale_id);

-- 6. Add Membership snapshot columns to Sales and Sale Items
ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS customer_membership_id UUID REFERENCES public.customer_memberships(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS membership_discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS manual_discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS membership_snapshot JSONB;

ALTER TABLE public.sale_items
    ADD COLUMN IF NOT EXISTS is_complimentary BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS membership_benefit_id UUID,
    ADD COLUMN IF NOT EXISTS membership_discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00;

-- 7. Seed Permissions
INSERT INTO public.permissions (id, code, name, module, description)
VALUES 
    (gen_random_uuid(), 'memberships.view', 'View Memberships & Plans', 'memberships', 'Inspect membership plans and customer member directories'),
    (gen_random_uuid(), 'memberships.manage', 'Manage Memberships & Plans', 'memberships', 'Create or edit plans, register members, pause/resume, and configure benefits')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to Owner role for all businesses
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'Owner' AND p.code IN ('memberships.view', 'memberships.manage')
ON CONFLICT DO NOTHING;

-- Grant permissions to Manager role for all businesses
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'Manager' AND p.code IN ('memberships.view', 'memberships.manage')
ON CONFLICT DO NOTHING;

-- 8. Seed Canonical Membership Plans for Trimz Salon
DO $$
DECLARE
    v_biz_id UUID;
BEGIN
    SELECT id INTO v_biz_id FROM public.businesses LIMIT 1;
    IF v_biz_id IS NOT NULL THEN
        -- Silver Club
        INSERT INTO public.membership_plans (
            business_id, name, slug, description, price, validity_months, discount_percent, perks_json, is_active, display_order
        ) VALUES (
            v_biz_id,
            'Trimz Silver Club',
            'trimz-silver-club',
            'Entry VIP club with 10% discount on all haircuts & grooming and priority weekend booking',
            2999.00,
            6,
            10.00,
            '["10% off all haircuts & grooming", "Priority weekend booking", "Complimentary hair wash per visit"]'::jsonb,
            TRUE,
            1
        ) ON CONFLICT (business_id, slug) DO NOTHING;

        -- Gold Executive
        INSERT INTO public.membership_plans (
            business_id, name, slug, description, price, validity_months, discount_percent, perks_json, is_active, display_order
        ) VALUES (
            v_biz_id,
            'Trimz Gold Executive',
            'trimz-gold-executive',
            'Executive tier with 15% discount across all services & retail plus complimentary monthly head massage',
            5999.00,
            12,
            15.00,
            '["15% off all services & retail", "1 free Head Massage session per month", "Exclusive festive gift hamper"]'::jsonb,
            TRUE,
            2
        ) ON CONFLICT (business_id, slug) DO NOTHING;

        -- Platinum VIP
        INSERT INTO public.membership_plans (
            business_id, name, slug, description, price, validity_months, discount_percent, perks_json, is_active, display_order
        ) VALUES (
            v_biz_id,
            'Trimz Platinum VIP',
            'trimz-platinum-vip',
            'Ultimate elite membership with 20% off all salon menu items, senior stylist guarantee, and companion perks',
            9999.00,
            12,
            20.00,
            '["20% off all salon menu items", "Dedicated Senior Stylist guarantee", "Unlimited companion express haircuts"]'::jsonb,
            TRUE,
            3
        ) ON CONFLICT (business_id, slug) DO NOTHING;
    END IF;
END $$;
