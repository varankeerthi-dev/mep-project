-- Migration: 105_site_expenses.sql
-- Description: Creates expense_entries and consumable_catalog tables for Site Expenses module,
--              with pre-seeded consumable catalog items

-- 0. Extend approvals CHECK constraint
ALTER TABLE approvals DROP CONSTRAINT IF EXISTS approvals_approval_type_check;
ALTER TABLE approvals ADD CONSTRAINT approvals_approval_type_check
  CHECK (approval_type IN (
    'PURCHASE_ORDER', 'WORK_ORDER', 'QUOTATION', 'INVOICE',
    'PROFORMA_INVOICE', 'PAYMENT_REQUEST', 'MATERIAL_DISPATCH',
    'SITE_VISIT', 'EXPENSE_CLAIM', 'SITE_REPORT_REQUEST',
    'PURCHASE_PAYMENT', 'SUBCONTRACTOR_PAYMENT',
    'SITE_EXPENSE_REQUEST', 'SITE_EXPENSE_POST_PURCHASE'
  ));

-- 0b. Extend approval_workflows CHECK constraint
ALTER TABLE approval_workflows DROP CONSTRAINT IF EXISTS valid_workflow_approval_type;
ALTER TABLE approval_workflows ADD CONSTRAINT valid_workflow_approval_type
  CHECK (approval_type IN (
    'PURCHASE_ORDER', 'WORK_ORDER', 'QUOTATION', 'INVOICE',
    'PROFORMA_INVOICE', 'PAYMENT_REQUEST', 'MATERIAL_DISPATCH',
    'SITE_VISIT', 'EXPENSE_CLAIM', 'SITE_REPORT_REQUEST',
    'PURCHASE_PAYMENT', 'SUBCONTRACTOR_PAYMENT',
    'SITE_EXPENSE_REQUEST', 'SITE_EXPENSE_POST_PURCHASE'
  ));

-- 1. Create consumable_catalog table (must be before expense_entries due to FK)
CREATE TABLE IF NOT EXISTS consumable_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id) ON DELETE CASCADE NOT NULL,
  name varchar(255) NOT NULL,
  category varchar(50) NOT NULL CHECK (category IN ('Hardware', 'Electrical', 'Consumable Tools', 'Local Purchase', 'Other')),
  unit varchar(50),
  default_rate decimal(10,2),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Create expense_entries table
CREATE TABLE IF NOT EXISTS expense_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  entry_type varchar(50) NOT NULL CHECK (entry_type IN ('SITE_EXPENSE_REQUEST', 'SITE_EXPENSE_POST_PURCHASE')),
  expense_category varchar(50) NOT NULL CHECK (expense_category IN ('consumable', 'crane', 'labour', 'other_party', 'sudden_purchase', 'material')),
  item_type varchar(50) NOT NULL CHECK (item_type IN ('consumable', 'material', 'billable')),
  consumable_catalog_id uuid REFERENCES consumable_catalog(id) ON DELETE SET NULL,
  material_id uuid REFERENCES materials(id) ON DELETE SET NULL,
  description text,
  amount decimal(15,2) NOT NULL DEFAULT 0,
  required_date date,
  payment_method varchar(50) CHECK (payment_method IN ('engineer_paid_own', 'company_cash_to_engineer', 'company_direct')),
  payment_proof text,
  vendor_name varchar(255),
  vendor_gst varchar(50),
  requested_by uuid REFERENCES user_profiles(user_id) ON DELETE SET NULL NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'VERIFIED', 'PAID', 'REJECTED', 'CANCELLED')),
  approval_id uuid REFERENCES approvals(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE expense_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumable_catalog ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for expense_entries
DO $$
DECLARE tbl TEXT := 'expense_entries';
BEGIN
  EXECUTE format('
    DROP POLICY IF EXISTS "Users can view %1$s" ON %1$I;
    CREATE POLICY "Users can view %1$s" ON %1$I FOR SELECT
      USING (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()));
    DROP POLICY IF EXISTS "Users can insert %1$s" ON %1$I;
    CREATE POLICY "Users can insert %1$s" ON %1$I FOR INSERT
      WITH CHECK (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()));
    DROP POLICY IF EXISTS "Users can update %1$s" ON %1$I;
    CREATE POLICY "Users can update %1$s" ON %1$I FOR UPDATE
      USING (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()));
    DROP POLICY IF EXISTS "Users can delete %1$s" ON %1$I;
    CREATE POLICY "Users can delete %1$s" ON %1$I FOR DELETE
      USING (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()));
  ', tbl);
END $$;

-- 5. RLS policies for consumable_catalog
DO $$
DECLARE tbl TEXT := 'consumable_catalog';
BEGIN
  EXECUTE format('
    DROP POLICY IF EXISTS "Users can view %1$s" ON %1$I;
    CREATE POLICY "Users can view %1$s" ON %1$I FOR SELECT
      USING (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()));
    DROP POLICY IF EXISTS "Users can insert %1$s" ON %1$I;
    CREATE POLICY "Users can insert %1$s" ON %1$I FOR INSERT
      WITH CHECK (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()));
    DROP POLICY IF EXISTS "Users can update %1$s" ON %1$I;
    CREATE POLICY "Users can update %1$s" ON %1$I FOR UPDATE
      USING (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()));
    DROP POLICY IF EXISTS "Users can delete %1$s" ON %1$I;
    CREATE POLICY "Users can delete %1$s" ON %1$I FOR DELETE
      USING (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()));
  ', tbl);
END $$;

-- 6. Default approval workflows for the new types
INSERT INTO approval_workflows (approval_type, level, min_amount, max_amount, approver_role, is_active, organisation_id)
SELECT 'SITE_EXPENSE_REQUEST', 1, 0, NULL, 'Manager', true, id FROM organisations
ON CONFLICT DO NOTHING;

INSERT INTO approval_workflows (approval_type, level, min_amount, max_amount, approver_role, is_active, organisation_id)
SELECT 'SITE_EXPENSE_POST_PURCHASE', 1, 0, NULL, 'Manager', true, id FROM organisations
ON CONFLICT DO NOTHING;

-- 7. Pre-seed consumable catalog items (for all existing organisations)
INSERT INTO consumable_catalog (organisation_id, name, category, unit, default_rate, is_active)
SELECT
  o.id,
  v.name,
  v.category,
  v.unit,
  v.default_rate,
  true
FROM organisations o
CROSS JOIN (VALUES
  -- Hardware
  ('Screws (assorted)', 'Hardware', 'box', 150.00),
  ('Nails (assorted)', 'Hardware', 'kg', 80.00),
  ('Bolts & nuts (assorted)', 'Hardware', 'kg', 120.00),
  ('Washers (assorted)', 'Hardware', 'pack', 50.00),
  ('Anchors (wall)', 'Hardware', 'pack', 90.00),
  ('Hinges (door/cabinet)', 'Hardware', 'piece', 35.00),
  ('Locks (door)', 'Hardware', 'piece', 120.00),
  ('Handle (drawer/cabinet)', 'Hardware', 'piece', 25.00),
  ('Clamps (pipe)', 'Hardware', 'piece', 18.00),
  ('Cable ties (assorted)', 'Hardware', 'pack', 60.00),
  ('Drill bits (assorted set)', 'Hardware', 'set', 250.00),
  ('Cutting disc (metal)', 'Hardware', 'piece', 45.00),
  ('Cutting disc (marble)', 'Hardware', 'piece', 65.00),
  ('Grinding wheel', 'Hardware', 'piece', 85.00),
  ('Sandpaper (assorted grit)', 'Hardware', 'pack', 40.00),
  ('Measuring tape (5m)', 'Hardware', 'piece', 120.00),
  ('Spirit level (small)', 'Hardware', 'piece', 180.00),
  ('Chisel (wood/metal)', 'Hardware', 'piece', 95.00),
  ('Hammer (claw)', 'Hardware', 'piece', 220.00),
  ('Wrench set (adjustable)', 'Hardware', 'set', 350.00),
  ('Screwdriver set', 'Hardware', 'set', 180.00),
  ('Pliers (combination)', 'Hardware', 'piece', 140.00),
  ('Allen key set', 'Hardware', 'set', 75.00),
  ('Hacksaw frame + blade', 'Hardware', 'piece', 160.00),
  ('Utility knife + blades', 'Hardware', 'piece', 55.00),
  -- Electrical
  ('PVC insulation tape', 'Electrical', 'roll', 25.00),
  ('Wire connectors (chocolate block)', 'Electrical', 'pack', 35.00),
  ('Cable gland (assorted sizes)', 'Electrical', 'piece', 15.00),
  ('Heat shrink tubing (assorted)', 'Electrical', 'meter', 8.00),
  ('MCB (single pole, 16A/32A)', 'Electrical', 'piece', 180.00),
  ('MCB (double pole, 32A/63A)', 'Electrical', 'piece', 320.00),
  ('Switch (1-way, modular)', 'Electrical', 'piece', 45.00),
  ('Socket (5A/15A, modular)', 'Electrical', 'piece', 65.00),
  ('Indicator light (panel mount)', 'Electrical', 'piece', 20.00),
  ('Push button (momentary)', 'Electrical', 'piece', 30.00),
  ('Relay (8-pin, 12V/24V)', 'Electrical', 'piece', 150.00),
  ('Contactor (25A/40A)', 'Electrical', 'piece', 450.00),
  ('Phase indicator lamp', 'Electrical', 'piece', 85.00),
  ('Voltage tester / Test pen', 'Electrical', 'piece', 50.00),
  ('Multimeter (digital, basic)', 'Electrical', 'piece', 600.00),
  ('Clamp meter (digital)', 'Electrical', 'piece', 1200.00),
  ('Cable (single core, 1.5sqmm)', 'Electrical', 'meter', 12.00),
  ('Cable (single core, 2.5sqmm)', 'Electrical', 'meter', 18.00),
  ('Cable (single core, 4sqmm)', 'Electrical', 'meter', 28.00),
  ('Cable (3-core, 1.5sqmm)', 'Electrical', 'meter', 35.00),
  ('Cable (3-core, 2.5sqmm)', 'Electrical', 'meter', 55.00),
  ('Flexible conduit (16mm/20mm)', 'Electrical', 'meter', 10.00),
  ('Cable lug (ring/fork, assorted)', 'Electrical', 'pack', 45.00),
  ('Cable marker (numeric/alpha)', 'Electrical', 'pack', 30.00),
  ('Terminal block (DIN rail)', 'Electrical', 'piece', 12.00),
  ('DIN rail (35mm, 1m)', 'Electrical', 'meter', 40.00),
  -- Consumable Tools
  ('Safety helmet / Hard hat', 'Consumable Tools', 'piece', 180.00),
  ('Safety goggles', 'Consumable Tools', 'piece', 60.00),
  ('Dust mask (N95)', 'Consumable Tools', 'piece', 15.00),
  ('Safety gloves (cotton)', 'Consumable Tools', 'pair', 25.00),
  ('Safety gloves (rubber)', 'Consumable Tools', 'pair', 45.00),
  ('Safety shoes (basic)', 'Consumable Tools', 'pair', 450.00),
  ('Reflective vest', 'Consumable Tools', 'piece', 120.00),
  ('Safety harness (basic)', 'Consumable Tools', 'piece', 850.00),
  ('Rope (nylon, 10mm, per meter)', 'Consumable Tools', 'meter', 15.00),
  ('Ladder (6ft, aluminium)', 'Consumable Tools', 'piece', 1500.00),
  ('Ladder (10ft, aluminium)', 'Consumable Tools', 'piece', 2200.00),
  ('Scaffolding clamp', 'Consumable Tools', 'piece', 85.00),
  ('Shovel (round point)', 'Consumable Tools', 'piece', 250.00),
  ('Pickaxe', 'Consumable Tools', 'piece', 350.00),
  ('Crowbar', 'Consumable Tools', 'piece', 280.00),
  ('Wheelbarrow', 'Consumable Tools', 'piece', 1800.00),
  ('Bucket (plastic, 20L)', 'Consumable Tools', 'piece', 80.00),
  ('Broom (hard floor)', 'Consumable Tools', 'piece', 60.00),
  ('Mop + bucket set', 'Consumable Tools', 'set', 250.00),
  ('Garbage bags (heavy duty)', 'Consumable Tools', 'pack', 40.00),
  ('Paint brush (1" / 2" / 4")', 'Consumable Tools', 'piece', 20.00),
  ('Paint roller + tray', 'Consumable Tools', 'set', 120.00),
  ('Masking tape (painter)', 'Consumable Tools', 'roll', 35.00),
  -- Local Purchase
  ('PVC pipe (20mm/25mm, 3m)', 'Local Purchase', 'piece', 120.00),
  ('PVC bend (20mm/25mm)', 'Local Purchase', 'piece', 8.00),
  ('PVC coupler (20mm/25mm)', 'Local Purchase', 'piece', 6.00),
  ('PVC end cap (20mm/25mm)', 'Local Purchase', 'piece', 5.00),
  ('PVC glue / solvent', 'Local Purchase', 'piece', 85.00),
  ('G.I. pipe (15mm/20mm, 3m)', 'Local Purchase', 'piece', 350.00),
  ('G.I. elbow (15mm/20mm)', 'Local Purchase', 'piece', 18.00),
  ('G.I. tee (15mm/20mm)', 'Local Purchase', 'piece', 22.00),
  ('G.I. socket (15mm/20mm)', 'Local Purchase', 'piece', 12.00),
  ('Ball valve (PVC, 20mm/25mm)', 'Local Purchase', 'piece', 95.00),
  ('Ball valve (GI, 15mm/20mm)', 'Local Purchase', 'piece', 150.00),
  ('Gate valve (GI, 15mm/20mm)', 'Local Purchase', 'piece', 220.00),
  ('Teflon tape (plumber)', 'Local Purchase', 'roll', 15.00),
  ('Hose pipe (15mm, per meter)', 'Local Purchase', 'meter', 25.00),
  ('Hose clamp (adjustable)', 'Local Purchase', 'piece', 10.00),
  ('Thread sealant / M-seal', 'Local Purchase', 'pack', 30.00),
  ('Epoxy compound (quick fix)', 'Local Purchase', 'pack', 65.00),
  ('Lubricant spray (WD-40)', 'Local Purchase', 'piece', 180.00),
  ('Silicone sealant', 'Local Purchase', 'piece', 120.00),
  ('MS flat bar (25x5mm, per meter)', 'Local Purchase', 'meter', 85.00),
  ('MS angle (25x25x3mm, per meter)', 'Local Purchase', 'meter', 110.00),
  ('Welding electrode (2.5mm/3.15mm)', 'Local Purchase', 'pack', 150.00),
  ('Binding wire (1kg)', 'Local Purchase', 'kg', 55.00),
  ('GI wire (1kg)', 'Local Purchase', 'kg', 70.00),
  ('Expansion bolt (8mm/10mm)', 'Local Purchase', 'piece', 12.00)
) AS v(name, category, unit, default_rate)
ON CONFLICT DO NOTHING;
