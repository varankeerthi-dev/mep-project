-- Create client_opening_balances table for storing opening balances per financial year

CREATE TABLE IF NOT EXISTS client_opening_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  financial_year VARCHAR(20) NOT NULL,
  amount DECIMAL(15,2) DEFAULT 0,
  as_of_date DATE,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, organisation_id, financial_year)
);

-- Enable Row Level Security
ALTER TABLE client_opening_balances ENABLE ROW LEVEL SECURITY;

-- Create policy for all access (matching other tables)
DROP POLICY IF EXISTS "Enable all access" ON client_opening_balances;
CREATE POLICY "Enable all access" ON client_opening_balances FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_ob_org_client ON client_opening_balances(organisation_id, client_id);
CREATE INDEX IF NOT EXISTS idx_ob_org_fy ON client_opening_balances(organisation_id, financial_year);
CREATE INDEX IF NOT EXISTS idx_ob_client_fy ON client_opening_balances(client_id, financial_year);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_ob_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_client_opening_balances_updated_at ON client_opening_balances;
CREATE TRIGGER update_client_opening_balances_updated_at
    BEFORE UPDATE ON client_opening_balances
    FOR EACH ROW
    EXECUTE FUNCTION update_ob_updated_at();
