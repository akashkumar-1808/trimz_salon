-- TRIMZ SALON — FIX PROFILE PRIVILEGE ESCALATION TRIGGER FOR BACKEND POOLER
-- Migration: 20261022000001_fix_profile_trigger.sql

CREATE OR REPLACE FUNCTION public.check_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Allow backend direct pooler/postgres user or service_role
    IF current_user IN ('postgres', 'supabase_admin') OR auth.role() = 'service_role' THEN
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
