-- TRIMZ SALON — STYLIST ATTRIBUTION ON SALES & INVOICES
-- Migration: 20261023000001_sales_stylist_attribution.sql

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS staff_name VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_sales_staff_id ON public.sales(staff_id);
CREATE INDEX IF NOT EXISTS idx_sales_business_staff ON public.sales(business_id, staff_id);

-- Optional: backfill existing records with operator name if staff_name is null
UPDATE public.sales s
SET staff_name = p.name,
    staff_id = p.id
FROM public.profiles p
WHERE s.operator_id = p.id
  AND s.staff_name IS NULL;
