-- Verification fix-forward for 20261001000006.
--
-- 00006 constrained the set name with:
--   CHECK (char_length(name) BETWEEN 1 AND 100)
-- char_length() does not trim, so a whitespace-only name ('   ') has length 3
-- and satisfied the constraint. Verified against the live table: the insert
-- succeeded. The application path was never at risk, because saveSet() trims
-- and rejects an empty name before it reaches the database, but the constraint
-- did not back that rule up and any other writer (SQL, future service, import)
-- could create an unusable set.
--
-- Fix: constrain the trimmed length instead.
ALTER TABLE public.material_attribute_sets
  DROP CONSTRAINT IF EXISTS material_attribute_set_name_len;

ALTER TABLE public.material_attribute_sets
  ADD CONSTRAINT material_attribute_set_name_len
  CHECK (char_length(btrim(name)) BETWEEN 1 AND 100);
