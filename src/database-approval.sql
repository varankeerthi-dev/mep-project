-- Phase-2: Discount Approval Engine Database Schema
-- Created for MEP Project Quotation Enhancement

-- 1. Discount Settings Table
CREATE TABLE IF NOT EXISTS discount_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID REFERENCES company_variants(id) ON DELETE CASCADE,
    default_discount_percent DECIMAL(5,2) DEFAULT 0,
    min_discount_percent DECIMAL(5,2) DEFAULT 0,
    max_discount_percent DECIMAL(5,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(variant_id)
);

-- 2. Discount Approval Table
CREATE TABLE IF NOT EXISTS discount_approval (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_revision_id UUID REFERENCES quotation_header(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES company_variants(id) ON DELETE CASCADE,
    role_name VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    action_by_user_id UUID,
    action_by_email VARCHAR(255),
    action_at TIMESTAMPTZ,
    approval_valid_until TIMESTAMPTZ,
    remark TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(quotation_revision_id, variant_id, role_name)
);

-- 3. Discount Approval Log Table (Append-only)
CREATE TABLE IF NOT EXISTS discount_approval_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_revision_id UUID REFERENCES quotation_header(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES company_variants(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    performed_by_user_id UUID,
    performed_by_email VARCHAR(255),
    old_value DECIMAL(5,2),
    new_value DECIMAL(5,2),
    remark TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_discount_approval_quotation ON discount_approval(quotation_revision_id);
CREATE INDEX IF NOT EXISTS idx_discount_approval_variant ON discount_approval(variant_id);
CREATE INDEX IF NOT EXISTS idx_discount_approval_status ON discount_approval(status);
CREATE INDEX IF NOT EXISTS idx_discount_approval_log_quotation ON discount_approval_log(quotation_revision_id);
CREATE INDEX IF NOT EXISTS idx_discount_approval_log_timestamp ON discount_approval_log(timestamp);

-- 5. Add approval fields to quotation_header
ALTER TABLE quotation_header ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'none';
ALTER TABLE quotation_header ADD COLUMN IF NOT EXISTS approval_requested_at TIMESTAMPTZ;
ALTER TABLE quotation_header ADD COLUMN IF NOT EXISTS approval_completed_at TIMESTAMPTZ;

-- 6. Add email tracking to quotation_header
ALTER TABLE quotation_header ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
ALTER TABLE quotation_header ADD COLUMN IF NOT EXISTS email_sent_to VARCHAR(255);
ALTER TABLE quotation_header ADD COLUMN IF NOT EXISTS email_subject VARCHAR(500);
ALTER TABLE quotation_header ADD COLUMN IF NOT EXISTS email_body TEXT;

-- 7. Comments
COMMENT ON TABLE discount_settings IS 'Stores min/max discount limits per variant';
COMMENT ON TABLE discount_approval IS 'Tracks approval status per variant per quotation';
COMMENT ON TABLE discount_approval_log IS 'Audit log for all approval events (append-only)';
