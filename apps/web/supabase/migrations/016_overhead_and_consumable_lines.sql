-- ============================================================
-- MANUFACTURING ENGINE V2 — PHASE 4E & 4F: OVERHEAD & FLAT CONSUMABLE COST LINES
-- Migration: 016_overhead_and_consumable_lines.sql
-- Date: August 13, 2026
-- ============================================================

-- 1. Add BOM Blanket Overhead % to bom_headers
ALTER TABLE bom_headers
  ADD COLUMN IF NOT EXISTS overhead_percentage NUMERIC(6,3) NOT NULL DEFAULT 0.000;

-- 2. Create bom_cost_lines table for flat unmeasured consumable/additional costs (e.g. Grease ₹10, Packaging ₹25)
CREATE TABLE IF NOT EXISTS bom_cost_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID NOT NULL REFERENCES bom_headers(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  sequence_no INT NOT NULL DEFAULT 1,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bom_cost_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for bom_cost_lines" ON bom_cost_lines;
CREATE POLICY "Enable all access for bom_cost_lines" ON bom_cost_lines FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_bom_cost_lines_bom_id ON bom_cost_lines(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_cost_lines_org_id ON bom_cost_lines(organisation_id);
