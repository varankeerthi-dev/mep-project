-- Migration: Add site_contacts, instructions_to_site_persons, and checklist_items to site_visits
ALTER TABLE site_visits
  ADD COLUMN IF NOT EXISTS site_contacts jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS instructions_to_site_persons text DEFAULT '',
  ADD COLUMN IF NOT EXISTS checklist_items jsonb DEFAULT '[]'::jsonb;
