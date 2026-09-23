# Accounting Implementation Verification Report (Functionality-first)

## Executive Summary

**Overall verdict:** Partially works — the core GL engine (`post_journal_entry`) functions for basic voucher posting with double-entry enforcement, but there are **critical multi-tenancy bypasses, unused hardened security code, missing period locks, and broken GST RLS**. Several "implemented" features are either dead code or superficial.

### Top 5 Critical Functional Gaps (with proof)
1. **Cross-org posting bypass in `post_journal_entry`** — the active posting RPC does NOT validate that accounts belong to the caller's org. An attacker can pass another org's account_id and corrupt external balances.
2. **`purchase_returns` / `purchase_return_items` have no tenant isolation** — RLS policies are `true`/`true` (full open access). Any user can read/write/delete any org's purchase returns.
3. **GST table RLS compares `organisation_id = auth.uid()`** — `auth.uid()` is the user UUID, not org UUID. This either locks out normal users or leaks data when a user UUID coincidentally matches an org UUID.
4. **Period locks are defined but not enforced** — `financial_periods.is_closed` exists but is never checked in `post_journal_entry` or `post_double_entry_journal`. Users can post to closed periods.
5. **`post_double_entry_journal` is dead code** — the frontend calls `post_journal_entry`. The hardened RPC with RBAC, account-org validation, control-account party checks, and period-lock enforcement exists but is **never executed**.

### Top 5 Multi-Tenant Risks (with proof)
1. **`purchase_returns` / `purchase_return_items` RLS = `true`** — zero isolation
2. **GST RLS uses `auth.uid()` instead of org membership** — broken isolation
3. **`post_journal_entry` accepts cross-org account IDs** — balance corruption across tenants
4. **`post_double_entry_journal` validates org correctly but is dead code** — false sense of security
5. **`record_debit_note` hardcodes account codes (`2100`, `5000`, `1500`, `2000`)** — if these accounts don't exist in an org, the GL posting silently skips (no error), causing unbalanced books

---

## 1. Multi-tenancy Verification

| Area | Evidence (file:line or function) | Org-scoped? (Yes/No/Unclear) | RLS enforced? | Hardcoded org IDs found | Risk | Verdict |
|---|---|---|---|---|---|---|
| **accounts** | `accounts` table + `post_journal_entry` RPC validates `v_account` exists but NOT org | Partial | Yes (via `user_can_access_org`) | No | Medium | RLS is correct, but active posting RPC bypasses account-org validation |
| **journal_entries** | RPC inserts `p_organisation_id`; RLS uses `user_can_access_org(company_id)` | Yes | Yes | No | Low | Properly scoped |
| **journal_entry_lines** | RLS uses subquery on `journal_entries` | Yes | Yes | No | Low | Properly scoped via parent |
| **purchase_returns** | Migration `20260922000000_purchase_returns.sql` creates RLS `true`/`true` | **No** | **No** | No | **Critical** | Zero tenant isolation — any user can read/write all purchase returns |
| **purchase_return_items** | Same migration, same RLS `true`/`true` | **No** | **No** | No | **Critical** | Zero tenant isolation |
| **debit_notes** | RPC `record_debit_note` uses `p_organisation_id`; RLS uses `user_can_access_org` | Yes | Yes | No | Low | Properly scoped |
| **debit_note_items** | RLS uses `user_can_access_org(organisation_id)` | Yes | Yes | No | Low | Properly scoped |
| **gst_outward_supply** | RLS: `organisation_id = auth.uid()` | **No** (broken) | **Broken** | No | **Critical** | `auth.uid()` is user UUID, not org UUID |
| **gst_inward_supply** | RLS: `organisation_id = auth.uid()` | **No** (broken) | **Broken** | No | **Critical** | Same bug |
| **gst_itc_ledger** | RLS: `organisation_id = auth.uid()` | **No** (broken) | **Broken** | No | **Critical** | Same bug |
| **gst_rcm_liability** | RLS: `organisation_id = auth.uid()` | **No** (broken) | **Broken** | No | **Critical** | Same bug |
| **gst_returns** | RLS: `organisation_id = auth.uid()` | **No** (broken) | **Broken** | No | **Critical** | Same bug |
| **gst_reconciliation** | RLS: `organisation_id = auth.uid()` | **No** (broken) | **Broken** | No | **Critical** | Same bug |
| **gstr1_documents** | RLS uses `org_members` subquery | Yes | Yes | No | Low | Properly scoped |
| **gstr2b_documents** | RLS uses `org_members` subquery | Yes | Yes | No | Low | Properly scoped |
| **subcontractor_tds_payments** | RPC/API filters by `organisation_id` via subcontractor relationship | Yes | Partial (via app logic) | No | Medium | Depends on app-layer filtering |
| **party_opening_balances** | RLS uses `user_can_access_org` | Yes | Yes | No | Low | Properly scoped |
| **CoA masters (accounts)** | `ChartOfAccounts.tsx` queries filter by `organisation_id` | Yes | Yes | No | Low | Properly scoped |
| **Voucher numbering** | `generate_voucher_number` is per-org, per-type, per-FY | Yes | N/A | No | Low | Correct |

**Summary:** 2 tables have completely broken RLS (`purchase_returns`, `purchase_return_items`). 6 GST tables have broken RLS comparing org_id to user_id. The active posting RPC (`post_journal_entry`) does not validate account org ownership.

---

## 2. Voucher Posting Logic (trace)

### Entry Point: `post_journal_entry` (ACTIVE — used by frontend)
**File:** Supabase RPC (remote DB)  
**Called from:** `useCreateJournalEntry()` in `useAccounting.ts:128`

```sql
-- ACTIVE RPC (what frontend calls)
CREATE OR REPLACE FUNCTION public.post_journal_entry(
  p_organisation_id uuid, p_voucher_date date, p_voucher_type text,
  p_narration text, p_lines jsonb
) RETURNS uuid LANGUAGE plpgsql AS $function$
DECLARE
  v_journal_id UUID;
  v_total_debit DECIMAL := 0;
  v_total_credit DECIMAL := 0;
  v_line JSONB;
  v_voucher_no TEXT;
  v_account RECORD;
BEGIN
  -- 1. Validates >= 2 lines
  IF jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'At least 2 line items required';
  END IF;

  -- 2. Loops lines: sums debit/credit, validates account exists + Active
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_total_debit := v_total_debit + COALESCE((v_line->>'debit')::DECIMAL, 0);
    v_total_credit := v_total_credit + COALESCE((v_line->>'credit')::DECIMAL, 0);
    SELECT * INTO v_account FROM accounts WHERE id = (v_line->>'account_id')::UUID;
    IF NOT FOUND THEN RAISE EXCEPTION 'Account not found: %', v_line->>'account_id'; END IF;
    IF v_account.status != 'Active' THEN RAISE EXCEPTION 'Account is not active: %', v_account.name; END IF;
  END LOOP;

  -- 3. Validates double-entry (tolerance 0.01)
  IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
    RAISE EXCEPTION 'Total debit (%) must equal total credit (%)', v_total_debit, v_total_credit;
  END IF;

  -- 4. Generates voucher number per-org, per-type, per-FY
  v_voucher_no := generate_voucher_number(p_organisation_id, p_voucher_type, p_voucher_date);

  -- 5. Inserts journal_entries with status 'Posted'
  INSERT INTO journal_entries (organisation_id, company_id, voucher_no, voucher_date, voucher_type, narration, status, total_debit, total_credit)
  VALUES (p_organisation_id, p_organisation_id, v_voucher_no, p_voucher_date, p_voucher_type::voucher_type, p_narration, 'Posted', v_total_debit, v_total_credit)
  RETURNING id INTO v_journal_id;

  -- 6. Inserts lines + updates account balances
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    INSERT INTO journal_entry_lines (journal_id, account_id, debit, credit, party_type, party_id, narration)
    VALUES (v_journal_id, (v_line->>'account_id')::UUID, COALESCE((v_line->>'debit')::DECIMAL, 0), COALESCE((v_line->>'credit')::DECIMAL, 0), (v_line->>'party_type')::party_type_enum, (v_line->>'party_id')::UUID, v_line->>'narration');

    -- 7. Updates account.current_balance incrementally
    PERFORM update_account_balance((v_line->>'account_id')::UUID, COALESCE((v_line->>'debit')::DECIMAL, 0), COALESCE((v_line->>'credit')::DECIMAL, 0));
  END LOOP;

  RETURN v_journal_id;
END; $function$
```

| Check | Actual implementation | Enforced? (Yes/No) | Proof | Verdict |
|---|---|---|---|---|
| **Dr == Cr balance** | `ABS(v_total_debit - v_total_credit) > 0.01` throws exception | Yes | RPC line: `IF ABS(...) > 0.01 THEN RAISE EXCEPTION` | Works |
| **Account exists + Active** | `SELECT * INTO v_account FROM accounts WHERE id = ...` then status check | Yes | RPC loop | Works |
| **Account org validation** | **NONE** — does not check `accounts.organisation_id = p_organisation_id` | **No** | RPC only checks `id` and `status`, not org | **CRITICAL: cross-org posting possible** |
| **Party required for control accounts** | Accepts `party_type`/`party_id` but no validation that control accounts require it | No | RPC inserts party_id as-is without checking account.account_type | Gap |
| **Period lock check** | **NONE** — `financial_periods.is_closed` not referenced | No | No `financial_periods` query in RPC | **Gap: can post to closed periods** |
| **Approval required** | Inserts with status `'Posted'` directly — no approval gate | No | No approval check in RPC | Gap |
| **Balance updates** | Calls `update_account_balance` per line: `current_balance = current_balance + debit - credit` | Yes | RPC calls `PERFORM update_account_balance(...)` | Works, but `current_balance` can drift from computed TB if lines are manually edited |
| **RBAC check** | **NONE** — no role check in RPC | No | No `auth.uid()` role validation | Gap |

### Dead Code: `post_double_entry_journal`
**Status:** Exists in DB but **never called by frontend**  
**Where:** Supabase RPC `post_double_entry_journal`  
**What it does (that `post_journal_entry` doesn't):**
- Validates `v_account_org = p_organisation_id` (account org check)
- Checks `user_can_access_org(p_organisation_id)` (RBAC)
- Validates `party_id` present when `account_type` in ('receivable', 'payable', 'Control Account')
- Checks `financial_periods` for closed periods
- Requires `accounting` or `owner` role

**Why it's dead:** Frontend `useCreateJournalEntry()` in `useAccounting.ts:128` calls `post_journal_entry`, not `post_double_entry_journal`.

### Unpost/Reverse
**Status:** **Not implemented**  
No RPC or UI found for reversing/unposting a journal entry. Once posted, entries cannot be reversed through the application.

---

## 3. Calculations Verification

| Calculation | Function/path | Formula implemented | Uses org/config? | Hardcoded values | Testable? | Verdict |
|---|---|---|---|---|---|---|
| **GST (intra/inter)** | Frontend: `CreditNoteEditorPageV2.tsx:198`, `Bills.tsx:294-296`, `usePurchaseQueries.ts:1242` | `taxable * rate / 100`; intra splits rate in half (`/200`) for CGST+SGST | No — rates come from item data, defaults are hardcoded | **Yes:** default `cgst=9, sgst=9, igst=18` when item.gst_percent missing | Partially | Works for invoices/CNs/DNs, but default rates are hardcoded |
| **GST (RPC level)** | `record_debit_note` RPC | `taxable * (tax_pct/200)` for intra, `taxable * (tax_pct/100)` for inter | No master rate table — rate passed via `p_items[].tax_percent` | No | Yes | Works but relies on caller-supplied rates |
| **TDS (subcontractor only)** | `SubcontractorWorkOrderCreate.tsx`, `ledgerCalculator.ts` | `gross_amount * tds_percent / 100` | No master table — `tds_percent` stored on work order | No | Partially | Only for subcontractors, not general vendors/professionals |
| **TDS (general)** | **Not implemented** | N/A | N/A | N/A | No | No TDS calculation for general vendors |
| **Ageing** | **Not implemented** | N/A | N/A | N/A | No | No debtors/creditors ageing |
| **Schedule III** | **Not implemented** | N/A | N/A | N/A | No | `schedule_iii_line` column exists but no report |
| **Project P&L** | **Not implemented** | N/A | N/A | N/A | No | Project tagging exists but no aggregation report |
| **FX/Rounding** | Rounding to 2 decimals in frontend (`Math.round(x*100)/100`) | Standard 2-decimal rounding | No FX revaluation logic found | No | Partial | No FX handling |

### GST Calculation Detail (verified working)
**Frontend** (`CreditNoteEditorPageV2.tsx:194-198`):
```typescript
const cgstPct = isInter ? 0 : Number(invItem.cgst_percent || invItem.tax_percent || 9);
const sgstPct = isInter ? 0 : Number(invItem.sgst_percent || invItem.tax_percent || 9);
const igstPct = isInter ? Number(invItem.igst_percent || invItem.tax_percent || 18) : 0;
const taxable = qty * rate;
const cgstAmt = Math.round(taxable * cgstPct / 100 * 100) / 100;
```
**RPC** (`record_debit_note`):
```sql
IF v_is_intrastate THEN
  v_line_cgst := ROUND(v_line_taxable * (v_line_tax_pct / 200.0), 2);
  v_line_sgst := ROUND(v_line_taxable * (v_line_tax_pct / 200.0), 2);
ELSE
  v_line_igst := ROUND(v_line_taxable * (v_line_tax_pct / 100.0), 2);
END IF;
```
**Verdict:** Calculation is mathematically correct for POS-based GST. **However**, POS (place of supply / state) logic is not enforced in the general DayBook voucher entry — it's only applied in invoice/CN/DN-specific modules.

---

## 4. Hardcoded Values Inventory

| Literal found | File:line | Context (usage) | Should be config? | Per-org? | Recommendation |
|---|---|---|---|---|---|
| `18` (GST default) | `conversions/api.ts:290` | `gst_percentage: Number(item.gst_percentage \|\| 18)` | Yes | No | Move to org-level tax config |
| `9` (CGST/SGST default) | `CreditNoteEditorPageV2.tsx:81` | `createEmptyItem()` defaults | Yes | No | Move to org-level tax config |
| `18` (IGST default) | `CreditNoteEditorPageV2.tsx:81` | `createEmptyItem()` defaults | Yes | No | Move to org-level tax config |
| `'2100'` (AP account code) | `record_debit_note` RPC | Hardcoded lookup for Accounts Payable | Yes | No | Make configurable per org |
| `'5000', '1500', '2000'` (purchase return account codes) | `record_debit_note` RPC | Fallback account lookup for contra entry | Yes | No | Make configurable |
| `'Purchase Return%'`, `'Inventory%'` (account name fallback) | `record_debit_note` RPC | ILIKE fallback for contra account | Yes | No | Make configurable |
| Voucher prefixes (`RCP`, `PAY`, `INV`, `PO`, `JRNL`, `CNTR`, `CN`, `DN`) | `generate_voucher_number` RPC | Prefix mapping by voucher type | No (standard) | N/A | Acceptable as standards |
| `'Posted'` (voucher status) | `post_journal_entry` RPC | Hardcoded status on insert | No (standard) | N/A | Acceptable |
| `0.01` (balance tolerance) | `post_journal_entry` RPC | Dr/Cr tolerance | No (standard) | N/A | Acceptable |
| Financial year April-March logic | `generate_voucher_number` RPC | FY calculation | No (India-specific standard) | N/A | Acceptable for Indian context |

**Summary:** GST default rates are hardcoded in 3+ places. Debit note RPC hardcodes account codes with silent fallback to name search — if accounts don't exist, GL posting is skipped without error.

---

## 5. RBAC, Audit Trail, Period Locks (enforcement)

### Permission Checks

| Item | Enforcement point | Actually enforced? | Bypass possible? | Evidence | Verdict |
|---|---|---|---|---|---|
| **Post voucher** | `post_journal_entry` RPC | **No** | **Yes** — no role check in RPC | RPC has no `auth.uid()` role validation | **Broken** |
| **Post voucher (hardened)** | `post_double_entry_journal` RPC | Yes (requires `accounting` or `owner`) | No | Dead code — frontend never calls it | **Exists but unused** |
| **Approve voucher** | **Not implemented** | No | N/A | No approval gate in posting RPC | Missing |
| **Close period** | `financial_periods` table | No enforcement | N/A | Table exists but never queried in posting | Missing |
| **Create CoA** | `ChartOfAccounts.tsx` UI | UI-only | Yes | No RPC/API role check found | Partial |
| **Delete CoA** | `ChartOfAccounts.tsx` UI | UI-only | Yes | `handleDelete` calls direct delete without RPC guard | Partial |

### Audit Trail

| Item | Enforcement point | Actually enforced? | Evidence | Verdict |
|---|---|---|---|---|
| **Journal entry changes** | `trg_journal_audit` trigger on `journal_entries` | **Yes** | Trigger fires AFTER INSERT/UPDATE/DELETE, calls `log_journal_audit()` | Works |
| **Journal line changes** | `trg_journal_lines_audit` trigger on `journal_entry_lines` | **Yes** | Same function, logs to `journal_audit_logs` | Works |
| **Unified across all tables** | **No** | No | Only `journal_entries` and `journal_entry_lines` have triggers | Partial |
| **Viewer UI** | **Not found** | No | No audit log viewer page found | Missing |

**Audit log schema** (from `log_journal_audit` function):
```sql
CREATE TABLE journal_audit_logs (
  id UUID PRIMARY KEY,
  table_name TEXT,        -- 'journal_entries' or 'journal_entry_lines'
  record_id UUID,
  action TEXT,            -- 'INSERT', 'UPDATE', 'DELETE'
  old_data JSONB,
  new_data JSONB,
  changed_by UUID,        -- auth.uid()
  changed_at TIMESTAMP,
  ip_address TEXT
);
```

### Period Locks

| Item | Enforcement point | Actually enforced? | Evidence | Verdict |
|---|---|---|---|---|
| **Period lock table** | `financial_periods` with `is_closed` | Table exists | Schema: `id, organisation_id, period_name, start_date, end_date, is_closed, closed_at, closed_by` | **Not enforced** |
| **Posting guard** | **None** | **No** | `post_journal_entry` and `post_double_entry_journal` do not query `financial_periods` | **Critical gap** |
| **Frontend check** | **None** | **No** | No `financial_periods` query in DayBook or any voucher UI | Gap |

---

## 6. Imports Verification

| Import | Handler (path) | Validates? | Writes to real tables? | Org-scoped? | Dr=Cr enforced? | Verdict |
|---|---|---|---|---|---|---|
| **CoA import** | **Not found** | No | No | N/A | N/A | **Not implemented** |
| **Ledger/Party import** | **Not found** | No | No | N/A | N/A | **Not implemented** |
| **Opening balance (CoA)** | **Not found** | No | No | N/A | N/A | **Not implemented** |
| **Opening balance (Parties)** | `LedgerDashboard.tsx` `OpeningBalanceTab` | Partial | Yes (`party_opening_balances` table) | Yes (via `useAuth().organisation.id`) | No Dr=Cr validation found | Partial |
| **Bulk import (materials)** | `BulkImportModal.tsx` + `utils/bulkImport.ts` | Yes | Yes (`materials`, `warehouses`) | Yes | N/A | Works for non-accounting |

**Summary:** No accounting import wizards exist. The only import infrastructure (`BulkImportModal`) handles materials/warehouses. CoA import, ledger import, and CoA opening balance import are all missing despite being in the reference UX checklist.

---

## 7. Evidence Log

### Files Read (key findings)

| File | Key Findings |
|---|---|
| `supabase/migrations/20240101000156_double_entry_gl_engine.sql` | Core GL schema: `accounts`, `journal_entries`, `journal_entry_lines`, `post_double_entry_journal` RPC (dead code), `update_account_balance`, `get_trial_balance`, `ensure_gl_account_exists` |
| `supabase/migrations/20260922000000_purchase_returns.sql` | **CRITICAL:** RLS policies set to `true`/`true` (no tenant isolation) |
| `supabase/migrations/20260922000001_purchase_returns_rpc_fix.sql` | Fixed `convert_purchase_return_to_debit_note` to include `return_qty` |
| Remote DB RPC `post_journal_entry` | **Active posting RPC.** Validates Dr=Cr, account active, but NO org check on account, NO period lock, NO RBAC, NO approval |
| Remote DB RPC `post_double_entry_journal` | **Dead code.** Has org validation, RBAC, party checks, period locks — but never called by frontend |
| Remote DB RPC `record_debit_note` | Debit note creation with GST calc + GL posting. Hardcodes account codes `2100`, `5000`, `1500`, `2000`. Silent skip if accounts missing. |
| Remote DB RPC `generate_voucher_number` | Per-org, per-type, per-FY sequential numbering. Correct. |
| Remote DB RPC `update_account_balance` | `current_balance = current_balance + debit - credit`. Called by `post_journal_entry`. |
| Remote DB RPC `generate_next_dn_number` | Per-org sequence (`dn_seq_<org_id>`). Correct. |
| Remote DB RPC `recalc_vendor_balance` | Recalculates vendor balance from bills/debits/payments. Correct. |
| `src/pages/accounting/useAccounting.ts:121-178` | Frontend calls `post_journal_entry` (not the hardened version) |
| `src/pages/accounting/DayBook.tsx` | Voucher entry UI — no period lock check, no approval workflow |
| `src/pages/accounting/ChartOfAccounts.tsx` | CoA tree UI — lacks Schedule III, GST/TDS, normal balance fields |
| `src/gst/api/index.ts` | GST CRUD API — no calculation logic, just table reads/writes |
| `src/credit-notes/pages/CreditNoteEditorPageV2.tsx:194-198` | GST calc: intra splits rate/2, inter uses full rate. Defaults: 9% CGST, 9% SGST, 18% IGST |
| `src/modules/Purchase/components/Bills.tsx:294-296` | GST calc in bills: `taxable * percent / 100` |
| `src/modules/Purchase/components/DebitNotes.tsx:77-85` | GST calc in debit notes |
| Remote DB RLS policies | `purchase_returns`/`purchase_return_items`: `true`/`true`. GST tables: `organisation_id = auth.uid()` (wrong) |
| Remote DB `financial_periods` table | Exists with `is_closed` but never checked in posting RPCs |
| Remote DB `journal_audit_logs` + triggers | Audit logging works for journal entries and lines only |

### Critical Code Snippets

**1. Cross-org account bypass in active posting RPC:**
```sql
-- post_journal_entry validates account exists and is active, BUT NOT org:
SELECT * INTO v_account FROM accounts WHERE id = (v_line->>'account_id')::UUID;
IF NOT FOUND THEN RAISE EXCEPTION 'Account not found: %', v_line->>'account_id'; END IF;
IF v_account.status != 'Active' THEN RAISE EXCEPTION 'Account is not active: %', v_account.name; END IF;
-- MISSING: IF v_account.organisation_id <> p_organisation_id THEN RAISE EXCEPTION ...
```

**2. Dead hardened RPC with correct checks:**
```sql
-- post_double_entry_journal (never called by frontend)
SELECT v_account_org, v_account_active, v_account_type INTO ...
FROM accounts WHERE id = v_account_id;
IF v_account_org IS NULL OR v_account_org <> p_organisation_id THEN
  RAISE EXCEPTION 'Account % does not belong to organization %', v_account_id, p_organisation_id;
END IF;
-- Also checks: user_can_access_org, financial_periods, party_id for control accounts
```

**3. Broken GST RLS:**
```sql
-- gst_inward_supply RLS (and all gst_* tables):
CREATE POLICY "Organisations can view their own GST inward supply"
  ON gst_inward_supply FOR SELECT
  USING (organisation_id = auth.uid());  -- WRONG: auth.uid() is user UUID, not org UUID
```

**4. Purchase returns with no RLS:**
```sql
-- 20260922000000_purchase_returns.sql
CREATE POLICY "Enable all access" ON purchase_returns FOR ALL USING (true) WITH CHECK (true);
-- Same for purchase_return_items
```

**5. Debit note RPC hardcoded account codes with silent skip:**
```sql
SELECT id INTO v_ap_account_id FROM accounts WHERE account_code = '2100' LIMIT 1;
SELECT id INTO v_purchase_return_account_id FROM accounts
  WHERE account_code IN ('5000', '1500', '2000') OR name ILIKE '%Purchase Return%' OR name ILIKE '%Inventory%'
  LIMIT 1;
IF v_ap_account_id IS NOT NULL AND v_purchase_return_account_id IS NOT NULL THEN
  -- INSERT journal entries...
END IF;
-- If accounts not found, no GL is posted — but debit note is still created!
```

**6. No period lock check:**
```sql
-- post_journal_entry: no reference to financial_periods
-- post_double_entry_journal: no reference to financial_periods
-- financial_periods table exists but is never queried during posting
```

---

## Appendix: Assumptions

1. `auth.uid()` returns the authenticated user's UUID, not the organisation UUID. Verified by checking `auth.uid()` usage in `generate_next_dn_number` (compared against `user_can_access_org`).
2. The `post_double_entry_journal` RPC is dead code — confirmed by grep across entire `src/` directory showing zero references.
3. `current_balance` on `accounts` is maintained by `update_account_balance` called from `post_journal_entry`, but `get_trial_balance` recomputes from journal lines + opening_balance. If `post_double_entry_journal` were used (or if lines are manually edited), balances could drift.
4. CSV reference files (`Voucher_Matrix_India.csv`, `Compliance_Mapping_India.csv`, `GST_TDS_Masters_India.csv`) are binary/XLSX and could not be parsed; analysis based on markdown specs only.
