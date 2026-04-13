-- Add Financial Year settings to organisations table
-- Supports both Indian (April-March) and overseas (Jan-Dec) financial years

ALTER TABLE organisations 
ADD COLUMN IF NOT EXISTS financial_year_format VARCHAR(20) DEFAULT 'FY24-25',
ADD COLUMN IF NOT EXISTS financial_year_start_month INTEGER DEFAULT 4,  -- 1=January, 4=April
ADD COLUMN IF NOT EXISTS financial_year_start_day INTEGER DEFAULT 1,   -- Start day of FY
ADD COLUMN IF NOT EXISTS current_financial_year VARCHAR(20) DEFAULT 'FY24-25';  -- Active FY

-- Create updated_at trigger for organisations if not exists
CREATE OR REPLACE FUNCTION update_organisations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_organisations_updated_at ON organisations;
CREATE TRIGGER update_organisations_updated_at
    BEFORE UPDATE ON organisations
    FOR EACH ROW
    EXECUTE FUNCTION update_organisations_updated_at();
