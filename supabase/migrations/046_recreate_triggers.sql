-- Migration 046: Recreate trigger and verify consumption summary update

-- Drop and recreate the trigger on daily_material_usage for INSERT/UPDATE
DROP TRIGGER IF EXISTS trigger_update_consumption_on_usage ON daily_material_usage;
CREATE TRIGGER trigger_update_consumption_on_usage
  AFTER INSERT OR UPDATE ON daily_material_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_material_consumption_summary();

-- Also verify the DELETE trigger exists (from 044)
DROP TRIGGER IF EXISTS trigger_delete_consumption_on_material_list ON project_material_list;
CREATE TRIGGER trigger_delete_consumption_on_material_list
  AFTER DELETE ON project_material_list
  FOR EACH ROW
  EXECUTE FUNCTION delete_consumption_summary_on_material_delete();

DROP TRIGGER IF EXISTS trigger_update_consumption_on_usage_delete ON daily_material_usage;
CREATE TRIGGER trigger_update_consumption_on_usage_delete
  AFTER DELETE ON daily_material_usage
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_consumption_summary_on_usage_delete();