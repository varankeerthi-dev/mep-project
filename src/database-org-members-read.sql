-- Allow authenticated users to view other org members' profiles
-- so approval settings, member lists, task assignees, etc. can resolve names.
CREATE POLICY "org_members_view_member_profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT om2.user_id
      FROM org_members om2
      WHERE om2.organisation_id IN (
        SELECT om1.organisation_id
        FROM org_members om1
        WHERE om1.user_id = auth.uid()
      )
    )
  );

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;