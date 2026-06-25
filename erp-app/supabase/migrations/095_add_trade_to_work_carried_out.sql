-- Migration: 095_add_trade_to_work_carried_out.sql
-- Description: Add trade column to work_carried_out table to categorize daily site logs by trade/discipline.

ALTER TABLE work_carried_out 
ADD COLUMN IF NOT EXISTS trade VARCHAR(100) DEFAULT 'General';
