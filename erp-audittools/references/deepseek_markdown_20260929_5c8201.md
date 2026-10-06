# Fraud Pattern Library — ACFE + ISA 240 mapped to ERP objects

For each pattern, the auditor must test whether the ERP **detects**,
**blocks**, **logs**, or **ignores** it. Ignore = CRITICAL.

---

## A. Procurement / P2P

### A1. Fake / ghost vendor
- **Signals:** vendor with no PO history, bank in high-risk jurisdiction,
  address = employee address, tax ID invalid, phone = employee phone.
- **ERP tests:**
  - Does vendor creation require tax-ID validation?
  - Does vendor master check for duplicate address/bank?
  - Does vendor creation require independent approval?
  - Is vendor with no transactions in 12 months flagged?

### A2. Duplicate invoice
- **Signals:** same vendor + same amount within N days; same invoice number
  across different vendors; amount rounded.
- **ERP tests:**
  - Duplicate invoice number check enabled?
  - Same amount + same vendor within 90 days triggers review?
  - OCR of invoice matches PO/GR?

### A3. Split PO / split invoice
- **Signals:** multiple POs to same vendor within short window, each just
  under approval threshold.
- **ERP tests:**
  - Cumulative value check across POs?
  - Threshold-bypass report?

### A4. Kickback pricing
- **Signals:** PO price > last PO price + market; no competitive bid.
- **ERP tests:**
  - Price history comparison at PO entry?
  - Bid waiver requires reason + approval?

### A5. GR without delivery
- **Signals:** GR posted with no logistics evidence, no serial/lot scan.
- **ERP tests:**
  - GR requires carrier / delivery note reference?
  - GR without PO flagged?

### A6. Invoice without GR
- **Signals:** three-way match bypassed.
- **ERP tests:**
  - Match enforcement level: block / warn / allow?
  - Override requires second approval + log?

### A7. Vendor bank change fraud
- **Signals:** bank changed shortly before a large payment.
- **ERP tests:**
  - Bank change maker–checker?
  - Out-of-band confirmation?
  - Pending payments flagged on bank change?
  - Change logged with before/after?

### A8. Urgent / emergency PO abuse
- **Signals:** high share of "urgent" POs by one user.
- **ERP tests:**
  - "Urgent" flag rate-limited?
  - Reported to management?
  - Ceiling enforced?

---

## B. Order-to-Cash

### B1. Standalone credit memo
- **Signals:** credit memo without original invoice; to related party.
- **ERP tests:**
  - Reference to original invoice enforced?
  - Dual approval above threshold?
  - Related-party detection?

### B2. Discount abuse
- **Signals:** one rep's average discount far above peers.
- **ERP tests:**
  - Discount cap enforced?
  - Override approval + log?

### B3. Cash application fraud (lapping)
- **Signals:** cash applied to wrong invoices; unapplied cash aging.
- **ERP tests:**
  - Unapplied cash > N days auto-escalated?
  - Can user apply cash to invoices they created?

### B4. Write-off abuse
- **Signals:** repeated small write-offs by same user.
- **ERP tests:**
  - Write-off threshold + approval?
  - Cumulative write-off tracking?

---

## C. Finance / GL

### C1. Journal entry fraud
- **Signals:** round-dollar JEs, backdated JEs, JEs to suspense accounts,
  JEs posted near close.
- **ERP tests:**
  - JE dual approval above threshold?
  - Suspense account posting restricted?
  - Backdated JE blocked?
  - JE into closed period blocked?

### C2. Fixed-asset fraud
- **Signals:** opex capitalized; disposals not recorded; useful life
  manipulated.
- **ERP tests:**
  - Capitalization threshold enforced?
  - Disposal approval + log?
  - Useful life changes logged?

### C3. Bank reconciliation fraud
- **Signals:** reconciling items aged; same user edits bank master.
- **ERP tests:**
  - Reconcile SoD from bank master edit?
  - Aging report?
  - Write-off of reconciling item requires approval?

---

## D. HR / Payroll

### D1. Ghost employee
- **Signals:** employee with no time entries; duplicate bank account across
  employees; bank account changed right before payroll.
- **ERP tests:**
  - New hire requires HR + manager + payroll triad?
  - Duplicate bank detection?
  - Off-cycle payment approval?

### D2. Expense fraud
- **Signals:** duplicate receipts, out-of-policy claims, weekend/holiday,
  round amounts, expense just under threshold.
- **ERP tests:**
  - Policy engine blocks (not warns)?
  - Duplicate receipt detection?
  - Threshold-splitting detection?

### D3. Timesheet fraud
- **Signals:** backdated entries; approver = submitter; hours just under
  overtime threshold.
- **ERP tests:**
  - Backdating blocked or flagged?
  - SoD submit vs approve?
  - Overtime threshold alerting?

---

## E. Inventory

### E1. Inventory shrink cover-up
- **Signals:** repeated small adjustments below approval threshold; same
  user; same SKU.
- **ERP tests:**
  - Cumulative adjustment tracking per user/SKU?
  - Reason code required?
  - Cycle count triggers on variance?

### E2. Fake transfer
- **Signals:** stock transfer created and received by same user; no
  in-transit visibility.
- **ERP tests:**
  - Transfer create SoD from receive?
  - In-transit report?

---

## F. Cross-module

### F1. Threshold splitting
- **Pattern:** multiple transactions just under approval threshold.
- **ERP tests:**
  - Cumulative value check across N days?
  - Threshold-bypass report?

### F2. Round-number transactions
- **Pattern:** amounts ending in 000.
- **ERP tests:**
  - Report on round-number financial transactions?

### F3. Backdated transactions
- **Pattern:** transaction date earlier than creation date.
- **ERP tests:**
  - Backdating blocked or flagged?
  - Report on backdated transactions?

### F4. Off-hours activity
- **Pattern:** transactions outside business hours.
- **ERP tests:**
  - Off-hours report?
  - Alerting?

### F5. User burst activity
- **Pattern:** one user, many objects, short window.
- **ERP tests:**
  - Velocity check?
  - Alerting?

---

## G. ISA 240 fraud risk factors (auditor's lens)

The standard requires the auditor to presume fraud risk in:
- **Revenue recognition** — side agreements, channel stuffing, bill-and-hold.
- **Management override of controls** — top-side JEs, unusual transactions.

Map these to ERP tests:
- Revenue: does the ERP detect bill-and-hold (invoice without shipment)?
- Override: does the ERP log every override with reason + approver?