-- Production-grade invoice module
-- Supports itemized invoices, lot invoices, and client-specific templates.

CREATE TABLE IF NOT EXISTS invoice_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  layout_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  template_id UUID REFERENCES invoice_templates(id) ON DELETE SET NULL,
  source_type TEXT CHECK (source_type IN ('quotation', 'challan', 'po', 'direct')),
  source_id UUID,
  template_type TEXT NOT NULL CHECK (template_type IN ('standard', 'lot', 'client_custom')),
  mode TEXT NOT NULL CHECK (mode IN ('itemized', 'lot')),
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  cgst NUMERIC(15,2) NOT NULL DEFAULT 0,
  sgst NUMERIC(15,2) NOT NULL DEFAULT 0,
  igst NUMERIC(15,2) NOT NULL DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  hsn_code TEXT,
  qty NUMERIC(15,2) NOT NULL DEFAULT 0,
  rate NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  qty_used NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS default_template_id UUID REFERENCES invoice_templates(id);

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS name TEXT;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS gst_number TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'client_name'
  ) THEN
    EXECUTE 'UPDATE clients SET name = COALESCE(name, client_name) WHERE name IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'gstin'
  ) THEN
    EXECUTE 'UPDATE clients SET gst_number = COALESCE(gst_number, gstin) WHERE gst_number IS NULL';
  END IF;
END $$;

INSERT INTO invoice_templates (name, layout_json)
SELECT 'Standard Invoice', '{"template_type":"standard"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM invoice_templates WHERE name = 'Standard Invoice'
);

INSERT INTO invoice_templates (name, layout_json)
SELECT 'Lot Invoice', '{"template_type":"lot"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM invoice_templates WHERE name = 'Lot Invoice'
);

INSERT INTO invoice_templates (name, layout_json)
SELECT 'Client Custom Invoice', '{"template_type":"client_custom","extra_column_label":"Reference"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM invoice_templates WHERE name = 'Client Custom Invoice'
);

CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_template_id ON invoices(template_id);
CREATE INDEX IF NOT EXISTS idx_invoices_source ON invoices(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_materials_invoice_id ON invoice_materials(invoice_id);
CREATE INDEX IF NOT EXISTS idx_clients_default_template_id ON clients(default_template_id);

ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_templates_all_access" ON invoice_templates;
DROP POLICY IF EXISTS "invoices_all_access" ON invoices;
DROP POLICY IF EXISTS "invoice_items_all_access" ON invoice_items;
DROP POLICY IF EXISTS "invoice_materials_all_access" ON invoice_materials;

CREATE POLICY "invoice_templates_all_access" ON invoice_templates
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "invoices_all_access" ON invoices
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "invoice_items_all_access" ON invoice_items
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "invoice_materials_all_access" ON invoice_materials
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
