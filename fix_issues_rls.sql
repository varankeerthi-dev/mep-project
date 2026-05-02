-- ============================================================
-- FIX: ISSUE TRACKING RLS POLICIES
-- ============================================================
-- The previous policies relied on user_profiles.organisation_id which 
-- only supports a single organisation per user. These updated policies 
-- allow access for all organisations where the user is a member.
-- ============================================================

-- 1. Issues
DROP POLICY IF EXISTS "issues_org_policy" ON issues;
CREATE POLICY "issues_org_policy" ON issues FOR ALL
  USING (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()))
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()));

-- 2. Attachments
DROP POLICY IF EXISTS "issue_attachments_org_policy" ON issue_attachments;
CREATE POLICY "issue_attachments_org_policy" ON issue_attachments FOR ALL
  USING (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()))
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()));

-- 3. Activity Logs
DROP POLICY IF EXISTS "issue_activity_logs_org_policy" ON issue_activity_logs;
CREATE POLICY "issue_activity_logs_org_policy" ON issue_activity_logs FOR ALL
  USING (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()))
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()));

-- 4. Comments
DROP POLICY IF EXISTS "issue_comments_org_policy" ON issue_comments;
CREATE POLICY "issue_comments_org_policy" ON issue_comments FOR ALL
  USING (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()))
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()));

-- 5. Subcontractor Work Orders (Optional Fix if same issue exists there)
DROP POLICY IF EXISTS "swo_org_policy" ON subcontractor_work_orders;
CREATE POLICY "swo_org_policy" ON subcontractor_work_orders FOR ALL
  USING (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()))
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()));

SELECT 'Issue Module RLS Fix Applied Successfully' AS result;
