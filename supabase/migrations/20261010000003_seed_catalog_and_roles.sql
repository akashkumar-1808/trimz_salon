-- ==============================================================================
-- TRIMZ SALON — STAGE 1 DATABASE FOUNDATION: SEED DATA & ROLE TEMPLATES
-- Migration: 20261010000003_seed_catalog_and_roles.sql
-- Description: Seed canonical 24 permissions, default business, default
--              system roles (Owner, Manager, Receptionist, Service Staff),
--              and reference service categories.
-- ==============================================================================

-- ==============================================================================
-- 1. SEED GRANULAR PERMISSIONS CATALOGUE
-- ==============================================================================
INSERT INTO public.permissions (code, name, module, description) VALUES
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
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    module = EXCLUDED.module,
    description = EXCLUDED.description;

-- ==============================================================================
-- 2. SEED DEFAULT BUSINESS & ROLES
-- ==============================================================================
DO $$
DECLARE
    v_biz_id UUID;
    v_owner_role_id UUID;
    v_mgr_role_id UUID;
    v_rec_role_id UUID;
    v_staff_role_id UUID;
    v_cat_hair UUID;
    v_cat_beard UUID;
    v_cat_facial UUID;
    v_cat_spa UUID;
BEGIN
    -- 2.1 Default Business
    SELECT id INTO v_biz_id FROM public.businesses WHERE name = 'Trimz Salon' LIMIT 1;
    IF v_biz_id IS NULL THEN
        INSERT INTO public.businesses (
            name, legal_name, phone, email, address, city, state, postal_code, default_tax_rate, bill_prefix
        ) VALUES (
            'Trimz Salon', 
            'Trimz Unisex Salon Private Limited', 
            '+919800011223', 
            'contact@trimzsalon.com', 
            '100 Feet Road, Indiranagar', 
            'Bengaluru', 
            'Karnataka', 
            '560038', 
            5.00, 
            'TZ'
        )
        RETURNING id INTO v_biz_id;
    END IF;

    -- 2.2 Roles Configuration
    -- Role A: Owner (System Role, Unrestricted)
    INSERT INTO public.roles (business_id, name, slug, description, is_system)
    VALUES (v_biz_id, 'Owner', 'owner', 'Unrestricted administrative access to all salon operations', TRUE)
    ON CONFLICT (business_id, slug) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO v_owner_role_id;

    -- Grant ALL permissions to Owner
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_owner_role_id, p.id FROM public.permissions p
    ON CONFLICT DO NOTHING;

    -- Role B: Manager
    INSERT INTO public.roles (business_id, name, slug, description, is_system)
    VALUES (v_biz_id, 'Manager', 'manager', 'Day-to-day salon operations, reporting, inventory, and staff oversight', FALSE)
    ON CONFLICT (business_id, slug) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO v_mgr_role_id;

    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_mgr_role_id, p.id FROM public.permissions p
    WHERE p.code IN (
        'dashboard.view', 'billing.view', 'billing.create', 'billing.edit',
        'customers.view', 'customers.create', 'customers.edit',
        'services.view', 'employees.view', 'reports.view', 'reports.export',
        'settings.view', 'audit.view'
    )
    ON CONFLICT DO NOTHING;

    -- Role C: Receptionist
    INSERT INTO public.roles (business_id, name, slug, description, is_system)
    VALUES (v_biz_id, 'Receptionist', 'receptionist', 'Front-desk walk-in billing, customer registration, and service catalog lookup', FALSE)
    ON CONFLICT (business_id, slug) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO v_rec_role_id;

    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_rec_role_id, p.id FROM public.permissions p
    WHERE p.code IN (
        'billing.view', 'billing.create',
        'customers.view', 'customers.create', 'customers.edit',
        'services.view'
    )
    ON CONFLICT DO NOTHING;

    -- Role D: Service Staff
    INSERT INTO public.roles (business_id, name, slug, description, is_system)
    VALUES (v_biz_id, 'Service Staff', 'service-staff', 'Assigned service viewing and customer service history', FALSE)
    ON CONFLICT (business_id, slug) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO v_staff_role_id;

    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_staff_role_id, p.id FROM public.permissions p
    WHERE p.code IN ('services.view', 'customers.view')
    ON CONFLICT DO NOTHING;

    -- 2.3 Service Categories
    INSERT INTO public.service_categories (business_id, name, slug, display_order)
    VALUES (v_biz_id, 'Hair Cut & Styling', 'hair-cut-styling', 1)
    ON CONFLICT (business_id, slug) DO UPDATE SET display_order = EXCLUDED.display_order
    RETURNING id INTO v_cat_hair;

    INSERT INTO public.service_categories (business_id, name, slug, display_order)
    VALUES (v_biz_id, 'Beard & Shaving', 'beard-shaving', 2)
    ON CONFLICT (business_id, slug) DO UPDATE SET display_order = EXCLUDED.display_order
    RETURNING id INTO v_cat_beard;

    INSERT INTO public.service_categories (business_id, name, slug, display_order)
    VALUES (v_biz_id, 'Facial & Cleanup', 'facial-cleanup', 3)
    ON CONFLICT (business_id, slug) DO UPDATE SET display_order = EXCLUDED.display_order
    RETURNING id INTO v_cat_facial;

    INSERT INTO public.service_categories (business_id, name, slug, display_order)
    VALUES (v_biz_id, 'Hair Spa & Treatments', 'hair-spa-treatments', 4)
    ON CONFLICT (business_id, slug) DO UPDATE SET display_order = EXCLUDED.display_order
    RETURNING id INTO v_cat_spa;

    -- 2.4 Popular Services
    INSERT INTO public.services (business_id, category_id, name, slug, price, duration_minutes, audience, commission_rate)
    VALUES
        (v_biz_id, v_cat_hair, 'Hair Cut - Essential', 'hair-cut-essential', 149.00, 30, 'Male', 10.00),
        (v_biz_id, v_cat_hair, 'Change of Style & Styling', 'change-of-style-styling', 199.00, 40, 'Male', 10.00),
        (v_biz_id, v_cat_hair, 'Signature Haircut - Women', 'signature-haircut-women', 349.00, 45, 'Female', 10.00),
        (v_biz_id, v_cat_hair, 'Layer Cut - Women', 'layer-cut-women', 799.00, 60, 'Female', 12.00),
        (v_biz_id, v_cat_beard, 'Beard Sculpt & Shaving', 'beard-sculpt-shaving', 79.00, 20, 'Male', 10.00),
        (v_biz_id, v_cat_beard, 'Classic Shave & Hot Towel', 'classic-shave-hot-towel', 69.00, 20, 'Male', 10.00),
        (v_biz_id, v_cat_facial, 'Charcoal Detox Facial', 'charcoal-detox-facial', 699.00, 45, 'Male', 15.00),
        (v_biz_id, v_cat_facial, 'Gold Glow Facial - Women', 'gold-glow-facial-women', 1499.00, 60, 'Female', 15.00),
        (v_biz_id, v_cat_spa, 'Anti-Dandruff Spa Treatment', 'anti-dandruff-spa-treatment', 1999.00, 60, 'Unisex', 15.00),
        (v_biz_id, v_cat_spa, 'Head Oil Massage (30 min)', 'head-oil-massage-30-min', 299.00, 30, 'Male', 10.00)
    ON CONFLICT (business_id, slug) DO UPDATE SET price = EXCLUDED.price;

END $$;
