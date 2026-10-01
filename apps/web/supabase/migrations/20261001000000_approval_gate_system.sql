-- Migration: 20261001000000_approval_gate_system.sql
-- Description: Adds bypass authority, metadata audit fields, and employee tracking to approval workflows and action logs.

-- 1. Extend approval_workflows table
ALTER TABLE approval_workflows 
ADD COLUMN IF NOT EXISTS can_bypass_prior_levels BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS approver_name TEXT;

-- 2. Extend approval_actions table to store rich audit metadata (e.g. bypass logs, skipped levels)
ALTER TABLE approval_actions 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 3. Create index on approval_actions metadata for rapid audit queries
CREATE INDEX IF NOT EXISTS idx_approval_actions_metadata ON approval_actions USING gin (metadata);
