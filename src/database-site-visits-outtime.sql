-- Add out_time column to site_visits
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS out_time VARCHAR(20);
