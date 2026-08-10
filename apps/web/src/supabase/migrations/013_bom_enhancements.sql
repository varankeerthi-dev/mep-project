-- ============================================================
-- MANUFACTURING MODULE — BOM ENHANCEMENTS
-- Version: 1.0
-- Date: 2026-08-10
-- ============================================================
-- Phase 0 schema additions for the BOM enhancement plan.
-- All columns are nullable with safe defaults.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS on every statement.
-- ============================================================

-- bom_headers additions
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS custom_attributes JSONB DEFAULT '{}'::jsonb;
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS total_estimated_cost DECIMAL(14,2) DEFAULT 0;
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS estimated_production_minutes INTEGER DEFAULT 0;
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS revision VARCHAR(20) DEFAULT 'A';
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS effective_date DATE;
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS valid_to DATE;
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS product_code VARCHAR(100);
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS bom_type VARCHAR(20) DEFAULT 'assembly'
  CHECK (bom_type IN ('assembly', 'repetitive', 'formula'));
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS priority VARCHAR(20)
  CHECK (priority IN ('low', 'medium', 'high', 'critical'));
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS product_category VARCHAR(20)
  CHECK (product_category IN ('standard', 'custom', 'prototype'));
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(255);
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS approved_by_name VARCHAR(255);

-- bom_items additions
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS custom_attributes JSONB DEFAULT '{}'::jsonb;
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(14,2) DEFAULT 0;
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS sequence_no INTEGER DEFAULT 0;
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS work_center_id UUID REFERENCES work_centers(id) ON DELETE SET NULL;
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS is_critical BOOLEAN DEFAULT false;
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS alternate_material_id UUID REFERENCES materials(id) ON DELETE SET NULL;
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS drawing_reference VARCHAR(100);
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS inspection_required BOOLEAN DEFAULT false;
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS shelf_life_days INTEGER;
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS scrap_factor DECIMAL(5,2);
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS yield_pct DECIMAL(5,2);
