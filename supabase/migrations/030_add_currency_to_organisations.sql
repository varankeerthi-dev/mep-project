-- Add currency and locale support to organisations table
ALTER TABLE organisations 
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en-IN',
ADD COLUMN IF NOT EXISTS currency_locked BOOLEAN NOT NULL DEFAULT true;

-- Update existing organisations to have INR and en-IN
UPDATE organisations 
SET currency = 'INR', locale = 'en-IN', currency_locked = true
WHERE currency IS NULL OR locale IS NULL;

-- Create supported currencies configuration table
CREATE TABLE IF NOT EXISTS supported_currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE, -- ISO 4217 currency code (INR, USD, etc.)
  symbol TEXT NOT NULL, -- Currency symbol (₹, $, etc.)
  name TEXT NOT NULL, -- Full name (Indian Rupee, US Dollar, etc.)
  locale TEXT NOT NULL, -- Locale for formatting (en-IN, en-US, etc.)
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert supported currencies
INSERT INTO supported_currencies (code, symbol, name, locale, sort_order) VALUES
  ('INR', '₹', 'Indian Rupee', 'en-IN', 1),
  ('USD', '$', 'US Dollar', 'en-US', 2),
  ('AUD', 'A$', 'Australian Dollar', 'en-AU', 3),
  ('CNY', '¥', 'Chinese Yuan', 'zh-CN', 4),
  ('AED', 'د.إ', 'UAE Dirham', 'ar-AE', 5),
  ('SAR', '﷼', 'Saudi Riyal', 'ar-SA', 6)
ON CONFLICT (code) DO NOTHING;

-- Enable RLS on supported_currencies
ALTER TABLE supported_currencies ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Anyone can view supported currencies"
  ON supported_currencies FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Allow service role to manage supported currencies
CREATE POLICY "Service role can manage supported currencies"
  ON supported_currencies FOR ALL
  TO service_role
  USING (true);

-- Add index for lookups
CREATE INDEX idx_supported_currencies_code ON supported_currencies(code);
CREATE INDEX idx_supported_currencies_active ON supported_currencies(is_active) WHERE is_active = true;
