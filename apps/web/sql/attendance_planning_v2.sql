-- Add audit columns to attendance_plans
ALTER TABLE attendance_plans
ADD COLUMN IF NOT EXISTS created_by UUID,
ADD COLUMN IF NOT EXISTS created_by_name TEXT,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- Add index for history queries
CREATE INDEX IF NOT EXISTS idx_attendance_plans_created_by
    ON attendance_plans (organisation_id, created_by);
