-- Phase 0 — read-only checks for the Quotation Follow-up Loop (PRD Appendix A)
-- Run against the DEPLOYED database (Supabase SQL editor, read-only intent).
-- Every statement is a SELECT. Nothing here writes.
-- Paste results back into the PRD review thread; the answers gate Phase 1.

-- ============================================================
-- 1. Constraints on the three lifecycle tables (F4, F21, F30, P0-4)
--    Look for: quotation_header.status CHECK (expected absent),
--    follow_up_quotation_tracking.follow_up_status CHECK (5 values = remediation NOT applied),
--    follow_up_activity_log.event_type CHECK (does it list quotation_status_changed?),
--    quotation_revisions.status CHECK (should be pending_approval, approved, in_progress, completed, rejected)
-- ============================================================
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid IN ('follow_up_quotation_tracking'::regclass,
                    'follow_up_activity_log'::regclass,
                    'quotation_header'::regclass);

-- 2. Are status-change audit rows surviving at all? (F11, F30)
--    Zero, with real status changes present, means audit rows are being dropped live.
SELECT count(*) FROM follow_up_activity_log WHERE event_type = 'quotation_status_changed';

-- 3. Live RLS policies — answers P0-2 for real (repo says org-scoped already)
--    A USING (true) / permissive all-access policy on quotation_header = live cross-tenant leak.
SELECT tablename, policyname, cmd, qual FROM pg_policies
 WHERE tablename IN ('quotation_header','notifications');

-- 4. Live notifications shape vs the three repo variants (F10)
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'notifications' ORDER BY ordinal_position;

-- ============================================================
-- 5. Constraints for the other two tables Phase 0 depends on (F21, F8)
-- ============================================================
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid IN ('quotation_revisions'::regclass,'client_communication'::regclass);

-- 6. next_action_label NOT NULL question (F31) + win/loss reuse (F13, C13)
--    If next_action_label is NOT NULL with no default, reminder upserts already fail in production.
--    Do NOT fix the column here — this is the measurement.
SELECT column_name, is_nullable, column_default FROM information_schema.columns
 WHERE table_name='follow_up_quotation_tracking'
   AND column_name IN ('next_action_label','win_loss_reason_id','assignee_user_id','win_loss_notes');

-- 7. Is the vocabulary remediation migration recorded as applied? (direct answer to P0-4)
--    If this table is empty or unlicensed, fall back to query 1's CHECK definitions.
SELECT version, name FROM supabase_migrations.schema_migrations
 WHERE name LIKE '%remediation%' ORDER BY version;

-- 8. Does the permission key the RPC will check actually have grants? (F23)
--    Expect: 'update' present or absent, 'edit' deleted by the action-key alignment migration.
--    Use whichever action_key has a non-zero grant count in the RPC authorise step.
SELECT p.action_key, count(rp.id) FROM permissions p
  LEFT JOIN role_permissions rp ON rp.permission_id = p.id
 WHERE p.resource = 'quotations' GROUP BY 1 ORDER BY 1;

-- 9. Status offender report + rename blast radius (Q5, §4.4)
--    Any value outside the §4.1 set (notably 'Under Negotiation') must be reported, not coerced.
SELECT status, count(*) FROM quotation_header GROUP BY status ORDER BY count(*) DESC;

-- 10. Approver id space, per row (§6.3, Q9)
SELECT a.approver_id,
       (a.approver_id IN (SELECT id FROM employees))           AS in_employees,
       (a.approver_id IN (SELECT user_id FROM user_profiles))  AS in_user_profiles
  FROM approval_workflows a WHERE a.approval_type = 'QUOTATION' AND a.is_active;

-- 11. The same question as a rate, which is what Q9 needs (G2)
--     employees_only / neither > 0 means approval notification contacts are already failing
--     silently via getContact's maybeSingle(), independent of this feature.
SELECT count(*) FILTER (WHERE x.in_employees AND NOT x.in_user_profiles)      AS employees_only,
       count(*) FILTER (WHERE x.in_user_profiles AND NOT x.in_employees)      AS profiles_only,
       count(*) FILTER (WHERE x.in_employees AND x.in_user_profiles)          AS both,
       count(*) FILTER (WHERE NOT x.in_employees AND NOT x.in_user_profiles)  AS neither,
       count(*)                                                              AS total
  FROM (SELECT a.approver_id,
              (a.approver_id IN (SELECT id FROM employees))          AS in_employees,
              (a.approver_id IN (SELECT user_id FROM user_profiles)) AS in_user_profiles
         FROM approval_workflows a WHERE a.is_active) x;

-- 12. The second notification store (F34, Q11): live shape of both tables side by side
SELECT table_name, column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name IN ('notifications','approval_notifications')
 ORDER BY table_name, ordinal_position;

-- 13. And their volume, to size the Q11 merge
SELECT 'notifications' AS store, count(*) AS rows, count(*) FILTER (WHERE read_at IS NULL) AS unread
  FROM notifications
UNION ALL
SELECT 'approval_notifications', count(*), count(*) FILTER (WHERE read_at IS NULL)
  FROM approval_notifications;

-- 14. F33 / G4 blast radius: quotations under approval with a recently touched header.
--     quotation_header.updated_at is used on purpose — quotation_items has created_at only
--     (F14) and rows are deleted/re-inserted on every save (F27), so item timestamps are not
--     a stable churn signal. Non-zero = the Phase 1b edit block needs a release note.
SELECT count(*) FROM quotation_header
 WHERE upper(status) IN ('PENDING_APPROVAL','PENDING APPROVAL')
   AND updated_at > now() - interval '30 days';

-- ============================================================
-- Not included here: the F31 reminder-upsert test.
-- It is the only Phase 0 check that WRITES (insert a follow_up_quotation_tracking row
-- the way recordQuotationReminder does, omitting next_action_label). Run it in staging,
-- not against production data, and only after query 6 shows the column NOT NULL without
-- a default — if query 6 shows a default or a nullable column, the test is unnecessary.
-- ============================================================
