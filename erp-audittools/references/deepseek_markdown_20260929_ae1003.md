# ERP UX Heuristics — Extended Reference

ERP UX is not cosmetics. A confusing screen is a fraud enabler and a
control bypass. Rate every screen 0–5 against these. Any score ≤2 is a
finding.

---

## Core heuristics (used in SKILL.md §3)

### UX-1. Affordance honesty
Does the UI imply a control (lock icon, "required" asterisk, "verified"
badge) that the backend does not actually enforce?
- **5:** Every affordance maps to a real backend rule.
- **2:** Some affordances are decorative; user cannot tell which are real.
- **0:** "Verified" badge appears on unverified data.

### UX-2. Destructive-action friction
Is "Delete / Cancel / Void / Reverse" separated from normal actions,
confirmed, and reason-coded?
- **5:** Destructive action requires reason code + typed confirmation +
  second approver (for financial objects).
- **2:** Single confirm dialog.
- **0:** One-click destructive action.

### UX-3. Approval visibility
Can the approver see *what changed since draft* and *who changed it*?
- **5:** Side-by-side diff + change history + attachments inline.
- **2:** Approver sees only the final values.
- **0:** Approver sees a "summary card" with no detail — rubber-stamp.

### UX-4. Field-level help
Are critical fields (payment terms, tax code, cost center, T&C) explained
inline?
- **5:** Tooltip + example + link to policy, without leaving screen.
- **2:** Help icon opens a PDF.
- **0:** No help; user guesses.

### UX-5. Error specificity
Does a blocked save explain WHICH rule fired and HOW to fix it?
- **5:** "Blocked: PO amount 12,000 exceeds your approval limit 10,000.
  Request approval from [Manager]." with one-click escalation.
- **2:** "Invalid input."
- **0:** Silent failure.

### UX-6. Default-danger
Any checkbox, radio, or dropdown whose default is the *less safe* option.
- **5:** All safety-critical defaults are safe (unchecked, restrictive).
- **2:** Some defaults unsafe.
- **0:** Consent/safety checkboxes pre-checked.

### UX-7. Search & filter
Can auditors retrieve transactions by user, date, amount, vendor without
writing SQL?
- **5:** Saved searches, export to CSV, filter by change-doc.
- **2:** Basic search only.
- **0:** No search; must know transaction ID.

### UX-8. Mobile / approval ergonomics
Can an approver meaningfully review a PO on mobile, or is it a rubber-stamp
button?
- **5:** Full detail + attachments + diff visible on mobile.
- **2:** Amount + vendor only.
- **0:** Single "Approve" button, no detail.

### UX-9. Bulk actions
Are bulk approve/post actions scoped, previewed, and logged per-item?
- **5:** Per-item confirmation + audit log per item.
- **2:** Bulk with summary log.
- **0:** Bulk with no per-item log.

### UX-10. Latency honesty
Does the UI show optimistic success before the server confirms (creating
ghost transactions)?
- **5:** Spinner until server confirms; failure shown clearly.
- **2:** Optimistic UI with rollback.
- **0:** Optimistic UI with no rollback — user thinks it saved.

---

## Extended heuristics (ERP-specific)

### UX-11. Context preservation
When the user returns to a list after editing a record, is scroll position
and filter preserved?

### UX-12. Cross-reference visibility
Does a PO screen show linked GR, invoice, and payment status inline?
- **5:** Full document flow with drill-through.
- **0:** User must open 4 screens to reconstruct.

### UX-13. Attachment integrity
Are attachments versioned? Can a user replace a quote PDF after approval?

### UX-14. Number formatting
Are amounts shown with currency, thousand separators, and consistent
decimals? Inconsistent formatting hides fraud.

### UX-15. Date/time clarity
Are timestamps shown with timezone? Is "created" vs "posted" vs "modified"
clearly labeled?

### UX-16. Role-appropriate density
Does a data-entry user see 80 fields when 12 are relevant? Cognitive
overload → mistakes → fraud cover.

### UX-17. Confirmation of irreversible actions
Is irreversible action (posting a payment, closing a period) confirmed
with the amount/user/date echoed back?

### UX-18. Approval re-authentication
For high-value approvals, is the user re-prompted for password/MFA?
- **5:** Re-auth for amounts > threshold.
- **0:** Session reuse allows one-click approval hours later.

### UX-19. Notification integrity
Do approval notifications include the amount, vendor, and a link — or just
"you have a pending approval"?

### UX-20. Audit-friendly UI
Can an auditor (read-only role) see:
- All fields including hidden ones?
- Change history?
- Who approved what, when?
If the UI hides these from auditors, the UI is a control weakness.

---

## Anti-pattern library (with severities)

| Anti-pattern | Severity | Why |
|---|---|---|
| Pre-checked safety/consent checkbox | CRITICAL | Nullifies control |
| "Override" button without reason code | CRITICAL | No audit trail |
| Default = least safe option | HIGH | Silent policy violation |
| Destructive action without confirmation | HIGH | Data loss / fraud cover |
| Success toast before server confirms | HIGH | Ghost transactions |
| Approval screen hides key fields | HIGH | Rubber-stamp approvals |
| No inline help on financial fields | MEDIUM | Wrong data entry |
| No drill-through from report to source | MEDIUM | Audit friction |
| Bulk approve without per-item preview | HIGH | Mass fraud |
| Mobile approval = single button | HIGH | Rubber-stamp |
| Error "Invalid input" with no field | MEDIUM | User confusion |
| No auditor export | MEDIUM | Audit friction |
| Field labels differ from industry standard | LOW | Training cost |
| No timezone on timestamps | MEDIUM | Audit ambiguity |
| Attachments replaceable after approval | HIGH | Evidence tampering |
| No re-auth for high-value approvals | HIGH | Session hijack |
| Approval notification lacks amount | MEDIUM | Blind approval |
| Auditor role sees fewer fields than user | CRITICAL | Audit impossible |

---

## Scoring

For each screen audited:
1. Score 0–5 on each heuristic.
2. Any score ≤2 → finding.
3. Severity from the anti-pattern table (if matched) else:
   - Score 0 → HIGH
   - Score 1–2 → MEDIUM
4. Compute screen average; screens < 3.0 → module-level UX finding.

---

## How to cite findings

Every UX finding must cite:
- **Screen name** (and screenshot file)
- **Heuristic** (UX-N)
- **Score** (0–5)
- **Anti-pattern** (if matched)
- **Severity**
- **Evidence** (screenshot region)
- **Fix** (concrete UI change, not "improve UX")

Example:
> **UX finding — PO approval screen**
> Heuristic UX-3 (Approval visibility): score 1.
> Anti-pattern: "Approval screen hides key fields."
> Severity: HIGH.
> Evidence: `po_approval.png` — T&C checkbox not shown; vendor bank
> details not shown; only amount + vendor name.
> Fix: Add collapsible "Control details" panel showing T&C status,
> vendor bank (last 4), and diff since draft; require scroll-to-view
> before enabling Approve button.