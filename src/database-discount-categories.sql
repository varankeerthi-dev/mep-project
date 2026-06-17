-- Discount Categories Module
-- Independent from company_variants (variants). Used for bulk discount grouping in quotations.

-- 1. Discount Categories table
CREATE TABLE IF NOT EXISTS discount_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID REFERENCES organisations(id),
  name VARCHAR(100) NOT NULL,
  default_discount_percent DECIMAL(5,2) DEFAULT 0,
  min_discount_percent DECIMAL(5,2) DEFAULT 0,
  max_discount_percent DECIMAL(5,2) DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add organisation_id to existing table (safe to re-run)
ALTER TABLE discount_categories ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id);

ALTER TABLE discount_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "discount_categories_all_access" ON discount_categories;
CREATE POLICY "discount_categories_all_access" ON discount_categories FOR ALL USING (true) WITH CHECK (true);

-- 2. Add discount_category_id to materials
ALTER TABLE materials ADD COLUMN IF NOT EXISTS discount_category_id UUID REFERENCES discount_categories(id);

-- 3. Add discount_category_id to quotation_items (for persistence)
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS discount_category_id UUID REFERENCES discount_categories(id);

-- 4. Add discount_category_id to approval tables
ALTER TABLE discount_approval ADD COLUMN IF NOT EXISTS discount_category_id UUID REFERENCES discount_categories(id);
ALTER TABLE discount_approval_log ADD COLUMN IF NOT EXISTS discount_category_id UUID REFERENCES discount_categories(id);

-- 5. Add discount_category_id to discount_variant_settings (Settings -> Discount Settings, Premium/Bulk/Special)
ALTER TABLE discount_variant_settings ADD COLUMN IF NOT EXISTS discount_category_id UUID REFERENCES discount_categories(id);

-- 5b. Add discount_category_id to quotation_revision_variant_discount (for header discount storage)
ALTER TABLE quotation_revision_variant_discount ADD COLUMN IF NOT EXISTS discount_category_id UUID REFERENCES discount_categories(id);

-- Drop old unique constraint and re-create with partial indexes (PostgreSQL NULL-safe)
ALTER TABLE quotation_revision_variant_discount DROP CONSTRAINT IF EXISTS quotation_revision_variant_discount_quotation_revision_id_variant_id_key;
DROP INDEX IF EXISTS idx_quotation_revision_variant_discount_unique_variant;
DROP INDEX IF EXISTS idx_quotation_revision_variant_discount_unique_dc;
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotation_revision_variant_discount_unique_variant
  ON quotation_revision_variant_discount(quotation_revision_id, variant_id)
  WHERE variant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotation_revision_variant_discount_unique_dc
  ON quotation_revision_variant_discount(quotation_revision_id, discount_category_id)
  WHERE discount_category_id IS NOT NULL;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_materials_discount_category ON materials(discount_category_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_discount_category ON quotation_items(discount_category_id);
CREATE INDEX IF NOT EXISTS idx_discount_approval_discount_category ON discount_approval(discount_category_id);
CREATE INDEX IF NOT EXISTS idx_discount_variant_settings_discount_category ON discount_variant_settings(discount_category_id);
CREATE INDEX IF NOT EXISTS idx_quotation_revision_variant_discount_dc ON quotation_revision_variant_discount(discount_category_id);

-- 7. Insert default discount categories
INSERT INTO discount_categories (name, default_discount_percent, min_discount_percent, max_discount_percent) VALUES
('Standard', 0, 0, 5),
('Wholesale', 10, 0, 15),
('Distributor', 20, 0, 25)
ON CONFLICT DO NOTHING;
