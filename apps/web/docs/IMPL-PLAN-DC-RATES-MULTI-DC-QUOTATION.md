# Implementation Plan: DC Rate Sources + Multi-DC Quotation Allocation

## Problem Statement

1. **DC rates are disconnected from pricing intelligence** — rates stored in DCs are whatever was typed at creation time. No option to pull from project rates or client-specific ARC rates. Users have no control over which rate source to use.

2. **Multi-DC → Quotation is impossible** — when a user sends 3 DCs to complete work, they need ONE quotation. Currently DC → Quotation is 1:1 only. No way to combine multiple DCs into a single quotation with allocation tracking.

---

## Confirmed Decisions

| Decision | Choice |
|----------|--------|
| Rate source fallback | **Strict** — if rate_source = 'project' and no project rate exists, show ₹0. No fallback chain. |
| Multi-DC client validation | **Resolve client_id from name** — batch query clients table, compare IDs. Block if different. |
| dc_links storage | **Junction table** `quotation_dc_links` (not JSONB) |
| Allocation save | **Block save** when allocated amount ≠ quotation total |
| Multi-DC quotation modes | **3 options**: Single Total, Grouped by DC (detailed), One row per DC |
| Rate resolution | DC with project → project_rates. Missing → ₹0. DC without project → ARC. Missing → ₹0. |

---

## Feature 1: Rate Source Selector at DC Creation

### 1.1 Database Changes

**Migration**: `supabase/migrations/XXX_add_rate_source_to_dc.sql`

```sql
ALTER TABLE delivery_challans 
  ADD COLUMN IF NOT EXISTS rate_source VARCHAR(20) DEFAULT 'base';

COMMENT ON COLUMN delivery_challans.rate_source IS 
  'Rate source: base (item_variant_pricing), project (project_rates), arc (material_client_pricing), manual (user-typed)';
```

### 1.2 Type Updates

**File**: `src/api.ts`

Add `rate_source` to `DeliveryChallan` interface:
```typescript
interface DeliveryChallan {
  // ... existing fields
  rate_source?: 'base' | 'project' | 'arc' | 'manual';
}
```

### 1.3 New API Function

**File**: `src/api.ts`

```typescript
export async function getProjectRates(
  projectId: string, 
  itemIds: string[]
): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('project_rates')
    .select('item_id, rate')
    .eq('project_id', projectId)
    .in('item_id', itemIds);
  
  const map: Record<string, number> = {};
  data?.forEach(r => { map[r.item_id] = r.rate; });
  return map;
}
```

ARC rates already available via `fetchArcPricingForItems()` in `src/lib/arc-pricing.ts`.

### 1.4 CreateDC.tsx Changes

**File**: `src/pages/CreateDC.tsx`

#### A. Add to formData (line ~147):
```typescript
rate_source: 'base',
```

#### B. Separate queries for project rates + ARC (not inside dcInitQuery):
```typescript
// Re-fetch when project_id changes
const projectRatesQuery = useQuery({
  queryKey: ['project-rates', formData.project_id],
  queryFn: () => getProjectRates(formData.project_id, materials.map(m => m.id)),
  enabled: !!formData.project_id && !!materials.length,
});

// Re-fetch when client_name changes
const client = clients.find(c => c.client_name === formData.client_name);
const arcRatesQuery = useQuery({
  queryKey: ['arc-rates-for-dc', client?.id],
  queryFn: () => fetchArcPricingForItems(client.id, materials.map(m => m.id)),
  enabled: !!client?.id && !!materials.length,
});

const projectRates = projectRatesQuery.data || {};
const arcPricingMap = arcRatesQuery.data || {};
```

#### C. Modify getRate() — STRICT mode, no fallback:
```typescript
const getRate = (itemId: string, variantId: string, make?: string) => {
  // Manual mode → user types rate, default 0
  if (formData.rate_source === 'manual') return 0;
  
  // Project rate → strict, ₹0 if missing
  if (formData.rate_source === 'project') {
    return projectRates[itemId] ?? 0;
  }
  
  // ARC rate → strict, ₹0 if missing
  if (formData.rate_source === 'arc') {
    const arcRate = getArcRateFromMap(arcPricingMap, itemId, variantId);
    return arcRate ?? 0;
  }
  
  // Base rate → existing logic (item_variant_pricing)
  const vId = variantId || 'no_variant';
  const mName = make || '';
  if (variantPricingWithMake[itemId]?.[vId]?.[mName] !== undefined) {
    return variantPricingWithMake[itemId][vId][mName];
  }
  if (mName) {
    const itemPricing = variantPricingWithMake[itemId] || {};
    for (const v in itemPricing) {
      if (itemPricing[v][mName] !== undefined) return itemPricing[v][mName];
    }
  }
  if (variantPricingWithMake[itemId]?.[vId]?.[''] !== undefined) {
    return variantPricingWithMake[itemId][vId][''];
  }
  const mat = getMaterial(itemId);
  return mat?.sale_price || 0;
};
```

#### D. Rate source dropdown in Document column (after Source field):
```tsx
<div style={headerFieldStyle}>
  <span style={labelColStyle}>Rate From:</span>
  <div style={fieldColStyle}>
    <select name="rate_source" className="form-select" style={{padding:'4px 8px',fontSize:'12px'}} 
      value={formData.rate_source} onChange={handleInputChange} disabled={isLocked}>
      <option value="base">Base Rate</option>
      <option value="project" disabled={!formData.project_id}>Project Rate</option>
      <option value="arc" disabled={!formData.client_name}>Client ARC</option>
      <option value="manual">Manual Entry</option>
    </select>
  </div>
</div>
```

#### E. Store in buildDCData():
```typescript
const buildDCData = (statusOverride?: string) => ({
  ...formData,
  rate_source: formData.rate_source,
  // ... existing fields
});
```

### 1.5 NonBillableDC.tsx Changes

Same pattern: add `rate_source` to formData, add dropdown, modify getRate() to strict mode.

### 1.6 Consolidation Views

**Files**: `DateWiseConsolidation.tsx`, `MaterialWiseConsolidation.tsx`

Add "Rate Source" column showing badge (P/A/M/base) from `dc.rate_source`. Informational only.

---

## Feature 2: Multi-DC → Single Quotation Allocation

### 2.1 Database Changes

**Migration**: `supabase/migrations/XXX_add_dc_links_and_conversion_status.sql`

```sql
-- Junction table for DC ↔ Quotation links
CREATE TABLE IF NOT EXISTS quotation_dc_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotation_header(id) ON DELETE CASCADE,
  dc_id UUID NOT NULL REFERENCES delivery_challans(id) ON DELETE CASCADE,
  dc_number VARCHAR(50) NOT NULL,
  dc_date DATE,
  dc_amount NUMERIC(12,2) DEFAULT 0,
  allocated_amount NUMERIC(12,2) DEFAULT 0,
  organisation_id UUID REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quotation_dc_links_quotation ON quotation_dc_links(quotation_id);
CREATE INDEX idx_quotation_dc_links_dc ON quotation_dc_links(dc_id);

-- Track conversion status on DCs
ALTER TABLE delivery_challans
  ADD COLUMN IF NOT EXISTS conversion_status VARCHAR(50) DEFAULT NULL;

COMMENT ON COLUMN delivery_challans.conversion_status IS 
  'NULL = not converted, "converted_to_quotation" = linked to a quotation';
```

### 2.2 Type Updates

**File**: `src/conversions/types.ts`

```typescript
export type ConversionType = 
  | 'quotation-to-proforma' 
  | 'quotation-to-invoice' 
  | 'quotation-to-dc'
  | 'dc-to-quotation' 
  | 'dc-to-proforma'
  | 'multi-dc-to-quotation'
  | 'proforma-to-invoice';

export type MultiDCQuotationMode = 'single-total' | 'grouped-by-dc' | 'one-row-per-dc';

export interface DCAllocation {
  dc_id: string;
  dc_number: string;
  dc_date: string;
  dc_amount: number;
  allocated_amount: number;
}

export interface ConvertedQuotationData {
  // ... existing fields
  dc_links?: DCAllocation[];
  multi_dc_mode?: MultiDCQuotationMode;
}
```

### 2.3 Multi-DC Conversion API

**File**: `src/conversions/api.ts`

```typescript
// Fetch multiple DCs for conversion
export async function fetchMultipleDCsForConversion(
  dcIds: string[],
  organisationId: string
): Promise<DCSourceData[]> {
  const { data, error } = await supabase
    .from('delivery_challans')
    .select(`
      id, dc_number, client_name, project_id, remarks, dc_date,
      items:delivery_challan_items(id, material_id, material_name, quantity, rate, amount, unit, size)
    `)
    .in('id', dcIds)
    .eq('organisation_id', organisationId);

  if (error) throw error;
  if (!data || data.length === 0) throw new Error('No DCs found');

  return data.map(dc => ({
    id: dc.id,
    dc_number: dc.dc_number,
    client_name: dc.client_name,
    client_id: null,
    project_id: dc.project_id,
    ship_to_state: '',
    po_no: '',
    remarks: dc.remarks,
    dc_date: dc.dc_date,
    items: (dc.items || []).map(item => ({
      id: item.id,
      material_id: item.material_id,
      material_name: item.material_name,
      quantity: Number(item.quantity),
      rate: Number(item.rate),
      amount: Number(item.amount),
    })),
  }));
}

// Validate all DCs are for the same client (resolve by ID)
export async function validateDCsSameClient(
  sources: DCSourceData[],
  organisationId: string
): Promise<{ valid: boolean; clientName?: string; error?: string }> {
  // Resolve each DC's client_name to client_id
  const clientNames = [...new Set(sources.map(s => s.client_name).filter(Boolean))];
  
  if (clientNames.length === 0) {
    return { valid: false, error: 'No client found on selected DCs' };
  }
  
  if (clientNames.length > 1) {
    return { valid: false, error: `Multiple clients found: ${clientNames.join(', ')}. All DCs must be for the same client.` };
  }
  
  return { valid: true, clientName: clientNames[0] };
}

// Transform: Single Total mode
export function transformMultiDC_SingleTotal(sources: DCSourceData[]): ConversionResult {
  const allItems = sources.flatMap(dc => dc.items);
  const grandTotal = allItems.reduce((sum, item) => sum + item.amount, 0);

  const dcLinks: DCAllocation[] = sources.map(dc => ({
    dc_id: dc.id,
    dc_number: dc.dc_number,
    dc_date: dc.dc_date,
    dc_amount: dc.items.reduce((sum, item) => sum + item.amount, 0),
    allocated_amount: dc.items.reduce((sum, item) => sum + item.amount, 0),
  }));

  const items: ConvertedQuotationItem[] = [{
    item_id: null,
    description: `Supply as per DC: ${sources.map(s => s.dc_number).join(', ')}`,
    qty: 1,
    rate: grandTotal,
    tax_percent: 18,
    uom: 'lot',
  }];

  return {
    data: {
      client_id: sources[0].client_id || '',
      project_id: sources[0].project_id,
      billing_address: null,
      gstin: null,
      state: sources[0].ship_to_state,
      date: sources[0].dc_date,
      valid_till: null,
      payment_terms: null,
      reference: sources.map(s => s.dc_number).join(', '),
      remarks: sources.map(s => s.remarks).filter(Boolean).join(' | '),
      items,
      dc_links: dcLinks,
      multi_dc_mode: 'single-total',
    },
    sourceType: 'Delivery Challans',
    sourceNumber: sources.map(s => s.dc_number).join(', '),
    conversionType: 'multi-dc-to-quotation',
    targetDocumentType: 'quotation',
  };
}

// Transform: Grouped by DC mode
export function transformMultiDC_GroupedByDC(sources: DCSourceData[]): ConversionResult {
  const items: ConvertedQuotationItem[] = [];
  const dcLinks: DCAllocation[] = [];
  let sno = 0;

  sources.forEach(dc => {
    const dcTotal = dc.items.reduce((sum, item) => sum + item.amount, 0);
    
    // Add DC header row
    items.push({
      item_id: null,
      description: `--- ${dc.dc_number} (${dc.dc_date}) ---`,
      qty: 0,
      rate: 0,
      tax_percent: 0,
      uom: '',
      is_header: true,
    });

    // Add each item from this DC
    dc.items.forEach(item => {
      sno++;
      items.push({
        item_id: item.material_id,
        description: item.material_name,
        qty: item.quantity,
        rate: item.rate,
        tax_percent: 18,
        uom: 'nos',
      });
    });

    // Add subtotal row
    items.push({
      item_id: null,
      description: `Subtotal ${dc.dc_number}`,
      qty: 0,
      rate: dcTotal,
      tax_percent: 0,
      uom: '',
      is_subtotal: true,
    });

    dcLinks.push({
      dc_id: dc.id,
      dc_number: dc.dc_number,
      dc_date: dc.dc_date,
      dc_amount: dcTotal,
      allocated_amount: dcTotal,
    });
  });

  return {
    data: {
      client_id: sources[0].client_id || '',
      project_id: sources[0].project_id,
      billing_address: null,
      gstin: null,
      state: sources[0].ship_to_state,
      date: sources[0].dc_date,
      valid_till: null,
      payment_terms: null,
      reference: sources.map(s => s.dc_number).join(', '),
      remarks: sources.map(s => s.remarks).filter(Boolean).join(' | '),
      items,
      dc_links: dcLinks,
      multi_dc_mode: 'grouped-by-dc',
    },
    sourceType: 'Delivery Challans',
    sourceNumber: sources.map(s => s.dc_number).join(', '),
    conversionType: 'multi-dc-to-quotation',
    targetDocumentType: 'quotation',
  };
}

// Transform: One row per DC mode
export function transformMultiDC_OneRowPerDC(sources: DCSourceData[]): ConversionResult {
  const items: ConvertedQuotationItem[] = [];
  const dcLinks: DCAllocation[] = [];

  sources.forEach(dc => {
    const dcTotal = dc.items.reduce((sum, item) => sum + item.amount, 0);
    
    items.push({
      item_id: null,
      description: `Supply as per ${dc.dc_number}`,
      qty: 1,
      rate: dcTotal,
      tax_percent: 18,
      uom: 'lot',
    });

    dcLinks.push({
      dc_id: dc.id,
      dc_number: dc.dc_number,
      dc_date: dc.dc_date,
      dc_amount: dcTotal,
      allocated_amount: dcTotal,
    });
  });

  return {
    data: {
      client_id: sources[0].client_id || '',
      project_id: sources[0].project_id,
      billing_address: null,
      gstin: null,
      state: sources[0].ship_to_state,
      date: sources[0].dc_date,
      valid_till: null,
      payment_terms: null,
      reference: sources.map(s => s.dc_number).join(', '),
      remarks: sources.map(s => s.remarks).filter(Boolean).join(' | '),
      items,
      dc_links: dcLinks,
      multi_dc_mode: 'one-row-per-dc',
    },
    sourceType: 'Delivery Challans',
    sourceNumber: sources.map(s => s.dc_number).join(', '),
    conversionType: 'multi-dc-to-quotation',
    targetDocumentType: 'quotation',
  };
}
```

### 2.4 DCList.tsx Multi-Select

**File**: `src/pages/DCList.tsx`

#### A. State:
```typescript
const [selectedDCIds, setSelectedDCIds] = useState<Set<string>>(new Set());
const [showMultiConvertModal, setShowMultiConvertModal] = useState(false);
const [multiConvertMode, setMultiConvertMode] = useState<MultiDCQuotationMode>('single-total');
```

#### B. Checkbox column (only on billable DCs):
```tsx
<th><input type="checkbox" onChange={handleSelectAll} /></th>
<td>
  {dc.dc_type !== 'non-billable' && (
    <input type="checkbox" checked={selectedDCIds.has(dc.id)} 
      onChange={() => toggleDCSelection(dc.id)} />
  )}
</td>
```

#### C. Selection validation at click time (before navigation):
```typescript
const handleMultiConvert = async () => {
  const ids = Array.from(selectedDCIds);
  
  // Fetch DCs to validate same client
  const dcList = await fetchMultipleDCsForConversion(ids, organisation.id);
  const validation = await validateDCsSameClient(dcList, organisation.id);
  
  if (!validation.valid) {
    alert(validation.error);
    return;
  }
  
  // Navigate with mode
  const idsParam = ids.join(',');
  navigate(`/quotation/create?convertFrom=multi-dc-to-quotation&sourceIds=${idsParam}&mode=${multiConvertMode}`);
  setShowMultiConvertModal(false);
  setSelectedDCIds(new Set());
};
```

#### D. Multi-convert modal with mode selection:
```tsx
{showMultiConvertModal && (
  <div className="modal">
    <h3>Convert {selectedDCIds.size} DCs to Quotation</h3>
    <p>Choose layout:</p>
    
    <label>
      <input type="radio" value="single-total" checked={multiConvertMode === 'single-total'}
        onChange={() => setMultiConvertMode('single-total')} />
      Single Total — 1 "Supply" row = sum of all DCs
    </label>
    
    <label>
      <input type="radio" value="grouped-by-dc" checked={multiConvertMode === 'grouped-by-dc'}
        onChange={() => setMultiConvertMode('grouped-by-dc')} />
      Grouped by DC — Items listed under each DC header with subtotals
    </label>
    
    <label>
      <input type="radio" value="one-row-per-dc" checked={multiConvertMode === 'one-row-per-dc'}
        onChange={() => setMultiConvertMode('one-row-per-dc')} />
      One row per DC — Each DC = 1 summary row
    </label>
    
    <button onClick={handleMultiConvert}>Convert</button>
    <button onClick={() => setShowMultiConvertModal(false)}>Cancel</button>
  </div>
)}
```

### 2.5 CreateQuotation.tsx — DC Allocation UI

**File**: `src/pages/CreateQuotation.tsx`

#### A. URL params:
```typescript
const convertFrom = searchParams.get('convertFrom') as ConversionType | null;
const sourceIds = searchParams.get('sourceIds');
const multiDCMode = searchParams.get('mode') as MultiDCQuotationMode | null;
const isMultiDCConversion = convertFrom === 'multi-dc-to-quotation';
```

#### B. DC Links state + junction table queries:
```typescript
const [dcLinks, setDCLinks] = useState<DCAllocation[]>([]);

// Load existing DC links on edit
const existingLinksQuery = useQuery({
  queryKey: ['quotation-dc-links', editId],
  queryFn: async () => {
    const { data } = await supabase
      .from('quotation_dc_links')
      .select('*')
      .eq('quotation_id', editId);
    return data || [];
  },
  enabled: !!editId,
});
```

#### C. Auto-populate on conversion:
```typescript
useEffect(() => {
  if (isMultiDCConversion && multiDCQuery.data && multiDCMode) {
    let result: ConversionResult;
    
    switch (multiDCMode) {
      case 'grouped-by-dc':
        result = transformMultiDC_GroupedByDC(multiDCQuery.data);
        break;
      case 'one-row-per-dc':
        result = transformMultiDC_OneRowPerDC(multiDCQuery.data);
        break;
      default:
        result = transformMultiDC_SingleTotal(multiDCQuery.data);
    }
    
    setItems(result.data.items.map((item, idx) => ({ ...item, id: idx + 1 })));
    setDCLinks(result.data.dc_links || []);
    setFormData(prev => ({
      ...prev,
      client_name: multiDCQuery.data[0].client_name || '',
      project_id: multiDCQuery.data[0].project_id || '',
      reference: multiDCQuery.data.map(dc => dc.dc_number).join(', '),
    }));
  }
}, [isMultiDCConversion, multiDCQuery.data, multiDCMode]);
```

#### D. DC Allocation section (for single-total and one-row-per-dc modes):
```tsx
{isMultiDCConversion && dcLinks.length > 0 && multiDCMode !== 'grouped-by-dc' && (
  <div className="card" style={{ marginTop: '16px' }}>
    <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
      DC Allocation
      <button className="btn btn-sm btn-secondary" style={{ marginLeft: '12px' }}
        onClick={handleAutoSplit}>
        Auto-Split
      </button>
    </h3>
    <table className="table">
      <thead>
        <tr>
          <th>DC Number</th>
          <th>DC Date</th>
          <th style={{ textAlign: 'right' }}>DC Amount</th>
          <th style={{ textAlign: 'right' }}>Allocated Amount</th>
          <th style={{ textAlign: 'right' }}>%</th>
        </tr>
      </thead>
      <tbody>
        {dcLinks.map((link, idx) => (
          <tr key={link.dc_id}>
            <td>{link.dc_number}</td>
            <td>{format(new Date(link.dc_date), 'dd/MM/yyyy')}</td>
            <td style={{ textAlign: 'right' }}>₹{link.dc_amount.toLocaleString('en-IN')}</td>
            <td style={{ textAlign: 'right' }}>
              <input type="number" value={link.allocated_amount}
                onChange={(e) => handleAllocationChange(idx, parseFloat(e.target.value) || 0)}
                style={{ width: '120px', textAlign: 'right' }} />
            </td>
            <td style={{ textAlign: 'right' }}>
              {grandTotal > 0 ? ((link.allocated_amount / grandTotal) * 100).toFixed(1) : 0}%
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr style={{ fontWeight: 700, background: '#f3f4f6' }}>
          <td colSpan={2}>Total</td>
          <td style={{ textAlign: 'right' }}>₹{totalDCAmount.toLocaleString('en-IN')}</td>
          <td style={{ textAlign: 'right', color: isAllocationBalanced ? '#16a34a' : '#dc2626' }}>
            ₹{totalAllocated.toLocaleString('en-IN')}
          </td>
          <td style={{ textAlign: 'right' }}>
            {grandTotal > 0 ? ((totalAllocated / grandTotal) * 100).toFixed(1) : 0}%
          </td>
        </tr>
      </tfoot>
    </table>
    {!isAllocationBalanced && (
      <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '8px' }}>
        ⚠ Allocated (₹{totalAllocated.toLocaleString('en-IN')}) ≠ 
        Quotation total (₹{grandTotal.toLocaleString('en-IN')}). 
        Difference: ₹{Math.abs(totalAllocated - grandTotal).toLocaleString('en-IN')}
      </div>
    )}
  </div>
)}
```

#### E. Save-blocking validation:
```typescript
const handleSubmit = async (e) => {
  e.preventDefault();
  
  // Block save if allocation mismatch
  if (isMultiDCConversion && dcLinks.length > 0) {
    if (!isAllocationBalanced) {
      alert('DC allocation amount does not match quotation total. Please adjust before saving.');
      return;
    }
  }
  
  // ... existing save logic ...
  
  // Save DC links to junction table
  if (isMultiDCConversion && dcLinks.length > 0 && dcId) {
    await supabase.from('quotation_dc_links').insert(
      dcLinks.map(link => ({
        quotation_id: dcId,
        dc_id: link.dc_id,
        dc_number: link.dc_number,
        dc_date: link.dc_date,
        dc_amount: link.dc_amount,
        allocated_amount: link.allocated_amount,
        organisation_id: organisation.id,
      }))
    );
    
    // Update conversion_status on each DC
    for (const link of dcLinks) {
      await supabase.from('delivery_challans')
        .update({ conversion_status: 'converted_to_quotation' })
        .eq('id', link.dc_id);
    }
  }
};
```

#### F. Edit-mode reload:
```typescript
useEffect(() => {
  if (editId && existingLinksQuery.data?.length) {
    setDCLinks(existingLinksQuery.data);
  }
}, [editId, existingLinksQuery.data]);
```

### 2.6 Conversion Hook Updates

**File**: `src/conversions/hooks.ts`

```typescript
if (type === 'multi-dc-to-quotation') {
  const dcIds = sourceId.split(',');
  const sources = await fetchMultipleDCsForConversion(dcIds, organisation.id);
  const clientId = await resolveClientIdFromName(sources[0].client_name, organisation.id);
  sources.forEach(s => { s.client_id = clientId; });
  
  // Default to single-total for hook; CreateQuotation handles mode via URL param
  return transformMultiDC_SingleTotal(sources);
}
```

### 2.7 DCList — "Already Quoted" Badge

In DCList.tsx, show conversion status:
```tsx
{dc.conversion_status && (
  <span className="badge badge-blue" style={{ fontSize: '10px' }}>
    {dc.conversion_status === 'converted_to_quotation' ? 'Quoted' : dc.conversion_status}
  </span>
)}
```

---

## Implementation Order

### Phase 1: Rate Source Selector
1. DB migration: `rate_source` column
2. Add `getProjectRates()` to `src/api.ts`
3. Modify `CreateDC.tsx` — dropdown + getRate() strict mode
4. Modify `CreateNonBillableDC.tsx` — same
5. Update consolidation views with rate source badge

### Phase 2: Multi-DC Quotation
1. DB migration: `quotation_dc_links` table + `conversion_status` column
2. Update `src/conversions/types.ts`
3. Add multi-DC conversion functions to `src/conversions/api.ts`
4. Add multi-select UI to `DCList.tsx` with client validation
5. Add mode selection modal to `DCList.tsx`
6. Add DC Allocation UI to `CreateQuotation.tsx` with save-blocking
7. Add edit-mode reload for DC links
8. Add "Quoted" badge in DCList

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Project rates missing for items | Medium | Strict mode: show ₹0, user knows to switch source |
| ARC rates missing for client | Low | Strict mode: show ₹0 |
| Multi-DC with different clients | High | Validate at click time, block with error modal |
| Allocation sum mismatch | Medium | Block save, show visual warning with difference |
| Existing DCs without rate_source | Low | Default to 'base', backward compatible |
| Double conversion | High | `conversion_status` column + confirmation dialog + lock function |
| Concurrent multi-DC selection | High | Atomic lock via Supabase RPC, abort if DC already locked |
| Different tax rates across DCs | High | Per-item tax rate, calculate per-slab in quotation |
| DC already invoiced | High | Check invoiced_amount, pull only remaining |
| Rounding errors | Low | ₹1 tolerance, auto-adjust last DC allocation |
| Stock race condition | High | Atomic `deduct_stock` RPC with FOR UPDATE lock |
| DC deleted after quotation | Medium | CASCADE delete + warning on DC deletion |
| dc_links not in Proforma/Invoice | Medium | Copy dc_links in conversion, junction tables for PI/Invoice |

---

## Top 10 Edge Case Mitigations (Billing Engineer's Nightmare)

### #15 — Different tax rates across DCs

**Problem**: DC-001 has 12% items, DC-002 has 18% items. Quotation gets default 18% on all items. Wrong tax, compliance risk.

**Mitigation**:
- In `transformMultiDC_*` functions, group items by their original tax rate
- Store `tax_percent` per item in `delivery_challan_items` (if not already)
- For "Single Total" mode: show tax breakdown in allocation section — "₹X at 12%, ₹Y at 18%"
- For "Grouped by DC" mode: each item carries its own tax rate
- In quotation save, calculate CGST/SGST/IGST per tax slab, not flat 18%
- **If DC items don't have tax rate stored**: Use the DC's project/client default tax rate. If neither exists, use 18% with a warning badge.

```typescript
// In quotation save logic:
const taxSlabs = {};
items.forEach(item => {
  const rate = item.tax_percent || 18;
  if (!taxSlabs[rate]) taxSlabs[rate] = { taxable: 0, tax: 0 };
  taxSlabs[rate].taxable += item.line_total || (item.qty * item.rate);
});

Object.entries(taxSlabs).forEach(([rate, slab]) => {
  slab.tax = slab.taxable * parseFloat(rate) / 100;
});
```

---

### #17 — DC already partially invoiced

**Problem**: DC was partially invoiced, then user selects it for multi-DC quotation. Full DC amount pulled into quotation. Double billing.

**Mitigation**:
- Add `invoiced_amount` column to `delivery_challans` (or compute from invoice_links)
- Before conversion, check: `dc.total_amount - dc.invoiced_amount = remaining`
- Pull only `remaining` amount into quotation
- Show in DCList: "Partially invoiced: ₹X of ₹Y billed"
- If DC is fully invoiced, block conversion entirely with message: "DC fully invoiced. Cannot create quotation."

```sql
-- Migration addition:
ALTER TABLE delivery_challans
  ADD COLUMN IF NOT EXISTS invoiced_amount NUMERIC(12,2) DEFAULT 0;

-- Or compute dynamically:
-- SELECT dc_id, SUM(amount) as invoiced_total 
-- FROM invoice_items WHERE dc_id IN (...) GROUP BY dc_id;
```

```typescript
// In fetchMultipleDCsForConversion:
const { data: invoiceData } = await supabase
  .from('invoice_items')
  .select('dc_id, SUM(amount) as invoiced_total')
  .in('dc_id', dcIds)
  .group_by('dc_id');

// Adjust DC items to exclude already-invoiced amounts
```

---

### #43 — Concurrent conversion (double quotation)

**Problem**: Two users select same DCs, both click convert. Two quotations created for same DCs. No lock.

**Mitigation**:
- **Optimistic locking**: Before saving quotation, verify DCs haven't been linked since fetch
- Check `conversion_status` is still NULL for all selected DCs
- If any DC now has `conversion_status = 'converted_to_quotation'`, abort with message
- Use Supabase RPC or transaction for atomic check-and-set:

```sql
-- Atomic lock: convert multiple DCs
CREATE OR REPLACE FUNCTION lock_dcs_for_quotation(dc_ids UUID[])
RETURNS TABLE(dc_id UUID, locked BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  UPDATE delivery_challans
  SET conversion_status = 'locked_for_quotation'
  WHERE id = ANY(dc_ids)
    AND conversion_status IS NULL
  RETURNING id, TRUE;
END;
$$ LANGUAGE plpgsql;
```

```typescript
// In quotation save:
const { data: locked } = await supabase.rpc('lock_dcs_for_quotation', {
  dc_ids: dcLinks.map(l => l.dc_id)
});

const lockedIds = new Set(locked?.filter(l => l.locked).map(l => l.dc_id));
const unlockedDcLinks = dcLinks.filter(l => lockedIds.has(l.dc_id));

if (unlockedDcLinks.length < dcLinks.length) {
  const failedDcs = dcLinks.filter(l => !lockedIds.has(l.dc_id)).map(l => l.dc_number);
  alert(`Could not lock DCs: ${failedDcs.join(', ')}. They may have been claimed by another quotation.`);
  // Rollback: release locks on successfully locked DCs
  await supabase.from('delivery_challans')
    .update({ conversion_status: null })
    .in('id', Array.from(lockedIds));
  return;
}
```

---

### #25 — Rounding ₹0.01 blocks save

**Problem**: 3 DCs with ₹33,333.33 each → total ₹99,999.99. ₹0.01 difference blocks save. Frustrating.

**Mitigation**:
- Add tolerance threshold: allow ₹0.01–₹0.99 difference as "rounding adjustment"
- Auto-adjust last DC's allocation to absorb rounding difference
- Show: "Rounding adjustment: ₹0.01 applied to DC-003"

```typescript
const ROUNDING_TOLERANCE = 1.00; // ₹1 tolerance

const isAllocationBalanced = () => {
  const diff = Math.abs(totalAllocated - grandTotal);
  return diff <= ROUNDING_TOLERANCE;
};

const handleAutoSplit = () => {
  const total = grandTotal;
  const totalDCAmount = dcLinks.reduce((sum, l) => sum + l.dc_amount, 0);
  
  if (totalDCAmount === 0) return;
  
  // Proportional split for all but last
  const newLinks = dcLinks.map((link, idx) => {
    if (idx < dcLinks.length - 1) {
      return { ...link, allocated_amount: Math.round((link.dc_amount / totalDCAmount) * total * 100) / 100 };
    }
    // Last DC absorbs rounding difference
    const allocatedSoFar = newLinks?.slice(0, -1).reduce((s, l) => s + l.allocated_amount, 0) || 0;
    return { ...link, allocated_amount: Math.round((total - allocatedSoFar) * 100) / 100 };
  });
  
  setDCLinks(newLinks);
};
```

---

### #8 — Rate source stuck on "project" after clearing project

**Problem**: User selects "Project Rate", adds items, then clears project_id. rate_source stays "project". All items show ₹0.

**Mitigation**:
- Watch `project_id` changes. If project_id cleared and rate_source = 'project', auto-switch to 'base'
- Same for client_name + 'arc' combination
- Show toast: "Project removed. Rate source switched to Base Rate."

```typescript
useEffect(() => {
  if (!formData.project_id && formData.rate_source === 'project') {
    setFormData(prev => ({ ...prev, rate_source: 'base' }));
    // Optionally show toast/notification
  }
  if (!formData.client_name && formData.rate_source === 'arc') {
    setFormData(prev => ({ ...prev, rate_source: 'base' }));
  }
}, [formData.project_id, formData.client_name]);
```

---

### #36 — DC deleted after quotation created

**Problem**: Quotation saved with dc_links. DC later deleted. Quotation references dead DC.

**Mitigation**:
- Use CASCADE delete on `quotation_dc_links.dc_id` FK — when DC is deleted, link is removed
- On quotation edit/load, check if linked DCs still exist:
```typescript
const validLinks = dcLinks.filter(link => 
  existingLinksQuery.data?.some(q => q.dc_id === link.dc_id)
);
const orphanedLinks = dcLinks.filter(link => 
  !existingLinksQuery.data?.some(q => q.dc_id === link.dc_id)
);

if (orphanedLinks.length > 0) {
  // Show warning: "DC-003 was deleted. Allocation removed."
  setDCLinks(validLinks);
}
```
- In DC deletion, warn if DC is linked to quotations:
```typescript
const handleDeleteDC = async (dc) => {
  const { data: links } = await supabase
    .from('quotation_dc_links')
    .select('quotation_id, quotation_header(quotation_no)')
    .eq('dc_id', dc.id);
  
  if (links?.length > 0) {
    const qNos = links.map(l => l.quotation_header?.quotation_no).filter(Boolean);
    if (!confirm(`This DC is linked to quotation(s): ${qNos.join(', ')}. Delete anyway?`)) {
      return;
    }
  }
  // proceed with delete
};
```

---

### #38 — Double conversion (same DC quoted twice)

**Problem**: User creates quotation from DC, then creates ANOTHER quotation from same DC. Two quotations for same items.

**Mitigation**:
- `conversion_status` column set on first conversion
- Before allowing single-DC conversion (existing flow), check status:
```typescript
const handleConvertToQuotation = async () => {
  // Check if already converted
  const { data: dc } = await supabase
    .from('delivery_challans')
    .select('conversion_status')
    .eq('id', convertDC.id)
    .single();
  
  if (dc?.conversion_status) {
    const proceed = confirm(
      `This DC was already converted to a quotation. Create another?`
    );
    if (!proceed) return;
  }
  
  navigate(`/quotation/create?convertFrom=dc-to-quotation&sourceId=${convertDC.id}`);
};
```
- In DCList, show "Quoted" badge with count: "Quoted (2)" if linked to 2 quotations
- For multi-DC, check all selected DCs before navigation (already planned in #43)

---

### #10 — Race condition on stock deduction

**Problem**: Two engineers create DCs from same warehouse simultaneously. Both see available qty = 10. Both deduct 8. Stock goes to -6 (clamped to 0).

**Mitigation**:
- Use Supabase RPC for atomic stock deduction:
```sql
CREATE OR REPLACE FUNCTION deduct_stock(
  p_item_id UUID,
  p_warehouse_id UUID,
  p_variant_id UUID,
  p_quantity NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
  v_current NUMERIC;
BEGIN
  -- Lock the row
  SELECT current_stock INTO v_current
  FROM item_stock
  WHERE item_id = p_item_id
    AND warehouse_id = p_warehouse_id
    AND company_variant_id IS NOT DISTINCT FROM p_variant_id
  FOR UPDATE;
  
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Stock record not found';
  END IF;
  
  IF v_current < p_quantity THEN
    RETURN FALSE; -- insufficient stock
  END IF;
  
  UPDATE item_stock
  SET current_stock = current_stock - p_quantity,
      updated_at = NOW()
  WHERE item_id = p_item_id
    AND warehouse_id = p_warehouse_id
    AND company_variant_id IS NOT DISTINCT FROM p_variant_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

```typescript
// Replace direct supabase update with RPC call:
const { data: success } = await supabase.rpc('deduct_stock', {
  p_item_id: item.material_id,
  p_warehouse_id: formData.warehouse_id,
  p_variant_id: item.uses_variant ? item.variant_id : null,
  p_quantity: item.quantity,
});

if (!success) {
  alert(`Insufficient stock for ${item.material_name}. Stock may have changed since you loaded the page.`);
  return;
}
```

---

### #26 — Over-allocation (allocation > DC amount)

**Problem**: User manually sets allocation = ₹50,000 but DC amount = ₹30,000. Billing > delivery.

**Mitigation**:
- Validate allocation ≤ DC amount + small tolerance
- If allocation > DC amount, show warning and block save
- Exception: allow over-allocation if user explicitly opts in (advance billing scenario)

```typescript
const handleAllocationChange = (idx: number, value: number) => {
  const link = dcLinks[idx];
  
  if (value > link.dc_amount + ROUNDING_TOLERANCE) {
    // Allow but mark as over-allocated
    setDCLinks(dcLinks.map((l, i) => 
      i === idx ? { ...l, allocated_amount: value, is_over_allocated: true } : l
    ));
  } else {
    setDCLinks(dcLinks.map((l, i) => 
      i === idx ? { ...l, allocated_amount: value, is_over_allocated: false } : l
    ));
  }
};
```

```tsx
// In UI, show over-allocation warning per row:
{link.is_over_allocated && (
  <span style={{ color: '#dc2626', fontSize: '10px' }}>
    ⚠ Over DC amount
  </span>
)}
```

```typescript
// In save validation:
const hasOverAllocation = dcLinks.some(l => l.allocated_amount > l.dc_amount + ROUNDING_TOLERANCE);
if (hasOverAllocation) {
  const proceed = confirm('One or more allocations exceed DC amount. This may indicate advance billing. Proceed?');
  if (!proceed) return;
}
```

---

### #37 — dc_links not carried to Proforma/Invoice

**Problem**: Quotation has dc_links. User converts quotation to Proforma or Invoice. dc_links not carried forward. Audit chain breaks.

**Mitigation**:
- When converting Quotation → Proforma/Invoice, copy dc_links forward
- Add `dc_links` JSONB to `proforma_invoices` and `invoices` tables (or junction tables)
- In `transformQuotationToProforma` and `transformQuotationToInvoice`:

```typescript
// In transformQuotationToProforma:
export function transformQuotationToProforma(source: QuotationSourceData): ConversionResult {
  // ... existing logic ...
  
  const data: ConvertedProformaData = {
    // ... existing fields
    dc_links: (source as any).dc_links || [], // Carry forward
  };
  
  return { data, ... };
}
```

- On Proforma/Invoice PDF, show DC references in footer: "Linked DCs: DC-001, DC-002"
- Create junction tables for proforma and invoice if needed:
```sql
CREATE TABLE IF NOT EXISTS proforma_dc_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_id UUID REFERENCES proforma_invoices(id) ON DELETE CASCADE,
  dc_id UUID REFERENCES delivery_challans(id) ON DELETE CASCADE,
  dc_number VARCHAR(50),
  allocated_amount NUMERIC(12,2),
  organisation_id UUID REFERENCES organisations(id)
);

CREATE TABLE IF NOT EXISTS invoice_dc_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  dc_id UUID REFERENCES delivery_challans(id) ON DELETE CASCADE,
  dc_number VARCHAR(50),
  allocated_amount NUMERIC(12,2),
  organisation_id UUID REFERENCES organisations(id)
);
```

---

## Testing Checklist

### Rate Source Selector
- [ ] DC with rate_source = 'base' → rates from item_variant_pricing
- [ ] DC with rate_source = 'project' → ₹0 for items without project rates
- [ ] DC with rate_source = 'arc' → ₹0 for items without ARC rates
- [ ] DC with rate_source = 'manual' → rate field editable, default 0
- [ ] Edit existing DC → rate_source preserved, dropdown reflects saved value
- [ ] Consolidation view shows rate source badge
- [ ] Non-billable DC supports rate source selector

### Multi-DC Quotation
- [ ] Select 1 DC → normal single-DC conversion (unchanged)
- [ ] Select 2+ DCs → mode selection modal appears
- [ ] Single Total mode → 1 "Supply" row = sum
- [ ] Grouped by DC mode → items under DC headers with subtotals
- [ ] One row per DC mode → each DC = 1 summary row
- [ ] Different clients → blocked with error message
- [ ] Allocation mismatch → save blocked with warning
- [ ] Auto-split distributes proportionally
- [ ] Manual override updates allocated amounts
- [ ] Save creates junction table entries
- [ ] Edit quotation → DC links loaded correctly
- [ ] "Quoted" badge shows on converted DCs
- [ ] Re-conversion warned (not blocked)

### Edge Case Tests (Top 10)
- [ ] #15: DCs with different tax rates → quotation calculates per-slab tax correctly
- [ ] #17: DC already partially invoiced → only remaining amount pulled into quotation
- [ ] #43: Concurrent conversion → second user gets "DC locked" error
- [ ] #25: Rounding ₹0.01 → auto-adjusted, save not blocked
- [ ] #8: Clear project_id when rate_source = 'project' → auto-switches to 'base'
- [ ] #36: Delete DC after quotation → quotation warns, link removed via CASCADE
- [ ] #38: Try to convert same DC twice → confirmation dialog shown
- [ ] #10: Two DCs from same warehouse simultaneously → atomic stock deduction
- [ ] #26: Allocation > DC amount → warning shown, save requires confirmation
- [ ] #37: Quotation → Proforma → dc_links carried forward
