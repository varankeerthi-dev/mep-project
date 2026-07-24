-- Operational Governance System Migration (Modules 1, 2, 4, 5)
-- Date: 2026-07-23

-- ----------------------------------------------------------------------------
-- 1. Field Variation Intents (Module 1: "Ghost Work" Prevention)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS field_variation_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID,
    project_id UUID,
    site_engineer_id UUID,
    site_engineer_name TEXT,
    client_rep_name TEXT NOT NULL,
    client_rep_phone TEXT,
    client_rep_email TEXT,
    scope_description TEXT NOT NULL,
    estimated_cost DECIMAL(12, 2) DEFAULT 0.00,
    photo_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
    status TEXT NOT NULL DEFAULT 'pending_acknowledgment' CHECK (status IN ('pending_acknowledgment', 'acknowledged', 'pm_overridden', 'rejected')),
    acknowledged_at TIMESTAMPTZ,
    client_signature_url TEXT,
    pm_override_by UUID,
    pm_override_reason TEXT,
    pm_overridden_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for field_variation_intents
ALTER TABLE field_variation_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users in org" ON field_variation_intents
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 2. Material Return Handshakes (Module 2: 2-Step Handshake)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS material_return_handshakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID,
    project_id UUID,
    warehouse_id UUID,
    site_engineer_id UUID,
    site_engineer_name TEXT,
    storekeeper_id UUID,
    storekeeper_name TEXT,
    item_id UUID,
    material_name TEXT NOT NULL,
    uom TEXT DEFAULT 'NOS',
    requested_qty DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    received_good_qty DECIMAL(12, 2) DEFAULT 0.00,
    received_scrap_qty DECIMAL(12, 2) DEFAULT 0.00,
    claimed_condition TEXT NOT NULL DEFAULT 'good' CHECK (claimed_condition IN ('good', 'scrap', 'mixed')),
    verified_condition TEXT CHECK (verified_condition IN ('good', 'scrap', 'mixed_verified')),
    scrap_reason_code TEXT,
    scrap_photo_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
    status TEXT NOT NULL DEFAULT 'in_transit' CHECK (status IN ('in_transit', 'verified_good', 'verified_scrap', 'rejected_by_storekeeper')),
    remarks TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    verified_at TIMESTAMPTZ
);

-- RLS Policies for material_return_handshakes
ALTER TABLE material_return_handshakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users in org" ON material_return_handshakes
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 3. Vendor Dispute Logs (Module 4: Warranty Claim Date Snapshot & Dispute Tracking)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vendor_dispute_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID,
    vendor_id UUID,
    equipment_name TEXT NOT NULL,
    serial_number TEXT,
    invoice_date DATE,
    commissioning_date DATE,
    warranty_expiry_date DATE,
    claim_reference_no TEXT,
    dispute_reason_code TEXT NOT NULL CHECK (dispute_reason_code IN ('improper_storage', 'power_surge', 'expired_window', 'unauthorized_installation', 'other')),
    dispute_details TEXT,
    status TEXT NOT NULL DEFAULT 'under_dispute' CHECK (status IN ('under_dispute', 'accepted_by_vendor', 'rejected_by_vendor', 'settled_with_discount')),
    recorded_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for vendor_dispute_logs
ALTER TABLE vendor_dispute_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users in org" ON vendor_dispute_logs
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 4. DC Line Allocations (Module 5: Line-Item Level DC Reconciliation)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dc_line_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID,
    dc_header_id UUID,
    dc_number TEXT,
    material_id UUID,
    material_name TEXT NOT NULL,
    delivered_qty DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    allocated_qty DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    unit_rate DECIMAL(12, 2) DEFAULT 0.00,
    quotation_id UUID,
    invoice_id UUID,
    status TEXT DEFAULT 'allocated' CHECK (status IN ('pending', 'allocated', 'reconciled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for dc_line_allocations
ALTER TABLE dc_line_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users in org" ON dc_line_allocations
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
