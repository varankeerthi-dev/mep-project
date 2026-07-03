-- Subscriptions Table
-- Tracks organisation subscriptions to pricing plans
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES pricing_plans(id),
  status TEXT NOT NULL DEFAULT 'active', -- active, trialing, past_due, canceled, unpaid
  billing_cycle TEXT NOT NULL DEFAULT 'monthly', -- monthly, annual
  
  -- Payment provider details
  provider TEXT NOT NULL, -- stripe, razorpay
  customer_id TEXT, -- stripe_customer_id or razorpay_customer_id
  subscription_id TEXT, -- stripe_subscription_id or razorpay_subscription_id
  payment_method_id TEXT,
  
  -- Trial details
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  
  -- Billing dates
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  
  -- Cancellation
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one active subscription per organisation
  UNIQUE(organisation_id, status) WHERE status IN ('active', 'trialing')
);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow organisations to view their own subscriptions
CREATE POLICY "Organisations can view own subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations 
      WHERE user_id = auth.uid()
    )
  );

-- Allow service role to manage subscriptions
CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL
  TO service_role
  USING (true);

-- Indexes
CREATE INDEX idx_subscriptions_organisation_id ON subscriptions(organisation_id);
CREATE INDEX idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_provider ON subscriptions(provider);
CREATE INDEX idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX idx_subscriptions_subscription_id ON subscriptions(subscription_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Subscription Events Table (for webhook event tracking)
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- subscription.created, subscription.updated, invoice.paid, etc.
  provider TEXT NOT NULL, -- stripe, razorpay
  provider_event_id TEXT UNIQUE, -- stripe_event_id or razorpay_event_id
  event_data JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage subscription events
CREATE POLICY "Service role can manage subscription events"
  ON subscription_events FOR ALL
  TO service_role
  USING (true);

-- Indexes
CREATE INDEX idx_subscription_events_subscription_id ON subscription_events(subscription_id);
CREATE INDEX idx_subscription_events_event_type ON subscription_events(event_type);
CREATE INDEX idx_subscription_events_provider_event_id ON subscription_events(provider_event_id);
CREATE INDEX idx_subscription_events_processed ON subscription_events(processed) WHERE processed = false;
