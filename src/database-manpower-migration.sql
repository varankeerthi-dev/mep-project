-- ============================================
-- MANPOWER-BASED SUBCONTRACTOR SYSTEM MIGRATION
-- ============================================
-- This migration replaces the basic subcontractor_attendance table
-- with a comprehensive manpower-based billing system
-- ============================================

-- Step 1: Drop old subcontractor_attendance table
DROP TABLE IF EXISTS subcontractor_attendance CASCADE;

-- ============================================
-- LABOUR CATEGORIES
-- ============================================
-- Defines types of workers (Mason, Carpenter, Electrician, etc.)
CREATE TABLE IF NOT EXISTS labour_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE,
  description TEXT,
  base_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) DEFAULT 'day', -- 'day', 'hour', 'piece'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE labour_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Organisations can view their labour categories" ON labour_categories;
DROP POLICY IF EXISTS "Organisations can insert their labour categories" ON labour_categories;
DROP POLICY IF EXISTS "Organisations can update their labour categories" ON labour_categories;
DROP POLICY IF EXISTS "Organisations can delete their labour categories" ON labour_categories;
CREATE POLICY "Organisations can view their labour categories" 
  ON labour_categories FOR SELECT 
  USING (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()));
CREATE POLICY "Organisations can insert their labour categories" 
  ON labour_categories FOR INSERT 
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()));
CREATE POLICY "Organisations can update their labour categories" 
  ON labour_categories FOR UPDATE 
  USING (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()));
CREATE POLICY "Organisations can delete their labour categories" 
  ON labour_categories FOR DELETE 
  USING (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()));

DROP INDEX IF EXISTS idx_labour_categories_org;
DROP INDEX IF EXISTS idx_labour_categories_active;
CREATE INDEX idx_labour_categories_org ON labour_categories(organisation_id);
CREATE INDEX idx_labour_categories_active ON labour_categories(organisation_id, is_active);

-- ============================================
-- RATE CARDS
-- ============================================
-- Negotiated rates for labour categories per subcontractor/work unit
CREATE TABLE IF NOT EXISTS rate_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  work_unit_id UUID, -- Optional: specific to a work unit
  labour_category_id UUID REFERENCES labour_categories(id) ON DELETE CASCADE,
  base_rate DECIMAL(10,2) NOT NULL,
  negotiated_rate DECIMAL(10,2) NOT NULL, -- Editable post-entry
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT true,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(subcontractor_id, labour_category_id, work_unit_id, effective_from)
);

ALTER TABLE rate_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Organisations can view their rate cards" ON rate_cards;
DROP POLICY IF EXISTS "Organisations can insert their rate cards" ON rate_cards;
DROP POLICY IF EXISTS "Organisations can update their rate cards" ON rate_cards;
DROP POLICY IF EXISTS "Organisations can delete their rate cards" ON rate_cards;
CREATE POLICY "Organisations can view their rate cards" 
  ON rate_cards FOR SELECT 
  USING (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()));
CREATE POLICY "Organisations can insert their rate cards" 
  ON rate_cards FOR INSERT 
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()));
CREATE POLICY "Organisations can update their rate cards" 
  ON rate_cards FOR UPDATE 
  USING (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()));
CREATE POLICY "Organisations can delete their rate cards" 
  ON rate_cards FOR DELETE 
  USING (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()));

DROP INDEX IF EXISTS idx_rate_cards_org;
DROP INDEX IF EXISTS idx_rate_cards_subcontractor;
DROP INDEX IF EXISTS idx_rate_cards_labour_category;
DROP INDEX IF EXISTS idx_rate_cards_work_unit;
DROP INDEX IF EXISTS idx_rate_cards_effective;
CREATE INDEX idx_rate_cards_org ON rate_cards(organisation_id);
CREATE INDEX idx_rate_cards_subcontractor ON rate_cards(subcontractor_id);
CREATE INDEX idx_rate_cards_labour_category ON rate_cards(labour_category_id);
CREATE INDEX idx_rate_cards_work_unit ON rate_cards(work_unit_id);
CREATE INDEX idx_rate_cards_effective ON rate_cards(effective_from, effective_to);

-- ============================================
-- CONTEXT MODIFIERS
-- ============================================
-- Multipliers for risk, shift, location, etc.
CREATE TABLE IF NOT EXISTS context_modifiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE,
  modifier_type VARCHAR(50) NOT NULL, -- 'RISK', 'SHIFT', 'LOCATION', 'SKILL', 'OTHER'
  multiplier DECIMAL(5,3) NOT NULL DEFAULT 1.0, -- e.g., 1.5 for 50% increase
  is_percentage BOOLEAN DEFAULT true, -- true = percentage multiplier, false = fixed amount
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE context_modifiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Organisations can view their context modifiers" ON context_modifiers;
DROP POLICY IF EXISTS "Organisations can insert their context modifiers" ON context_modifiers;
DROP POLICY IF EXISTS "Organisations can update their context modifiers" ON context_modifiers;
DROP POLICY IF EXISTS "Organisations can delete their context modifiers" ON context_modifiers;
CREATE POLICY "Organisations can view their context modifiers" 
  ON context_modifiers FOR SELECT 
  USING (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()));
CREATE POLICY "Organisations can insert their context modifiers" 
  ON context_modifiers FOR INSERT 
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()));
CREATE POLICY "Organisations can update their context modifiers" 
  ON context_modifiers FOR UPDATE 
  USING (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()));
CREATE POLICY "Organisations can delete their context modifiers" 
  ON context_modifiers FOR DELETE 
  USING (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()));

DROP INDEX IF EXISTS idx_context_modifiers_org;
DROP INDEX IF EXISTS idx_context_modifiers_type;
DROP INDEX IF EXISTS idx_context_modifiers_active;
CREATE INDEX idx_context_modifiers_org ON context_modifiers(organisation_id);
CREATE INDEX idx_context_modifiers_type ON context_modifiers(modifier_type);
CREATE INDEX idx_context_modifiers_active ON context_modifiers(organisation_id, is_active);

-- ============================================
-- MANPOWER ATTENDANCE
-- ============================================
-- Daily attendance with category breakdown and context modifiers
CREATE TABLE IF NOT EXISTS manpower_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  work_unit_id UUID, -- Links to project or work order
  work_unit_type VARCHAR(50), -- 'PROJECT', 'ALTERATION', 'AMC', 'WORK_ORDER'
  attendance_date DATE NOT NULL,
  labour_category_id UUID REFERENCES labour_categories(id) ON DELETE CASCADE,
  workers_count INTEGER NOT NULL DEFAULT 1,
  hours_worked DECIMAL(5,2) DEFAULT 8, -- For hourly rates
  supervisor_name VARCHAR(100),
  applied_modifiers UUID[], -- Array of context modifier IDs
  base_rate DECIMAL(10,2) NOT NULL, -- Rate at time of entry
  adjusted_rate DECIMAL(10,2) NOT NULL, -- After modifiers
  original_amount DECIMAL(12,2) NOT NULL, -- base_rate * workers_count
  adjusted_amount DECIMAL(12,2) NOT NULL, -- adjusted_rate * workers_count
  remarks TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'DRAFT', -- 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE manpower_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Organisations can view their manpower attendance" ON manpower_attendance;
DROP POLICY IF EXISTS "Organisations can insert their manpower attendance" ON manpower_attendance;
DROP POLICY IF EXISTS "Organisations can update their manpower attendance" ON manpower_attendance;
DROP POLICY IF EXISTS "Organisations can delete their manpower attendance" ON manpower_attendance;
CREATE POLICY "Organisations can view their manpower attendance" 
  ON manpower_attendance FOR SELECT 
  USING (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()));
CREATE POLICY "Organisations can insert their manpower attendance" 
  ON manpower_attendance FOR INSERT 
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()));
CREATE POLICY "Organisations can update their manpower attendance" 
  ON manpower_attendance FOR UPDATE 
  USING (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()));
CREATE POLICY "Organisations can delete their manpower attendance" 
  ON manpower_attendance FOR DELETE 
  USING (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()));

DROP INDEX IF EXISTS idx_manpower_attendance_org;
DROP INDEX IF EXISTS idx_manpower_attendance_subcontractor;
DROP INDEX IF EXISTS idx_manpower_attendance_date;
DROP INDEX IF EXISTS idx_manpower_attendance_work_unit;
DROP INDEX IF EXISTS idx_manpower_attendance_labour_category;
DROP INDEX IF EXISTS idx_manpower_attendance_status;
CREATE INDEX idx_manpower_attendance_org ON manpower_attendance(organisation_id);
CREATE INDEX idx_manpower_attendance_subcontractor ON manpower_attendance(subcontractor_id);
CREATE INDEX idx_manpower_attendance_date ON manpower_attendance(attendance_date);
CREATE INDEX idx_manpower_attendance_work_unit ON manpower_attendance(work_unit_id);
CREATE INDEX idx_manpower_attendance_labour_category ON manpower_attendance(labour_category_id);
CREATE INDEX idx_manpower_attendance_status ON manpower_attendance(status);

-- ============================================
-- MANPOWER BILLING
-- ============================================
-- Calculated bills with original vs adjusted rate comparison
CREATE TABLE IF NOT EXISTS manpower_billing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  work_unit_id UUID,
  work_unit_type VARCHAR(50),
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  attendance_entries UUID[], -- Array of manpower_attendance IDs
  total_original_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_adjusted_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_difference DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'INR',
  status VARCHAR(50) DEFAULT 'DRAFT', -- 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'CANCELLED'
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  payment_id UUID REFERENCES subcontractor_payments(id),
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE manpower_billing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Organisations can view their manpower billing" ON manpower_billing;
DROP POLICY IF EXISTS "Organisations can insert their manpower billing" ON manpower_billing;
DROP POLICY IF EXISTS "Organisations can update their manpower billing" ON manpower_billing;
DROP POLICY IF EXISTS "Organisations can delete their manpower billing" ON manpower_billing;
CREATE POLICY "Organisations can view their manpower billing" 
  ON manpower_billing FOR SELECT 
  USING (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()));
CREATE POLICY "Organisations can insert their manpower billing" 
  ON manpower_billing FOR INSERT 
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()));
CREATE POLICY "Organisations can update their manpower billing" 
  ON manpower_billing FOR UPDATE 
  USING (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()));
CREATE POLICY "Organisations can delete their manpower billing" 
  ON manpower_billing FOR DELETE 
  USING (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()));

DROP INDEX IF EXISTS idx_manpower_billing_org;
DROP INDEX IF EXISTS idx_manpower_billing_subcontractor;
DROP INDEX IF EXISTS idx_manpower_billing_period;
DROP INDEX IF EXISTS idx_manpower_billing_status;
DROP INDEX IF EXISTS idx_manpower_billing_work_unit;
CREATE INDEX idx_manpower_billing_org ON manpower_billing(organisation_id);
CREATE INDEX idx_manpower_billing_subcontractor ON manpower_billing(subcontractor_id);
CREATE INDEX idx_manpower_billing_period ON manpower_billing(billing_period_start, billing_period_end);
CREATE INDEX idx_manpower_billing_status ON manpower_billing(status);
CREATE INDEX idx_manpower_billing_work_unit ON manpower_billing(work_unit_id);

-- ============================================
-- TRIGGER: Update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_labour_categories_updated_at ON labour_categories;
CREATE TRIGGER update_labour_categories_updated_at BEFORE UPDATE ON labour_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rate_cards_updated_at ON rate_cards;
CREATE TRIGGER update_rate_cards_updated_at BEFORE UPDATE ON rate_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_context_modifiers_updated_at ON context_modifiers;
CREATE TRIGGER update_context_modifiers_updated_at BEFORE UPDATE ON context_modifiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_manpower_attendance_updated_at ON manpower_attendance;
CREATE TRIGGER update_manpower_attendance_updated_at BEFORE UPDATE ON manpower_attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_manpower_billing_updated_at ON manpower_billing;
CREATE TRIGGER update_manpower_billing_updated_at BEFORE UPDATE ON manpower_billing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA: Default Labour Categories
-- ============================================
INSERT INTO labour_categories (organisation_id, name, code, description, base_rate, unit) VALUES
  (NULL, 'Mason', 'MASON', 'Skilled masonry worker', 800, 'day'),
  (NULL, 'Carpenter', 'CARPENTER', 'Skilled carpentry worker', 750, 'day'),
  (NULL, 'Electrician', 'ELECTRICIAN', 'Skilled electrical worker', 850, 'day'),
  (NULL, 'Plumber', 'PLUMBER', 'Skilled plumbing worker', 750, 'day'),
  (NULL, 'Painter', 'PAINTER', 'Skilled painting worker', 700, 'day'),
  (NULL, 'Helper', 'HELPER', 'Unskilled helper', 500, 'day'),
  (NULL, 'Supervisor', 'SUPERVISOR', 'Site supervisor', 1000, 'day')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- SEED DATA: Default Context Modifiers
-- ============================================
INSERT INTO context_modifiers (organisation_id, name, code, modifier_type, multiplier, is_percentage, description) VALUES
  (NULL, 'Night Shift', 'NIGHT_SHIFT', 'SHIFT', 1.25, true, '25% premium for night work'),
  (NULL, 'High Risk', 'HIGH_RISK', 'RISK', 1.5, true, '50% premium for high-risk work'),
  (NULL, 'Remote Location', 'REMOTE', 'LOCATION', 1.2, true, '20% premium for remote sites'),
  (NULL, 'Overtime', 'OVERTIME', 'SHIFT', 1.5, true, '50% premium for overtime'),
  (NULL, 'Weekend Work', 'WEEKEND', 'SHIFT', 1.5, true, '50% premium for weekend work')
ON CONFLICT (code) DO NOTHING;
