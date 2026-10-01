-- ============================================================================
-- Purchase Phase 1.2 — Backfill live-only purchase POLICIES
--
-- Drift evidence (PURCHASE-PHASE1-DRIFT-REPORT.md, 2026-09-29):
--   22 RLS policies exist in project rujqejtisqermjyqqgoj but appear in NO file
--   under supabase/migrations/. They fall into two groups:
--
--   (a) 14 "common_*" RBAC policies — these DO appear under src/*.sql, but
--       src/ is not a reproducible migration path. A rebuild from
--       supabase/migrations/ alone would create the Purchase tables with
--       ZERO RLS enforcement on them. This is the most severe drift item:
--       the application would appear to work while tenant isolation was
--       entirely absent.
--
--   (b) 8 tenant-isolation policies that exist in neither path.
--
--   All definitions below are captured verbatim from pg_policies, preserving
--   cmd, permissive mode, role list, USING and WITH CHECK expressions.
--
-- Faithfulness rule:
--   This file reproduces live state. It does NOT tighten anything. Several
--   captured policies are permissive in ways the Phase 3/4 work intends to
--   change; those are annotated but deliberately left as-is so the Phase 1.10
--   scratch rebuild reproduces production exactly.
--
-- Idempotent: DROP POLICY IF EXISTS precedes every CREATE POLICY.
-- No table or data changes.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 2a. RBAC "common_*" policies — reproduce live exactly
-- ---------------------------------------------------------------------------

-- purchase_orders: the reference pattern. Command-scoped, so PostgreSQL does
-- not OR the permission checks together across commands.
DROP POLICY IF EXISTS common_purchase_orders_read ON public.purchase_orders;
CREATE POLICY common_purchase_orders_read ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (app_is_org_member(organisation_id));

DROP POLICY IF EXISTS common_purchase_orders_write ON public.purchase_orders;
CREATE POLICY common_purchase_orders_write ON public.purchase_orders
  FOR INSERT TO authenticated
  WITH CHECK (app_has_org_permission(organisation_id, 'purchase_orders.create'::text));

DROP POLICY IF EXISTS common_purchase_orders_edit ON public.purchase_orders;
CREATE POLICY common_purchase_orders_edit ON public.purchase_orders
  FOR UPDATE TO authenticated
  USING (app_has_org_permission(organisation_id, 'purchase_orders.edit'::text))
  WITH CHECK (app_has_org_permission(organisation_id, 'purchase_orders.edit'::text));

DROP POLICY IF EXISTS common_purchase_orders_delete ON public.purchase_orders;
CREATE POLICY common_purchase_orders_delete ON public.purchase_orders
  FOR DELETE TO authenticated
  USING (app_has_org_permission(organisation_id, 'purchase_orders.delete'::text));

DROP POLICY IF EXISTS common_purchase_order_items_read ON public.purchase_order_items;
CREATE POLICY common_purchase_order_items_read ON public.purchase_order_items
  FOR SELECT TO authenticated
  USING (app_is_org_member(organisation_id));

-- NOTE (carried forward, Phase 4 / W4.7): this is cmd=ALL, so it applies to
-- INSERT/UPDATE/DELETE as well as SELECT. purchase_order_items has no separate
-- tenant-isolation policy, so this is the only guard on the table.
DROP POLICY IF EXISTS common_purchase_order_items_write ON public.purchase_order_items;
CREATE POLICY common_purchase_order_items_write ON public.purchase_order_items
  FOR ALL TO authenticated
  USING (app_has_org_permission(organisation_id, 'purchase_orders.edit'::text))
  WITH CHECK (app_has_org_permission(organisation_id, 'purchase_orders.edit'::text));

DROP POLICY IF EXISTS common_purchase_vendors_read ON public.purchase_vendors;
CREATE POLICY common_purchase_vendors_read ON public.purchase_vendors
  FOR SELECT TO authenticated
  USING (app_is_org_member(organisation_id));

-- NOTE (carried forward, Phase 4 / W4.7): cmd=ALL. Combined with the
-- PERMISSIVE purchase_vendors_tenant_isolation policy below, PostgreSQL ORs
-- the two, so any org member can write vendors regardless of the permission
-- check. purchase_orders does not have this problem; this table should adopt
-- the command-scoped shape.
DROP POLICY IF EXISTS common_purchase_vendors_write ON public.purchase_vendors;
CREATE POLICY common_purchase_vendors_write ON public.purchase_vendors
  FOR ALL TO authenticated
  USING (app_has_org_permission(organisation_id, 'purchase_vendors.edit'::text))
  WITH CHECK (app_has_org_permission(organisation_id, 'purchase_vendors.edit'::text));

DROP POLICY IF EXISTS common_purchase_bills_read ON public.purchase_bills;
CREATE POLICY common_purchase_bills_read ON public.purchase_bills
  FOR SELECT TO authenticated
  USING (app_is_org_member(organisation_id));

DROP POLICY IF EXISTS common_purchase_bill_items_read ON public.purchase_bill_items;
CREATE POLICY common_purchase_bill_items_read ON public.purchase_bill_items
  FOR SELECT TO authenticated
  USING (app_is_org_member(organisation_id));

DROP POLICY IF EXISTS common_purchase_payments_read ON public.purchase_payments;
CREATE POLICY common_purchase_payments_read ON public.purchase_payments
  FOR SELECT TO authenticated
  USING (app_is_org_member(organisation_id));

DROP POLICY IF EXISTS common_purchase_payment_bills_read ON public.purchase_payment_bills;
CREATE POLICY common_purchase_payment_bills_read ON public.purchase_payment_bills
  FOR SELECT TO authenticated
  USING (app_is_org_member(organisation_id));


-- ---------------------------------------------------------------------------
-- 2b. Tenant-isolation policies — live-only, captured verbatim
--
-- Note the two different membership predicates in use across these:
--   user_can_access_org(organisation_id)
--     -> requires org_members row with status='active' AND the linked employee
--        (if any) also active.
--   inline org_members subquery
--     -> no status predicate at all. A suspended member still matches.
-- Both are reproduced as-is. Consolidation is Phase 4 work, not this file's.
-- ---------------------------------------------------------------------------

-- --- requisitions ---
DROP POLICY IF EXISTS purchase_requisitions_org_access ON public.purchase_requisitions;
CREATE POLICY purchase_requisitions_org_access ON public.purchase_requisitions
  FOR ALL TO public
  USING (organisation_id IN (SELECT org_members.organisation_id FROM org_members WHERE org_members.user_id = auth.uid()))
  WITH CHECK (organisation_id IN (SELECT org_members.organisation_id FROM org_members WHERE org_members.user_id = auth.uid()));

DROP POLICY IF EXISTS purchase_requisition_lines_org_access ON public.purchase_requisition_lines;
CREATE POLICY purchase_requisition_lines_org_access ON public.purchase_requisition_lines
  FOR ALL TO public
  USING (organisation_id IN (SELECT org_members.organisation_id FROM org_members WHERE org_members.user_id = auth.uid()))
  WITH CHECK (organisation_id IN (SELECT org_members.organisation_id FROM org_members WHERE org_members.user_id = auth.uid()));

DROP POLICY IF EXISTS purchase_release_rules_org_access ON public.purchase_release_rules;
CREATE POLICY purchase_release_rules_org_access ON public.purchase_release_rules
  FOR ALL TO public
  USING (organisation_id IN (SELECT org_members.organisation_id FROM org_members WHERE org_members.user_id = auth.uid()))
  WITH CHECK (organisation_id IN (SELECT org_members.organisation_id FROM org_members WHERE org_members.user_id = auth.uid()));

-- --- audit log ---
-- NOTE (carried forward, Phase 3 / W3.8): cmd=ALL on the audit trail means
-- end users can UPDATE and DELETE history. There is no append-only trigger.
-- This migration does not add one; it reproduces the live state.
DROP POLICY IF EXISTS purchase_audit_log_org_access ON public.purchase_audit_log;
CREATE POLICY purchase_audit_log_org_access ON public.purchase_audit_log
  FOR ALL TO public
  USING (organisation_id IN (SELECT org_members.organisation_id FROM org_members WHERE org_members.user_id = auth.uid()))
  WITH CHECK (organisation_id IN (SELECT org_members.organisation_id FROM org_members WHERE org_members.user_id = auth.uid()));

-- --- invoice verification / settings ---
DROP POLICY IF EXISTS purchase_iv_org_access ON public.purchase_invoice_verifications;
CREATE POLICY purchase_iv_org_access ON public.purchase_invoice_verifications
  FOR ALL TO public
  USING (organisation_id IN (SELECT org_members.organisation_id FROM org_members WHERE org_members.user_id = auth.uid()))
  WITH CHECK (organisation_id IN (SELECT org_members.organisation_id FROM org_members WHERE org_members.user_id = auth.uid()));

DROP POLICY IF EXISTS purchase_iv_settings_org_access ON public.purchase_iv_settings;
CREATE POLICY purchase_iv_settings_org_access ON public.purchase_iv_settings
  FOR ALL TO public
  USING (organisation_id IN (SELECT org_members.organisation_id FROM org_members WHERE org_members.user_id = auth.uid()))
  WITH CHECK (organisation_id IN (SELECT org_members.organisation_id FROM org_members WHERE org_members.user_id = auth.uid()));

-- --- availability inquiry (sourcing) ---
DROP POLICY IF EXISTS availability_inquiries_org_access ON public.availability_inquiries;
CREATE POLICY availability_inquiries_org_access ON public.availability_inquiries
  FOR ALL TO public
  USING (organisation_id IN (SELECT org_members.organisation_id FROM org_members WHERE org_members.user_id = auth.uid()))
  WITH CHECK (organisation_id IN (SELECT org_members.organisation_id FROM org_members WHERE org_members.user_id = auth.uid()));

DROP POLICY IF EXISTS availability_inquiry_lines_org_access ON public.availability_inquiry_lines;
CREATE POLICY availability_inquiry_lines_org_access ON public.availability_inquiry_lines
  FOR ALL TO public
  USING (organisation_id IN (SELECT org_members.organisation_id FROM org_members WHERE org_members.user_id = auth.uid()))
  WITH CHECK (organisation_id IN (SELECT org_members.organisation_id FROM org_members WHERE org_members.user_id = auth.uid()));

DROP POLICY IF EXISTS availability_responses_org_access ON public.availability_responses;
CREATE POLICY availability_responses_org_access ON public.availability_responses
  FOR ALL TO public
  USING (organisation_id IN (SELECT org_members.organisation_id FROM org_members WHERE org_members.user_id = auth.uid()))
  WITH CHECK (organisation_id IN (SELECT org_members.organisation_id FROM org_members WHERE org_members.user_id = auth.uid()));

-- --- goods receipt / material inward ---
DROP POLICY IF EXISTS goods_receipts_org_access ON public.goods_receipts;
CREATE POLICY goods_receipts_org_access ON public.goods_receipts
  FOR ALL TO public
  USING (organisation_id IN (SELECT org_members.organisation_id FROM org_members WHERE org_members.user_id = auth.uid()))
  WITH CHECK (organisation_id IN (SELECT org_members.organisation_id FROM org_members WHERE org_members.user_id = auth.uid()));

DROP POLICY IF EXISTS goods_receipt_notes_tenant_isolation ON public.goods_receipt_notes;
CREATE POLICY goods_receipt_notes_tenant_isolation ON public.goods_receipt_notes
  FOR ALL TO authenticated
  USING (user_can_access_org(organisation_id))
  WITH CHECK (user_can_access_org(organisation_id));

DROP POLICY IF EXISTS material_inward_tenant_isolation ON public.material_inward;
CREATE POLICY material_inward_tenant_isolation ON public.material_inward
  FOR ALL TO authenticated
  USING (user_can_access_org(organisation_id))
  WITH CHECK (user_can_access_org(organisation_id));

-- --- debit notes ---
-- NOTE: debit_notes also carries debit_notes_tenant_isolation (created in
-- 20260817000004). Both are cmd=ALL with the same predicate. They are
-- equivalent under OR, so this is a harmless duplicate — reproduced for
-- fidelity, flagged for cleanup in Phase 4.
DROP POLICY IF EXISTS debit_notes_tenant_access ON public.debit_notes;
CREATE POLICY debit_notes_tenant_access ON public.debit_notes
  FOR ALL TO authenticated
  USING (user_can_access_org(organisation_id))
  WITH CHECK (user_can_access_org(organisation_id));


-- ---------------------------------------------------------------------------
-- 2c. Approvals-family policies — live-only, captured verbatim
--
-- Included because the Purchase approval chain depends on them:
-- usePurchaseQueries.ts:812 and :1342 read payment_requests/approvals, and
-- approvals/api.ts writes the approvals row directly.
--
-- approval_users_update_org_approvals / approval_users_delete_org_approvals
-- are notable: they permit any org member to UPDATE and DELETE approval rows.
-- Combined with the unauthenticated client-side approval engines
-- (approvals/api.ts:288, workflow-engine.ts:24, siteReportApproval.ts:174),
-- the approval trail is not a reliable control. Reproduced as-is.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view approvals for their organisation" ON public.approvals;
CREATE POLICY "Users can view approvals for their organisation" ON public.approvals
  FOR SELECT TO public
  USING (organisation_id IN (SELECT user_organisations.organisation_id FROM user_organisations WHERE user_organisations.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can create approvals for their organisation" ON public.approvals;
CREATE POLICY "Users can create approvals for their organisation" ON public.approvals
  FOR INSERT TO public
  WITH CHECK (organisation_id IN (SELECT user_organisations.organisation_id FROM user_organisations WHERE user_organisations.user_id = auth.uid()));

DROP POLICY IF EXISTS approval_users_update_org_approvals ON public.approvals;
CREATE POLICY approval_users_update_org_approvals ON public.approvals
  FOR UPDATE TO authenticated
  USING (user_can_access_org(organisation_id))
  WITH CHECK (user_can_access_org(organisation_id));

DROP POLICY IF EXISTS approval_users_delete_org_approvals ON public.approvals;
CREATE POLICY approval_users_delete_org_approvals ON public.approvals
  FOR DELETE TO authenticated
  USING (user_can_access_org(organisation_id));

DROP POLICY IF EXISTS "Users can view actions for their organisation approvals" ON public.approval_actions;
CREATE POLICY "Users can view actions for their organisation approvals" ON public.approval_actions
  FOR SELECT TO public
  USING (organisation_id IN (SELECT user_organisations.organisation_id FROM user_organisations WHERE user_organisations.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can create actions for their organisation" ON public.approval_actions;
CREATE POLICY "Users can create actions for their organisation" ON public.approval_actions
  FOR INSERT TO public
  WITH CHECK (organisation_id IN (SELECT user_organisations.organisation_id FROM user_organisations WHERE user_organisations.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can create notifications for their organisation" ON public.approval_notifications;
CREATE POLICY "Users can create notifications for their organisation" ON public.approval_notifications
  FOR INSERT TO public
  WITH CHECK (organisation_id IN (SELECT user_organisations.organisation_id FROM user_organisations WHERE user_organisations.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view workflows for their organisation" ON public.approval_workflows;
CREATE POLICY "Users can view workflows for their organisation" ON public.approval_workflows
  FOR SELECT TO public
  USING (organisation_id IN (SELECT user_organisations.organisation_id FROM user_organisations WHERE user_organisations.user_id = auth.uid()));


-- ---------------------------------------------------------------------------
-- 2d. Subcontractor payments — live-only, captured verbatim
--
-- In scope because useRecordPaymentForRequest (usePurchaseQueries.ts:1654)
-- posts subcontractor payments from the Purchase module's PaymentsHub.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS subcontractor_payments_tenant_isolation ON public.subcontractor_payments;
CREATE POLICY subcontractor_payments_tenant_isolation ON public.subcontractor_payments
  FOR ALL TO authenticated
  USING (user_can_access_org(organisation_id))
  WITH CHECK (user_can_access_org(organisation_id));

DROP POLICY IF EXISTS subpay_select_org ON public.subcontractor_payments;
CREATE POLICY subpay_select_org ON public.subcontractor_payments
  FOR SELECT TO authenticated
  USING (user_can_access_org(organisation_id));

DROP POLICY IF EXISTS subpay_insert_org ON public.subcontractor_payments;
CREATE POLICY subpay_insert_org ON public.subcontractor_payments
  FOR INSERT TO authenticated
  WITH CHECK (user_can_access_org(organisation_id));

DROP POLICY IF EXISTS subpay_update_org ON public.subcontractor_payments;
CREATE POLICY subpay_update_org ON public.subcontractor_payments
  FOR UPDATE TO authenticated
  USING (user_can_access_org(organisation_id))
  WITH CHECK (user_can_access_org(organisation_id));

DROP POLICY IF EXISTS subpay_delete_org ON public.subcontractor_payments;
CREATE POLICY subpay_delete_org ON public.subcontractor_payments
  FOR DELETE TO authenticated
  USING (user_can_access_org(organisation_id));
