# Implement Last Quoted/Invoiced Rate Indicators in Quotation Creator

Implement a feature to display the last quoted base rate (from `quotation_items`) and the last invoiced base rate (from `invoice_items`) for each item in the Quotation Creator ([CreateQuotation.tsx](file:///c:/Users/admin/mep-project/src/pages/CreateQuotation.tsx)) based on the selected client.

## Proposed Changes

### Database Optimization

#### [NEW] [Migration file](file:///c:/Users/admin/mep-project/supabase/migrations/055_add_invoice_items_jsonb_index.sql)
- Add a functional index on `invoice_items` to index the `material_id` within the `meta_json` column. This prevents full table scans when querying historical pricing:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_invoice_items_meta_material_id 
    ON invoice_items (((meta_json->>'material_id')::UUID));
  ```

### Shared Hooks & API Layer

#### [NEW] [useLastDocumentRates.ts](file:///c:/Users/admin/mep-project/src/hooks/useLastDocumentRates.ts)
- Implement a custom hook `useLastDocumentRates(clientId, itemIds)` using `@tanstack/react-query`:
  - **Quotation Lookup**: Queries `quotation_items` matching the client and item IDs:
    ```typescript
    supabase
      .from('quotation_items')
      .select('item_id, variant_id, rate, base_rate_snapshot, quotation_header!inner(quotation_no, date)')
      .eq('quotation_header.client_id', clientId)
      .in('item_id', itemIds)
    ```
  - **Invoice Lookup**: Queries `invoice_items` matching the client and item IDs using JSONB arrow pathing:
    ```typescript
    supabase
      .from('invoice_items')
      .select('rate, meta_json, invoices!inner(invoice_no, invoice_date)')
      .eq('invoices.client_id', clientId)
      .in('meta_json->>material_id', itemIds)
    ```
  - **In-Memory Grouping**: Filters and maps the results by `${item_id}_${variant_id || 'no_variant'}` to identify the latest record.
  - **Rate Integrity**: Resolves and returns the **Base Rate** (before discount) rather than the net rate:
    - Quotations: Uses `base_rate_snapshot` (falling back to `rate`).
    - Invoices: Uses `meta_json.base_rate` (falling back to `rate`).
    - This ensures that when the user applies the rate, subsequent quotation discounts are computed correctly without double-discounting.

### Sales & Quotations Component

#### [MODIFY] [CreateQuotation.tsx](file:///c:/Users/admin/mep-project/src/pages/CreateQuotation.tsx)
- **Hooks Integration**:
  - Load pricing history for current items:
    ```typescript
    const lastRatesQuery = useLastDocumentRates(formData.client_id, quotationItemIds);
    ```
- **Base Rate Cell UI**:
  - Render the clickable badges directly below the base rate input field within the item row (hidden if no history is returned).
  - **LQ (Last Quoted)**: Styled with a warm amber theme, displaying `LQ: ₹Rate`.
  - **LI (Last Invoiced)**: Styled with a cool blue theme, displaying `LI: ₹Rate`.
  - Tooltips display exact document source info: `Quote #QT-001 on 12/05/2026`.
  - Clicking a badge overrides the item's `base_rate_snapshot`, recalculates the row's final rate, and displays a success toast.
- **Under-billing Alert**:
  - If the user manually inputs a rate *lower* than the last invoiced base rate (LI), render a small warning icon (`⚠️`) next to the input with a tooltip: `Warning: Entered rate (₹X) is lower than the last invoiced rate (₹Y) for this client.`

---

## Verification Plan

### Automated Tests
- Run `npm run typecheck` to confirm type safety.

### Manual Verification
1. Run the database migration to create the functional index.
2. Select a Client who has prior transaction history.
3. Add items to the quotation and verify that the `LQ` and `LI` helper badges render correctly beneath the rate inputs.
4. Click a badge and verify that the input updates and recalculates the line total.
5. Input a rate lower than the `LI` rate and verify that the under-billing warning icon appears.
