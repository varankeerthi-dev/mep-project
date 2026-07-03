-- Add missing prefix, padding, suffix, start_number, and current_number columns to document_settings

ALTER TABLE document_settings 
  -- Delivery Challan (DC)
  ADD COLUMN IF NOT EXISTS dc_prefix VARCHAR(20) DEFAULT 'DC',
  ADD COLUMN IF NOT EXISTS dc_start_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS dc_suffix VARCHAR(20) DEFAULT '',
  ADD COLUMN IF NOT EXISTS dc_padding INTEGER DEFAULT 4,
  ADD COLUMN IF NOT EXISTS dc_current_number INTEGER DEFAULT 1,
  
  -- Invoices
  ADD COLUMN IF NOT EXISTS invoice_prefix VARCHAR(20) DEFAULT 'INV',
  ADD COLUMN IF NOT EXISTS invoice_start_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS invoice_suffix VARCHAR(20) DEFAULT '',
  ADD COLUMN IF NOT EXISTS invoice_padding INTEGER DEFAULT 4,
  ADD COLUMN IF NOT EXISTS invoice_current_number INTEGER DEFAULT 1,
  
  -- Quotations
  ADD COLUMN IF NOT EXISTS quotation_prefix VARCHAR(20) DEFAULT 'QT',
  ADD COLUMN IF NOT EXISTS quotation_start_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quotation_suffix VARCHAR(20) DEFAULT '',
  ADD COLUMN IF NOT EXISTS quotation_padding INTEGER DEFAULT 4,
  ADD COLUMN IF NOT EXISTS quotation_current_number INTEGER DEFAULT 1,
  
  -- Non-Billable DC (NB DC)
  ADD COLUMN IF NOT EXISTS nb_dc_prefix VARCHAR(20) DEFAULT 'NBDC',
  ADD COLUMN IF NOT EXISTS nb_dc_start_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nb_dc_suffix VARCHAR(20) DEFAULT '',
  ADD COLUMN IF NOT EXISTS nb_dc_padding INTEGER DEFAULT 4,
  ADD COLUMN IF NOT EXISTS nb_dc_current_number INTEGER DEFAULT 1;
