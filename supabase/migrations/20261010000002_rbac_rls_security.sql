-- ==============================================================================
-- TRIMZ SALON — STAGE 1 DATABASE FOUNDATION: RBAC & ROW LEVEL SECURITY
-- Migration: 20261010000002_rbac_rls_security.sql
-- Description: Security Definer helper functions, granular RBAC policies,
--              Row Level Security (RLS) on all 14 tables, multi-tenant isolation,
--              privilege escalation prevention triggers, and audit immutability.
-- ==============================================================================

-- ==============================================================================
-- 1. SECURITY DEFINER HELPER FUNCTIONS
-- ==============================================================================

-- Resolve current authenticated user's business ID
CREATE OR REPLACE FUNCTION public.get_auth_business_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT business_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Check if current authenticated user is the salon owner
CREATE OR REPLACE FUNCTION public.is_business_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT COALESCE(
        (SELECT is_owner FROM public.profiles WHERE id = auth.uid() AND status = 'ACTIVE'),
        false
    );
$$;

-- Check if current user has a specific granular permission
CREATE OR REPLACE FUNCTION public.has_permission(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- 1. Service role bypass
    IF auth.role() = 'service_role' THEN
        RETURN TRUE;
    END IF;

    -- 2. Owner has unrestricted authority across all business modules
    IF (SELECT COALESCE(is_owner, false) FROM public.profiles WHERE id = auth.uid() AND status = 'ACTIVE') THEN
        RETURN TRUE;
    END IF;

    -- 3. Check database-backed role-permission grants
    RETURN EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.profiles pr ON pr.id = ur.user_id AND pr.status = 'ACTIVE'
        JOIN public.roles r ON r.id = ur.role_id
        JOIN public.role_permissions rp ON rp.role_id = r.id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = auth.uid()
          AND r.business_id = pr.business_id
          AND p.code = p_code
    );
END;
$$;

-- ==============================================================================
-- 2. ENABLE ROW LEVEL SECURITY ON ALL EXPOSED BUSINESS TABLES
-- ==============================================================================

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 3. RLS POLICIES: TENANCY & PERMISSION SCOPING
-- ==============================================================================

-- 3.1 BUSINESSES
DROP POLICY IF EXISTS "businesses_select_policy" ON public.businesses;
CREATE POLICY "businesses_select_policy" ON public.businesses
    FOR SELECT TO authenticated
    USING (id = public.get_auth_business_id() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "businesses_update_policy" ON public.businesses;
CREATE POLICY "businesses_update_policy" ON public.businesses
    FOR UPDATE TO authenticated
    USING (id = public.get_auth_business_id() AND public.is_business_owner())
    WITH CHECK (id = public.get_auth_business_id() AND public.is_business_owner());

-- 3.2 PROFILES
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
    FOR SELECT TO authenticated
    USING (business_id = public.get_auth_business_id() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('employees.create')))
    );

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
    FOR UPDATE TO authenticated
    USING (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (id = auth.uid() OR public.is_business_owner() OR public.has_permission('employees.edit')))
    )
    WITH CHECK (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (id = auth.uid() OR public.is_business_owner() OR public.has_permission('employees.edit')))
    );

DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
CREATE POLICY "profiles_delete_policy" ON public.profiles
    FOR DELETE TO authenticated
    USING (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND public.is_business_owner() AND id != auth.uid())
    );

-- 3.3 ROLES
DROP POLICY IF EXISTS "roles_select_policy" ON public.roles;
CREATE POLICY "roles_select_policy" ON public.roles
    FOR SELECT TO authenticated
    USING (business_id = public.get_auth_business_id() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "roles_insert_policy" ON public.roles;
CREATE POLICY "roles_insert_policy" ON public.roles
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('roles.manage')))
    );

DROP POLICY IF EXISTS "roles_update_policy" ON public.roles;
CREATE POLICY "roles_update_policy" ON public.roles
    FOR UPDATE TO authenticated
    USING (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('roles.manage')))
    )
    WITH CHECK (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('roles.manage')))
    );

DROP POLICY IF EXISTS "roles_delete_policy" ON public.roles;
CREATE POLICY "roles_delete_policy" ON public.roles
    FOR DELETE TO authenticated
    USING (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND is_system = FALSE AND (public.is_business_owner() OR public.has_permission('roles.manage')))
    );

-- 3.4 PERMISSIONS (Read-only for all authenticated staff)
DROP POLICY IF EXISTS "permissions_select_policy" ON public.permissions;
CREATE POLICY "permissions_select_policy" ON public.permissions
    FOR SELECT TO authenticated
    USING (TRUE);

-- 3.5 ROLE_PERMISSIONS
DROP POLICY IF EXISTS "role_permissions_select_policy" ON public.role_permissions;
CREATE POLICY "role_permissions_select_policy" ON public.role_permissions
    FOR SELECT TO authenticated
    USING (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.roles r 
            WHERE r.id = role_permissions.role_id 
              AND r.business_id = public.get_auth_business_id()
        )
    );

DROP POLICY IF EXISTS "role_permissions_modify_policy" ON public.role_permissions;
CREATE POLICY "role_permissions_modify_policy" ON public.role_permissions
    FOR ALL TO authenticated
    USING (
        auth.role() = 'service_role' OR
        (
            EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_permissions.role_id AND r.business_id = public.get_auth_business_id())
            AND (public.is_business_owner() OR public.has_permission('roles.manage'))
        )
    )
    WITH CHECK (
        auth.role() = 'service_role' OR
        (
            EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_permissions.role_id AND r.business_id = public.get_auth_business_id())
            AND (public.is_business_owner() OR public.has_permission('roles.manage'))
        )
    );

-- 3.6 USER_ROLES
DROP POLICY IF EXISTS "user_roles_select_policy" ON public.user_roles;
CREATE POLICY "user_roles_select_policy" ON public.user_roles
    FOR SELECT TO authenticated
    USING (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = user_roles.user_id 
              AND p.business_id = public.get_auth_business_id()
        )
    );

DROP POLICY IF EXISTS "user_roles_modify_policy" ON public.user_roles;
CREATE POLICY "user_roles_modify_policy" ON public.user_roles
    FOR ALL TO authenticated
    USING (
        auth.role() = 'service_role' OR
        (
            EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_roles.user_id AND p.business_id = public.get_auth_business_id())
            AND (public.is_business_owner() OR public.has_permission('employees.edit'))
        )
    )
    WITH CHECK (
        auth.role() = 'service_role' OR
        (
            EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_roles.user_id AND p.business_id = public.get_auth_business_id())
            AND (public.is_business_owner() OR public.has_permission('employees.edit'))
        )
    );

-- 3.7 CUSTOMERS
DROP POLICY IF EXISTS "customers_select_policy" ON public.customers;
CREATE POLICY "customers_select_policy" ON public.customers
    FOR SELECT TO authenticated
    USING (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('customers.view')))
    );

DROP POLICY IF EXISTS "customers_insert_policy" ON public.customers;
CREATE POLICY "customers_insert_policy" ON public.customers
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('customers.create')))
    );

DROP POLICY IF EXISTS "customers_update_policy" ON public.customers;
CREATE POLICY "customers_update_policy" ON public.customers
    FOR UPDATE TO authenticated
    USING (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('customers.edit')))
    )
    WITH CHECK (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('customers.edit')))
    );

DROP POLICY IF EXISTS "customers_delete_policy" ON public.customers;
CREATE POLICY "customers_delete_policy" ON public.customers
    FOR DELETE TO authenticated
    USING (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('customers.delete')))
    );

-- 3.8 SERVICE CATEGORIES
DROP POLICY IF EXISTS "service_categories_select_policy" ON public.service_categories;
CREATE POLICY "service_categories_select_policy" ON public.service_categories
    FOR SELECT TO authenticated
    USING (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('services.view')))
    );

DROP POLICY IF EXISTS "service_categories_modify_policy" ON public.service_categories;
CREATE POLICY "service_categories_modify_policy" ON public.service_categories
    FOR ALL TO authenticated
    USING (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('services.create') OR public.has_permission('services.edit')))
    )
    WITH CHECK (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('services.create') OR public.has_permission('services.edit')))
    );

-- 3.9 SERVICES
DROP POLICY IF EXISTS "services_select_policy" ON public.services;
CREATE POLICY "services_select_policy" ON public.services
    FOR SELECT TO authenticated
    USING (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('services.view')))
    );

DROP POLICY IF EXISTS "services_insert_policy" ON public.services;
CREATE POLICY "services_insert_policy" ON public.services
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('services.create')))
    );

DROP POLICY IF EXISTS "services_update_policy" ON public.services;
CREATE POLICY "services_update_policy" ON public.services
    FOR UPDATE TO authenticated
    USING (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('services.edit')))
    )
    WITH CHECK (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('services.edit')))
    );

DROP POLICY IF EXISTS "services_delete_policy" ON public.services;
CREATE POLICY "services_delete_policy" ON public.services
    FOR DELETE TO authenticated
    USING (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('services.delete')))
    );

-- 3.10 SALES
DROP POLICY IF EXISTS "sales_select_policy" ON public.sales;
CREATE POLICY "sales_select_policy" ON public.sales
    FOR SELECT TO authenticated
    USING (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('billing.view')))
    );

DROP POLICY IF EXISTS "sales_insert_policy" ON public.sales;
CREATE POLICY "sales_insert_policy" ON public.sales
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('billing.create')))
    );

DROP POLICY IF EXISTS "sales_update_policy" ON public.sales;
CREATE POLICY "sales_update_policy" ON public.sales
    FOR UPDATE TO authenticated
    USING (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('billing.edit') OR public.has_permission('billing.cancel')))
    )
    WITH CHECK (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('billing.edit') OR public.has_permission('billing.cancel')))
    );

-- 3.11 SALE ITEMS
DROP POLICY IF EXISTS "sale_items_select_policy" ON public.sale_items;
CREATE POLICY "sale_items_select_policy" ON public.sale_items
    FOR SELECT TO authenticated
    USING (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.sales s 
            WHERE s.id = sale_items.sale_id 
              AND s.business_id = public.get_auth_business_id()
              AND (public.is_business_owner() OR public.has_permission('billing.view'))
        )
    );

DROP POLICY IF EXISTS "sale_items_insert_policy" ON public.sale_items;
CREATE POLICY "sale_items_insert_policy" ON public.sale_items
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.sales s 
            WHERE s.id = sale_items.sale_id 
              AND s.business_id = public.get_auth_business_id()
              AND (public.is_business_owner() OR public.has_permission('billing.create'))
        )
    );

-- 3.12 PAYMENTS
DROP POLICY IF EXISTS "payments_select_policy" ON public.payments;
CREATE POLICY "payments_select_policy" ON public.payments
    FOR SELECT TO authenticated
    USING (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('billing.view')))
    );

DROP POLICY IF EXISTS "payments_insert_policy" ON public.payments;
CREATE POLICY "payments_insert_policy" ON public.payments
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('billing.create')))
    );

DROP POLICY IF EXISTS "payments_update_policy" ON public.payments;
CREATE POLICY "payments_update_policy" ON public.payments
    FOR UPDATE TO authenticated
    USING (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('billing.cancel')))
    )
    WITH CHECK (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('billing.cancel')))
    );

-- 3.13 INVOICES
DROP POLICY IF EXISTS "invoices_select_policy" ON public.invoices;
CREATE POLICY "invoices_select_policy" ON public.invoices
    FOR SELECT TO authenticated
    USING (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('billing.view')))
    );

DROP POLICY IF EXISTS "invoices_insert_policy" ON public.invoices;
CREATE POLICY "invoices_insert_policy" ON public.invoices
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('billing.create')))
    );

DROP POLICY IF EXISTS "invoices_update_policy" ON public.invoices;
CREATE POLICY "invoices_update_policy" ON public.invoices
    FOR UPDATE TO authenticated
    USING (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('billing.cancel')))
    )
    WITH CHECK (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('billing.cancel')))
    );

-- 3.14 AUDIT LOGS (STRICTLY IMMUTABLE / APPEND-ONLY)
DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        auth.role() = 'service_role' OR
        (business_id = public.get_auth_business_id() AND (public.is_business_owner() OR public.has_permission('audit.view')))
    );

DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_policy" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.role() = 'service_role' OR
        business_id = public.get_auth_business_id()
    );

-- No UPDATE or DELETE policy exists on audit_logs => PostgreSQL automatically rejects any modification!

-- ==============================================================================
-- 4. PRIVILEGE ESCALATION GUARDS (TRIGGERS)
-- ==============================================================================

-- Guard 1: Prevent non-owner from elevating self to owner or tampering with business binding
CREATE OR REPLACE FUNCTION public.check_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Service role can perform administrative updates
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- If altering is_owner, status, or business_id:
    IF (OLD.is_owner IS DISTINCT FROM NEW.is_owner) OR 
       (OLD.business_id IS DISTINCT FROM NEW.business_id) OR
       (OLD.status IS DISTINCT FROM NEW.status) THEN
        
        -- Caller must be an active owner of the same business
        IF NOT public.is_business_owner() THEN
            RAISE EXCEPTION 'Privilege escalation rejected: Only an active Business Owner can modify roles, status, or tenancy binding.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_profile_privilege_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.check_profile_privilege_escalation();

-- Guard 2: Prevent assigning the 'Owner' role unless performed by an active Owner or service_role
CREATE OR REPLACE FUNCTION public.check_user_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_role_slug VARCHAR(80);
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    SELECT slug INTO v_role_slug FROM public.roles WHERE id = NEW.role_id;
    IF v_role_slug = 'owner' THEN
        IF NOT public.is_business_owner() THEN
            RAISE EXCEPTION 'Privilege escalation rejected: Only an active Business Owner can assign the Owner role.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_role_escalation ON public.user_roles;
CREATE TRIGGER trg_user_role_escalation
    BEFORE INSERT OR UPDATE ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.check_user_role_escalation();

-- Guard 3: Prevent deleting or mutating system roles
CREATE OR REPLACE FUNCTION public.check_system_role_protection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF OLD.is_system = TRUE THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'System integrity violation: System role "%" cannot be deleted.', OLD.name;
        ELSIF TG_OP = 'UPDATE' AND (OLD.slug IS DISTINCT FROM NEW.slug OR OLD.is_system IS DISTINCT FROM NEW.is_system) THEN
            RAISE EXCEPTION 'System integrity violation: System role slug cannot be modified.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_system_role_protection ON public.roles;
CREATE TRIGGER trg_system_role_protection
    BEFORE UPDATE OR DELETE ON public.roles
    FOR EACH ROW
    EXECUTE FUNCTION public.check_system_role_protection();

-- ==============================================================================
-- 5. CONTROLLED OWNER BOOTSTRAP FUNCTION
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.bootstrap_business_owner(
    p_business_id UUID,
    p_user_id UUID,
    p_name TEXT,
    p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_existing_owners INT;
    v_owner_role_id UUID;
    v_user_email VARCHAR(255);
BEGIN
    -- 0. Authorization check: ONLY service_role or an active Business Owner can invoke bootstrap
    IF auth.role() != 'service_role' AND NOT public.is_business_owner() THEN
        RAISE EXCEPTION 'Access denied: bootstrap_business_owner can only be executed by service_role or an active Business Owner.';
    END IF;

    -- 1. Verify user exists in auth.users
    SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;
    IF v_user_email IS NULL THEN
        RAISE EXCEPTION 'Bootstrap error: User ID % not found in auth.users.', p_user_id;
    END IF;

    -- 2. Check if business already has an active owner
    SELECT COUNT(*) INTO v_existing_owners
    FROM public.profiles
    WHERE business_id = p_business_id AND is_owner = TRUE AND status = 'ACTIVE';

    -- If an owner already exists, this function can ONLY be called by an existing owner or service_role
    IF v_existing_owners > 0 THEN
        IF auth.role() != 'service_role' AND NOT public.is_business_owner() THEN
            RAISE EXCEPTION 'Bootstrap rejected: Business already has an active Owner. Only existing Owner or service_role can add additional owners.';
        END IF;
    END IF;

    -- 3. Upsert Profile
    INSERT INTO public.profiles (id, business_id, email, name, phone, is_owner, status)
    VALUES (p_user_id, p_business_id, v_user_email, p_name, p_phone, TRUE, 'ACTIVE')
    ON CONFLICT (id) DO UPDATE SET
        is_owner = TRUE,
        status = 'ACTIVE',
        name = EXCLUDED.name,
        phone = COALESCE(EXCLUDED.phone, profiles.phone),
        updated_at = CURRENT_TIMESTAMP;

    -- 4. Locate and assign the system 'Owner' role
    SELECT id INTO v_owner_role_id
    FROM public.roles
    WHERE business_id = p_business_id AND slug = 'owner';

    IF v_owner_role_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role_id)
        VALUES (p_user_id, v_owner_role_id)
        ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;

    -- 5. Audit log entry
    INSERT INTO public.audit_logs (business_id, user_id, action, entity_name, entity_id, details)
    VALUES (
        p_business_id,
        p_user_id,
        'OWNER_BOOTSTRAPPED',
        'profiles',
        p_user_id,
        jsonb_build_object(
            'email', v_user_email,
            'name', p_name,
            'initial_bootstrap', (v_existing_owners = 0)
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'business_id', p_business_id,
        'user_id', p_user_id,
        'email', v_user_email,
        'is_owner', true
    );
END;
$$;

-- Restrict RPC execution: Revoke execute from PUBLIC, anon, and ordinary authenticated users
REVOKE ALL ON FUNCTION public.bootstrap_business_owner(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_business_owner(UUID, UUID, TEXT, TEXT) TO service_role;
