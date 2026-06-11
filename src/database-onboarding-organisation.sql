-- Onboarding fields for organisation setup
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS organisation_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS manufacturing_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

