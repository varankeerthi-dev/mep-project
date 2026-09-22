-- Warranty & Serial Tracking Module — Phase 2: RPCs
-- RPCs for warranty/serial management, GRN serial capture, DC allocation, vendor returns, warranty tracker

-- ============================================================
-- 1. UPDATE MATERIAL WARRANTY SETTINGS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_material_warranty_settings(
  p_material_id uuid,
  p_organisation_id uuid,
  p_has_warranty boolean DEFAULT false,
  p_warranty_period integer DEFAULT NULL,
  p_warranty_unit varchar DEFAULT NULL,
  p_has_serial_number boolean DEFAULT false,
  p_serial_number_format varchar DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_material RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  SELECT * INTO v_material FROM public.materials
  WHERE id = p_material_id AND organisation_id = p_organisation_id;

  IF v_material IS NULL THEN
    RAISE EXCEPTION 'Material not found or unauthorized';
  END IF;

  UPDATE public.materials SET
    has_warranty = p_has_warranty,
    warranty_period = CASE WHEN p_has_warranty THEN p_warranty_period ELSE NULL END,
    warranty_unit = CASE WHEN p_has_warranty THEN p_warranty_unit ELSE NULL END,
    has_serial_number = p_has_serial_number,
    serial_number_format = CASE WHEN p_has_serial_number THEN p_serial_number_format ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_material_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'material_id', p_material_id,
    'has_warranty', p_has_warranty,
    'has_serial_number', p_has_serial_number
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_material_warranty_settings(uuid, uuid, boolean, integer, varchar, boolean, varchar) TO authenticated;

-- ============================================================
-- 2. UPDATE GRN ITEM SERIALS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_grn_item_serials(
  p_grn_item_id uuid,
  p_organisation_id uuid,
  p_serial_number text DEFAULT NULL,
  p_warranty_start_date date DEFAULT NULL,
  p_warranty_end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_grn_item RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  SELECT * INTO v_grn_item FROM public.grn_items
  WHERE id = p_grn_item_id AND organisation_id = p_organisation_id;

  IF v_grn_item IS NULL THEN
    RAISE EXCEPTION 'GRN item not found or unauthorized';
  END IF;

  -- Validate warranty dates
  IF p_warranty_end_date IS NOT NULL AND p_warranty_start_date IS NOT NULL THEN
    IF p_warranty_end_date < p_warranty_start_date THEN
      RAISE EXCEPTION 'Warranty end date must be after start date';
    END IF;
  END IF;

  -- Validate serial number format against material
  IF p_serial_number IS NOT NULL AND TRIM(p_serial_number) != '' THEN
    DECLARE
      v_material RECORD;
      v_format_pattern text;
    BEGIN
      SELECT * INTO v_material FROM public.materials
      WHERE id = v_grn_item.material_id AND organisation_id = p_organisation_id;

      IF v_material IS NOT NULL AND v_material.has_serial_number AND v_material.serial_number_format IS NOT NULL THEN
        -- Convert format pattern to regex
        -- Example: SN-{YYYY}-{####} -> SN-\d{4}-\d{4}
        v_format_pattern := replace(v_material.serial_number_format, '{YYYY}', '\d{4}');
        v_format_pattern := replace(v_format_pattern, '{####}', '\d+');
        v_format_pattern := replace(v_format_pattern, '{###}', '\d{3}');
        v_format_pattern := replace(v_format_pattern, '{##}', '\d{2}');
        v_format_pattern := replace(v_format_pattern, '{#}', '\d');
        
        IF p_serial_number !~ ('^' || v_format_pattern || '$') THEN
          RAISE EXCEPTION 'Serial number does not match required format: %', v_material.serial_number_format;
        END IF;
      END IF;
    END;
  END IF;

  -- Check for duplicate serial number
  IF p_serial_number IS NOT NULL AND TRIM(p_serial_number) != '' THEN
    DECLARE
      v_duplicate_count int;
    BEGIN
      SELECT COUNT(*) INTO v_duplicate_count FROM public.grn_items
      WHERE serial_number = TRIM(p_serial_number)
        AND id != p_grn_item_id
        AND organisation_id = p_organisation_id;
      
      IF v_duplicate_count > 0 THEN
        RAISE EXCEPTION 'Serial number already exists: %', TRIM(p_serial_number);
      END IF;
    END;
  END IF;

  UPDATE public.grn_items SET
    serial_number = CASE WHEN TRIM(p_serial_number) = '' THEN NULL ELSE TRIM(p_serial_number) END,
    warranty_start_date = p_warranty_start_date,
    warranty_end_date = p_warranty_end_date,
    updated_at = NOW()
  WHERE id = p_grn_item_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'grn_item_id', p_grn_item_id,
    'serial_number', TRIM(p_serial_number),
    'warranty_start_date', p_warranty_start_date,
    'warranty_end_date', p_warranty_end_date
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_grn_item_serials(uuid, uuid, text, date, date) TO authenticated;

-- ============================================================
-- 3. ALLOCATE SERIALS TO DC
-- ============================================================

CREATE OR REPLACE FUNCTION public.allocate_serials_to_dc(
  p_dc_item_id uuid,
  p_organisation_id uuid,
  p_serial_numbers text[] DEFAULT NULL,
  p_warranty_start_date date DEFAULT NULL,
  p_warranty_end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_dc_item RECORD;
  v_dc RECORD;
  v_material RECORD;
  v_serial text;
  v_allocated_count int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  -- Get DC item
  SELECT * INTO v_dc_item FROM public.delivery_challan_items
  WHERE id = p_dc_item_id AND organisation_id = p_organisation_id;

  IF v_dc_item IS NULL THEN
    RAISE EXCEPTION 'DC item not found or unauthorized';
  END IF;

  -- Get DC header
  SELECT * INTO v_dc FROM public.delivery_challans
  WHERE id = v_dc_item.delivery_challan_id AND organisation_id = p_organisation_id;

  IF v_dc IS NULL THEN
    RAISE EXCEPTION 'Delivery challan not found or unauthorized';
  END IF;

  -- Get material
  SELECT * INTO v_material FROM public.materials
  WHERE id = v_dc_item.material_id AND organisation_id = p_organisation_id;

  IF v_material IS NULL THEN
    RAISE EXCEPTION 'Material not found';
  END IF;

  -- Validate serial numbers count matches quantity
  IF p_serial_numbers IS NOT NULL AND array_length(p_serial_numbers, 1) IS NOT NULL THEN
    IF array_length(p_serial_numbers, 1) != v_dc_item.quantity THEN
      RAISE EXCEPTION 'Number of serial numbers (%) does not match quantity (%)', array_length(p_serial_numbers, 1), v_dc_item.quantity;
    END IF;
  END IF;

  -- Validate warranty dates
  IF p_warranty_end_date IS NOT NULL AND p_warranty_start_date IS NOT NULL THEN
    IF p_warranty_end_date < p_warranty_start_date THEN
      RAISE EXCEPTION 'Warranty end date must be after start date';
    END IF;
  END IF;

  -- Validate serial number format
  IF p_serial_numbers IS NOT NULL THEN
    FOREACH v_serial IN ARRAY p_serial_numbers
    LOOP
      IF v_material.has_serial_number AND v_material.serial_number_format IS NOT NULL THEN
        DECLARE
          v_format_pattern text;
        BEGIN
          v_format_pattern := replace(v_material.serial_number_format, '{YYYY}', '\d{4}');
          v_format_pattern := replace(v_format_pattern, '{####}', '\d+');
          v_format_pattern := replace(v_format_pattern, '{###}', '\d{3}');
          v_format_pattern := replace(v_format_pattern, '{##}', '\d{2}');
          v_format_pattern := replace(v_format_pattern, '{#}', '\d');
          
          IF v_serial !~ ('^' || v_format_pattern || '$') THEN
            RAISE EXCEPTION 'Serial number does not match required format: %', v_material.serial_number_format;
          END IF;
        END;
      END IF;
      
      -- Check for duplicate serial numbers in DC
      IF EXISTS (
        SELECT 1 FROM public.delivery_challan_items
        WHERE delivery_challan_id = v_dc_item.delivery_challan_id
          AND id != p_dc_item_id
          AND serial_number = v_serial
      ) THEN
        RAISE EXCEPTION 'Serial number already used in this DC: %', v_serial;
      END IF;
      
      v_allocated_count := v_allocated_count + 1;
    END LOOP;
  END IF;

  -- Update DC item with serials
  UPDATE public.delivery_challan_items SET
    serial_number = array_to_string(p_serial_numbers, ', '),
    warranty_start_date = p_warranty_start_date,
    warranty_end_date = p_warranty_end_date,
    updated_at = NOW()
  WHERE id = p_dc_item_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'dc_item_id', p_dc_item_id,
    'allocated_serials', v_allocated_count,
    'warranty_start_date', p_warranty_start_date,
    'warranty_end_date', p_warranty_end_date
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.allocate_serials_to_dc(uuid, uuid, text[], date, date) TO authenticated;

-- ============================================================
-- 4. CREATE VENDOR RETURN
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_vendor_return(
  p_organisation_id uuid,
  p_vendor_id uuid,
  p_grn_id uuid DEFAULT NULL,
  p_purchase_bill_id uuid DEFAULT NULL,
  p_return_number varchar DEFAULT NULL,
  p_return_date date DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_return_type varchar DEFAULT 'credit_note',
  p_items jsonb DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_vendor_return RECORD;
  v_item jsonb;
  v_return_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  -- Validate vendor exists
  IF NOT EXISTS (SELECT 1 FROM public.purchase_vendors WHERE id = p_vendor_id) THEN
    RAISE EXCEPTION 'Vendor not found';
  END IF;

  -- Validate GRN exists if provided
  IF p_grn_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.goods_receipt_notes WHERE id = p_grn_id AND organisation_id = p_organisation_id) THEN
      RAISE EXCEPTION 'GRN not found or unauthorized';
    END IF;
  END IF;

  -- Validate return type
  IF p_return_type NOT IN ('credit_note', 'delivery_challan') THEN
    RAISE EXCEPTION 'Invalid return type. Must be credit_note or delivery_challan';
  END IF;

  -- Create vendor return
  INSERT INTO public.vendor_returns (
    organisation_id, vendor_id, grn_id, purchase_bill_id, return_number,
    return_date, reason, return_type, status, created_by
  ) VALUES (
    p_organisation_id, p_vendor_id, p_grn_id, p_purchase_bill_id,
    p_return_number, COALESCE(p_return_date, CURRENT_DATE), p_reason,
    p_return_type, 'draft', COALESCE(p_created_by, auth.uid())
  )
  RETURNING * INTO v_vendor_return;

  v_return_id := v_vendor_return.id;

  -- Insert vendor return items if provided
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      INSERT INTO public.vendor_return_items (
        vendor_return_id, organisation_id, material_id, grn_item_id,
        serial_number, quantity, unit, batch_no,
        warranty_start_date, warranty_end_date, reason
      ) VALUES (
        v_return_id,
        p_organisation_id,
        (v_item->>'material_id')::uuid,
        (v_item->>'grn_item_id')::uuid,
        v_item->>'serial_number',
        (v_item->>'quantity')::numeric,
        v_item->>'unit',
        v_item->>'batch_no',
        (v_item->>'warranty_start_date')::date,
        (v_item->>'warranty_end_date')::date,
        v_item->>'reason'
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'status', 'success',
    'vendor_return_id', v_return_id,
    'return_number', v_vendor_return.return_number
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_vendor_return(uuid, uuid, uuid, uuid, varchar, date, text, varchar, jsonb, uuid) TO authenticated;

-- ============================================================
-- 5. GET WARRANTY TRACKER DATA
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_warranty_tracker_data(
  p_organisation_id uuid,
  p_filter_customer_id uuid DEFAULT NULL,
  p_filter_item_id uuid DEFAULT NULL,
  p_filter_expiry_days int DEFAULT NULL,
  p_filter_status varchar DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  material_id uuid,
  material_name varchar,
  serial_number varchar,
  warranty_start_date date,
  warranty_end_date date,
  days_remaining int,
  status varchar,
  client_name varchar,
  dc_id uuid,
  dc_number varchar,
  dc_date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    dci.id,
    dci.material_id,
    dci.material_name,
    dci.serial_number,
    dci.warranty_start_date,
    dci.warranty_end_date,
    CASE 
      WHEN dci.warranty_end_date IS NULL THEN NULL
      WHEN dci.warranty_end_date < CURRENT_DATE THEN -1
      ELSE (dci.warranty_end_date - CURRENT_DATE)
    END as days_remaining,
    CASE 
      WHEN dci.warranty_end_date IS NULL THEN 'unknown'
      WHEN dci.warranty_end_date < CURRENT_DATE THEN 'expired'
      WHEN dci.warranty_end_date < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
      ELSE 'active'
    END as status,
    dc.client_name,
    dc.id as dc_id,
    dc.dc_number,
    dc.dc_date
  FROM public.delivery_challan_items dci
  JOIN public.delivery_challans dc ON dc.id = dci.delivery_challan_id
  WHERE dci.organisation_id = p_organisation_id
    AND dci.serial_number IS NOT NULL
    AND (p_filter_customer_id IS NULL OR dc.party_id = p_filter_customer_id)
    AND (p_filter_item_id IS NULL OR dci.material_id = p_filter_item_id)
    AND (p_filter_status IS NULL OR 
      CASE 
        WHEN dci.warranty_end_date IS NULL THEN 'unknown'
        WHEN dci.warranty_end_date < CURRENT_DATE THEN 'expired'
        WHEN dci.warranty_end_date < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
        ELSE 'active'
      END = p_filter_status
    )
    AND (p_filter_expiry_days IS NULL OR 
      (dci.warranty_end_date IS NOT NULL AND 
       dci.warranty_end_date >= CURRENT_DATE AND 
       dci.warranty_end_date <= CURRENT_DATE + (p_filter_expiry_days || ' days')::interval)
    )
  ORDER BY dci.warranty_end_date ASC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_warranty_tracker_data(uuid, uuid, uuid, int, varchar) TO authenticated;
