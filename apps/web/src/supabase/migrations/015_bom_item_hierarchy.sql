-- ============================================================
-- MANUFACTURING MODULE — BOM ITEM HIERARCHY (SUB-ASSEMBLIES)
-- Version: 1.0
-- Date: 2026-09-11
-- ============================================================
-- Adds the parent link used by the BOM editor's sub-assembly tree.
-- bom_items.parent_material_id references the parent ITEM row
-- (see BOMEditor addSubMaterial / getFlattenedTree), and
-- bom_headers.parent_bom_id links cloned BOMs to their source.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS on every statement.
-- ============================================================

ALTER TABLE bom_items
  ADD COLUMN IF NOT EXISTS parent_material_id UUID REFERENCES bom_items(id) ON DELETE CASCADE;

ALTER TABLE bom_headers
  ADD COLUMN IF NOT EXISTS parent_bom_id UUID REFERENCES bom_headers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bom_items_parent ON bom_items(parent_material_id);
CREATE INDEX IF NOT EXISTS idx_bom_headers_parent ON bom_headers(parent_bom_id);
