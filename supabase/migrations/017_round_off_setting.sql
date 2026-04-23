-- Add round off setting to organisations table
-- This allows users to enable/disable automatic rounding of rate after discount

ALTER TABLE organisations 
ADD COLUMN IF NOT EXISTS round_off_enabled BOOLEAN DEFAULT true;
