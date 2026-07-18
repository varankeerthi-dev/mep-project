# OpenCode Implementation Prompts — CreateQuotation.tsx Refactor (All Phases)

## READ THIS FIRST

**Phase 1 below is verified against your actual current file** — every anchor string
was pulled directly from `apps/web/src/pages/CreateQuotation.tsx` and can be pasted
into OpenCode as-is.

**Phases 2-6 CANNOT be exact-anchor prompts yet.** They touch files that don't exist
until Phase 1's module split lands (`useQuotationMutations.ts`, `QuotationItemsTable.tsx`,
etc.). Running them as written risks the same problem as the original "Move To" PRD —
the agent guessing at insertion points instead of matching them exactly.

**Recommended use:**
1. Run Phase 1 only. Verify it (checklist included).
2. Come back and ask me to re-derive Phase 2's exact anchors from the post-Phase-1
   file structure — I'll `view` the actual new files before writing it.
3. Repeat for each subsequent phase.

Phases 2-6 are included here as **scoped instructions** (what to build, where, why,
edge cases to handle) so you have the full picture — but treat them as drafts to be
finalized, not paste-ready prompts, until the phase before them has actually shipped.

---

## PHASE 1 — Concurrency Lock, S.No Fix, isDirty Fix, Module Split
### (Exact anchors — verified against current file — ready to run)

```
TASK: Fix concurrency data loss, S.No indexing bug, and false dirty-state warning in
apps/web/src/pages/CreateQuotation.tsx. Do NOT do the module split (folder
restructure into CreateQuotation/index.tsx + hooks + components) in this same pass —
that is a separate, larger mechanical change and should be its own PR so any
regression is easy to bisect. This prompt covers only the three functional/data-safety
fixes below.

---

STEP 1 — Capture updated_at on load, for use as a concurrency token

First, verify the quotation_header table actually has an `updated_at` column
maintained by a trigger on every update. If it does not exist, use `revision_no`
instead everywhere `updated_at` appears below (increment it manually by 1 on every
successful save in that case).

Find this state declaration (search near the top of the component, close to other
useState declarations for formData/items):
  const [isDirty, setIsDirty] = useState(false);

Add directly after it:
  const [lastLoadedUpdatedAt, setLastLoadedUpdatedAt] = useState<string | null>(null);

---

STEP 2 — Set lastLoadedUpdatedAt when a quotation loads

Find this exact block inside loadQuotation:

  if (data) {
      setFormData({
        id: isDuplicate ? '' : (data.id || ''),
        quotation_no: isDuplicate ? '' : (data.quotation_no || ''),

Insert a new line directly BEFORE `setFormData({`:

  if (data) {
      if (!isDuplicate) {
        setLastLoadedUpdatedAt(data.updated_at || null);
      }
      setFormData({
        id: isDuplicate ? '' : (data.id || ''),
        quotation_no: isDuplicate ? '' : (data.quotation_no || ''),

(Duplicated quotations should not carry the concurrency token of the source record,
since they become a new row on save — hence the isDuplicate guard.)

---

STEP 3 — Add the optimistic locking guard to the save path

Find this exact block:

      if (editId) {
        const { data: updatedHeader, error: updateError } = await withTimeout(
          supabase
            .from('quotation_header')
            .update(quotationData)
            .eq('id', editId)
            .eq('organisation_id', organisation?.id)
            .select('id'),
          'updating quotation header'
        );
        if (updateError) throw updateError;
        if (!updatedHeader || updatedHeader.length === 0) {
          throw new Error('Quotation header not found for update or permission denied.');
        }
        quotationId = updatedHeader[0].id;
        setFormData(prev => ({ ...prev, id: quotationId }));

Replace with:

      if (editId) {
        let updateQuery = supabase
          .from('quotation_header')
          .update(quotationData)
          .eq('id', editId)
          .eq('organisation_id', organisation?.id);

        if (lastLoadedUpdatedAt) {
          updateQuery = updateQuery.eq('updated_at', lastLoadedUpdatedAt);
        }

        const { data: updatedHeader, error: updateError } = await withTimeout(
          updateQuery.select('id, updated_at'),
          'updating quotation header'
        );
        if (updateError) throw updateError;
        if (!updatedHeader || updatedHeader.length === 0) {
          toast.error('Save conflict', {
            description: 'This quotation was modified by someone else. Please reload to see the latest version before saving again.'
          });
          setSaving(false);
          return;
        }
        quotationId = updatedHeader[0].id;
        setLastLoadedUpdatedAt(updatedHeader[0].updated_at);
        setFormData(prev => ({ ...prev, id: quotationId }));

NOTE: if you determined in Step 1 that this table uses `revision_no` instead of
`updated_at`, replace `.eq('updated_at', lastLoadedUpdatedAt)` with
`.eq('revision_no', lastLoadedRevisionNo)`, and include `revision_no: (formData.revision_no || 1) + 1`
in the `quotationData` payload being sent, so it increments on every successful save.

---

STEP 4 — Fix the S.No indexing bug

Find this exact block:

                items
                  .filter(item => {
                    if (activeSection === 'materials') {
                      return item.section !== 'erection';
                    } else {
                      return item.section === 'erection';
                    }
                  })
                  .map((item, index) => {
                  const itemCountBefore = items.slice(0, index).filter(i => !i.is_header && !i.is_subtotal).length;

Replace with:

                items
                  .filter(item => {
                    if (activeSection === 'materials') {
                      return item.section !== 'erection';
                    } else {
                      return item.section === 'erection';
                    }
                  })
                  .map((item, index, filteredArr) => {
                  const itemCountBefore = filteredArr.slice(0, index).filter(i => !i.is_header && !i.is_subtotal).length;

(This computes itemCountBefore relative to the SAME filtered array being rendered,
instead of slicing the full unfiltered items array with an index that belongs to the
filtered one. This is a minimal, safe fix — do not attempt the fuller
materialItems/erectionItems useMemo split described in Phase 1 of the PRD; that
belongs to the module-split PR, not this one.)

---

STEP 5 — Fix the false isDirty-on-load bug

Find this exact block:

useEffect(() => {
  if (!initLoading) {
    setIsDirty(true);
  }
}, [initLoading]);

Delete it entirely.

Then verify (do not need to change, just confirm) that removeItem already calls
setIsDirty(true) after its setItems call — it does, at two call sites (the linked-
erection-charge branch and the plain-delete branch). Use that as the reference
pattern.

Search the file for any place that calls setItems(...) or setFormData(...) in
response to a direct user action (typing, toggling, selecting) and does NOT already
call setIsDirty(true) nearby. The two most likely gaps are:
  1. updateItem (the general-purpose item field updater)
  2. Any onChange handler on formData fields in the header form section

For each gap found, add setIsDirty(true) at the end of the function/handler, but
do NOT add it to purely load/init-triggered calls (e.g., inside loadQuotation itself,
or the initial setItems(mappedItems) call when a quotation is first loaded) — only
to handlers that fire from direct user interaction.

---

TESTING CHECKLIST (do these manually after implementation):
1. Open the same quotation in two browser tabs. Edit and save in Tab B first — it
   succeeds. Then try to save in Tab A (with its now-stale lastLoadedUpdatedAt) —
   confirm you get the "Save conflict" toast instead of a silent overwrite.
2. Materials tab: confirm S.No reads 1, 2, 3... continuously with no gaps or resets.
3. Switch to Erection tab: confirm S.No there also reads continuously starting from
   1 within that section (this fix makes each section count independently within
   itself — full cross-section numbering is a module-split-era change, not this one).
4. Open a quotation and do NOT edit anything. Try to close the tab / navigate away —
   confirm NO "unsaved changes" browser warning appears.
5. Open a quotation, edit one field (e.g. payment terms), try to close — confirm the
   warning DOES appear this time.
6. Run `pnpm --filter=web build` — zero new TypeScript errors.
```

---

## PHASE 2 — Item-Identity-Preserving Save
### (Scoped instructions — finalize exact anchors after Phase 1 ships)

**Goal:** Replace the `quotation_items` delete-all-then-reinsert-all pattern with a
diff against the last-loaded snapshot, so unchanged rows keep their database `id`.

**Where:** New file `utils/itemDiff.ts` (or inline in `useQuotationMutations.ts` if
the module split hasn't happened yet — confirm which with me before running).

**What to build:**
- A snapshot of `items` captured immediately after `loadQuotation` succeeds and
  again after every successful save (`originalItemsRef` or state).
- A diff function that classifies current items into `toInsert` (new, temp-id
  prefixed), `toUpdate` (existing id, changed fields), `toDelete` (existed in
  snapshot, missing from current).
- Replace the `supabase.from('quotation_items').delete()...insert()` pair in
  `handleSave` with calls to this diff function.
- New item rows created via `addEmptyItemRow`, bulk-add, and the AI document parser
  must all be tagged with a temporary id in the format `new-<uuid>` so the diff
  function can recognize them as inserts, not updates.

**Edge cases to handle:**
- A row deleted by one user and edited by another concurrently — decide whether the
  update-on-missing-row case should surface a toast (recommended, reuse the Phase 1
  conflict-toast pattern) or fail silently.
- Every code path that creates a new item row must use the `new-` id convention
  consistently, or it will misclassify as an update against a nonexistent id.

**Verification:**
1. Edit 2 fields on an 80-item quotation, save — network tab shows ~2 update calls,
   not a full delete+insert of all 80 rows.
2. Delete one row, add one row, edit a third, save in one action — confirm all three
   operation types fire correctly and `display_order` ends up sequential.

---

## PHASE 3 — Autosave + Save-Status Indicator
### (Scoped instructions — finalize exact anchors after Phase 2 ships)

**Goal:** Debounced background save reusing Phase 1 + 2's save path, with a visible
Saved/Saving/Unsaved indicator.

**Where:** New `hooks/useAutosave.ts`, new `components/SaveStatusIndicator.tsx`.

**What to build:**
- `useEffect` watching `items`/`formData`/`isDirty`, 3-second debounce, calls a
  `silentSave()` variant of the existing save function that skips status-change
  side effects (approval triggers, Draft→Sent transitions).
- Must reuse the exact same optimistic-locking + diff-save path as manual save —
  no separate/duplicate save logic — so conflicts are caught here too.
- Guard against firing while a manual save (`saving` state) is already in flight.

**Edge cases:**
- Debounce timer must reset on every relevant state change (cleanup function in the
  `useEffect`, standard pattern — do not accumulate multiple pending saves).
- A conflict during autosave should surface the same toast as Phase 1's manual-save
  conflict, and the status indicator should reflect "Unsaved changes" (not flip to
  "Saved") until the user reloads and reconciles.

**Verification:**
1. Edit a field, wait 3s without clicking Save, refresh — edit persisted.
2. Two-tab conflict during the autosave window — same conflict toast fires as manual
   save.
3. Confirm autosave never changes `status` or fires approval side effects.

---

## PHASE 4 — Virtualize the Items Tables
### (Scoped instructions — finalize exact anchors after Phase 1's module split ships)

**Goal:** Only render visible rows in `QuotationItemsTable` / `ErectionItemsSection`
once quotations exceed roughly 30-50 rows.

**Where:** Inside the extracted `QuotationItemsTable.tsx` / `ErectionItemsSection.tsx`
components — this phase cannot start until those components exist as separate files.

**What to build:**
- Pair the already-installed `@tanstack/react-table` with `@tanstack/react-virtual`
  for row rendering.
- Off-screen rows render as fixed-height placeholders; visible rows (+ overscan)
  mount full input/select components.

**Edge cases:**
- Header and subtotal rows have different heights than regular rows — virtualization
  needs per-row height awareness, not a uniform fixed height, or scroll position
  will drift.
- Keyboard focus must survive scrolling a focused row out of the rendered window —
  test tab-through explicitly, this is the most common virtualization regression.
- Drag-and-drop and "Move To" must still be able to target off-screen rows — needs
  auto-scroll-while-dragging, or dropping onto an unmounted row becomes impossible.

**Verification:**
1. 150-item quotation, type continuously in a cell — no visible lag.
2. Scroll to the middle, click a cell, tab through several rows — focus tracks
   correctly.
3. Drag a row toward an off-screen target — auto-scroll engages, drop succeeds.

---

## PHASE 5 — Presence Banner
### (Scoped instructions — finalize exact anchors after Phase 1 ships)

**Goal:** Warn a user, before they start editing, that someone else already has the
quotation open — prevention layer on top of Phase 1's detection-at-save-time layer.

**Where:** New `hooks/usePresence.ts`, new `components/PresenceBanner.tsx`.

**What to build:**
- Reuse whatever `last_active_at` presence mechanism already exists elsewhere in
  the app (ask me to locate it in the codebase before building a new one).
- On mount, upsert presence for this quotation id; clear on unmount/save.
- If another user's presence is detected and still within a TTL window on load, show
  a dismissible, non-blocking banner naming them and roughly when they opened it.

**Edge cases:**
- Must expire via timestamp + TTL, not rely solely on clean unmount (tab
  crash/force-quit won't fire cleanup).
- Must stay advisory only — never blocks editing or saving.

**Verification:**
1. Open the same quotation in two sessions — second session shows the banner.
2. Close/idle-out the first session — banner clears or times out in the second.
3. Confirm the banner never blocks editing or saving.

---

## PHASE 6 — UX Polish (Validation, Combined View, Touch, Bulk Ops, Session Refresh)
### (Scoped instructions — finalize exact anchors after Phases 1-2 ship)

Each sub-item below is independently shippable; can be run as separate small prompts
rather than one large one.

**6.1 Inline validation** — move client/date-range checks from the `handleSave`
pre-flight block into per-field `onBlur` handlers in `QuotationHeaderForm.tsx`,
reusing the existing `zod` `dateValidationSchema`. Track per-field "touched" state so
errors don't show before the user has interacted with a field.

**6.2 Combined section view** — replace the `activeSection` full tab-swap with both
`QuotationItemsTable` and `ErectionItemsSection` rendering together on one scroll,
separated by a section divider that collapses if a section is empty.

**6.3 Touch-friendly row actions** — replace hover-reveal opacity/transform buttons
with always-visible icon buttons, ~40px minimum tap target.

**6.4 Bulk operations** — row checkboxes in `QuotationItemsTable`, toolbar actions
for bulk delete/discount-override/move-to-section when 1+ rows selected. Bulk delete
must reuse the existing linked-erection-charge confirmation warning per affected row,
not skip it at bulk scale. Batch into as few network calls as practical rather than
one call per row.

**6.5 Session-expiry UX** — replace the inline `withTimeout(ensureValidSession(), ...)`
workaround in `handleSave` with a background token-refresh timer (e.g. every 5
minutes) independent of save actions; only prompt re-login if that background
refresh itself fails. Ensure an in-flight autosave during a refresh retries rather
than silently failing.

**Verification (all of 6.x):**
1. Blank required field, tab away — inline error shows, no premature errors on
   untouched fields.
2. Mixed quotation — materials + erection visible on one continuous scroll.
3. Row actions usable on tablet/touch emulation without hover.
4. Bulk-delete 5 rows including one with a linked erection charge — warning shown,
   one batched delete, `display_order` reindexes correctly.
5. Tab left open past session timeout — token refreshes silently, Save/autosave
   never appear unresponsive.
