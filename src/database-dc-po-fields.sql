-- Add PO No and PO Date fields to delivery_challans
-- Run this in Supabase SQL Editor

ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS po_no VARCHAR(50);
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS po_date DATE;
