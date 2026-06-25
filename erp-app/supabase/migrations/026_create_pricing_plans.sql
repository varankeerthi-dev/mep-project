-- Pricing Plans Table
-- Stores the different pricing tiers (Free, Premium, Elite, Enterprise)
CREATE TABLE IF NOT EXISTS pricing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price_monthly NUMERIC(10, 2) NOT NULL DEFAULT 0,
  price_annual NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  stripe_price_id_monthly TEXT,
  stripe_price_id_annual TEXT,
  razorpay_plan_id_monthly TEXT,
  razorpay_plan_id_annual TEXT,
  trial_days INTEGER DEFAULT 14,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE pricing_plans ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Anyone can view pricing plans"
  ON pricing_plans FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to manage pricing plans
CREATE POLICY "Service role can manage pricing plans"
  ON pricing_plans FOR ALL
  TO service_role
  USING (true);

-- Insert default pricing plans
INSERT INTO pricing_plans (name, slug, description, price_monthly, price_annual, trial_days, sort_order) VALUES
  ('Free', 'free', 'Perfect for getting started', 0, 0, 0, 1),
  ('Premium', 'premium', 'For growing businesses', 999, 9600, 14, 2),
  ('Elite', 'elite', 'For scaling teams', 2499, 24000, 14, 3),
  ('Enterprise', 'enterprise', 'For large organizations', 0, 0, 30, 4)
ON CONFLICT (slug) DO NOTHING;

-- Index for lookups
CREATE INDEX idx_pricing_plans_slug ON pricing_plans(slug);
CREATE INDEX idx_pricing_plans_active ON pricing_plans(is_active) WHERE is_active = true;
