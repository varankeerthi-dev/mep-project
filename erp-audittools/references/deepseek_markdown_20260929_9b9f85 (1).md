# SAP Baseline — Reference Controls per Module

This file is the *reference standard* the auditor cites when flagging a
finding. SAP is not the only correct ERP, but its controls are the
enterprise-grade floor. If the audited ERP does less than this, flag it.

---

## 1. Procure-to-Pay (P2P)

### 1.1 Segregation of Duties (SAP GRC baseline)
| Action A | Must not be same user as | SAP object |
|---|---|---|
| Vendor master create (XK01) | PO create (ME21N) | LFA1 |
| Vendor bank change (XK02) | Payment release (F110 release) | LFB1 |
| PO create (ME21N) | PO approve (release strategy) | EKKO |
| GR post (MIGO) | Invoice post (MIRO) | MSEG |
| Invoice post (MIRO) | Payment run create (F110) | RBKP |
| Payment run create (F110) | Payment run release (F110) | REGUH |

### 1.2 Change-document logging (`CDHDR` / `CDPOS`)
Every change to the following tables must generate a change doc:
`EKKO`, `EKPO`, `LFA1`, `LFB1`, `RBKP`, `RSEG`.
Change doc records: user, date, time, transaction code, old value, new value.

### 1.3 Three-way match
- PO ↔ GR ↔ Invoice must match within tolerance.
- Tolerances set in `OMR6` (invoice) and `OMC0` (GR).
- **Blank tolerance = infinite tolerance = CRITICAL.**
- Match failure blocks posting — no "post anyway" without second approval.

### 1.4 Release strategy (`OMGS`, `OMRE`)
- PO approval is a multi-level release strategy based on amount, cost center,
  material group.
- Each release level = different user.
- "Release" is a transaction logged to `CDHDR`.

### 1.5 Vendor master
- Vendor creation must be maker–checker.
- Bank changes require separate approval + re-verification.
- Vendor is blocked (not deleted) if inactive; blocked vendor cannot be
  used in PO/invoice.

### 1.6 T&C / consent controls
- SAP has no built-in "T&C checkbox" — the correct pattern is a **custom
  workflow** where the checkbox is:
  - Unchecked by default
  - Locked (read-only) until the user affirmatively clicks it
  - Logged in `CDHDR` with the T&C version accepted
  - **Cannot be edited by the same user who is agreeing to it**
- **Default-checked T&C = CRITICAL defect.**

---

## 2. Order-to-Cash (O2C) / CRM

### 2.1 SoD
| Action A | Must not be same user as |
|---|---|
| Customer master create (XD01) | Credit limit edit (FD32) |
| Sales order create (VA01) | Discount override (VK11 / pricing condition edit) |
| Invoice post (VF01) | Credit memo post (VF11) |
| Cash application (F-28) | Write-off (F-32) |
| Sales rep | Commission approver |

### 2.2 Credit management
- `FD32` credit limit per customer.
- Order blocks when credit exceeded (`VKM3` release).
- Release must be by Credit Manager, not the sales rep.
- Every release logged.

### 2.3 Pricing / discount
- Price conditions (`VK11`) editable only by pricing admin.
- Override above % cap triggers approval workflow.
- Unbounded override = CRITICAL.

### 2.4 Credit memo fraud
- Credit memo must reference original invoice (`VBFA` document flow).
- Standalone credit memo above threshold requires dual approval.
- Related-party detection (same tax ID, same address).

---

## 3. Finance & Accounting

### 3.1 Journal entries
- Manual JE (FB50) above threshold requires second approval.
- "Top-side" JEs near period close are flagged in audit reports.
- JE post into closed period is impossible; reopening is logged.

### 3.2 Payment run (F110 baseline)
- **Create and release must be two different users.**
- Payment medium file (bank file) generated only after release.
- Payment proposal can be regenerated but old proposals are archived.

### 3.3 Period close
- `OB52` locks posting periods. Closed period = no posting.
- Reopening requires authorization object `S_PROF` + change log.

### 3.4 Fixed assets
- Capitalization (AS01) separate from depreciation run (AFAB).
- Asset disposal requires approval; unrecorded disposal = audit finding.

### 3.5 Bank master (`FI12`)
- House bank / bank account edits are SoD from payment release.
- Change requires change-doc logging.

### 3.6 FX rates
- Manual rate override (`OB08`) requires approval.
- Rate changes logged; used rates traceable to transactions.

---

## 4. HR / Payroll

### 4.1 SoD
| Action A | Must not be same user as |
|---|---|
| Employee master edit (PA30) | Payroll run (PC00_Mxx_CALC) |
| Payroll run create | Payroll approve/release |
| Timesheet submit | Timesheet approve (same employee) |
| Expense submit | Expense approve |

### 4.2 Bank detail changes
- Change to `PA0009` (bank details) requires maker–checker.
- Change flags any pending payroll for re-approval.
- Out-of-band confirmation recommended.

### 4.3 Off-cycle payments
- Require dual approval.
- Capped per period.
- Reported separately.

### 4.4 Ghost employee detection
- New hire without time entries for N periods → report.
- Duplicate bank accounts across employees → report.

---

## 5. Inventory / Warehouse

### 5.1 Stock adjustments (`MI07`, `MI10`)
- Reason code mandatory.
- Above tolerance → approval.
- Unapproved adjustment = CRITICAL.

### 5.2 Negative stock
- Blocked by default (`OMJJ`).
- If enabled, requires reason + reporting.

### 5.3 Cycle count
- Blind count (counter does not see expected qty).
- Recount required on variance > threshold.
- Count entry SoD from count approval.

---

## 6. Manufacturing

### 6.1 BOM changes (`CS01`)
- Require Engineering Change Order (ECO).
- Approval + effective date.
- Silent edits = CRITICAL.

### 6.2 Backflush (`MFBF`)
- Scrap variance reports must be reviewed.
- Unchecked backflush hides shrinkage.

### 6.3 Work order close
- Cannot close with open operations or unconfirmed qty.
- Variance report generated.

---

## 7. Security / Access

### 7.1 Authentication
- MFA required for all financial approvers.
- Password policy meets NIST 800-63B.

### 7.2 Access
- No shared accounts.
- No service accounts with human login.
- Emergency ("firefighter") access time-boxed + logged.

### 7.3 Role recertification
- At least annually.
- Evidence required.

---

## 8. Universal baselines (apply everywhere)

| Control | SAP standard |
|---|---|
| Change logging | `CDHDR`/`CDPOS` for every financial object |
| Soft delete | Deactivate, never hard delete |
| Master data SoD | Maker–checker on vendor, customer, item, employee, GL |
| Approval thresholds | Explicitly set; blank = infinite = CRITICAL |
| Fail-closed | Failed control blocks transaction; no silent override |