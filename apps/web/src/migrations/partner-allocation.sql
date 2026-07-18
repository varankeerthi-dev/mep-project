-- Partner Allocation Module
-- Run this in Supabase SQL Editor

-- 1. Partner types enum
DO $$ BEGIN
  CREATE TYPE partner_type AS ENUM ('subcontractor', 'individual', 'internal_team', 'franchisee');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Allocation status enum
DO $$ BEGIN
  CREATE TYPE allocation_status AS ENUM ('Pending', 'Accepted', 'Rejected', 'In Progress', 'Completed', 'Verified', 'Reassigned');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Commission type enum
DO $$ BEGIN
  CREATE TYPE commission_type AS ENUM ('fixed', 'percentage');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. Partners table
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  partner_type partner_type NOT NULL DEFAULT 'individual',
  business_name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  gstin TEXT,
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE SET NULL,
  categories TEXT[] DEFAULT '{}',
  service_areas TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_active_jobs INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Lead allocations table
CREATE TABLE IF NOT EXISTS lead_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  status allocation_status NOT NULL DEFAULT 'Pending',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  dispatcher_notes TEXT,
  partner_notes TEXT,
  commission_type commission_type,
  commission_value NUMERIC(12,2),
  estimated_value NUMERIC(12,2) DEFAULT 0,
  created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_partners_organisation_id ON partners(organisation_id);
CREATE INDEX IF NOT EXISTS idx_partners_is_active ON partners(is_active);
CREATE INDEX IF NOT EXISTS idx_partners_subcontractor_id ON partners(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_lead_allocations_organisation_id ON lead_allocations(organisation_id);
CREATE INDEX IF NOT EXISTS idx_lead_allocations_lead_id ON lead_allocations(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_allocations_partner_id ON lead_allocations(partner_id);
CREATE INDEX IF NOT EXISTS idx_lead_allocations_status ON lead_allocations(status);

-- 7. Add referred_to_partner_id to client_communication
ALTER TABLE client_communication ADD COLUMN IF NOT EXISTS referred_to_partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_client_communication_referred_to_partner ON client_communication(referred_to_partner_id);

-- 8. Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_partners_updated_at ON partners;
CREATE TRIGGER set_partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_lead_allocations_updated_at ON lead_allocations;
CREATE TRIGGER set_lead_allocations_updated_at
  BEFORE UPDATE ON lead_allocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. RLS
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_allocations ENABLE ROW LEVEL SECURITY;

-- Partners RLS
CREATE POLICY "partners_org_access" ON partners
  FOR ALL USING (organisation_id IN (SELECT get_user_organisations()));

-- Lead allocations RLS
CREATE POLICY "lead_allocations_org_access" ON lead_allocations
  FOR ALL USING (organisation_id IN (SELECT get_user_organisations()));
