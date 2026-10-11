-- ==============================================================================
-- TRIMZ SALON — PUBLIC SHAREABLE DIGITAL INVOICE SYSTEM
-- Migration: 20261011000001_public_invoice_tokens.sql
-- ==============================================================================

-- 1. Create public_invoice_tokens table for secure token tracking
CREATE TABLE IF NOT EXISTS public.public_invoice_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    view_count INT NOT NULL DEFAULT 0,
    last_viewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for fast token verification and invoice lookups
CREATE INDEX IF NOT EXISTS idx_public_invoice_tokens_hash 
ON public.public_invoice_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_public_invoice_tokens_invoice 
ON public.public_invoice_tokens(invoice_id);

CREATE INDEX IF NOT EXISTS idx_public_invoice_tokens_business 
ON public.public_invoice_tokens(business_id);

-- 3. Enable RLS and tenant security
ALTER TABLE public.public_invoice_tokens ENABLE ROW LEVEL SECURITY;

-- Staff tenant isolation policy
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'public_invoice_tokens' AND policyname = 'public_invoice_tokens_tenant_isolation'
    ) THEN
        CREATE POLICY "public_invoice_tokens_tenant_isolation" ON public.public_invoice_tokens
            FOR ALL
            USING (business_id = current_setting('app.current_business_id', true)::uuid);
    END IF;
END $$;
