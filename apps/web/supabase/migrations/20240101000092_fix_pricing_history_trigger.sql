-- Drop the existing trigger that fires on DELETE of material_client_pricing
-- and tries to INSERT into material_client_pricing_history with a now-deleted pricing_id
DROP TRIGGER IF EXISTS trg_material_client_pricing_history ON material_client_pricing;
DROP FUNCTION IF EXISTS fn_material_client_pricing_history();

-- Recreate the trigger to only fire on INSERT/UPDATE (not DELETE)
CREATE OR REPLACE FUNCTION fn_material_client_pricing_history()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- On DELETE, clean up history rows for the deleted pricing record
    DELETE FROM material_client_pricing_history WHERE pricing_id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO material_client_pricing_history (
      pricing_id, material_id, pricing_type, old_rate, new_rate,
      valid_from, valid_to, status, change_type, changed_at
    ) VALUES (
      NEW.id, NEW.material_id, NEW.pricing_type,
      OLD.rate, NEW.rate, NEW.valid_from, NEW.valid_to,
      NEW.status, 'updated', NOW()
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO material_client_pricing_history (
      pricing_id, material_id, pricing_type, old_rate, new_rate,
      valid_from, valid_to, status, change_type, changed_at
    ) VALUES (
      NEW.id, NEW.material_id, NEW.pricing_type,
      NULL, NEW.rate, NEW.valid_from, NEW.valid_to,
      NEW.status, 'created', NOW()
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_material_client_pricing_history
  AFTER INSERT OR UPDATE OR DELETE ON material_client_pricing
  FOR EACH ROW
  EXECUTE FUNCTION fn_material_client_pricing_history();
