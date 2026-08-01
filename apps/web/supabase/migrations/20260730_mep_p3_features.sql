-- 1. IPQC Checkpoints (checkpoints defined per BOM sequence)
CREATE TABLE IF NOT EXISTS ipqc_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID NOT NULL REFERENCES bom_headers(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL, -- order in production
  checkpoint_name TEXT NOT NULL, -- e.g. "After Mixing", "Pre-Assembly"
  checkpoint_type TEXT DEFAULT 'mandatory', -- mandatory | optional
  parameter_definitions JSONB, -- [{name, spec, unit, severity}]
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. IPQC Inspections (recorded checks for job card checkpoints)
CREATE TABLE IF NOT EXISTS ipqc_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id UUID NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
  checkpoint_id UUID NOT NULL REFERENCES ipqc_checkpoints(id) ON DELETE CASCADE,
  inspector_id UUID REFERENCES auth.users(id),
  inspection_date TIMESTAMPTZ DEFAULT now(),
  result TEXT DEFAULT 'pending', -- pending | passed | failed | conditional
  parameter_results JSONB, -- [{name, measured_value, is_pass}]
  sampled_qty NUMERIC(12,3),
  total_batch_qty NUMERIC(12,3),
  remarks TEXT,
  organisation_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. WIP Valuation Snapshot (historical tracking table)
CREATE TABLE IF NOT EXISTS wip_valuation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  job_card_id UUID NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  wip_qty NUMERIC(12,3) NOT NULL,
  unit_cost NUMERIC(15,4),
  total_value NUMERIC(15,2),
  days_in_wip INTEGER,
  organisation_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
