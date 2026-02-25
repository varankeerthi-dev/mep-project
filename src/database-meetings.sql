-- ============================================
-- MEETINGS & CLIENT REQUESTS TABLES
-- Run this in Supabase SQL Editor
-- ============================================

-- Meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_name VARCHAR(255) NOT NULL,
  meeting_date DATE NOT NULL,
  meeting_time VARCHAR(20),
  description TEXT,
  location TEXT,
  status VARCHAR(50) DEFAULT 'upcoming',
  participants TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Client Requests table
CREATE TABLE IF NOT EXISTS client_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_name VARCHAR(255) NOT NULL,
  request_date DATE NOT NULL,
  subject VARCHAR(255),
  description TEXT,
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS
ALTER TABLE meetings DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_requests DISABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_client_requests_date ON client_requests(request_date);
CREATE INDEX IF NOT EXISTS idx_client_requests_status ON client_requests(status);
