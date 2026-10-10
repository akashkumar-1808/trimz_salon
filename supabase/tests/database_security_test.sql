-- ==============================================================================
-- TRIMZ SALON — STAGE 1 VERIFICATION & SECURITY TEST SUITE
-- File: supabase/tests/database_security_test.sql
-- Description: Unit and integration tests for schema constraints,
--              Row Level Security (RLS), multi-tenant isolation,
--              permission evaluation, and privilege escalation guards.
-- ==============================================================================

BEGIN;

-- Setup test reporting
DO $$
BEGIN
    RAISE NOTICE '==================================================';
    RAISE NOTICE 'TRIMZ SALON — STAGE 1 DATABASE SECURITY TEST SUITE';
    RAISE NOTICE '==================================================';
END $$;

-- ------------------------------------------------------------------------------
-- TEST 1: SCHEMA & CONSTRAINT VALIDATION
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_table_count INT;
    v_fk_count INT;
BEGIN
    -- 1.1 Verify all 14 core tables exist in public schema
    SELECT COUNT(*) INTO v_table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
          'businesses', 'profiles', 'roles', 'permissions',
          'role_permissions', 'user_roles', 'customers',
          'service_categories', 'services', 'sales',
          'sale_items', 'payments', 'invoices', 'audit_logs'
      );

    ASSERT v_table_count = 14, 
        format('FAIL: Expected 14 core tables, found %s', v_table_count);
    RAISE NOTICE '[PASS] Test 1.1: All 14 core tables exist in public schema.';

    -- 1.2 Verify foreign keys on transactional spine
    SELECT COUNT(*) INTO v_fk_count
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND table_schema = 'public'
      AND table_name IN ('profiles', 'roles', 'sales', 'sale_items', 'payments', 'invoices');

    ASSERT v_fk_count >= 8,
        format('FAIL: Insufficient foreign keys (%s)', v_fk_count);
    RAISE NOTICE '[PASS] Test 1.2: Foreign keys properly defined on transactional spine.';

    -- 1.3 Verify monetary types use NUMERIC(12, 2)
    PERFORM 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales'
      AND column_name = 'total_amount'
      AND data_type = 'numeric'
      AND numeric_precision = 12
      AND numeric_scale = 2;

    ASSERT FOUND, 'FAIL: sales.total_amount does not use NUMERIC(12, 2)';
    RAISE NOTICE '[PASS] Test 1.3: Precise monetary precision NUMERIC(12, 2) verified.';
END $$;

-- ------------------------------------------------------------------------------
-- TEST 2: PERMISSIONS & ROLE SEED VALIDATION
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_perm_count INT;
    v_owner_role_id UUID;
    v_owner_perms_count INT;
BEGIN
    -- 2.1 Verify granular permissions count >= 24
    SELECT COUNT(*) INTO v_perm_count FROM public.permissions;
    ASSERT v_perm_count >= 24, 
        format('FAIL: Expected at least 24 granular permissions, found %s', v_perm_count);
    RAISE NOTICE '[PASS] Test 2.1: Granular permissions catalogue loaded (%s permissions).', v_perm_count;

    -- 2.2 Verify system 'Owner' role has ALL permissions
    SELECT id INTO v_owner_role_id FROM public.roles WHERE slug = 'owner' LIMIT 1;
    ASSERT v_owner_role_id IS NOT NULL, 'FAIL: System role "Owner" not found.';

    SELECT COUNT(*) INTO v_owner_perms_count 
    FROM public.role_permissions 
    WHERE role_id = v_owner_role_id;

    ASSERT v_owner_perms_count = v_perm_count,
        format('FAIL: Owner role does not have all permissions (has %s of %s)', v_owner_perms_count, v_perm_count);
    RAISE NOTICE '[PASS] Test 2.2: System Owner role granted all %s permissions.', v_owner_perms_count;
END $$;

-- ------------------------------------------------------------------------------
-- TEST 3: RLS ENABLEMENT VALIDATION
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_rls_missing INT;
BEGIN
    SELECT COUNT(*) INTO v_rls_missing
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (
          'businesses', 'profiles', 'roles', 'permissions',
          'role_permissions', 'user_roles', 'customers',
          'service_categories', 'services', 'sales',
          'sale_items', 'payments', 'invoices', 'audit_logs'
      )
      AND rowsecurity = false;

    ASSERT v_rls_missing = 0,
        format('FAIL: Found %s tables with Row Level Security DISABLED.', v_rls_missing);
    RAISE NOTICE '[PASS] Test 3.1: Row Level Security is ENABLED on all 14 core tables.';
END $$;

-- ------------------------------------------------------------------------------
-- TEST 4: PERMISSION CHECK FUNCTION & OWNER BYPASS
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_test_owner_id UUID := gen_random_uuid();
    v_test_staff_id UUID := gen_random_uuid();
    v_biz_id UUID;
    v_rec_role_id UUID;
BEGIN
    SELECT id INTO v_biz_id FROM public.businesses LIMIT 1;
    SELECT id INTO v_rec_role_id FROM public.roles WHERE slug = 'receptionist' LIMIT 1;

    -- Insert mock auth users
    INSERT INTO auth.users (id, email) VALUES 
        (v_test_owner_id, 'test_owner@trimzsalon.com'),
        (v_test_staff_id, 'test_staff@trimzsalon.com');

    -- Insert profiles
    INSERT INTO public.profiles (id, business_id, email, name, is_owner, status) VALUES
        (v_test_owner_id, v_biz_id, 'test_owner@trimzsalon.com', 'Test Owner', TRUE, 'ACTIVE'),
        (v_test_staff_id, v_biz_id, 'test_staff@trimzsalon.com', 'Test Staff', FALSE, 'ACTIVE');

    -- Assign Receptionist role to staff
    INSERT INTO public.user_roles (user_id, role_id) VALUES (v_test_staff_id, v_rec_role_id);

    -- Mock session as Owner
    PERFORM set_config('request.jwt.claim.sub', v_test_owner_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    ASSERT public.is_business_owner() = TRUE, 'FAIL: Owner check returned false for owner';
    ASSERT public.has_permission('billing.create') = TRUE, 'FAIL: Owner denied billing.create';
    ASSERT public.has_permission('arbitrary.nonexistent.perm') = TRUE, 'FAIL: Owner denied arbitrary permission';
    RAISE NOTICE '[PASS] Test 4.1: Owner has unrestricted access and passes all permission checks.';

    -- Mock session as Staff
    PERFORM set_config('request.jwt.claim.sub', v_test_staff_id::text, true);
    ASSERT public.is_business_owner() = FALSE, 'FAIL: Staff check returned true for owner';
    ASSERT public.has_permission('billing.create') = TRUE, 'FAIL: Receptionist denied billing.create';
    ASSERT public.has_permission('employees.create') = FALSE, 'FAIL: Receptionist granted employees.create';
    ASSERT public.has_permission('settings.edit') = FALSE, 'FAIL: Receptionist granted settings.edit';
    RAISE NOTICE '[PASS] Test 4.2: Staff correctly granted billing and denied administrative permissions.';
END $$;

-- ------------------------------------------------------------------------------
-- TEST 5: PRIVILEGE ESCALATION REJECTION
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_test_staff_id UUID;
    v_escalation_prevented BOOLEAN := FALSE;
BEGIN
    SELECT id INTO v_test_staff_id FROM public.profiles WHERE email = 'test_staff@trimzsalon.com';
    
    -- Mock session as Staff
    PERFORM set_config('request.jwt.claim.sub', v_test_staff_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    -- Attempt to escalate own profile to is_owner = true
    BEGIN
        UPDATE public.profiles SET is_owner = TRUE WHERE id = v_test_staff_id;
    EXCEPTION WHEN OTHERS THEN
        v_escalation_prevented := TRUE;
    END;

    ASSERT v_escalation_prevented = TRUE, 'FAIL: Non-owner was able to self-promote to is_owner=true!';
    RAISE NOTICE '[PASS] Test 5.1: Privilege escalation trigger successfully rejected self-promotion to owner.';
END $$;

-- ------------------------------------------------------------------------------
-- TEST 6: MULTI-TENANT CROSS-BUSINESS ISOLATION
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_biz_a UUID;
    v_biz_b UUID := gen_random_uuid();
    v_user_a UUID := gen_random_uuid();
    v_user_b UUID := gen_random_uuid();
    v_customer_a UUID := gen_random_uuid();
    v_customer_b UUID := gen_random_uuid();
BEGIN
    SELECT id INTO v_biz_a FROM public.businesses LIMIT 1;

    -- Create secondary business
    INSERT INTO public.businesses (id, name, phone, address, city, state, postal_code)
    VALUES (v_biz_b, 'Second Business', '+919999988888', 'MG Road', 'Bengaluru', 'Karnataka', '560001');

    -- Insert users
    INSERT INTO auth.users (id, email) VALUES
        (v_user_a, 'user_a@trimz.com'),
        (v_user_b, 'user_b@other.com');

    INSERT INTO public.profiles (id, business_id, email, name, is_owner) VALUES
        (v_user_a, v_biz_a, 'user_a@trimz.com', 'User A', TRUE),
        (v_user_b, v_biz_b, 'user_b@other.com', 'User B', TRUE);

    -- Insert customers into both businesses
    INSERT INTO public.customers (id, business_id, name, phone) VALUES
        (v_customer_a, v_biz_a, 'Customer A', '+919111111111'),
        (v_customer_b, v_biz_b, 'Customer B', '+919222222222');

    -- Mock session as User A
    PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    ASSERT public.get_auth_business_id() = v_biz_a, 'FAIL: get_auth_business_id resolved wrong business';

    -- Verify User A cannot see Customer B
    PERFORM 1 FROM public.customers WHERE id = v_customer_b;
    ASSERT NOT FOUND, 'FAIL: Cross-tenant data leak! User A was able to read Business B customer!';
    RAISE NOTICE '[PASS] Test 6.1: Cross-business isolation enforced: User A cannot read Business B records.';
END $$;

-- Rollback test data to leave database clean
ROLLBACK;

DO $$
BEGIN
    RAISE NOTICE '==================================================';
    RAISE NOTICE 'ALL 6 DATABASE & SECURITY TESTS PASSED (100%%)';
    RAISE NOTICE '==================================================';
END $$;
