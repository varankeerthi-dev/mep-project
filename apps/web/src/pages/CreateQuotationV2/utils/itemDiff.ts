import { supabase } from '../../../supabase';

export interface Item {
  id?: any;
  quotation_id?: string;
  organisation_id?: string | null;
  item_id?: string | null;
  sac_code?: string | null;
  description?: string;
  qty?: number | null;
  rate?: number;
  tax_percent?: number;
  uom?: string;
  discount_percent?: number;

  line_total?: number;
  display_order?: number;
  custom1?: string;
  custom2?: string;
  variant_id?: string | null;
  base_rate_snapshot?: number;
  applied_discount_percent?: number;
  is_override?: boolean;
  final_rate_snapshot?: number;
  is_header?: boolean;
  is_subtotal?: boolean;
  subtotal_label?: string | null;
  [key: string]: any;
}

const isUUID = (str: any): boolean => {
  if (typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

// Check if two item rows have different values for the db columns
const hasRowChanged = (curr: Item, orig: Item): boolean => {
  const fieldsToCompare = [
    'organisation_id',
    'item_id',
    'sac_code',
    'description',
    'qty',
    'rate',
    'tax_percent',
    'uom',
    'discount_percent',

    'line_total',
    'display_order',
    'custom1',
    'custom2',
    'variant_id',
    'base_rate_snapshot',
    'applied_discount_percent',
    'is_override',
    'final_rate_snapshot',
    'is_header',
    'is_subtotal',
    'subtotal_label'
  ];

  for (const field of fieldsToCompare) {
    const currVal = curr[field] === undefined ? null : curr[field];
    const origVal = orig[field] === undefined ? null : orig[field];
    if (currVal !== origVal) {
      // Handle numeric variations like 0 vs null/undefined or string float comparison
      if (typeof currVal === 'number' || typeof origVal === 'number') {
        const nCurr = currVal === null ? 0 : Number(currVal);
        const nOrig = origVal === null ? 0 : Number(origVal);
        if (Math.abs(nCurr - nOrig) > 0.0001) {
          return true;
        }
      } else {
        return true;
      }
    }
  }
  return false;
};

// Map items to database format (strip extra client-side UI fields)
const mapToDbRow = (item: Item, quotationId: string, displayOrder: number): any => {
  const isErection = item.section === 'erection';
  return {
    quotation_id: quotationId,
    organisation_id: item.organisation_id || null,
    item_id: isErection ? null : (item.item_id || null),
    sac_code: isErection ? (item.sac_code || '995419') : null,
    description: isErection ? (item.description || 'Erection Charges') : (item.description || ''),
    qty: item.qty === null ? null : (parseFloat(item.qty as any) || 0),
    rate: parseFloat(item.rate as any) || 0,
    tax_percent: parseFloat(item.tax_percent as any) || 0,
    uom: item.uom || '',
    discount_percent: parseFloat(item.discount_percent as any) || 0,

    line_total: parseFloat(item.line_total as any) || 0,
    display_order: displayOrder,
    custom1: item.custom1 || '',
    custom2: item.custom2 || '',
    variant_id: item.variant_id || null,
    base_rate_snapshot: parseFloat(item.base_rate_snapshot as any) || parseFloat(item.rate as any) || 0,
    applied_discount_percent: parseFloat(item.applied_discount_percent as any) || 0,
    is_override: !!item.is_override,
    final_rate_snapshot: parseFloat(item.final_rate_snapshot as any) || parseFloat(item.rate as any) || 0,
    is_header: !!item.is_header,
    is_subtotal: !!item.is_subtotal,
    subtotal_label: item.subtotal_label || null
  };
};

export async function saveItemsDiff(
  quotationId: string,
  currentItems: Item[],
  originalItems: Item[]
): Promise<any[]> {
  const originalById = new Map<string, Item>();
  originalItems.forEach(item => {
    if (isUUID(item.id)) {
      originalById.set(item.id, item);
    }
  });

  const currentById = new Map<string, Item>();
  currentItems.forEach(item => {
    if (isUUID(item.id)) {
      currentById.set(item.id, item);
    }
  });

  // 1. Identify deleted items (existed in original items but missing/un-matched in current items)
  const toDelete = originalItems.filter(item => isUUID(item.id) && !currentById.has(item.id));

  // 2. Identify new items (does not have a valid database UUID id)
  const toInsert = currentItems.filter(item => !isUUID(item.id));

  // 3. Identify updated items (has valid UUID, matched in original items, but changed)
  const toUpdate = currentItems.filter(item => {
    if (!isUUID(item.id)) return false;
    const orig = originalById.get(item.id);
    return orig && hasRowChanged(item, orig);
  });

  const dbInserts = toInsert.map((item, idx) => {
    const displayOrder = currentItems.indexOf(item);
    return mapToDbRow(item, quotationId, displayOrder >= 0 ? displayOrder : idx);
  });

  // Run delete and updates/inserts
  if (toDelete.length > 0) {
    const deleteIds = toDelete.map(item => item.id);
    const { error: delError } = await supabase
      .from('quotation_items')
      .delete()
      .in('id', deleteIds);
    if (delError) throw delError;
  }

  // Updates - execute each update query
  for (const item of toUpdate) {
    const displayOrder = currentItems.indexOf(item);
    const dbRow = mapToDbRow(item, quotationId, displayOrder);
    const { error: updError } = await supabase
      .from('quotation_items')
      .update(dbRow)
      .eq('id', item.id);
    if (updError) throw updError;
  }

  // Inserts - execute a bulk insert of new rows and return the newly generated UUIDs
  let insertedRows: any[] = [];
  if (dbInserts.length > 0) {
    const { data, error: insError } = await supabase
      .from('quotation_items')
      .insert(dbInserts)
      .select('*');
    if (insError) throw insError;
    insertedRows = data || [];
  }

  // Return the final list of items with their correct database IDs mapped back
  const savedItems = currentItems.map((item, idx) => {
    if (isUUID(item.id)) {
      return item; // Keep existing ID
    }
    const dbInsertIndex = toInsert.indexOf(item);
    if (dbInsertIndex >= 0 && insertedRows.length > 0) {
      const matchedRow = insertedRows.find(
        (r: any) => r.display_order === idx
      ) || insertedRows[dbInsertIndex];
      
      if (matchedRow) {
        return {
          ...item,
          id: matchedRow.id, // Assign the database-generated UUID
          created_at: matchedRow.created_at,
          updated_at: matchedRow.updated_at
        };
      }
    }
    return item;
  });

  return savedItems;
}
