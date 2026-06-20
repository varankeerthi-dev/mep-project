-- Migration: Add template_id column to delivery_challans
ALTER TABLE delivery_challans 
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES document_templates(id) ON DELETE SET NULL;

COMMENT ON COLUMN delivery_challans.template_id IS 
  'Selected document template for rendering the Delivery Challan PDF';
