# 🚀 Quick Quote Generator – Enterprise + Execution Prompt (Final)

---

# 🎯 OBJECTIVE
Build a **Quick Quote Generator** inside:
> Quotation → New Quotation

This system must be:
- Config-driven (NO hardcoding)
- Scalable across organizations
- High performance (in-memory resolution)
- Extensible for future rules

---

# 🧩 PHASE 1 — DATABASE SCHEMA

Tables:

## quick_quote_settings
- org_id
- default_material
- default_variant
- default_make
- default_spec
- enable_valves
- enable_thread_items

## size_mappings
- org_id (nullable)
- mm_size
- inch_size

## pre_quote_templates
- org_id
- name

## pre_quote_template_items
- template_id
- item_type
- size_formula
- size_source
- use_inch

## item_attributes
- item_id
- key
- value

---

# 🧩 PHASE 2 — RESOLVER ENGINE

Function: generateQuickQuoteItems(config)

Steps:
1. Fetch all required data ONCE
2. Resolve:
   - {size}
   - {sub_size}
3. Convert mm → inch using size_mappings
4. Filter items using:
   - type
   - size
   - variant
   - make
   - spec (PN/SCH/etc)
5. Apply thread filter flag
6. Apply fallback:
   - remove variant
   - remove make
7. Return structured items

---

# 🧩 PHASE 3 — UI (Quotation Page)

Quick Quote Bar:

[ ⚡ Quick Quote ] Size ▼ Sub-size ▼ Variant ▼ Make ▼ Spec ▼ [+ Advanced]

Features:
- Prefill defaults
- Advanced toggles:
  - Include Valves
  - Include Thread Items
- Generate button
- Append rows to quotation
- Autofocus qty
- Keyboard navigation

---

# 🧩 PHASE 4 — SETTINGS

Settings Page:

## Defaults
- Material
- Variant
- Make
- Spec

## Toggles
- Enable Valves
- Enable Thread Items

## Size Mapping Editor
- mm_size ↔ inch_size

---

# ⚡ PERFORMANCE RULES

- Fetch config ONCE
- Store in React Context
- NO API calls during generation
- Use in-memory filtering

---

# 🔒 IMPLEMENTATION RULES (CRITICAL)

## ✅ MUST INCLUDE

- DB-driven mappings
- Attribute-based filtering
- Org-level overrides
- Fallback logic
- Clean UI integration

---

## ❌ MUST NOT INCLUDE

- Hardcoded mappings (65mm → 2.5")
- Item name parsing logic
- Per-item DB queries
- Excel-like drag features
- Over-engineered rule builders

---

# ⚠️ EDGE CASES

- Missing mapping → fallback mm
- Missing spec → ignore filter
- Missing item → skip safely
- Partial match → allowed

---

# 🏁 DEFINITION OF DONE

- User selects config
- Clicks Generate
- Items auto-filled correctly
- No lag
- No hardcoding
- Works across orgs

---

# 🔥 FINAL NOTE

This is NOT a feature.

This is a:
👉 Configurable Quote Generation Engine

Build clean. Keep it scalable. Avoid shortcuts.
