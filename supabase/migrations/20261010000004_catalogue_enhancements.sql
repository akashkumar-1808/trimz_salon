-- ==============================================================================
-- TRIMZ SALON — MIGRATION 0004: CATALOGUE ENHANCEMENTS
-- Adds department to service_categories, plus variant_name, is_variable_price,
-- and combo_items to services table.
-- ==============================================================================

-- 1. Service Categories: Department column ('Men', 'Women', 'Unisex')
ALTER TABLE public.service_categories
ADD COLUMN IF NOT EXISTS department VARCHAR(50) NOT NULL DEFAULT 'Unisex';

-- 2. Services: Variant name (e.g. 'Short Hair', '30 Min'), variable price flag, and combo items
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS variant_name VARCHAR(100) DEFAULT NULL;

ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS is_variable_price BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS combo_items TEXT DEFAULT NULL;

-- 3. Indexes for fast POS filtering by department and audience
CREATE INDEX IF NOT EXISTS idx_service_categories_dept
ON public.service_categories(business_id, department, is_active);

CREATE INDEX IF NOT EXISTS idx_services_audience_active
ON public.services(business_id, audience, is_active);
