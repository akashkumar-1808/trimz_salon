-- ==============================================================================
-- TRIMZ SALON — MIGRATION 0005: SERVICE PAUSE & SOFT DELETE
-- Adds is_deleted to public.services for non-destructive archiving.
-- Preserves all foreign key relationships with sales and invoices.
-- ==============================================================================

ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_services_active_deleted
ON public.services(business_id, is_active, is_deleted);
