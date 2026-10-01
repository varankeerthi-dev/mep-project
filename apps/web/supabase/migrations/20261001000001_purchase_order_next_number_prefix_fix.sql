-- Fix-forward for 20260929000004 (purchase_order_next_number):
-- stored po_prefix values carry a trailing dash ('PO-'), which produced
-- numbers like 'PO--2026-2027-0001'. Trim it before adding the separator.
-- Also default start/padding when the org has no document_settings row
-- (SELECT INTO leaves them NULL) instead of producing a NULL number.
-- Applied live 2026-10-01 as purchase_order_next_number_prefix_fix.
CREATE OR REPLACE FUNCTION public.purchase_order_next_number(p_organisation_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_fy TEXT;
  v_prefix TEXT := 'PO';
  v_start INT := 1;
  v_padding INT := 4;
  v_count INT;
  v_num TEXT;
BEGIN
  -- Indian financial year: April to March.
  v_fy := CASE
    WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4
      THEN EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || (EXTRACT(YEAR FROM CURRENT_DATE) + 1)::TEXT
    ELSE (EXTRACT(YEAR FROM CURRENT_DATE) - 1)::TEXT || '-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT
  END;

  -- Prefix/start/padding come from the org's document_settings row when present.
  -- Stored prefixes carry their own trailing dash ('PO-'), so it is trimmed
  -- before the separator is added — otherwise numbers render as 'PO--…'.
  BEGIN
    SELECT NULLIF(RTRIM(COALESCE(po_prefix, 'PO'), '-'), ''), COALESCE(po_start_number, 1), COALESCE(po_padding, 4)
      INTO v_prefix, v_start, v_padding
    FROM public.document_settings
    WHERE organisation_id = p_organisation_id
    LIMIT 1;
    -- No settings row: SELECT INTO leaves everything NULL, so default here.
    IF NOT FOUND THEN
      v_prefix := 'PO';
      v_start := 1;
      v_padding := 4;
    END IF;
  EXCEPTION WHEN others THEN
    v_prefix := 'PO';
    v_start := 1;
    v_padding := 4;
  END;
  IF v_prefix IS NULL OR v_prefix = '' THEN
    v_prefix := 'PO';
  END IF;
  IF v_start IS NULL OR v_start < 1 THEN
    v_start := 1;
  END IF;
  IF v_padding IS NULL OR v_padding < 1 THEN
    v_padding := 4;
  END IF;

  -- Max existing sequence for this org, not COUNT(*), so a cancelled or
  -- deleted PO cannot cause a collision.
  SELECT COALESCE(MAX(NULLIF(regexp_replace(po_number, '^[^0-9]*([0-9]+)$', '\1'), '')::INT), 0)
    INTO v_count
  FROM public.purchase_orders
  WHERE organisation_id = p_organisation_id
    AND po_number LIKE v_prefix || '-%';

  -- Start number is a floor, not a multiplier: the next sequence is the greater
  -- of (max existing + 1) and the configured start.
  v_num := v_prefix || '-' || v_fy || '-' || LPAD((GREATEST(v_count + 1, v_start))::TEXT, v_padding, '0');
  RETURN v_num;
END;
$$;
