-- ==============================================================================
-- TRIMZ SALON — INVOICE IMAGE RENDERING & WHATSAPP DELIVERY MIGRATION
-- Migration: 20261010000006_invoice_image_whatsapp.sql
-- ==============================================================================

-- 1. Add image asset tracking to invoices table
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS render_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS rendered_at TIMESTAMPTZ;

-- 2. Create whatsapp_messages table for Meta Cloud API tracking
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    recipient_phone VARCHAR(30) NOT NULL,
    meta_message_id VARCHAR(150) UNIQUE,
    media_id VARCHAR(150),
    caption TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    retry_count INT NOT NULL DEFAULT 0,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes for fast status lookups and idempotency
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_business_status 
ON public.whatsapp_messages(business_id, status);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_invoice 
ON public.whatsapp_messages(invoice_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_meta_id 
ON public.whatsapp_messages(meta_message_id);

-- 4. Enable RLS and tenant security
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_messages_tenant_isolation" ON public.whatsapp_messages
    FOR ALL
    USING (business_id = current_setting('app.current_business_id', true)::uuid);
