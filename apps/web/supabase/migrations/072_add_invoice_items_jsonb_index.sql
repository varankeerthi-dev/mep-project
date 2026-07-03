-- Create functional index on invoice_items meta_json material_id to optimize historical rate lookups
CREATE INDEX IF NOT EXISTS idx_invoice_items_meta_material_id 
  ON invoice_items ((meta_json->>'material_id'));
