-- Fix: Backfill show_in_bom for ALL existing materials where it's NULL
UPDATE materials SET 
  show_in_bom = true,
  is_manufactured = COALESCE(is_manufactured, false),
  allow_purchase = COALESCE(allow_purchase, true),
  allow_sales = COALESCE(allow_sales, true)
WHERE show_in_bom IS NULL 
   OR is_manufactured IS NULL 
   OR allow_purchase IS NULL 
   OR allow_sales IS NULL;
