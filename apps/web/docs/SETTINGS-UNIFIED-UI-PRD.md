# Settings Unified UI — Full PRD

**Status:** Draft  
**Date:** 2026-07-18  
**Author:** AI Audit  
**Scope:** Complete overhaul of all `/settings` pages, routes, and related settings components into a single unified experience aligned with `DESIGN.md`.

---

## ⚠️ Implementation Constraint (Must Follow)

This is a **greenfield implementation**.

**DO NOT modify, rename, or delete any existing Settings files, routes, or components.**

Implement the new architecture **alongside** the existing implementation.

### Requirements

- Create a new feature folder: `src/features/settings-v2/`
- Create a new page: `SettingsV2Page.tsx`
- Add a temporary route: `/settings-v2`
- **Keep the existing `/settings` route fully functional and untouched.**
- Do not reuse or overwrite the current Settings implementation.
- The new implementation should be **completely isolated** from the existing one.
- It is acceptable to copy code from the existing implementation where useful, but all changes must be made only inside the new `settings-v2` feature.
- The old Settings page will be removed **only after** the new implementation is fully tested and approved.

**Objective:** Allow side-by-side comparison of the old and new Settings implementations before replacing the production version.

---

## 1. Executive Summary

The Settings area has grown organically across the project with **no shared layout, no consistent component library, and massive code duplication**. There are **15+ files** for Terms & Conditions alone, **two competing document numbering systems**, **two sidebar navigation menus** pointing to different settings, and **five different styling approaches** across settings pages. Users experience confusion finding settings, inconsistency when using them, and a general sense that the UX is "lost."

**Goal:** Consolidate everything into a single unified Settings page at `/settings` with a consistent left-nav layout, shared components aligned to `DESIGN.md`, and zero dead code.

---

## 2. Current State — File Inventory

### 2.1 Core Settings Shell

| File | Route | Styling | Notes |
|---|---|---|---|
| `src/pages/Settings.tsx` | `/settings` | 100% inline styles | Monolithic, 8 internal tabs, `alert()` for saves |
| `src/components/ModuleSettings.tsx` | (tab inside Settings) | framer-motion + inline | Well-polished but own tokens |

### 2.2 Separate Route Settings Pages

| File | Route | Styling | Notes |
|---|---|---|---|
| `src/pages/PrintSettings.tsx` | `/settings/print` | 100% inline | Left-panel doc type selector + grid |
| `src/pages/TemplateSettings.tsx` | `/settings/template` | 100% inline | ~3500 lines! Massive built-in seeding |
| `src/pages/DiscountSettings.tsx` | `/settings/discounts` | Mix | Separate route but overlaps with Settings tabs |
| `src/pages/QuickQuoteSettings.tsx` | `/settings/quick-quote` | Mix | Standalone, should be a settings tab |
| `src/pages/TransactionNumberSeries.tsx` | `/settings/document-series` | Mix | Duplicates Settings.tsx "Document Numbers" tab |
| `src/pages/TermsConditionsSettings.tsx` | `/settings/terms-conditions` | — | One of 15(!) files for the same thing |
| `src/pages/Organisation.tsx` | `/settings/organisation` | Mix | Admin-route gated |
| `src/pages/AccessControl.tsx` | `/settings/access-control` | Mix | RBAC admin page |

### 2.3 DUPLICATION ALERT — Terms & Conditions (15 files)

All of these exist. Only `src/pages/TermsConditionsSettings.tsx` is actually routed.

```
src/components/TermsConditionsDrawer.tsx
src/components/TermsConditionsTab.tsx
src/components/TermsConditionsTabSafe.tsx
src/components/TermsConditionsTabSimple.tsx
src/pages/TermsConditionsDashboard.tsx
src/pages/TermsConditionsDashboardSimple.tsx
src/pages/TermsConditionsDirect.tsx
src/pages/TermsConditionsSettings.tsx          ← IN USE (routed)
src/pages/TermsConditionsSettingsDirect.tsx
src/pages/TermsConditionsSettingsFixed.tsx
src/pages/TermsConditionsSettingsPure.tsx
src/pages/TermsConditionsSettingsRefactored.tsx
src/pages/TermsConditionsSettingsShadcn.tsx
src/pages/TermsConditionsSettingsSimple.tsx
src/pages/TermsConditionsTest.tsx
```

### 2.4 Materials Settings (embedded in MaterialsPage, NOT in /settings)

| File | Tab Label | Notes |
|---|---|---|
| `src/features/materials/settings/CategoryTab.tsx` | Categories | Mixed Tailwind |
| `src/features/materials/settings/UnitTab.tsx` | Units | Uses ui components + inline |
| `src/features/materials/settings/WarehouseTab.tsx` | Warehouses | Mixed |
| `src/features/materials/settings/VariantsTab.tsx` | "Discount Categories" (mislabeled) | Mixed |
| `src/features/materials/settings/DiscountCategoriesTab.tsx` | Discount Categories (actual) | Mostly inline |

### 2.5 Duplicate Document Numbering

- **Settings.tsx → "Document Numbers" tab:** Manages `document_settings` table (prefix, start#, padding, suffix for 7 doc types)
- **TransactionNumberSeries.tsx → `/settings/document-series`:** Manages `settings` key-value table (just `prevent_duplicate_numbers`)

Two different tables, two different UIs, same conceptual domain.

---

## 3. UX Issues Found

### P0 — Data Loss & User Confusion

1. **⚠️ ALL UNSAVED EDITS ARE LOST ON NAVIGATION (ZERO PROTECTION)**  
   The single most damaging UX issue. A user edits GST, Address, Logo, discount percentages — then clicks a sidebar link, hits browser back, or accidentally closes the tab. **Every change disappears with no warning, no draft recovery, nothing.** There is no `beforeunload` handler, no tab-switch guard, no dirty state tracking. The Settings page has NO `isDirty` concept at all — it uses standalone `alert()` saves that don't batch or protect. This has likely caused real data loss for real users.

2. **Two conflicting navigation systems**  
   The Sidebar links to `/settings`, `/settings/print`, `/settings/template`, `/settings/discounts`, etc. But the Settings page itself has its own internal sidebar with different labels. A user clicking "Print settings" in the Sidebar gets a different page than clicking "Print Layouts" inside Settings.

3. **Settings scattered across the app**  
   Materials settings (Categories, Units, etc.) live inside the Materials module, not in the Settings area. Users must know to go there separately.

4. **No unified search**  
   There is no way to search across settings. Users must know which tab or route to navigate to. Tab-name-only search is useless — you already know the tab name if you can search it. Users need to search by **values** ("GST", "round off", "invoice prefix", "padding").

### P1 — Consistency & Trust

4. **5 styling systems in one area**  
   Some tabs use Tailwind, some use 100% inline, some use framer-motion, some use `ui/` components — none follow `DESIGN.md` tokens.

5. **`alert()` for save confirmations**  
   `Settings.tsx` uses browser `alert()` dialogs. Other pages use `sonner` toast, or nothing at all. Destroys trust in the save flow.

6. **`confirm()` for delete actions**  
   Multiple settings pages use browser `confirm()` instead of proper confirmation modals. Missing "Are you sure?" context.

7. **Inconsistent modal patterns**  
   `CategoryTab`, `VariantsTab`, `WarehouseTab` use bespoke `.modal-overlay` divs. `UnitTab` uses the `Modal` component from `src/components/ui/Modal.tsx`. Two different visual experiences.

### P2 — Visual Polish

8. **"General & Config" tab is wasted space**  
   Only one toggle (round_off). Takes a full screen with a single checkbox.

9. **"Dynamic Column Builder" is misleading**  
   Loads `PrintTemplateBuilder` — another template rendering tool. Users confuse this with "Template Settings" and "Print Settings."

10. **No loading/empty/error state consistency**  
    Some pages show "Loading..." text, others show nothing, some use spinner animations.

### P3 — Code Quality

11. **`TemplateSettings.tsx` at 3500+ lines**  
    50+ hardcoded built-in template definitions inline. Makes the file unmaintainable.

12. **No shared settings API layer**  
    Every settings page calls `supabase.from('...')` directly. No error handling abstraction, no caching strategy.

13. **Dead code accumulation**  
    At least 13 Terms & Conditions files are unused. `DiscountSettings.tsx` is a separate route but could be a tab.

---

## 4. Architectural Issues

| Issue | Impact |
|---|---|
| No `SettingsLayout` shared component | Every page reimplements header, padding, sidebar from scratch |
| No `SettingRow` / `SettingSection` primitives | Every page invents its own form field layout |
| Direct `supabase` calls | No centralized API layer, no error boundary, no optimistic updates |
| No `DESIGN.md` alignment | Card padding, label widths, button colors, font sizes all deviate from documented design system |
| Settings inside `Pages/` (not `features/`) | Hard to find, hard to test, hard to reuse |
| Inline `style={}` objects duplicated | Many pages redefine the same `inputStyle`, `labelStyle`, `cardStyle` objects |

---

## 5. Unified Nav Structure (Proposed)

```
Organisation
├── General & Config         ← round_off + future general settings
├── Organisation Info        ← company name, logo, address, etc.
├── Team Members             ← user management (moved from internal tab)

Documents
├── Numbering Series         ← unified from Settings.tsx + TransactionNumberSeries
├── Document Templates       ← TemplateSettings (cleaned up)
├── Print Layouts            ← PrintSettings (cleaned up)

Commerce
├── Discount Settings        ← DiscountSettings (moved from separate route)
├── Quick Quote              ← QuickQuoteSettings (moved from separate route)

Advanced
├── Modules                  ← ModuleSettings (keep as-is)
├── Access Control           ← RBAC (keep separate route, link here)
├── Approval Workflows      ← moved from separate route `/approval-settings`

Master Data
├── Item Categories          ← moved from MaterialsPage
├── Units of Measure         ← moved from MaterialsPage
├── Variants / Discount Cats ← moved from MaterialsPage
├── Warehouses               ← moved from MaterialsPage
├── Terms & Conditions       ← consolidated to 1 file
```

---

## 6. Shared Component Library (DESIGN.md Aligned)

### 6.1 Layout Components

```tsx
<SettingsShell>
  // Full-height flex column
  // White header bar with org name, user avatar, sign out
  // Flex row body: sidebar + content
  // DESIGN.md: font-family Inter, background #fafafa
</SettingsShell>

<SettingsSidebar>
  // 240px width, border-right, white background
  // Sections with uppercase headers (11px/600/0.05em)
  // Active item: #f5f5f5 background, #171717 text
  // Inactive item: transparent bg, #525252 text
  // DESIGN.md: consistent with existing sidebar patterns
</SettingsSidebar>

<SettingsContent>
  // flex-1, overflow-y-auto
  // padding: 32px 48px
  // max-width: 1000px, margin: 0 auto
  // DESIGN.md: page-level padding
</SettingsContent>
```

### 6.2 Building Block Components

```tsx
<SettingsSection title="Section Title" description="Optional subtitle">
  // White card, border: 1px solid #e5e5e5, border-radius: 8px
  // Card header: 24px padding, title 16px/600, subtitle 13px/#525252
  // Card body: 24px padding (DESIGN.md)
  // Note: NO save bar inside the section — saves are handled globally
</SettingsSection>

<SettingRow label="Label Text" description="Optional help text">
  // Flex row, align-items: center, gap: 8px (DESIGN.md)
  // Label: min-width: 70px, 11px/600, #374151 (DESIGN.md)
  // Value: flex: 1
</SettingRow>

<SettingToggle label="Enable Feature" description="Help text" checked={bool} onChange={fn}>
  // iOS-style toggle (same visual as ModuleSettings)
  // Label on left, toggle on right
  // Green #34C759 when on, #E9E9EA when off
</SettingToggle>

<SettingInput label="Field Name" value={string} onChange={fn}>
  // Label + input inline
  // Input: 12px font, 4px 8px padding (DESIGN.md inputStyle)
</SettingInput>

<SettingSelect label="Field Name" options={[]} value={string} onChange={fn}>
  // Searchable dropdown per DESIGN.md pattern
  // .dropdown-container with click-outside handler
</SettingSelect>

<SettingSaveBar loading={bool}>
  // Sticky bottom bar
  // Primary button: #185FA5 bg, 6px 14px padding, 12px/500 font (DESIGN.md)
  // Button hover: #0C447C
  // Disabled: #e5e5e5 bg, #a3a3a3 text, cursor: not-allowed
</SettingSaveBar>
```

### 6.3 Global Save Bar (NEW — Replaces Per-Section Save Bars)

**Pattern change:** Instead of each `SettingsSection` having its own Save button at the bottom, there is ONE global sticky save bar pinned to the bottom of the page. It only appears when there are unsaved changes.

#### Behavior

- The settings page tracks a `hasChanges` boolean across **all** sections in the active tab
- When any field changes, `hasChanges` becomes `true` → the global save bar slides in
- **Discard** reverts all changes back to the last-saved state
- **Save** persists all changes across all sections at once
- When there are no changes, the save bar is hidden (zero screen footprint)
- Switching tabs while there are unsaved changes: prompt the user with "You have unsaved changes. Discard them?"

#### Visual

```
┌──────────────────────────────────────────────────────────────┐
│  ◉ Unsaved changes                                      ┌──────┐ ┌──────┐ │
│                                                            │Discard│ │ Save │ │
│                                                            └──────┘ └──────┘ │
└───────────────── Sticky bottom, full-width ──────────────────────────────────┘
```

#### Component API

```tsx
<SettingsGlobalSaveBar
  hasChanges={boolean}
  isSaving={boolean}
  onSave={() => saveAll()}
  onDiscard={() => revertAll()}
>
  // Sticky bottom: position: sticky, bottom: 0, z-index: 20
  // Background: white with top border and shadow
  // Slide in/out: animate on hasChanges toggle
  // DESIGN.md tokens: primary button #185FA5, disabled state #e5e5e5
</SettingsGlobalSaveBar>
```

#### State Management

```tsx
// Each tab manages its own change tracking internally:
const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
const [savedSnapshot, setSavedSnapshot] = useState<FormData>(initialData);
const [liveData, setLiveData] = useState<FormData>(initialData);

const hasChanges = JSON.stringify(liveData) !== JSON.stringify(savedSnapshot);

const handleDiscard = () => {
  setLiveData(savedSnapshot);
  setDirtyFields(new Set());
};

const handleSave = async () => {
  await saveAllSections(liveData);
  setSavedSnapshot(structuredClone(liveData));
  setDirtyFields(new Set());
  toast.success('Settings saved');
};
```

### 6.4 Global Content Search (NEW — Smart Search Across All Settings)

**Not just tab names.** Typing "prefix" finds the Numbering Series tab. Typing "GST" finds Organisation Info. Typing "discount" finds both Discount Settings AND Discount Categories. Typing "round" finds the round_off toggle in General & Config.

#### Problem

Users don't know which tab a setting lives in. They search by the **thing they want to configure** — "quotation prefix", "padding", "warehouse code", "approval", "GST number". A search that only matches tab/section names is useless: if you know "Numbering Series" is the tab name, you don't need search.

#### How it works

Each tab/section registers a **search index** — a flat array of keyword strings that the global search bar matches against:

```tsx
// Example: Numbering Series tab registers:
searchIndex: [
  'Numbering Series',
  'Document Numbers',
  'prefix',
  'suffix',
  'padding',
  'start number',
  'quotation prefix',
  'invoice prefix',
  'PO prefix',
  'DC prefix',
  'quotation QT0001',
  'prevent duplicate numbers',
]

// Example: General & Config tab registers:
searchIndex: [
  'General',
  'round off',
  'rounding',
  'integer rounding',
  'auto-generate item codes',
  'item code generation',
]

// Example: Organisation Info tab registers:
searchIndex: [
  'Organisation',
  'Company',
  'GST',
  'GST number',
  'PAN',
  'PAN number',
  'logo',
  'address',
  'phone',
  'email',
]
```

#### Behavior

- Default search input in the Settings page header (above sidebar + content)
- As user types, automatically filters the sidebar to show only matching tabs
- Matching tabs highlight the matched keywords within their content
- If only one tab matches, auto-navigate to it
- If no tabs match, show "No results for 'xyz'" with suggestions

#### Visual

```
┌────────────────────────────────────────────────────────────────┐
│  Settings                                  🔍 [Search settings…] │
│                                                               │
│  ┌─────────────┐  ┌─────────────────────────────────────────┐ │
│  │ Organisation│  │  🔍 Results for "prefix"                  │ │
│  │   General   │  │                                         │ │
│  │   Org Info  │  │  📄 Documents › Numbering Series         │ │
│  │   Members   │  │     Found: prefix, suffix, padding,      │ │
│  ├─────────────┤  │     quotation prefix, invoice prefix…   │ │
│  │ 📄 Documents│  │                                         │ │
│  │   Numbering │←│ ← highlighted as match                   │ │
│  │   Templates │  │                                         │ │
│  │   Print     │  │                                         │ │
│  └─────────────┘  └─────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

#### Component API

```tsx
// Each tab exports a search index:
interface SettingsTabDefinition {
  id: string;
  label: string;
  icon: React.ComponentType;
  component: React.ComponentType;
  searchIndex: string[];  // <-- NEW: flat array of all searchable terms
}

// The global search bar:
<SettingsSearchBar
  tabs={allTabs}                          // all tab definitions with searchIndex
  activeTab={activeTabId}
  onTabChange={(id) => navigate(id)}
  placeholder="Search settings — try 'GST', 'prefix', 'warehouse'…"
/>
```

#### Implementation

- Each tab's search index is defined alongside its component in the tab registry
- The search bar filters `tabs` to only those where any `searchIndex` term matches the query (case-insensitive, substring match)
- The sidebar filters in sync: unmatched tabs get `display: none`
- The search input lives in the Settings page header, above both sidebar and content

### 6.5 Unsaved Changes Dialog (NEW — Guards Against Data Loss)

**This is the most critical UX fix in the entire PRD.** More important than animations, more important than consistent styling, more important than search. Users editing settings (GST, Address, Logo, Prefixes) MUST NOT lose their work when they navigate away.

#### The 3-Layer Protection Model

```
Layer 1: Global Save Bar (In-page)  ← visual indicator, inline save/discard
Layer 2: Tab-switch Guard (In-page) ← confirm before changing tabs
Layer 3: Navigation Guard (Browser) ← beforeunload + in-app nav intercept
```

#### Layer 1: Global Save Bar (Already defined in 6.3)

Shows "Unsaved changes" + [Discard] [Save] when `hasChanges === true`. Hides when clean.

#### Layer 2: Tab-Switch Guard

When the user clicks a different sidebar tab while there are unsaved changes:

```
┌──────────────────────────────────────────────────┐
│  ⚠️  Unsaved Changes                        ─────× │
│                                                  │
│  You have unsaved changes in "General & Config."  │
│  What would you like to do?                       │
│                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  │
│  │   Discard  │  │    Save    │  │   Cancel   │  │
│  │  (Revert)  │  │ (Save & go)│  │  (Stay put)│  │
│  └────────────┘  └────────────┘  └────────────┘  │
└──────────────────────────────────────────────────┘
```

**Implementation:**

```tsx
// In the Settings shell, before updating activeTab:
const handleTabChange = (newTabId: string) => {
  if (hasChanges && newTabId !== activeTab) {
    setPendingTab(newTabId);     // queue the destination
    setShowUnsavedDialog(true);  // show the dialog
    return;                      // block navigation
  }
  setActiveTab(newTabId);
};

// Dialog actions:
const handleSaveAndNavigate = async () => {
  await saveAllChanges();
  setHasChanges(false);
  setShowUnsavedDialog(false);
  setActiveTab(pendingTab);
};

const handleDiscardAndNavigate = () => {
  revertAllChanges();      // restore savedSnapshot
  setHasChanges(false);
  setShowUnsavedDialog(false);
  setActiveTab(pendingTab);
};

const handleCancel = () => {
  setShowUnsavedDialog(false);
  setPendingTab(null);
  // stay on current tab, nothing lost
};
```

#### Layer 3: Navigation Guard (Browser + In-App)

Two separate threats:

**3a. Browser tab close / refresh / back**

Standard `beforeunload` handler registered once in the Settings shell:

```tsx
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (hasChanges) {
      e.preventDefault();
      e.returnValue = '';   // modern browsers show generic dialog
    }
  };
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [hasChanges]);
```

**3b. In-app sidebar navigation (user clicks Dashboard, Store, etc.)**

The Settings shell wraps the entire page in a navigation context that intercepts React Router navigation. When `hasChanges` is true and the user clicks any link that leaves `/settings`, show the same Unsaved Changes Dialog.

**Approach for Settings.tsx (current architecture, no React Router nesting):**

Currently Settings is rendered by App.tsx's switch/case pattern. The most practical approach is:

```tsx
// In Settings.tsx/SettingsShell:
const handleSidebarClick = (e: MouseEvent) => {
  if (hasChanges) {
    const confirmed = window.confirm(
      'You have unsaved changes. Click OK to discard them and leave, or Cancel to stay.'
    );
    if (!confirmed) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
};
```

**Future (when migrated to React Router):** Use `useBlocker` from `react-router-dom`:

```tsx
import { useBlocker } from 'react-router-dom';

const blocker = useBlocker(hasChanges);

useEffect(() => {
  if (blocker.state === 'blocked') {
    setShowUnsavedDialog(true);
    setPendingLocation(blocker.location);
  }
}, [blocker]);

const handleLeaveAnyway = () => {
  blocker.proceed();
};
```

#### Component API

```tsx
<UnsavedChangesDialog
  isOpen={boolean}
  tabName={string}                        // "General & Config"
  onSave={() => saveAndNavigate()}
  onDiscard={() => discardAndNavigate()}
  onCancel={() => stay()}
  isSaving={boolean}
/>
```

#### Visual Specification

```
┌──────────────────────────────────────────┐
│ Background: white, rounded-xl (12px)     │
│ Max-width: 420px                         │
│                                           │
│  ⚠️  [icon] amber-500 circle bg          │
│  "Unsaved Changes" — 16px/600/#171717    │
│                                           │
│  "You have unsaved changes in             │
│   [tab name]. What would you like to do?" │
│   13px/#525252                            │
│                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Discard  │ │  Save &  │ │  Cancel  │  │
│  │ & Leave  │ │   Go     │ │          │  │
│  └──────────┘ └──────────┘ └──────────┘  │
│  bg:red-50   bg:#185FA5   bg:transparent │
│  text:red-600 text:white  text:#525252   │
│  hover:red-100 hover:#0C447C hover:bg-z50│
│                                           │
│ Backdrop: black/40 + backdrop-blur-sm     │
└──────────────────────────────────────────┘
```

#### State Machine

```
                          ┌─────────────────┐
        User edits field  │  IDLE (clean)   │
          ┌──────────────>│  Save bar: HIDDEN│
          │               └────────┬────────┘
          │                        │ User saves
          │                        v
     ┌────┴──────┐          ┌─────────────────┐
     │  DIRTY    │──────────│  IDLE (clean)   │
     │ Save bar: │  Save OK │  Save bar: HIDDEN│
     │  VISIBLE  │          └─────────────────┘
     └────┬──────┘
          │
          │ User clicks tab / nav link / close
          v
     ┌──────────────────────┐
     │  GUARDED             │
     │  3 options:          │
     │  [Save & proceed]    │
     │  [Discard & proceed] │
     │  [Cancel: stay]      │
     └──────────────────────┘
```

### 6.6 useUnsavedChanges Hook (Shared Logic)

Extract the dirty-state pattern into a reusable hook that any settings tab can consume.

```tsx
// src/features/settings/hooks/useUnsavedChanges.ts

interface UnsavedChangesOptions<T> {
  initialData: T;
  onSave: (data: T) => Promise<void>;
  storageKey?: string;  // for localStorage draft persistence
}

function useUnsavedChanges<T extends Record<string, any>>({
  initialData,
  onSave,
  storageKey,
}: UnsavedChangesOptions<T>) {
  // Core state
  const [savedSnapshot, setSavedSnapshot] = useState<T>(initialData);
  const [liveData, setLiveData] = useState<T>(initialData);

  // Derived
  const hasChanges = useMemo(
    () => JSON.stringify(liveData) !== JSON.stringify(savedSnapshot),
    [liveData, savedSnapshot]
  );

  // Actions
  const discard = useCallback(() => {
    setLiveData(savedSnapshot);
    if (storageKey) localStorage.removeItem(storageKey);
  }, [savedSnapshot, storageKey]);

  const save = useCallback(async () => {
    await onSave(liveData);
    setSavedSnapshot(structuredClone(liveData));
    if (storageKey) localStorage.removeItem(storageKey);
  }, [liveData, onSave, storageKey]);

  const updateField = useCallback((field: keyof T, value: any) => {
    setLiveData(prev => ({ ...prev, [field]: value }));
  }, []);

  const updateMultiple = useCallback((partial: Partial<T>) => {
    setLiveData(prev => ({ ...prev, ...partial }));
  }, []);

  const reset = useCallback((newData: T) => {
    setSavedSnapshot(newData);
    setLiveData(newData);
    if (storageKey) localStorage.removeItem(storageKey);
  }, [storageKey]);

  // Restore from localStorage on mount
  useEffect(() => {
    if (!storageKey) return;
    try {
      const draft = localStorage.getItem(storageKey);
      if (draft) {
        const parsed = JSON.parse(draft);
        setLiveData(parsed);
      }
    } catch {}
  }, [storageKey]);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (!storageKey || !hasChanges) return;
    const timer = setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(liveData));
    }, 1000);
    return () => clearTimeout(timer);
  }, [liveData, hasChanges, storageKey]);

  return {
    liveData,
    hasChanges,
    discard,
    save,
    updateField,
    updateMultiple,
    reset,
    isSaving: false,  // override with external saving state
  };
}
```

### 6.7 localStorage Draft Persistence (Crash Recovery)

Beyond just warning, offer **actual recovery**. When a user is editing settings and the browser crashes or the tab is accidentally closed:

```
┌──────────────────────────────────────────────┐
│                                              │
│  💾 Draft recovered                          │
│  We found unsaved changes from your last     │
│  session in "Numbering Series."              │
│                                              │
│  ┌────────┐  ┌──────────┐                    │
│  │ Restore│  │ Discard  │                    │
│  └────────┘  └──────────┘                    │
│                                              │
└──────────────────────────────────────────────┘
```

**How it works:**

1. When `hasChanges` becomes true, a debounced (1s) `localStorage.setItem` saves the current `liveData` under key `settings_draft_{tabId}`
2. When the user explicitly saves OR discards, the draft key is cleared
3. On mount (page load), check for `localStorage.getItem('settings_draft_{tabId}')`
4. If found, offer to restore it with a banner before rendering the tab
5. If user clicks "Restore", load the draft into `liveData` so `hasChanges` becomes true again

This covers:
- Browser crash
- Accidental tab close
- OS restart
- Power failure

### 6.8 DESIGN.md Token Reference

```
Card body padding:                24px
Label width:                      70px
Label font:                       11px / 600 / #374151
Field gap:                        8px
Input font/padding:               12px / 4px 8px
Section header:                   11px / 600 / 0.05em / uppercase / #6b7280
Primary button bg:                #185FA5
Primary button hover:             #0C447C
Primary button padding:           6px 14px
Button font:                      12px / 500
Button border-radius:             6px (header), 8px (modal)
Card border-radius:               8px (rounded-lg)
Modal border-radius:              rounded-xl (12px)
Table header:                     11px / 600 / text-zinc-500
Status badges:                    Active=green, Inactive=gray
Delete:                           red confirmation modal, not confirm()
Saves:                            sonner toast, not alert()
```

---

## 7. Tab-by-Tab Specifications

> ⚠️ **Important:** All tabs use the **global save bar** (section 6.3), NOT per-section save buttons. The specs below omit per-section save bars because saves are handled centrally at the page level.

### 7.1 General & Config

**Before:** One toggle (round_off), `alert()` save, `confirm()` deletes.

**After:**
```
SettingsSection "General Configuration"
├── SettingToggle "Enable Round Off"
│     "When enabled, the rate after discount will be rounded to the nearest integer."
│
└── SettingToggle "Auto-generate Item Codes"
      "Automatically assign codes to new items based on category prefix."
```

### 7.2 Organisation Info

**New tab**, moved from `/settings/organisation`:
```
SettingsSection "Organisation Details"
├── SettingInput "Organisation Name"
├── SettingInput "GST Number"
├── SettingInput "PAN Number"
├── ImageUpload "Logo"
├── SettingInput "Address Line 1"
├── SettingInput "Address Line 2"
├── SettingInput "City / State / Pincode"
├── SettingInput "Phone"
└── SettingInput "Email"
```

### 7.3 Numbering Series

**Before:** Two separate implementations — one in Settings.tsx tab, one in TransactionNumberSeries.tsx route.

**After (unified):**
```
SettingsSection "Document Numbering Series"
├── For each doc type (Quotation, Invoice, PO, DC, NB-DC, Receipt, Vendor):
│   ├── [Icon] "Label" — "Description"
│   ├── SettingInput "Prefix"       (monospace, uppercase)
│   ├── SettingInput "Start #"      (number input)
│   ├── SettingInput "Pad Zeros"    (number 1-10)
│   ├── SettingInput "Suffix"       (monospace, optional)
│   └── Preview: "QT0001-24" (monospace, highlighted)
│
└── Separator: "Global Settings"
    └── SettingToggle "Prevent Duplicate Numbers"
          "Warn when a document number has already been used."
```

### 7.4 Document Templates

**Before:** 3500-line file with 50+ hardcoded template definitions.

**After (refactored):**
```
SettingsSection "Document Templates"
├── Toolbar: Search + "Add Template" + filter by style
├── For each doc type section (collapsible):
│   └── Grid of template cards:
│       └── TemplateCard
│           ├── Name + Code
│           ├── Page: A4 Portrait
│           ├── Features: Logo, Bank, Terms, Sign, MSME
│           ├── Badge: "Default" if is_default
│           └── Actions: [Set Default] [Edit Columns] [Delete]
│
└── Template Editor Modal (extracted from current inline form)
    ├── "Template Name" + "Code"
    ├── "Document Type" select
    ├── "Page Size" + "Orientation"
    ├── "Show: Logo / Bank / Terms / Signature / MSME" toggles
    ├── "Column Visibility" — scrollable list of all columns with toggles
    ├── "Custom Labels" — editable text fields for label overrides
    └── Preview section with dummy data rendering
```

**Refactoring required:**
- Extract template seeding logic into a separate data file
- Extract TemplateEditorForm into a shared component
- Reduce `TemplateSettings.tsx` from 3500 lines to ~400 lines

### 7.5 Print Layouts

**Before:** Separate full-page component with left-panel doc type selector.

**After (tab within Settings):**
```
Same functional design, but wrapped in SettingsSection:
├── Left panel: document type radio/select
├── Right panel: grid of template cards
│   └── Each card: name, features, [Set as Default]
└── No structural changes needed — just port to new layout
```

### 7.6 Modules (keep as-is, but adapt save to global bar)

`ModuleSettings.tsx` is already well-polished with framer-motion, iOS toggles, search, category grouping. Keep the component, but **remove its internal save button** — emit a `hasChanges` event upward so the global save bar handles persistence. The component already tracks `hasChanges` internally via `useMemo`, so this is just wiring it to a callback instead of a local button.

### 7.7 Team Members

**Before:** Inline in Settings.tsx tab, `confirm()` for delete.

**After:**
```
SettingsSection "Team Members"
├── Header: "Invite and manage access levels" + [Add Member] button
├── User list table:
│   ├── Avatar + Name + Email + Employee ID
│   ├── Role badge (pill)
│   └── [Delete] with confirmation modal
│
└── AddTeamMemberModal (keep existing)

Note: Team member changes (add/delete) are immediate DB operations, not deferred to the global save bar. The save bar only covers settings that batch-save together.
```

### 7.8 Discount Settings

**Before:** Separate route `/settings/discounts`, manages `discount_variant_settings` table.

**After (tab within Settings):**
```
SettingsSection "Variant Discount Rules"
├── Table of variant → default/min/max discount
├── Inline editing or slide-out panel
└── Save with toast confirmation
```

### 7.9 Quick Quote

**Before:** Separate route `/settings/quick-quote`, manages `quick_quote_settings` table + size mappings.

**After (tab within Settings):**
```
SettingsSection "Quick Quote Configuration"
├── Quick toggle to enable/disable module
├── Variant → size → price mapping table
└── Save with toast confirmation
```

### 7.10 Master Data (Sub-tab Group)

All brought in from MaterialsPage settings tabs:

```
SettingsSection "Item Categories"
├── Table: Name, Description, Active status
├── [Add Category] → Modal
└── Inline [Edit] [Delete]

SettingsSection "Units of Measure"
├── Table: Name, Code, Description, Active
├── [Add Unit] → Modal (using existing UnitTab's Modal)
└── Inline [Edit] [Delete]

SettingsSection "Discount Categories"
├── Table: Name, Default/ Min/ Max Discount %, Active
├── [Add Category] → Modal
└── Inline [Edit] [Delete]

SettingsSection "Variants"
├── Table: Name, Active, Created date
├── [Add Variant] → Modal
└── Inline [Edit] [Delete]

SettingsSection "Warehouses"
├── Table: Code, Name, Location, Default, Active
├── [Add Warehouse] → Modal
└── Inline [Edit] [Delete]
```

### 7.11 Approval Settings (NEW — Missing from PRD, Already Built)

**Discovery:** There are TWO Approval Settings components. One is dead code.

| File | Status | Details |
|---|---|---|
| `src/components/ApprovalSettings.tsx` | **IN USE** (routed at `/approval-settings`) | ~900 lines, uses direct supabase + `useOrgApprovalWorkflows` hook, supports 10 approval modules with multi-level workflows |
| `src/pages/ApprovalSettings.tsx` | **DEAD CODE** (not imported anywhere) | ~640 lines, uses `ApprovalSettingsAPI` class, older implementation |

The sidebar links to `/approval-settings` which routes to `components/ApprovalSettings.tsx`.

**After (integrated tab in settings, then file cleanup):**

```
SettingsSection "Approval Workflows"
├── ⚠️ Info banner: "Changes only apply to NEW requests after saving."
├── For each of the 10 module types:
│   ├── [Toggle] "Enable approval" — rounded oval toggle
│   ├── (if enabled) Review step toggle for QUOTATION/WORK_ORDER/INVOICE/SALES_ORDER/JOB_CARD
│   │   └── EmployeeSelect (search + dropdown) for reviewer
│   ├── Table of Approval Levels:
│   │   ├── Level (auto-numbered)
│   │   ├── Approver (EmployeeSelect searchable)
│   │   ├── Min Amount (₹)
│   │   ├── Max Amount (₹)
│   │   └── [Remove]
│   └── [Add Approval Level] button
│
├── Backfill buttons:
│   ├── [Backfill approval metadata] — populates requester/project/ref for existing approvals
│   └── [Backfill missing approvals] — creates approval records for orphaned payment requests
│
└── [Save settings] button

Note: Approval Settings uses its own per-page Save button (not the global save bar) 
because it requires complex multi-table persistence (approval_workflows + approval_settings).
This is acceptable — rewire to global save bar in a future refinement.

Note: The dead `src/pages/ApprovalSettings.tsx` should be DELETED after verifying 
the routed component covers all functionality.
```

#### Search Index for Approval Settings

```tsx
searchIndex: [
  'Approval',
  'Approval Workflows',
  'Workflow',
  'Approver',
  'Reviewer',
  'Purchase Payment',
  'Subcontractor Payment',
  'Payment Request',
  'Quotation',
  'Work Order',
  'Purchase Order',
  'Sales Order',
  'Job Card',
  'Site Expense',
  'Site Expense Request',
  'Backfill',
  'approval metadata',
  'approval levels',
  'min amount',
  'max amount',
  'approval workflow levels',
]
```

#### Note for Implementation

When porting to Settings tab, extract `EmployeeSelect` into a shared `SettingEmployeeSelect` component since it's a complex searchable dropdown reused across all 10 modules and potentially elsewhere.

### 7.12 Terms & Conditions

**Before:** 15 files, only 1 used.

**After (consolidated):**
- Delete all 14 unused files
- Keep `src/pages/TermsConditionsSettings.tsx` (the one actually routed)
- Optionally refactor it to use `SettingsSection` and `SettingRow` components later

---

## 8. Implementation Plan (Migration Order)

### Phase 1: Foundation — 1 session
1. Create `src/features/settings/components/SettingsShell.tsx`
2. Create `src/features/settings/components/SettingsSidebar.tsx`
3. Create `src/features/settings/components/SettingsContent.tsx`
4. Create `src/features/settings/components/SettingSection.tsx`
5. Create `src/features/settings/components/SettingRow.tsx`
6. Create `src/features/settings/components/SettingToggle.tsx`
7. Create `src/features/settings/components/SettingInput.tsx`
8. Create `src/features/settings/components/SettingSelect.tsx`
9. Create `src/features/settings/components/SettingsGlobalSaveBar.tsx` ← the global save bar
10. Create `src/features/settings/hooks/useDirtyTracker.ts` ← change tracking hook
11. Create `src/features/settings/index.ts` (barrel exports)

### Phase 2: Clean Up Duplicates — 0.5 session
12. Delete all 14 unused Terms & Conditions files
13. Delete unused `Sidebar.backup.tsx`
14. Delete unused `src/pages/ApprovalSettings.tsx` (dead code — the routed version is `src/components/ApprovalSettings.tsx`)
15. Document numbering: merge `TransactionNumberSeries` into Settings tab

### Phase 3: Port Existing Tabs — 2 sessions
15. Port "General & Config" tab to new components + wire to global save bar
16. Port "Numbering Series" tab (unified from Settings.tsx + TransactionNumberSeries) + wire to global save bar
17. Port "Team Members" tab (immediate saves, not batched)
18. Port "Document Templates" tab (refactor TemplateSettings.tsx — extract seeding data, extract editor form) + wire to global save bar
19. Port "Print Layouts" tab + wire to global save bar

### Phase 4: Move External Routes — 2 sessions
20. Move DiscountSettings from `/settings/discounts` into Settings tab + wire to global save bar
21. Move QuickQuoteSettings from `/settings/quick-quote` into Settings tab + wire to global save bar
22. Approval Settings: Keep as separate route (`/approval-settings`) for now; extract `EmployeeSelect` into shared component; add tab spec and link from Settings sidebar
23. Move Materials Settings tabs into Settings Master Data section + wire to global save bar (for settings that batch-save)
24. Move Organisaton Settings from `/settings/organisation` into Settings tab + wire to global save bar
25. Adapt ModuleSettings to use global save bar (remove its internal Save button, wire hasChanges upward)

### Phase 5: Polish — 1 session
25. Create unified settings API layer (reduce direct `supabase` calls)
26. Replace all `alert()` with `sonner` toast
27. Replace all `confirm()` with proper confirmation modals
27a. Add `UnsavedChangesDialog` component
27b. Add `useUnsavedChanges` hook with localStorage draft persistence
27c. Wire `beforeunload` guard into SettingsShell
27d. Wire tab-switch guard into SettingsSidebar
27e. Add draft recovery banner to each tab
28. Add loading/empty/error states to every tab
29. QA all tabs against DESIGN.md tokens
30. Add global search across settings tabs

### Phase 6: Route Cleanup — 0.5 session
31. Update App.tsx to redirect old settings routes to `/settings` with hash/tab param
32. Update Sidebar to point all settings links to `/settings` with correct tab param
33. Test all entry points

**Total estimated effort:** ~7 sessions

---

## 9. Success Criteria

| Metric | Target |
|---|---|
| Settings files | Reduced from 35+ to ~20 (shared components + clean pages) |
| Dead Terms & Conditions files | Reduced from 15 to 1 |
| Styling systems | Reduced from 5 to 1 (DESIGN.md aligned) |
| `alert()` / `confirm()` calls | 0 — all replaced with toast/modals |
| Unsaved changes dialogs | 4+ layer scenarios covered: tab-switch, beforeunload, in-app nav, crash recovery |
| Draft recovery | localStorage auto-save restores data after crash/close |
| Data loss bug reports | **Target: zero.** Any report of lost edits is a P0 regression |
| Shared components | 10+ reusable (SettingsShell, SettingRow, etc.) |
| DESIGN.md token compliance | 100% — all pages use the documented padding, font, color, spacing tokens |
| Code duplication | Numbering series consolidated in one place; discount/quick-quote brought into unified nav |

---

## 10. Appendices

### A. File Mapping: Current → Future

| Current Location | Future Location | Action |
|---|---|---|
| `src/pages/Settings.tsx` | `src/features/settings/SettingsPage.tsx` | Refactor into shell |
| `src/pages/PrintSettings.tsx` | `src/features/settings/tabs/PrintTab.tsx` | Port to shared components |
| `src/pages/TemplateSettings.tsx` | `src/features/settings/tabs/TemplatesTab.tsx` | Extract data, refactor |
| `src/pages/DiscountSettings.tsx` | `src/features/settings/tabs/DiscountsTab.tsx` | Port to shared components |
| `src/pages/QuickQuoteSettings.tsx` | `src/features/settings/tabs/QuickQuoteTab.tsx` | Port to shared components |
| `src/pages/TransactionNumberSeries.tsx` | Deleted (merged into Numbering tab) | Merge |
| `src/pages/TermsConditionsSettings*.tsx` | Keep 1, delete 14 | Cleanup |
| `src/features/materials/settings/*.tsx` | `src/features/settings/tabs/MasterData/*` | Move + refactor |
| `src/components/ModuleSettings.tsx` | Keep as-is, wrap in shell | Minimal change |
| `src/components/SettingsShell.tsx` | _NEW_ | Create |
| `src/components/setting-*.tsx` | _NEW_ | Create shared components |

### B. DESIGN.md Tokens Quick Reference

| Token | Value | Applied Where |
|---|---|---|
| Card body padding | `24px` | SettingsSection body |
| Label width | `70px` | SettingRow label |
| Label font | `11px / 600` | SettingRow label |
| Input font/padding | `12px / 4px 8px` | SettingInput |
| Section header | `11px / 600 / 0.05em / uppercase` | Section titles |
| Primary button bg | `#185FA5` | SettingsGlobalSaveBar |
| Primary button hover | `#0C447C` | SettingsGlobalSaveBar |
| Button padding | `6px 14px` | All buttons |
| Button border-radius | `6px` (header), `8px` (modal) | All buttons |
| Card radius | `rounded-lg` (8px) | SettingsSection |
| Modal radius | `rounded-xl` (12px) | All modals in settings |

### C. Database Tables Referenced

| Table | Used By |
|---|---|
| `organisations` | General settings (round_off_enabled) |
| `document_settings` | Numbering series (prefix, start#, padding, suffix) |
| `settings` (key-value) | Duplicate number prevention flag |
| `document_templates` | Template settings, print settings |
| `discount_variant_settings` | Discount settings |
| `discount_categories` | Discount categories tab |
| `quick_quote_settings` | Quick quote settings |
| `quick_quote_size_mappings` | Quick quote size mappings |
| `item_categories` | Categories tab |
| `item_units` | Units tab |
| `warehouses` | Warehouses tab |
| `company_variants` | Variants tab |
| `approval_settings` | Approval workflows (module on/off, reviewer config) |
| `approval_workflows` | Approval levels per module (approver, min/max amount) |
| `users` | Team members |
| `terms_and_conditions` | Terms & conditions |
