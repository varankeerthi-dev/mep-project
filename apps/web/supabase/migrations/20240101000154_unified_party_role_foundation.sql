-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: 20240101000154_unified_party_role_foundation.sql
-- Description: Unified Party-Role Master Data Foundation & Legacy Read Compatibility
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE party_role_type AS ENUM ('customer', 'vendor', 'subcontractor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE balance_type AS ENUM ('debit', 'credit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Master Parties Table
CREATE TABLE IF NOT EXISTS parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  gstin VARCHAR(50),
  state VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  contact_person VARCHAR(100),
  address TEXT,
  status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Party Roles Junction Table
CREATE TABLE IF NOT EXISTS party_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  role party_role_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(party_id, role)
);

-- 4. Party Opening Balances
CREATE TABLE IF NOT EXISTS party_opening_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  role party_role_type NOT NULL,
  financial_year VARCHAR(20) NOT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  balance_type balance_type NOT NULL DEFAULT 'debit',
  as_of_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(party_id, role, financial_year, organisation_id)
);

-- 5. Unified Party Search View
CREATE OR REPLACE VIEW v_party_search AS
SELECT 
  p.id AS party_id,
  p.organisation_id,
  p.name AS party_name,
  p.gstin,
  p.state,
  p.email,
  p.phone AS contact,
  array_agg(pr.role::text) AS roles
FROM parties p
JOIN party_roles pr ON pr.party_id = p.id
WHERE p.status = 'Active'
GROUP BY p.id, p.organisation_id, p.name, p.gstin, p.state, p.email, p.phone;

-- Trigram Indexes for Fast Search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_parties_name_trgm ON parties USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_parties_gstin_trgm ON parties USING gin (gstin gin_trgm_ops);

-- 6. Read-Only Compatibility Views for Legacy Modules
CREATE OR REPLACE VIEW v_legacy_clients AS
SELECT p.id, p.organisation_id AS org_id, p.name AS client_name, p.gstin, p.state, p.email, p.phone AS contact
FROM parties p JOIN party_roles pr ON pr.party_id = p.id WHERE pr.role = 'customer';

CREATE OR REPLACE VIEW v_legacy_vendors AS
SELECT p.id, p.organisation_id, p.name AS company_name, p.gstin, p.state, p.email, p.phone
FROM parties p JOIN party_roles pr ON pr.party_id = p.id WHERE pr.role = 'vendor';

CREATE OR REPLACE VIEW v_legacy_subcontractors AS
SELECT p.id, p.organisation_id, p.name AS company_name, p.gstin, p.state, p.email, p.phone
FROM parties p JOIN party_roles pr ON pr.party_id = p.id WHERE pr.role = 'subcontractor';

-- 7. Tenant-Aware Role Validation Helper
CREATE OR REPLACE FUNCTION validate_party_role(
  p_organisation_id UUID,
  p_party_id UUID,
  p_role party_role_type
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM parties p
    JOIN party_roles pr ON pr.party_id = p.id
    WHERE p.id = p_party_id
      AND p.organisation_id = p_organisation_id
      AND pr.role = p_role
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 8. Backfill Migration from Legacy Tables
DO $$
BEGIN
  -- Backfill Clients
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients') THEN
    INSERT INTO parties (id, organisation_id, name, gstin, state, email, phone, created_at)
    SELECT 
      c.id, 
      COALESCE(c.organisation_id, c.org_id), 
      COALESCE(c.client_name, c.name, 'Unnamed Client'), 
      c.gstin, c.state, c.email, c.contact, NOW()
    FROM clients c
    WHERE COALESCE(c.organisation_id, c.org_id) IS NOT NULL
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, gstin = EXCLUDED.gstin, state = EXCLUDED.state;

    INSERT INTO party_roles (party_id, role)
    SELECT p.id, 'customer'::party_role_type
    FROM parties p
    WHERE EXISTS (SELECT 1 FROM clients c WHERE c.id = p.id)
    ON CONFLICT (party_id, role) DO NOTHING;
  END IF;

  -- Backfill Purchase Vendors
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_vendors') THEN
    INSERT INTO parties (id, organisation_id, name, gstin, state, email, phone, contact_person, created_at)
    SELECT 
      v.id, v.organisation_id, v.company_name, v.gstin, v.state, v.email, v.phone, v.contact_person, NOW()
    FROM purchase_vendors v
    WHERE v.organisation_id IS NOT NULL
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, gstin = EXCLUDED.gstin, state = EXCLUDED.state;

    INSERT INTO party_roles (party_id, role)
    SELECT p.id, 'vendor'::party_role_type
    FROM parties p
    WHERE EXISTS (SELECT 1 FROM purchase_vendors v WHERE v.id = p.id)
    ON CONFLICT (party_id, role) DO NOTHING;
  END IF;

  -- Backfill Subcontractors
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subcontractors') THEN
    INSERT INTO parties (id, organisation_id, name, gstin, state, email, phone, contact_person, created_at)
    SELECT 
      s.id, s.organisation_id, s.company_name, s.gstin, s.state, s.email, s.phone, s.contact_person, NOW()
    FROM subcontractors s
    WHERE s.organisation_id IS NOT NULL
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, gstin = EXCLUDED.gstin, state = EXCLUDED.state;

    INSERT INTO party_roles (party_id, role)
    SELECT p.id, 'subcontractor'::party_role_type
    FROM parties p
    WHERE EXISTS (SELECT 1 FROM subcontractors s WHERE s.id = p.id)
    ON CONFLICT (party_id, role) DO NOTHING;
  END IF;
END $$;
