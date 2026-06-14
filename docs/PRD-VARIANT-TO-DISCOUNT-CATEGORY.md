# PRD: Relabel "Variant" → "Discount Category" (UI Only)

**To:** Senior Engineer
**From:** Product
**Date:** 2026-06-14
**Status:** Approved for implementation

---

## Problem Statement

The `company_variants` system is called "Variant" everywhere in the UI but is actually a **discount category / product grouping system** — items are grouped into categories (Pipe, Hardware, Electrical) with per-category pricing and per-category discounts on quotations. The term "Variant" implies product variants (color, size, storage) which this is not, causing persistent user confusion and blocking future true product-variant features.

> **Note:** The original system was a hybrid — it allowed both discount grouping and context-based pricing (e.g., Retail vs Wholesale as pricing contexts). We are simplifying the user-facing name to "Discount Category" to reflect its primary use. The underlying functionality (different pricing per category) remains **completely unchanged**.

## Scope

UI labels only. **Zero database changes. Zero API changes. Zero functional changes.** Approximately ~60 string changes across 22 files.

---

## What Changed vs v1

| Gap | Fix |
|-----|-----|
| No rollback plan | Git revert — no DB migrations, no schema changes |
| Export column rename unmitigated | Added `use_legacy_export_columns` org toggle (default true, indefinite), UI hint in settings |
| No validation grep | Post-implementation `grep -rn "Variant" src/` pass + manual PDF/tooltip/empty-state inspection |
| No user communication | In-app banner + changelog + email to pro users 2 weeks pre-deploy |
| Monolithic order | Start smallest files first, MaterialsList.tsx last |
| No case/format consistency | Sentence case everywhere (UI + PDFs) matching existing codebase convention |
| Description potentially wrong | Verified `item_variant_pricing` — dual-purpose description added with footnote |
| Export toggle name too specific | Renamed to `use_legacy_export_columns` (generic, reusable) |

---

## Full Label Map

| Context | Old | New |
|---------|-----|-----|
| Tab/Page titles | `Inventory Variants` | `Discount Categories` |
| Section title (item form) | `Variant Pricing` | `Discount Category Pricing` |
| Section subtitle (item form) | `By variant & make (brand)` | `By category & make (brand)` |
| Section title (discounts) | `Discounts (By Variant)`, `Variant Discounts` | `Discounts (By Category)`, `Category Discounts` |
| Table column headers (UI) | `Variant` | `Discount Category` |
| PDF column headers | `Variant` / `VARIANT` | `Discount Category` (sentence case) |
| Export column headers (CSV/XLSX) | `Variant`, `Uses Variant` | `Discount Category`, `Uses Discount Category` |
| Form field labels | `Variant Name`, `Default Variant`, `Variant Default`, `Variant Filter`, `Variant *` | `Category Name`, `Default Category`, `Category Default`, `Category Filter`, `Category *` |
| Checkbox labels | `This item uses Variant pricing`, `Multi-Variant Pricing` | `This item uses Discount Category pricing`, `Multi-Category Pricing` |
| Section title (drawer) | `Variant Configuration` | `Discount Category Configuration` |
| Buttons | `+ Add Variant`, `Save Variant`, `Update Variant` | `+ Add Category`, `Save Category`, `Update Category` |
| Modal titles | `Edit Variant`, `Add Variant` | `Edit Category`, `Add Category` |
| Dropdown options | `No Variant`, `Select Variant` | `No Category`, `Select Category` |
| Dropdown placeholder | `Variant` | `Discount Category` |
| Confirm/empty text | `Delete this variant?`, `No variants found`, `No variants available.` | `Delete this category?`, `No categories found`, `No categories available.` |
| Description text | `Variants represent different commercial contexts (e.g., Retail, Wholesale, Export). Each item can have different pricing per variant.` | `Discount Categories group your items for tiered pricing (e.g., Pipe, Hardware, Electrical). Each item can have different sale/purchase prices per category, and quotations can apply category-specific discounts.` |
| Bulk import/export | `Uses Variant` | `Uses Discount Category` |
| Label config | `Variant Details` | `Category Details` |
| Empty state (BOM) | `Variant` (column) | `Discount Category` |

---

## What Stays The Same

| Item | Reason |
|------|--------|
| All DB column names (`company_variant_id`, `variant_name`, `uses_variant`, `is_active`, `item_variant_pricing`, `quotation_revision_variant_discount`) | Schema changes risk queries, joins, RLS, and report integrations |
| TypeScript variable names (`variants`, `variantPricing`, `handleVariantPricingRowChange`) | Renaming risks merge conflicts; code readability unaffected |
| Function signatures and file names | Out of scope |

---

## Export Mitigation

- **Toggle name:** `use_legacy_export_columns` (generic for future column renames)
- **Default:** `true` for all existing orgs on deploy
- **Deprecation:** Indefinite — old orgs keep the toggle until they explicitly change. New orgs default to `false` after 30 days.
- **UI hint in settings:** `"Export column names: 'Discount Category' (new) or 'Variant' (legacy)"`

## Rollback

`git revert` the PR commit. Zero risk — no DB, no schema, no functional changes.

## Validation

```bash
grep -rn "Variant" src/ --include="*.tsx" --include="*.ts"
```

All remaining user-facing hits must be converted. Inspect PDF HTML strings, error toasts, tooltips, empty states manually.

## Implementation Order

| Step | File | Changes | Risk |
|------|------|---------|------|
| 1 | `src/components/ExcelEditor.tsx` | 2 | Low |
| 2 | `src/components/ItemCreateDrawer.tsx` | 3 | Low |
| 3 | `src/pages/manufacturing/BOMEditor.tsx` | 2 | Low |
| 4 | `src/pages/DiscountSettings.tsx` | 2 | Low |
| 5 | `src/pages/TemplateSettings.tsx` | 2 | Low |
| 6 | `src/invoices/pages/InvoiceEditorPage.tsx` | 2 | Low |
| 7 | `src/pages/QuickQuoteSettings.tsx` | 1 | Low |
| 8 | `src/pages/StockAdjustment.tsx` | 1 | Low |
| 9 | `src/pages/QuotationView.tsx` | 1 | Low |
| 10 | `src/pages/DCList.tsx` | 1 | Low |
| 11 | `src/pages/CreateNonBillableDC.tsx` | 1 | Low |
| 12 | `src/pages/CreateDC.tsx` | 2 | Low |
| 13 | `src/pages/BOQ.tsx` | 4 | Medium |
| 14 | `src/pages/CreateQuotation.tsx` | 2 | Medium |
| 15 | `src/pages/MaterialInward.tsx` + `src/pages/MaterialOutward.tsx` | 2 | Low |
| 16 | `src/pages/QuickStockCheck.tsx` | 2 | Low |
| 17 | Project material files × 4 | 4 | Low |
| 18 | **`src/pages/MaterialsList.tsx`** | **~24** | **High** |

## User Communication

| Channel | Timing | Message |
|---------|--------|---------|
| In-app banner | Deploy day | "We've renamed 'Variant' → 'Discount Category' throughout the app. Your data and pricing are unaffected." |
| Changelog | Deploy day | `feat: Renamed "Variant" → "Discount Category" across all UI for clarity.` |
| Email (pro users) | 2 weeks pre-deploy | Notification about export column rename with migration instructions |

## Branch

`feat/variant-to-discount-category` → single commit → PR.
