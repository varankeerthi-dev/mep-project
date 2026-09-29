-- Migration: Warehouse Stock Requests & Fulfillment Core Tables
-- File: apps/web/supabase/migrations/20260927000001_stock_request_tables.sql

-- 1. stock_requests (Request Header)
CREATE TABLE IF NOT EXISTS stock_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    request_number text NOT NULL,
    destination_warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    requested_by uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE RESTRICT,
    requested_at timestamptz NOT NULL DEFAULT now(),
    required_date date,
    priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent','critical')),
    status text NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft',
        'submitted',
        'under_process',
        'partially_allocated',
        'allocated',
        'awaiting_dispatch',
        'partially_dispatched',
        'in_transit',
        'partially_received',
        'fulfilled',
        'cancelled',
        'closed'
    )),
    revision_number int NOT NULL DEFAULT 0,
    remarks text,
    idempotency_key text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    submitted_at timestamptz,
    cancelled_at timestamptz,
    cancelled_by uuid REFERENCES user_profiles(user_id) ON DELETE SET NULL,
    cancellation_reason text,
    CONSTRAINT uq_stock_requests_org_reqno UNIQUE(organisation_id, request_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_requests_idem ON stock_requests(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_requests_org_status ON stock_requests(organisation_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_requests_org_dest ON stock_requests(organisation_id, destination_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_requests_org_reqno ON stock_requests(organisation_id, request_number);

-- 2. stock_request_lines (Request Line Items)
CREATE TABLE IF NOT EXISTS stock_request_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    request_id uuid NOT NULL REFERENCES stock_requests(id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    company_variant_id uuid REFERENCES company_variants(id) ON DELETE RESTRICT,
    requested_qty numeric NOT NULL CHECK (requested_qty > 0),
    allocated_qty numeric NOT NULL DEFAULT 0 CHECK (allocated_qty >= 0),
    dispatched_qty numeric NOT NULL DEFAULT 0 CHECK (dispatched_qty >= 0),
    received_qty numeric NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
    notes text,
    line_number int NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_stock_req_line_allocated CHECK (allocated_qty <= requested_qty),
    CONSTRAINT chk_stock_req_line_dispatched CHECK (dispatched_qty <= allocated_qty),
    CONSTRAINT chk_stock_req_line_received CHECK (received_qty <= dispatched_qty)
);

CREATE INDEX IF NOT EXISTS idx_stock_req_lines_reqid ON stock_request_lines(request_id);
CREATE INDEX IF NOT EXISTS idx_stock_req_lines_org_item ON stock_request_lines(organisation_id, item_id);
CREATE INDEX IF NOT EXISTS idx_stock_req_lines_variant ON stock_request_lines(company_variant_id);

-- 3. stock_request_allocations (Fulfillment Allocations)
CREATE TABLE IF NOT EXISTS stock_request_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    request_line_id uuid NOT NULL REFERENCES stock_request_lines(id) ON DELETE CASCADE,
    request_id uuid NOT NULL REFERENCES stock_requests(id) ON DELETE CASCADE,
    source_warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    item_id uuid NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    company_variant_id uuid REFERENCES company_variants(id) ON DELETE RESTRICT,
    allocated_qty numeric NOT NULL CHECK (allocated_qty > 0),
    dispatched_qty numeric NOT NULL DEFAULT 0 CHECK (dispatched_qty >= 0),
    received_qty numeric NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
    released_qty numeric NOT NULL DEFAULT 0 CHECK (released_qty >= 0),
    status text NOT NULL DEFAULT 'confirmed' CHECK (status IN (
        'confirmed',
        'partially_dispatched',
        'dispatched',
        'partially_received',
        'received',
        'released',
        'cancelled'
    )),
    allocated_by uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE RESTRICT,
    allocated_at timestamptz NOT NULL DEFAULT now(),
    transfer_id uuid REFERENCES stock_transfers(id) ON DELETE SET NULL,
    notes text,
    reason text,
    idempotency_key text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_stock_req_alloc_dispatched CHECK (dispatched_qty <= allocated_qty),
    CONSTRAINT chk_stock_req_alloc_received CHECK (received_qty <= dispatched_qty),
    CONSTRAINT chk_stock_req_alloc_released CHECK (released_qty <= allocated_qty - dispatched_qty)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_request_alloc_idem ON stock_request_allocations(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_req_alloc_lineid ON stock_request_allocations(request_line_id);
CREATE INDEX IF NOT EXISTS idx_stock_req_alloc_reqid ON stock_request_allocations(request_id);
CREATE INDEX IF NOT EXISTS idx_stock_req_alloc_org_src ON stock_request_allocations(organisation_id, source_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_req_alloc_org_item_src ON stock_request_allocations(organisation_id, item_id, company_variant_id, source_warehouse_id);

-- 4. stock_request_activity_log (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS stock_request_activity_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    request_id uuid NOT NULL REFERENCES stock_requests(id) ON DELETE CASCADE,
    request_line_id uuid REFERENCES stock_request_lines(id) ON DELETE SET NULL,
    allocation_id uuid REFERENCES stock_request_allocations(id) ON DELETE SET NULL,
    event_type text NOT NULL,
    actor_id uuid REFERENCES user_profiles(user_id) ON DELETE SET NULL,
    actor_name text,
    source_warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL,
    destination_warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL,
    item_id uuid REFERENCES materials(id) ON DELETE SET NULL,
    company_variant_id uuid REFERENCES company_variants(id) ON DELETE SET NULL,
    quantity numeric,
    before_status text,
    after_status text,
    before_qty numeric,
    after_qty numeric,
    reference_type text,
    reference_id uuid,
    remarks text,
    metadata jsonb DEFAULT '{}',
    idempotency_key text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_req_log_reqid ON stock_request_activity_log(request_id);
CREATE INDEX IF NOT EXISTS idx_stock_req_log_org_created ON stock_request_activity_log(organisation_id, created_at DESC);

-- 5. Row Level Security Policies
ALTER TABLE stock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_request_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_request_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_request_activity_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stock_requests' AND policyname = 'stock_requests_policy_select') THEN
        CREATE POLICY "stock_requests_policy_select" ON stock_requests FOR SELECT USING (user_can_access_org(organisation_id));
        CREATE POLICY "stock_requests_policy_insert" ON stock_requests FOR INSERT WITH CHECK (user_can_access_org(organisation_id));
        CREATE POLICY "stock_requests_policy_update" ON stock_requests FOR UPDATE USING (user_can_access_org(organisation_id));
        CREATE POLICY "stock_requests_policy_delete" ON stock_requests FOR DELETE USING (user_can_access_org(organisation_id) AND status = 'draft');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stock_request_lines' AND policyname = 'stock_request_lines_policy_select') THEN
        CREATE POLICY "stock_request_lines_policy_select" ON stock_request_lines FOR SELECT USING (user_can_access_org(organisation_id));
        CREATE POLICY "stock_request_lines_policy_insert" ON stock_request_lines FOR INSERT WITH CHECK (user_can_access_org(organisation_id));
        CREATE POLICY "stock_request_lines_policy_update" ON stock_request_lines FOR UPDATE USING (user_can_access_org(organisation_id));
        CREATE POLICY "stock_request_lines_policy_delete" ON stock_request_lines FOR DELETE USING (user_can_access_org(organisation_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stock_request_allocations' AND policyname = 'stock_request_allocations_policy_select') THEN
        CREATE POLICY "stock_request_allocations_policy_select" ON stock_request_allocations FOR SELECT USING (user_can_access_org(organisation_id));
        CREATE POLICY "stock_request_allocations_policy_insert" ON stock_request_allocations FOR INSERT WITH CHECK (user_can_access_org(organisation_id));
        CREATE POLICY "stock_request_allocations_policy_update" ON stock_request_allocations FOR UPDATE USING (user_can_access_org(organisation_id));
        CREATE POLICY "stock_request_allocations_policy_delete" ON stock_request_allocations FOR DELETE USING (user_can_access_org(organisation_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stock_request_activity_log' AND policyname = 'stock_request_activity_log_policy_select') THEN
        CREATE POLICY "stock_request_activity_log_policy_select" ON stock_request_activity_log FOR SELECT USING (user_can_access_org(organisation_id));
        CREATE POLICY "stock_request_activity_log_policy_insert" ON stock_request_activity_log FOR INSERT WITH CHECK (user_can_access_org(organisation_id));
        CREATE POLICY "stock_request_activity_log_policy_update" ON stock_request_activity_log FOR UPDATE USING (user_can_access_org(organisation_id));
        CREATE POLICY "stock_request_activity_log_policy_delete" ON stock_request_activity_log FOR DELETE USING (user_can_access_org(organisation_id));
    END IF;
END $$;

-- 6. Seed Permissions
INSERT INTO permissions (key, description) VALUES
    ('stock_requests.read', 'Read stock requests'),
    ('stock_requests.create', 'Create stock requests'),
    ('stock_requests.update', 'Update stock requests'),
    ('stock_requests.delete', 'Delete draft stock requests'),
    ('stock_requests.submit', 'Submit stock requests'),
    ('stock_requests.allocate', 'Allocate stock requests'),
    ('stock_requests.dispatch', 'Dispatch stock requests'),
    ('stock_requests.receive', 'Receive stock requests'),
    ('stock_requests.cancel', 'Cancel stock requests'),
    ('stock_requests.release_allocation', 'Release stock request allocation')
ON CONFLICT (key) DO NOTHING;

-- Grant permissions to default roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.key LIKE 'stock_requests.%'
  AND r.name IN ('Admin', 'Owner', 'Warehouse Manager')
ON CONFLICT DO NOTHING;

-- 7. Seed Number Series Defaults
INSERT INTO domain_number_series (organisation_id, series_key, prefix, padding, next_number, active)
SELECT o.id, 'WSR', 'WSR-', 5, 1, true
FROM organisations o
ON CONFLICT (organisation_id, series_key) DO NOTHING;
