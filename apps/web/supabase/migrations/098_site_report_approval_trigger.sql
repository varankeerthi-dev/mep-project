-- ============================================
-- 098_site_report_approval_trigger.sql
-- Server-side enforcement: approved/reported
-- site reports cannot be edited.
--
-- This is a defence-in-depth supplement to
-- the client-side check already in SiteReport.tsx.
-- ============================================

CREATE OR REPLACE FUNCTION prevent_approved_report_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.pm_status IN ('Pending Approval', 'Approved', 'Reported') THEN
    RAISE EXCEPTION 'Cannot modify a report with status: %. This report is locked after approval/reporting.', OLD.pm_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_approved_report_update ON site_reports;

CREATE TRIGGER trg_prevent_approved_report_update
  BEFORE UPDATE ON site_reports
  FOR EACH ROW
  EXECUTE FUNCTION prevent_approved_report_update();
