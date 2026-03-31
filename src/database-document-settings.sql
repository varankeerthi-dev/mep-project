-- Document Settings Table for Number Series Configuration
CREATE TABLE IF NOT EXISTS document_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  
  -- Vendor Number Series
  vendor_prefix VARCHAR(20) DEFAULT 'VEN',
  vendor_start_number INTEGER DEFAULT 1,
  vendor_suffix VARCHAR(20) DEFAULT '',
  vendor_padding INTEGER DEFAULT 3,
  vendor_current_number INTEGER DEFAULT 1,
  
  -- Purchase Order Number Series (for future use)
  po_prefix VARCHAR(20) DEFAULT 'PO',
  po_start_number INTEGER DEFAULT 1,
  po_suffix VARCHAR(20) DEFAULT '',
  po_padding INTEGER DEFAULT 4,
  po_current_number INTEGER DEFAULT 1,
  
  -- Bill Number Series (for future use)
  bill_prefix VARCHAR(20) DEFAULT 'BILL',
  bill_start_number INTEGER DEFAULT 1,
  bill_suffix VARCHAR(20) DEFAULT '',
  bill_padding INTEGER DEFAULT 4,
  bill_current_number INTEGER DEFAULT 1,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(organisation_id)
);

ALTER TABLE document_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON document_settings FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_document_settings_org ON document_settings(organisation_id);

-- Function to get next vendor number
CREATE OR REPLACE FUNCTION get_next_vendor_number(p_org_id UUID)
RETURNS TEXT AS $$
DECLARE
  settings RECORD;
  next_num INTEGER;
  formatted_num TEXT;
BEGIN
  -- Get or create settings
  SELECT * INTO settings FROM document_settings WHERE organisation_id = p_org_id;
  
  IF NOT FOUND THEN
    -- Create default settings
    INSERT INTO document_settings (organisation_id) VALUES (p_org_id)
    ON CONFLICT (organisation_id) DO NOTHING;
    
    settings.vendor_prefix := 'VEN';
    settings.vendor_start_number := 1;
    settings.vendor_suffix := '';
    settings.vendor_padding := 3;
    settings.vendor_current_number := 1;
  END IF;
  
  -- Calculate next number
  next_num := COALESCE(settings.vendor_current_number, settings.vendor_start_number, 1);
  
  -- Format the number
  formatted_num := settings.vendor_prefix || 
                   LPAD(next_num::TEXT, COALESCE(settings.vendor_padding, 3), '0') ||
                   COALESCE(settings.vendor_suffix, '');
  
  -- Increment current number
  UPDATE document_settings 
  SET vendor_current_number = next_num + 1,
      updated_at = NOW()
  WHERE organisation_id = p_org_id;
  
  RETURN formatted_num;
END;
$$ LANGUAGE plpgsql;