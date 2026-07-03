-- Client Communication Table for tracking client calls
-- Run this in Supabase SQL Editor

-- Create client_communication table
CREATE TABLE IF NOT EXISTS client_communication (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  call_received_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  call_entered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  call_type VARCHAR(50) NOT NULL DEFAULT 'Incoming',
  call_category VARCHAR(50) NOT NULL,
  call_category_other VARCHAR(255),
  call_regarding VARCHAR(100) NOT NULL,
  call_regarding_other VARCHAR(255),
  call_brief TEXT,
  next_action TEXT,
  site_visit_id UUID REFERENCES site_visits(id) ON DELETE SET NULL,
  is_site_visit_scheduled BOOLEAN DEFAULT FALSE,
  site_visit_date TIMESTAMP WITH TIME ZONE,
  site_visit_notes TEXT,
  status VARCHAR(50) DEFAULT 'Open',
  priority VARCHAR(20) DEFAULT 'Normal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE client_communication ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON client_communication;

-- Create RLS policy - allow all authenticated users
CREATE POLICY "Enable all access for authenticated users"
  ON client_communication
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_client_communication_client_id ON client_communication(client_id);
CREATE INDEX IF NOT EXISTS idx_client_communication_call_date ON client_communication(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_communication_call_regarding ON client_communication(call_regarding);
CREATE INDEX IF NOT EXISTS idx_client_communication_status ON client_communication(status);
