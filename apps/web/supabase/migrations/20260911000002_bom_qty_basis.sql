-- ============================================================
-- MANUFACTURING MODULE — BOM QUANTITY BASIS (PERCENT AUTHORING)
-- Version: 1.0
-- Date: 2026-09-11
-- ============================================================
-- Lets a BOM be authored in percent-of-batch terms (formula-style
-- recipes). bom_items.percent is the authored share of the batch;
-- required_qty stays materialized (percent/100 * output_qty) so
-- job cards, explode_bom, and cost rollups work unchanged.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS.
-- ============================================================

ALTER TABLE bom_headers
  ADD COLUMN IF NOT EXISTS qty_basis VARCHAR(20) DEFAULT 'absolute';

ALTER TABLE bom_items
  ADD COLUMN IF NOT EXISTS percent DECIMAL(9,4);
