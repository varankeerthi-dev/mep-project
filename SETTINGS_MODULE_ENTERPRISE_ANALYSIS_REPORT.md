# Settings Module — Enterprise Analysis Report

**Scope:** `features/settings-v2/` shell + all 16 tabs (native + embedded legacy pages), RBAC permission catalog, `useUnsavedChanges` hook, control kit (`SettingToggle/Select/Input/Row/Section/RadioGroup`).
**Method:** full file reads + live screenshots at `/settings?tab=general` and `/settings?tab=numbering-series` (1017px viewport).
**Status:** report only — no code changes in this step.

---

## 1. What the Settings Module Actually Is

**Architecture.** One shell (`SettingsV2Page`) owns routing (`?tab=` + path aliases), per-tab dirty tracking, a save/discard registry, a global save bar, and an unsaved-changes guard dialog. 6 tabs are native (built on the shared `Setting*` control kit); 10 are legacy pages embedded via `lazy()` inside the shell. The native tabs share a `useUnsavedChanges` hook that gives snapshot diffing, debounced localStorage drafts, restore-on-return, and dirty signals.

**The good bones (genuinely enterprise-grade already):**
- Dirty-per-tab tracking with amber dot in the sidebar + guard dialog on navigation (Save & Proceed / Discard / Cancel).
- Draft persistence across sessions, with a "Restore Draft" banner when you come back.
- `PermissionGuard` at the page root (`org.settings` permission) with a graceful fallback message.
- URL-addressable tabs with a deep-link alias map.
- Lazy loading + skeletons per tab.

---

## 2. Feature & Control Inventory (16 tabs, truth-checked)

| Tab | Core controls | Persists to | State |
|---|---|---|---|
| **General & Config** | Round Off (segmented), Auto Item Codes (toggle), Date Format (select) | `organisations`, `settings` | Real. Only 3 settings. |
| **Organisation Info** | Identity, GSTIN/PAN/TAN/MSME, logo upload → storage, address, contact | `organisations` | Real, but no GSTIN/PAN format validation (the client zod GSTIN schema lives elsewhere and is not reused here). |
| **Team Members** | Employee roster + add form, portal-invite checkbox; Requests tab; Roles tab (16 permission modules × view / create / edit / delete / approve) | `employees`, RBAC tables | Roster is a read-only list — no edit / deactivate / role-assign on existing members. The roles tab is effectively a stub. |
| **Numbering Series** | Per-series prefix / start / pad / suffix, duplicate-prevention, FY format / month / current | `document_settings`, `settings`, `organisations` | Real but two competing UIs exist (native `NumberingTab` is never mounted; legacy `TransactionNumberSeries` renders). Live data shows duplicate "Purchase Order" rows and a junk `QWE / ssss0001` series. |
| **Document Templates** | 20+ built-in presets, default flags, column / label editor | `document_templates` | Real. Largest tab (~907 lines). |
| **Print Layouts** | Per-template page size / orientation / margins | `document_templates` | Real. |
| **Discount Settings** | 5 tables: structures, pricelists, variant settings | `discount_*` | Real, dense. |
| **Quick Quote** | Estimation defaults + size mappings | API module | Real. |
| **Module Management** | 31 module toggles, Enable / Disable All, search | org module states | Real. The control panel does **not** hide disabled modules from the app’s side-menu (no consumer found), so the live app still shows modules you think are off. |
| **Approval Workflows** | 8+ doc types, enable / reviewer / multi-level | workflow tables | Real (~915 lines) but built with zero guardrails: no threshold amounts, no cycle detection, no self-approval block. |
| **Tools & Equipment** | General / tools tabs | — | **Save button is a stub** (`console.log` only). Users believe they saved — they did not. Highest-risk page in the suite. |
| **Item Categories / Units / Variants / Warehouses** | Master-data CRUD | materials tables | Real (shared materials settings kit). |
| **Terms & Conditions** | Templates, sections, drag-order clauses | `terms_conditions_*` | Real (post-fix). |

**Control-layer inconsistencies found on the ground:**
- 🔴 **Broken segmented control** — Round Off Off / On renders as a clipped white pill on the right edge (live screenshot confirms).
- 🔴 **Two Boolean languages** — Numbering header uses a bare HTML checkbox; every other boolean in the page is a styled toggle.
- 🔴 **Serif font fallback** in the content area — body text and descriptions render in a generic serif instead of Inter.
- 🟡 **Legacy tabs bypass the dirty-tracker entirely** — editing Discount / Print / QuickQuote / Terms shows no save bar and no guard dialog; tab-switch silently loses work.
- 🟡 **No destructive-action pattern anywhere** — no confirm step, no typed confirmation, no undo for delete or disable.
- 🟡 No keyboard accessibility on the sidebar (0 `aria-`/`role-` attributes), and settings search matches labels only — no descriptions / aliases.

---

## 3. First-Principles UX Analysis (from the user’s chair)

**Who actually uses this page:**
1. An **owner/admin** setting up once during onboarding — fearful, checkbox by checkbox, terrified of accidentally breaking invoices.
2. An **accounts person** touching numbering / templates weekly — speed-motivated, hates being blocked or losing work.
3. A **field / ops manager** who should never reach dangerous tabs at all.

**What they need that the page doesn’t give them:**

1. **"What does this break?" is unanswered.** Every settings failure is a blast-radius problem. "Auto-generate Item Codes" tells you what it does, not that it affects every future material created. Round Off changes every printed total. The FY selector even admits danger in a footnote — but nothing enforces a pause there.
2. **Silent failure is the killer.** The Tools stub save and the un-guarded legacy tabs both violate the one contract a settings page has: *what I see saved is saved.* One lie destroys trust in all 16 tabs.
3. **Safety should be proportional to consequence.** Today a typo in GSTIN and disabling a whole module require identical effort: one click. Consequence and friction should be correlated — currently they are not.
4. **Undo beats confirmation.** Admins change settings in bursts (onboarding = 30 edits in 10 minutes). A confirm dialog on every save is torture; a visible *"last changed by, 5 min ago · Undo"* is freedom.
5. **State must be visible.** The amber dot exists per tab, but there is no "3 sections have unsaved changes" summary, no last-saved timestamp, and no indication of whether *you* or a colleague changed something.

---

## 4. UX Recommendations — The Enterprise Control Kit

### A. The three-tier toggle system (replaces today's one-size toggle)

| Tier | Use for | Behavior |
|---|---|---|
| **T1 Instant** | Display preferences (date format, density) | Applies immediately, with an **Undo (5s)** toast. |
| **T2 Staged** | Business rules (round off, numbering, discounts) | Keep the current dirty → save-bar model. Add an **inline impact hint**: "Affects new quotations only. Existing documents keep their numbers." |
| **T3 Guarded** | Module disable, FY change, approval-structure edits | Toggle flips → inline confirmation strip inside the row (not a modal): "36 employees will lose access to Manufacturing. [Keep it ON] [Disable anyway]" + typed confirmation only if the affected count exceeds 20. |

### B. Buttons — the four-verb standard

1. **Primary Save** — keep the current blue bar. Add a **"Saved 2 min ago"** timestamp that flips to "Unsaved changes" the moment anything dirties. This kills the "did it save?" anxiety.
2. **Danger actions** (delete template, disable module, discard draft) — outline-red button with a **2-step micro-confirm in place**: the button turns into "Click again to confirm · 3s" — no modal, undoable where possible.
3. **Section-level Reset to default** — text button on every section header. Enterprise users constantly need "what was it before I touched it."
4. **Bulk ops** (Enable / Disable All in Modules) — must preview before committing: "This will disable 24 of 31 modules."

### C. Guardrails that make it enterprise

- **Numbering Series:** live preview exists — extend it with a **collision check** (debounced DB lookup; red "already used by INV-0042" inline), a **series merge / dedupe wizard** for the duplicate rows visible in your data, and **lock editing** a series once documents exist (force "start a new series" instead — that is the fallback behavior users actually need).
- **Validation parity:** reuse the client zod GSTIN / PAN / phone schemas on the Organisation Info fields; validate on blur with the correction hint ("GSTIN format: 27AAAAA0000A1Z5").
- **Change log** (tab or footer panel): who changed what, when, with revert. The infrastructure for this (snapshot diffing) already exists inside `useUnsavedChanges` — the feature is just one migration away.
- **Team Members completion:** role assignment + soft-deactivate on each roster row. Without it, the 16-module permission catalog has no enforcement surface for existing users.

### D. Consistency sweep (quick wins)

- One boolean = one control: kill the bare checkbox; use the toggle everywhere.
- One select = `SettingSelect`: migrate the 5 raw `<select>`s in the legacy tabs to the native control.
- Apply Inter to body text (fix the serif fallback).
- Fix the segmented-control clipping.
- Wire the legacy tabs into `useUnsavedChanges` so the guard dialog covers all 16 tabs.
- Add `aria-labels` / roving focus to the sidebar (it is the primary navigation of the page).

---

## 5. Priority Order (if you later say "implement")

1. **P0 — Trust:** real persistence for Tools Settings; wire all legacy tabs into dirty-tracking / guard; fix the segmented control + font fallback.
2. **P1 — Safety:** T3 guarded toggles (Modules + FY); numbering collision check + dedupe; zod validation on tax fields.
3. **P2 — Power:** change log with undo; "Saved x ago" indicator; reset-to-default per section; Team Members role-assign / deactivate.
4. **P3 — Polish:** bulk-op previews; a11y pass; search over descriptions + aliases.

---

*Generated as a report. Produces UX suggestions from first principles mapped to actual user point-of-view; no fixes were applied in this step.*
