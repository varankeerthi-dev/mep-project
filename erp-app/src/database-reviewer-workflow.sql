-- Add reviewer fields to approvals table
ALTER TABLE approvals
ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT 'NOT_REQUIRED' CHECK (review_status IN ('NOT_REQUIRED', 'PENDING', 'REVIEWED', 'REJECTED')),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- Add index for review_status to help with filtering
CREATE INDEX IF NOT EXISTS idx_approvals_review_status ON approvals(review_status);

-- Optional: If the reviewer is different from the regular workflow, we need to allow the reviewer to see the record via RLS.
-- Because the default RLS policy "approval_users_view_org_approvals" already checks user's org membership:
-- CREATE POLICY "approval_users_view_org_approvals" ON approvals
--     FOR SELECT USING (
--         organisation_id IN (
--             SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()
--         )
--     );
-- We don't need additional RLS since it's org-based.
