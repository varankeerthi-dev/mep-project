-- Create a sequence for 8-digit Organisation IDs
-- Run this in Supabase SQL Editor

-- Create the sequence
CREATE SEQUENCE IF NOT EXISTS org_id_seq
  START WITH 10000001
  INCREMENT BY 1
  NO MAXVALUE
  NO CYCLE;

-- Example: How to get next 8-digit org ID
-- SELECT LPAD(seq.nextval::TEXT, 8, '0') as org_id;

-- Or you can use this function
CREATE OR REPLACE FUNCTION generate_org_id()
RETURNS TEXT AS $$
BEGIN
  RETURN LPAD(NEXT VALUE FOR org_id_seq::TEXT, 8, '0');
END;
$$ LANGUAGE plpgsql;

-- To get current value
-- SELECT last_value FROM org_id_seq;

-- To reset if needed (WARNING: only do this if you want to start fresh)
-- SELECT setval('org_id_seq', 10000000);
