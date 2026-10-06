--
name: erp-audit-strict
description: >
  Modular, SAP-grade ERP audit skill. Audits ANY ERP module (Procurement,
  Sales/CRM, Inventory, Manufacturing, Finance, HR/Payroll, Projects, Quality,
  Maintenance, Master Data, Security, Reporting) for control gaps, fraud
  vectors, segregation-of-duties violations, and UX anti-patterns.
  Use when the user asks to audit an ERP, review controls, test a module,
  rate ERP UX, or detect procurement/sales/payroll fraud.
version: 3.0.0
license: MIT
compatibility: Claude Code, Codex, Cursor, Gemini CLI, Agent-Skills-compatible runtimes
---

# ERP Audit — Strict Mode (Multi-Module)

## 0. How this skill behaves

This skill is **module-aware**. It first **detects** which ERP module is
under audit, then **loads the matching rule pack** from §4. Universal
principles in §2 and §3 apply to **every** module. Module packs only add
specifics — they never override the universal rules.

**Prime directive:** *If a control can be bypassed by a checkbox, a default,
a warning the user can click through, or a single user’s action, it is a
DEFECT — not a control.*

**Second directive:** *Every financial or master-data event must be
prevented, not warned about; and every mutation must be immutably logged.*

**Third directive:** *UX findings are not cosmetic. A confusing screen is a
fraud enabler. Rate UX with the same severity scale as control gaps.*

---

## 1. Execution protocol

When invoked, the agent MUST execute these steps in order:

1. **Identify the module(s).** Read the user’s prompt, screenshots, config
   exports, and file names. If ambiguous, ask ONE clarifying question, then
   proceed.
2. **Collect evidence.** Use `tools/extract_config.py` on any config export;
   `tools/diff_change_log.py` on any audit/change tables; `tools/sod_matrix.py`
   on any user-role matrix; `tools/screenshot_ocr.py` on UI images.
3. **Run Universal Checks (§2 + §3).** Always, for every module.
4. **Run the Module Rule Pack (§4.x)** matching the module.
5. **Cross-check against Fraud Library (§5)** and **UX Library (§6)**.
6. **Score and produce the report** using the template in §7.
7. **Never soften findings.** If severity is CRITICAL, say so plainly.

If evidence is insufficient, the agent must **state the assumption** and rate
the finding as `UNVERIFIED — treat as CRITICAL until proven otherwise`.

---

## 2. Universal control principles (apply to every module)

### 2.1 Enforcement over intent
- Controls must **prevent** non-compliant actions, not merely warn.
- **Canonical failure:** a checkbox (e.g., T&C acceptance, “I have verified
  the vendor”, “Urgent — bypass approval”) that is **checked by default**.
  A pre-checked box is not consent; it is a nullified control.
- Required pattern: unchecked by default, cannot submit until user
  affirmatively checks it, and the check is logged with **user ID, timestamp,
  IP, and screen version**.

### 2.2 Four-eyes / segregation of duties (SoD)
- No single user may complete a full financial lifecycle alone:
  - **Procure-to-Pay:** vendor create → PO create → PO approve → GR → invoice
    post → payment proposal → payment release.
  - **Order-to-Cash:** customer create → sales order → delivery → invoice →
    cash application → credit memo.
  - **Hire-to-Retire:** employee create → payroll run → payroll approve →
    bank file release.
  - **Record-to-Report:** journal entry → JE approve → period close.
- **SAP baseline:** F110 payment run creation and release cannot be the same
  user. Apply the same rule everywhere.
- **Test:** build the user × transaction matrix; flag any user who can
  perform two adjacent steps without a second approver.

### 2.3 Immutable audit trail
- Every mutation to a financial object (PO amount, vendor bank, customer
  credit limit, salary, GL account, cost center) must be logged with
  **before-value, after-value, user, timestamp** — and the log must be
  append-only, non-deletable by end users.
- **SAP baseline:** change documents (`CDHDR`/`CDPOS`). If the audited ERP
  lacks equivalent, flag CRITICAL.

### 2.4 Fail-closed configuration
- If a matching rule, approval, or validation fails, the system must
  **block**. “Override and proceed” buttons are a CRITICAL defect unless
  they require a second approver and are logged.
- Tolerance settings (invoice vs PO, GR vs PO) must be **explicitly set**;
  a blank tolerance = infinite tolerance = CRITICAL.

### 2.5 Least privilege & role hygiene
- No user should hold more than one high-risk role without compensating
  control. High-risk role pairs are listed in each module pack (§4).
- Role assignments must be **reviewed periodically**; check whether the ERP
  supports time-bound roles and recertification.

### 2.6 Data-integrity guardrails
- Master data (vendors, customers, items, BOMs, GL accounts, employees)
  must have **maker–checker** workflows. A single user editing bank details
  is a CRITICAL fraud vector (see §5.1).
- Deletion of master data must be **soft** (deactivation), never hard
  delete, if any transaction references it.

### 2.7 Integration & API hardening
- Every API endpoint that mutates financial data requires:
  authenticated caller, scoped token, idempotency key, rate limit, and
  **logging identical to UI actions**.
- Webhooks must be signed. Unsigned webhooks into financial objects = HIGH.

### 2.8 Reporting integrity
- Any user who can **create/modify** a financial transaction must NOT be
  able to also **alter the definition** of the report that presents it
  (report-writer vs transactional-user SoD).

---

## 3. Universal UX heuristics (rate every screen)

Score each screen 0–5 per heuristic. Any score ≤2 is a finding.

| # | Heuristic | What to look for |
|---|-----------|------------------|
| UX-1 | **Affordance honesty** | Does the UI imply a control (lock icon, “required” asterisk) that the backend does not enforce? |
| UX-2 | **Destructive-action friction** | Is “Delete / Cancel / Void” separated, confirmed, and reason-coded? |
| UX-3 | **Approval visibility** | Can the approver see *what changed since draft* and *who changed it*? |
| UX-4 | **Field-level help** | Are critical fields (payment terms, tax code, cost center) explained inline, not in a PDF? |
| UX-5 | **Error specificity** | Does a blocked save explain WHICH rule fired and HOW to fix it? |
| UX-6 | **Default-danger** | Any checkbox, radio, or dropdown whose default is the *less safe* option → finding. |
| UX-7 | **Search & filter** | Can auditors retrieve transactions by user, date, amount, vendor without writing SQL? |
| UX-8 | **Mobile/approval ergonomics** | Can an approver meaningfully review a PO on mobile, or is it a rubber-stamp button? |
| UX-9 | **Bulk actions** | Are bulk approve/post actions scoped, previewed, and logged per-item? |
| UX-10 | **Latency honesty** | Does the UI show optimistic success before the server confirms (creating ghost POs)? |

---

## 4. Module rule packs

The agent selects the pack(s) matching the audit scope. If the user says
“audit the ERP,” run **all** packs — but prioritize by financial exposure.

---

### 4.1 Procurement / Purchase-to-Pay (P2P)

**Scope:** requisition, RFQ, PO, goods receipt, invoice, payment.

**High-risk role pairs (SoD):**
- Vendor master create ↔ PO create
- Vendor bank detail edit ↔ Payment run release
- PO approve ↔ GR post
- GR post ↔ Invoice post
- Invoice post ↔ Payment run release

**Strict checks:**
- **T&C checkbox** (user’s canonical example): must be unchecked by default,
  must block submit until checked, must be logged with user+timestamp+version
  of the T&C text. If the T&C text is editable by the same user → CRITICAL
  (they can rewrite the terms they’re agreeing to).
- **PO without requisition:** Is a PO allowed to bypass requisition? If yes,
  check whether it’s logged as “exceptional” and reported.
- **Split POs:** Does the system detect POs split to stay under approval
  threshold (same vendor, same requester, within N days, sum > threshold)?
  If not → HIGH fraud vector.
- **Vendor bank change:** Requires maker–checker, out-of-band confirmation
  (callback/email to known contact), and re-approval of pending payments.
- **Three-way match:** PO ↔ GR ↔ Invoice with explicit tolerances. Blank
  tolerance = CRITICAL.
- **Retroactive PO:** Can a PO be dated before the invoice? If yes, flag.
- **Blanket PO** release logic: can releases exceed the blanket ceiling?
- **Emergency/urgent PO** bypass: what’s the ceiling and who approves?

**Module-specific UX:**
- Is the PO approval screen showing attachments (quotes, T&Cs) inline?
- Does the approver see the *current* vendor bank details, not cached ones?
- Is there a one-click “copy last PO” that also copies outdated prices?

**Fraud patterns (§5 cross-ref):** fake vendor, duplicate invoice, split PO,
kickback pricing, GR without delivery, invoice without GR.

---

### 4.2 Sales / CRM / Order-to-Cash

**Scope:** lead, opportunity, quote, sales order, delivery, invoice,
collections, credit, returns.

**High-risk role pairs:**
- Customer master create ↔ Credit limit edit
- Sales order create ↔ Price/discount override
- Invoice post ↔ Credit memo post
- Cash application ↔ Write-off
- Sales rep ↔ Commission approver

**Strict checks:**
- **Discount override:** Must be capped, reason-coded, and approved above
  threshold. Unbounded override = CRITICAL.
- **Price list integrity:** Can a rep edit the price list? Only pricing admin,
  with change log.
- **Credit limit:** Can order entry proceed when customer is over limit?
  Must be blocked unless Credit Manager approves *that specific order*.
- **Returns / credit memos:** Must reference original invoice; standalone
  credit memo > threshold requires dual approval (classic fraud vector).
- **Cash application:** Unapplied cash > N days must be reported; users
  cannot apply cash to invoices they created.
- **Commission engine:** Changing commission rates must be SoD from sales.
- **Subscription/auto-renewal:** auto-renew must be logged and cancellable.

**CRM-specific:**
- Lead conversion to opportunity to order must preserve audit link.
- Pipeline-stage changes: who can force-close “Won” without order?
- Can a rep delete a lost deal to hide churn? (Soft-delete with reason.)

**UX:**
- Does the order screen warn about credit hold *before* line entry?
- Are credit memos visually distinct from invoices in lists?

---

### 4.3 Inventory / Warehouse Management

**Scope:** item master, stock moves, adjustments, cycle count, transfers.

**High-risk role pairs:**
- Item master edit ↔ Stock adjustment
- Cycle count enter ↔ Cycle count approve
- Stock transfer create ↔ Stock transfer receive (same user = fake transfer)

**Strict checks:**
- **Manual stock adjustment:** Requires reason code + approval above
  tolerance. Unapproved adjustment = CRITICAL.
- **Negative stock:** Must be blocked unless explicitly enabled with
  reason. Silent negative = CRITICAL.
- **Cycle count:** Counters must not see system quantity (blind count).
  If UI shows expected qty → fraud vector.
- **Item cost:** Standard cost changes require finance approval + log.
- **Serial/lot:** Mandatory for regulated items; check enforcement.

**UX:**
- Scan-first workflows (barcode) vs manual entry.
- Adjustment screen must show last 5 adjustments for context.

---

### 4.4 Manufacturing / Production Planning

**Scope:** BOM, routing, work orders, backflush, scrap, WIP.

**High-risk role pairs:**
- BOM edit ↔ Work-order release
- Scrap post ↔ Production confirm
- Routing change ↔ Cost roll-up

**Strict checks:**
- **BOM changes:** require engineering change order (ECO) with approval and
  effective date; no silent edits.
- **Backflush:** If enabled, verify scrap variance reports exist and are
  reviewed; unchecked backflush hides shrinkage.
- **Scrap posting:** Reason-coded, threshold-approved.
- **Work-order close:** Cannot close with open operations or unconfirmed
  quantities.
- **Cost roll-up:** Only by cost accountant; log before/after standard cost.

---

### 4.5 Finance & Accounting

Sub-modules: AP, AR, GL, Fixed Assets, Treasury, Tax, Close.

**High-risk role pairs:**
- Vendor create (AP) ↔ Payment release
- JE create ↔ JE approve
- Bank reconciliation ↔ Bank master edit
- Fixed asset capitalization ↔ Depreciation run
- Treasury deal entry ↔ Treasury deal confirm

**Strict checks:**
- **Journal entries:** Manual JEs above threshold require dual approval;
  “top-side” JEs near close are flagged.
- **Period close:** Locking must be enforced system-wide; posting into a
  closed period must be impossible without a logged reopening event.
- **Bank master (house bank) edits:** SoD from payment release; change log
  mandatory.
- **Payment file generation vs release:** Two different humans (SAP F110
  baseline).
- **Reconciliation:** Unreconciled items > N days auto-escalated.
- **FX rates:** Manual rate override requires approval + log.
- **Tax codes:** Changes SoD from tax posting.

**UX:**
- JE screen must show “entered by / approved by / posted by”.
- Reversal must preserve original JE reference.

---

### 4.6 HR / Payroll / HCM

**Scope:** employee master, time, payroll, benefits, expenses.

**High-risk role pairs:**
- Employee master edit (esp. bank) ↔ Payroll run
- Payroll run create ↔ Payroll approve/release
- Time entry ↔ Time approval (for same employee)
- Expense submit ↔ Expense approve ↔ Reimburse

**Strict checks:**
- **Bank detail change on employee:** maker–checker + out-of-band
  confirmation; and **must invalidate/flag pending payroll**.
- **Ghost employee:** new hire creation requires HR + manager + payroll
  triad; check for hires without time entries or with duplicate bank
  accounts across employees (classic ghost-employee fraud).
- **Off-cycle payments:** require dual approval, capped, reported.
- **Expense reimbursement:** SoD between submitter and approver; policy
  engine must block out-of-policy, not warn.
- **Payroll register:** immutable after approval; changes create new cycle.

**UX:**
- Employee self-service must not allow editing payroll-relevant fields
  (bank, tax ID) without triggering a re-approval.
- Payslip viewer must mask full bank/SSN.

---

### 4.7 Projects / Professional Services

**Scope:** project master, budgets, timesheets, billing, WIP.

**High-risk role pairs:**
- Timesheet submit ↔ Timesheet approve
- Project budget edit ↔ Billing rate edit
- Expense on project ↔ Client invoice

**Strict checks:**
- **Timesheet:** Approver cannot be same as submitter; backdated entries
  flagged; billable vs non-billable locked after approval.
- **Rate cards:** Changes require sales + delivery approval.
- **WIP → Invoice:** Only finance can release; log every conversion.
- **Budget overrun:** block or require change order.

---

### 4.8 Quality Management

**Strict checks:**
- Inspection result override requires QA manager + reason + log.
- Non-conformance (NCR) closure requires independent verifier.
- Certificate of Analysis (CoA) tamper-evident (hash or versioned).

---

### 4.9 Maintenance / EAM

**Strict checks:**
- Work-order closure cannot be done by the technician alone (needs
  supervisor sign-off for safety-critical assets).
- Spare-part issue from stock requires reason + work-order reference.

---

### 4.10 Master Data Management

**Strict checks:**
- Every master record has maker–checker.
- Field-level change log with before/after.
- Duplicate detection (vendor name+tax ID, customer name+address).
- Deactivation ≠ deletion; referenced records can never be hard-deleted.

---

### 4.11 Security / Access Control

**Strict checks:**
- No shared accounts; no service accounts with human login.
- MFA enforced for all financial approvers.
- Password/session policy meets NIST 800-63B.
- Role recertification at least annually, with evidence.
- Emergency (“firefighter”) access is time-boxed and logged.
- Failed-login lockout and admin action alerting.

---

### 4.12 Reporting / Analytics

**Strict checks:**
- Report definitions for financial statements are SoD from transactional
  users (see §2.8).
- Drill-through from report to source transaction must be possible.
- Exports of PII / bank data are logged and rate-limited.

---

## 5. Fraud pattern library (cross-module)

For each pattern, the agent must test whether the ERP **detects**, **blocks**,
**logs**, or **ignores** it. Ignore = CRITICAL.

1. **Fake vendor / ghost vendor** — vendor with no PO history, bank in
   high-risk jurisdiction, address = employee address.
2. **Duplicate invoice** — same vendor, same amount, within N days.
3. **Split PO / split invoice** — to stay under threshold.
4. **Kickback pricing** — PO price > last PO price or > market, no
   competitive bid.
5. **GR without delivery** — GR posted with no logistics evidence.
6. **Invoice without GR** — three-way match bypassed.
7. **Vendor bank change fraud** — bank changed, next payment diverted.
8. **Ghost employee** — payroll to non-existent person.
9. **Expense fraud** — duplicate receipts, out-of-policy, weekend/holiday
   claims auto-approved.
10. **Credit memo fraud (AR)** — standalone credit memo to related party.
11. **Cash application fraud** — cash applied to wrong invoices, lapping.
12. **JE fraud** — round-dollar JEs, backdated JEs, JEs to suspense accounts.
13. **Fixed-asset fraud** — capitalization of opex, unrecorded disposals.
14. **Inventory shrink cover-up** — repeated small adjustments below
    threshold.
15. **Approval bypass via “urgent” flag** — check whether “urgent” is
    rate-limited, reported, and audited.

Each fraud test must cite **the exact screen, field, or config** where the
ERP fails.

---

## 6. UX anti-pattern library

Flag any occurrence. Severity is stated per anti-pattern.

| Anti-pattern | Severity |
|---|---|
| Pre-checked safety/consent checkbox | CRITICAL |
| “Override” button without reason code | CRITICAL |
| Default = least safe option | HIGH |
| Destructive action without confirmation | HIGH |
| Success toast before server confirms | HIGH |
| Approval screen hides key fields (bank, T&C) | HIGH |
| No inline help on financial fields | MEDIUM |
| No drill-through from report to source | MEDIUM |
| Bulk approve without per-item preview | HIGH |
| Mobile approval = single “Approve” button | HIGH |
| Error message “Invalid input” with no field | MEDIUM |
| Search returns paginated but no export for auditors | MEDIUM |
| Field labels differ from industry standard (e.g., “Payment terms” vs “T&C”) | LOW |

---

## 7. Report template

Every audit produces this structure:

ERP Audit Report — <Module> — <Date>
0. Scope & evidence
Modules audited:

Evidence reviewed (files, screenshots, exports):

Assumptions & unverified areas:

1. Executive summary
Overall risk rating: CRITICAL / HIGH / MEDIUM / LOW

Top 5 findings (one line each)

Estimated fraud exposure (qualitative if not quantifiable)

2. Findings
F-001 — <Title>
Module:

Severity: CRITICAL / HIGH / MEDIUM / LOW

Category: Control gap / SoD / Fraud vector / UX / Audit trail / Config

Evidence: <file:line, screenshot ID, config key>

What’s wrong:

Why it matters (SAP baseline):

Fraud / misuse scenario:

Reproduction steps:

Remediation (system-enforced, not policy):

Verification test after fix:

(repeat for every finding)

3. SoD matrix
<user × critical-action table with violations highlighted>

4. UX scorecard
<screen × heuristic table with 0–5 scores and findings>

5. Fraud-pattern coverage
<pattern × {detect, block, log, ignore} table>

6. Remediation roadmap
Quick wins (config changes, <1 week)

Structural (workflow/SoD redesign)

Strategic (platform changes)

---

## 8. Severity definitions

| Level | Definition |
|---|---|
| **CRITICAL** | Direct fraud/financial-loss enabler; no compensating control; must fix before next close. |
| **HIGH** | Control exists on paper only; bypassable by a single user or default. |
| **MEDIUM** | Control works but UX or logging gaps reduce its reliability. |
| **LOW** | Cosmetic or policy-adjacent; fix in normal backlog. |

---

## 9. Tool contracts (`tools/` folder)

The agent should call these when inputs are available. All tools print JSON
to stdout.

### `tools/extract_config.py`
- **Input:** ERP config export (XML / JSON / CSV).
- **Output:** normalized `{module, control_key, value, default, enforced}`.
- **Purpose:** feeds §2 and module packs.

### `tools/diff_change_log.py`
- **Input:** change-document table export (CSV/Parquet).
- **Output:** per-object mutation history with before/after/user/time.
- **Purpose:** tests §2.3 and detects suspicious edit windows.

### `tools/sod_matrix.py`
- **Input:** user–role–transaction export.
- **Output:** matrix of users vs. adjacent critical actions; violations
  flagged against §4 pack rules.
- **Purpose:** §2.2.

### `tools/screenshot_ocr.py`
- **Input:** UI screenshots.
- **Output:** field labels, default values, checkbox states.
- **Purpose:** detects pre-checked boxes, hidden fields, misleading
  affordances (§3, §6).

---

## 10. Reference files (`references/` folder)

- `sap_baseline.md` — SAP reference controls per module (F110 SoD, CDHDR
  change docs, three-way match, etc.).
- `fraud_patterns.md` — ACFE + ISA 240 taxonomy mapped to ERP objects.
- `ux_heuristics.md` — extended UX heuristics with ERP examples.

The agent must cite the relevant reference when flagging a finding.

---

## 11. Guardrails

- Never recommend “training” or “policy” as the primary fix. Fix the system.
- Never accept a screenshot as proof a control exists — request config.
- Never downgrade a CRITICAL because remediation is “hard.”
- Never audit only the happy path; always probe edge cases (backdated,
  voided, reversed, split, urgent, override).
- If the user’s evidence is a demo/trial instance, state that production
  findings may differ.