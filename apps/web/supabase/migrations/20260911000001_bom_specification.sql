-- ============================================================
-- MANUFACTURING MODULE — BOM SPECIFICATION + DUPLICATE GUARD
-- Version: 1.0
-- Date: 2026-09-11
-- ============================================================
-- Allows multiple BOMs per product differentiated by an optional
-- specification, while blocking exact duplicates (same org +
-- product + specification + revision).
-- Safe to re-run: ADD COLUMN IF NOT EXISTS / IF NOT EXISTS index.
-- ============================================================

ALTER TABLE bom_headers
  ADD COLUMN IF NOT EXISTS specification VARCHAR(200);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bom_headers_org_product_spec_rev
  ON bom_headers (
    organisation_id,
    product_id,
    (COALESCE(specification, '')),
    (COALESCE(revision, ''))
  );
