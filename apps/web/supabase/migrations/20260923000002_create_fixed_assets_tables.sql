-- Migration: 20260923000002_create_fixed_assets_tables.sql
-- Description: Create asset_categories and fixed_assets tables (Fixed Asset register) and seed baseline FA accounts and categories.

BEGIN;

-- 1. Create asset_categories table
CREATE TABLE IF NOT EXISTS public.asset_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  gl_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  depreciation_method text NOT NULL DEFAULT 'SLM' CHECK (depreciation_method IN ('SLM', 'WDV')),
  useful_life_years numeric(10,2) NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_asset_categories_org_name UNIQUE (organisation_id, name)
);

-- 2. Create fixed_assets table
CREATE TABLE IF NOT EXISTS public.fixed_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  asset_code text NOT NULL,
  name text NOT NULL,
  asset_category_id uuid REFERENCES public.asset_categories(id) ON DELETE SET NULL,
  gl_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  purchase_bill_id uuid REFERENCES public.purchase_bills(id) ON DELETE SET NULL,
  purchase_bill_item_id uuid REFERENCES public.purchase_bill_items(id) ON DELETE SET NULL,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  vendor_id uuid REFERENCES public.purchase_vendors(id) ON DELETE SET NULL,
  purchase_date date NOT NULL,
  purchase_cost numeric(14,2) NOT NULL,
  taxable_amount numeric(14,2),
  gst_amount numeric(14,2) DEFAULT 0,
  accumulated_depreciation numeric(14,2) NOT NULL DEFAULT 0,
  net_book_value numeric(14,2) NOT NULL,
  location text,
  serial_number text,
  is_depreciable boolean NOT NULL DEFAULT true,
  useful_life_years numeric(10,2),
  depreciation_method text DEFAULT 'SLM',
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISPOSED')),
  disposed_at date,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_fixed_assets_org_asset_code UNIQUE (organisation_id, asset_code)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_asset_categories_org ON public.asset_categories (organisation_id);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_org_code ON public.fixed_assets (organisation_id, asset_code);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_purchase_bill ON public.fixed_assets (purchase_bill_id);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_material ON public.fixed_assets (material_id);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_category ON public.fixed_assets (asset_category_id);

-- 4. Connect materials.asset_category_id foreign key
ALTER TABLE public.materials
  DROP CONSTRAINT IF EXISTS fk_materials_asset_category;
ALTER TABLE public.materials
  ADD CONSTRAINT fk_materials_asset_category
  FOREIGN KEY (asset_category_id) REFERENCES public.asset_categories(id) ON DELETE SET NULL;

-- 5. RLS Policies
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS asset_categories_org_isolation ON public.asset_categories;
CREATE POLICY asset_categories_org_isolation ON public.asset_categories
  FOR ALL USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

DROP POLICY IF EXISTS fixed_assets_org_isolation ON public.fixed_assets;
CREATE POLICY fixed_assets_org_isolation ON public.fixed_assets
  FOR ALL USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

-- 6. Helper: Ensure standard accounts exist for all organizations and seed baseline asset categories
DO $$
DECLARE
  r_org RECORD;
  v_fa_group_id UUID;
  v_fa_fe_id UUID;
  v_fa_pm_id UUID;
  v_fa_mv_id UUID;
  v_fa_te_id UUID;
  v_inv_asset_id UUID;
  v_cogs_id UUID;
BEGIN
  FOR r_org IN SELECT id FROM public.organisations LOOP
    -- Ensure Fixed Assets group & accounts
    v_fa_group_id := public.ensure_gl_account_exists(r_org.id, '1600', 'Fixed Assets', 'Asset');
    UPDATE public.accounts SET is_group = true WHERE id = v_fa_group_id;

    v_fa_fe_id := public.ensure_gl_account_exists(r_org.id, '1610', 'Furniture and Equipment', 'Asset');
    UPDATE public.accounts SET parent_id = v_fa_group_id WHERE id = v_fa_fe_id AND parent_id IS NULL;

    v_fa_pm_id := public.ensure_gl_account_exists(r_org.id, '1620', 'Plant & Machinery', 'Asset');
    UPDATE public.accounts SET parent_id = v_fa_group_id WHERE id = v_fa_pm_id AND parent_id IS NULL;

    v_fa_mv_id := public.ensure_gl_account_exists(r_org.id, '1630', 'Motor Vehicles', 'Asset');
    UPDATE public.accounts SET parent_id = v_fa_group_id WHERE id = v_fa_mv_id AND parent_id IS NULL;

    v_fa_te_id := public.ensure_gl_account_exists(r_org.id, '1640', 'Tools & Equipment', 'Asset');
    UPDATE public.accounts SET parent_id = v_fa_group_id WHERE id = v_fa_te_id AND parent_id IS NULL;

    -- Ensure Inventory Asset & COGS
    v_inv_asset_id := public.ensure_gl_account_exists(r_org.id, '1410', 'Inventory Asset', 'Asset');
    v_cogs_id      := public.ensure_gl_account_exists(r_org.id, '5000', 'Cost of Goods Sold', 'Expense');

    -- Seed baseline asset categories
    INSERT INTO public.asset_categories (organisation_id, name, gl_account_id, depreciation_method, useful_life_years)
    VALUES
      (r_org.id, 'Plant & Machinery', v_fa_pm_id, 'SLM', 15.00),
      (r_org.id, 'Tools & Equipment', v_fa_te_id, 'SLM', 5.00),
      (r_org.id, 'Motor Vehicles', v_fa_mv_id, 'SLM', 8.00),
      (r_org.id, 'Electrical Fixtures', v_fa_fe_id, 'SLM', 10.00),
      (r_org.id, 'Furniture & Fixtures', v_fa_fe_id, 'SLM', 10.00)
    ON CONFLICT (organisation_id, name) DO NOTHING;
  END LOOP;
END $$;

COMMIT;
