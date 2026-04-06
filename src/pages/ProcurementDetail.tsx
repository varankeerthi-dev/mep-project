import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';

const STATUSES = ['Pending', 'Sourcing', 'PO Raised', 'Received', 'Dispatched'] as const;
type Status = typeof STATUSES[number];

const STATUS_CONFIG: Record<Status, { bg: string; color: string; border: string }> = {
  Pending:    { bg: '#fef9c3', color: '#854d0e', border: '#fde047' },
  Sourcing:   { bg: '#e0f2fe', color: '#075985', border: '#7dd3fc' },
  'PO Raised':{ bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
  Received:   { bg: '#dcfce7', color: '#166534', border: '#86efac' },
  Dispatched: { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' },
};

type ProcurementItem = {
  id: string;
  list_id: string;
  item_id: string | null;
  item_name: string;
  make: string;
  variant_name: string;
  uom: string;
  boq_qty: number;
  stock_qty: number;
  local_qty: number;
  vendor_id: string | null;
  notes: string;
  status: Status;
  display_order: number;
  is_header_row: boolean;
  header_text: string;
  _dirty?: boolean;
  _isNew?: boolean;
};

export default function ProcurementDetail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  const orgId = organisation?.id;
  const listId = searchParams.get('id');

  const [items, setItems] = useState<ProcurementItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Fetch list header
  const { data: list, isLoading: listLoading } = useQuery({
    queryKey: ['procurement-list', listId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procurement_lists')
        .select('*')
        .eq('id', listId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!listId,
  });

  // Fetch vendors
  const { data: vendors = [] } = useQuery({
    queryKey: ['procurement-vendors', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_vendors')
        .select('id, company_name, vendor_code')
        .eq('organisation_id', orgId)
        .eq('status', 'Active')
        .order('company_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  // Fetch items
  const { data: rawItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['procurement-items', listId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procurement_items')
        .select('*')
        .eq('list_id', listId)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!listId,
  });

  // Hydrate items into state
  useEffect(() => {
    if (rawItems.length > 0) {
      setItems(rawItems.map((i: any) => ({ ...i, _dirty: false, _isNew: false })));
    }
  }, [rawItems]);

  // Update a field on an item
  const updateItem = useCallback((id: string, field: keyof ProcurementItem, value: any) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value, _dirty: true } : item
      )
    );
  }, []);

  // Add empty row
  const addRow = useCallback(() => {
    const newItem: ProcurementItem = {
      id: `new-${Date.now()}-${Math.random()}`,
      list_id: listId!,
      item_id: null,
      item_name: '',
      make: '',
      variant_name: '',
      uom: 'Nos',
      boq_qty: 0,
      stock_qty: 0,
      local_qty: 0,
      vendor_id: null,
      notes: '',
      status: 'Pending',
      display_order: items.length,
      is_header_row: false,
      header_text: '',
      _dirty: true,
      _isNew: true,
    };
    setItems((prev) => [...prev, newItem]);
  }, [items.length, listId]);

  // Add section header
  const addHeader = useCallback(() => {
    const newHeader: ProcurementItem = {
      id: `new-${Date.now()}-${Math.random()}`,
      list_id: listId!,
      item_id: null,
      item_name: '',
      make: '',
      variant_name: '',
      uom: '',
      boq_qty: 0,
      stock_qty: 0,
      local_qty: 0,
      vendor_id: null,
      notes: '',
      status: 'Pending',
      display_order: items.length,
      is_header_row: true,
      header_text: 'New Section',
      _dirty: true,
      _isNew: true,
    };
    setItems((prev) => [...prev, newHeader]);
  }, [items.length, listId]);

  // Delete row (local only until save)
  const deleteRow = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // Save all dirty items
  const handleSave = async () => {
    setSaving(true);
    try {
      const dirty = items.filter((i) => i._dirty);
      if (dirty.length === 0) { setSaving(false); return; }

      const toUpsert = dirty.map((item, idx) => ({
        ...(item._isNew ? {} : { id: item.id }),
        list_id: listId,
        organisation_id: orgId,
        item_id: item.item_id || null,
        item_name: item.item_name,
        make: item.make || null,
        variant_name: item.variant_name || null,
        uom: item.uom || null,
        boq_qty: parseFloat(String(item.boq_qty)) || 0,
        stock_qty: parseFloat(String(item.stock_qty)) || 0,
        local_qty: parseFloat(String(item.local_qty)) || 0,
        vendor_id: item.vendor_id || null,
        notes: item.notes || null,
        status: item.status,
        display_order: item.display_order ?? idx,
        is_header_row: item.is_header_row || false,
        header_text: item.header_text || null,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from('procurement_items').upsert(toUpsert, { onConflict: 'id' });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['procurement-items', listId] });
      setItems((prev) => prev.map((i) => ({ ...i, _dirty: false, _isNew: false })));
    } catch (e: any) {
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete item from DB
  const handleDeleteRow = async (item: ProcurementItem) => {
    if (item._isNew) { deleteRow(item.id); return; }
    if (!confirm(`Remove "${item.item_name || 'this row'}"?`)) return;
    const { error } = await supabase.from('procurement_items').delete().eq('id', item.id);
    if (error) { alert('Delete failed: ' + error.message); return; }
    deleteRow(item.id);
  };

  // Stats
  const stats = useMemo(() => {
    const dataRows = items.filter((i) => !i.is_header_row);
    const total = dataRows.length;
    const pending = dataRows.filter((i) => i.status === 'Pending').length;
    const sourcing = dataRows.filter((i) => i.status === 'Sourcing').length;
    const poRaised = dataRows.filter((i) => i.status === 'PO Raised').length;
    const received = dataRows.filter((i) => i.status === 'Received').length;
    const dispatched = dataRows.filter((i) => i.status === 'Dispatched').length;
    const needsSourcing = dataRows.filter((i) => {
      const gap = (i.boq_qty || 0) - (i.stock_qty || 0) - (i.local_qty || 0);
      return gap > 0;
    }).length;
    return { total, pending, sourcing, poRaised, received, dispatched, needsSourcing };
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    if (filterStatus === 'all') return items;
    if (filterStatus === 'needs') {
      return items.filter((i) => {
        if (i.is_header_row) return true;
        const gap = (i.boq_qty || 0) - (i.stock_qty || 0) - (i.local_qty || 0);
        return gap > 0;
      });
    }
    return items.filter((i) => i.is_header_row || i.status === filterStatus);
  }, [items, filterStatus]);

  const isLoading = listLoading || itemsLoading;
  const hasDirty = items.some((i) => i._dirty);

  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '20px', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <button
              onClick={() => navigate('/procurement')}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '13px', padding: 0 }}
            >
              ← Back
            </button>
            <span style={{ color: '#d1d5db' }}>|</span>
            <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}>{list?.title}</h1>
            {list?.source && (
              <span style={{
                padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                background: list.source === 'boq' ? '#fef3c7' : list.source === 'quotation' ? '#e0f2fe' : '#ede9fe',
                color: list.source === 'boq' ? '#92400e' : list.source === 'quotation' ? '#075985' : '#5b21b6',
              }}>
                {list.source.toUpperCase()}
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', gap: '16px' }}>
            {list?.client_name && <span>Client: {list.client_name}</span>}
            {(list?.boq_no || list?.quotation_no) && <span>Ref: {list.boq_no || list.quotation_no}</span>}
            {list?.notes && <span>{list.notes}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={addHeader} style={btnOutline}>+ Section</button>
          <button onClick={addRow} style={btnOutline}>+ Add Row</button>
          <button
            onClick={handleSave}
            disabled={saving || !hasDirty}
            style={{
              ...btnPrimary,
              opacity: saving || !hasDirty ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving...' : hasDirty ? '● Save Changes' : 'Saved'}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[
          { label: 'Total Items', value: stats.total, filter: 'all', bg: '#f3f4f6', color: '#374151' },
          { label: 'Needs Sourcing', value: stats.needsSourcing, filter: 'needs', bg: '#fef9c3', color: '#854d0e' },
          { label: 'Pending', value: stats.pending, filter: 'Pending', bg: '#fef9c3', color: '#854d0e' },
          { label: 'Sourcing', value: stats.sourcing, filter: 'Sourcing', bg: '#e0f2fe', color: '#075985' },
          { label: 'PO Raised', value: stats.poRaised, filter: 'PO Raised', bg: '#ede9fe', color: '#5b21b6' },
          { label: 'Received', value: stats.received, filter: 'Received', bg: '#dcfce7', color: '#166534' },
          { label: 'Dispatched', value: stats.dispatched, filter: 'Dispatched', bg: '#f3f4f6', color: '#374151' },
        ].map((s) => (
          <div
            key={s.filter}
            onClick={() => setFilterStatus(s.filter)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: filterStatus === s.filter ? s.bg : '#fff',
              border: `1px solid ${filterStatus === s.filter ? s.color + '40' : '#e5e7eb'}`,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: '18px', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '900px' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={thStyle}>#</th>
              <th style={{ ...thStyle, textAlign: 'left', minWidth: '200px' }}>Item</th>
              <th style={thStyle}>Make</th>
              <th style={thStyle}>Variant</th>
              <th style={thStyle}>UOM</th>
              <th style={thStyle}>BOQ Qty</th>
              <th style={thStyle}>Stock Qty</th>
              <th style={thStyle}>Local Qty</th>
              <th style={{ ...thStyle, color: '#dc2626' }}>Gap</th>
              <th style={{ ...thStyle, minWidth: '160px' }}>Vendor</th>
              <th style={{ ...thStyle, minWidth: '140px' }}>Status</th>
              <th style={{ ...thStyle, minWidth: '140px' }}>Notes</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={13} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                  No items. Click "+ Add Row" to start.
                </td>
              </tr>
            ) : (
              filteredItems.map((item, idx) => {
                if (item.is_header_row) {
                  return (
                    <tr key={item.id} style={{ background: '#f1f5f9' }}>
                      <td colSpan={12} style={{ padding: '8px 14px' }}>
                        <input
                          type="text"
                          value={item.header_text || ''}
                          onChange={(e) => updateItem(item.id, 'header_text', e.target.value)}
                          style={{
                            border: 'none', background: 'transparent', fontWeight: 700,
                            fontSize: '12px', color: '#1e293b', width: '100%', outline: 'none',
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                          }}
                          placeholder="Section name..."
                        />
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <button onClick={() => handleDeleteRow(item)} style={deleteBtnStyle}>×</button>
                      </td>
                    </tr>
                  );
                }

                const gap = (item.boq_qty || 0) - (item.stock_qty || 0) - (item.local_qty || 0);
                const gapColor = gap > 0 ? '#dc2626' : '#16a34a';
                const isDispatched = item.status === 'Dispatched';
                const cfg = STATUS_CONFIG[item.status as Status] || STATUS_CONFIG.Pending;

                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      background: item._dirty ? '#fffbeb' : isDispatched ? '#f9fafb' : '#fff',
                      opacity: isDispatched ? 0.7 : 1,
                    }}
                  >
                    {/* Row number */}
                    <td style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af', width: '40px' }}>
                      {idx + 1}
                    </td>

                    {/* Item name */}
                    <td style={tdStyle}>
                      <input
                        type="text"
                        value={item.item_name}
                        onChange={(e) => updateItem(item.id, 'item_name', e.target.value)}
                        disabled={isDispatched}
                        placeholder="Item name..."
                        style={{ ...cellInput, fontWeight: 500 }}
                      />
                    </td>

                    {/* Make */}
                    <td style={tdStyle}>
                      <input
                        type="text"
                        value={item.make || ''}
                        onChange={(e) => updateItem(item.id, 'make', e.target.value)}
                        disabled={isDispatched}
                        style={cellInput}
                      />
                    </td>

                    {/* Variant */}
                    <td style={tdStyle}>
                      <input
                        type="text"
                        value={item.variant_name || ''}
                        onChange={(e) => updateItem(item.id, 'variant_name', e.target.value)}
                        disabled={isDispatched}
                        style={cellInput}
                      />
                    </td>

                    {/* UOM */}
                    <td style={tdStyle}>
                      <input
                        type="text"
                        value={item.uom || ''}
                        onChange={(e) => updateItem(item.id, 'uom', e.target.value)}
                        disabled={isDispatched}
                        style={{ ...cellInput, width: '60px' }}
                      />
                    </td>

                    {/* BOQ Qty */}
                    <td style={tdStyle}>
                      <input
                        type="number"
                        value={item.boq_qty || ''}
                        onChange={(e) => updateItem(item.id, 'boq_qty', parseFloat(e.target.value) || 0)}
                        disabled={isDispatched}
                        style={{ ...cellInput, width: '70px', textAlign: 'right' }}
                      />
                    </td>

                    {/* Stock Qty */}
                    <td style={tdStyle}>
                      <input
                        type="number"
                        value={item.stock_qty || ''}
                        onChange={(e) => updateItem(item.id, 'stock_qty', parseFloat(e.target.value) || 0)}
                        disabled={isDispatched}
                        style={{ ...cellInput, width: '70px', textAlign: 'right' }}
                      />
                    </td>

                    {/* Local Qty */}
                    <td style={tdStyle}>
                      <input
                        type="number"
                        value={item.local_qty || ''}
                        onChange={(e) => updateItem(item.id, 'local_qty', parseFloat(e.target.value) || 0)}
                        disabled={isDispatched}
                        style={{ ...cellInput, width: '70px', textAlign: 'right' }}
                      />
                    </td>

                    {/* Gap */}
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <span style={{
                        fontWeight: 700,
                        fontSize: '13px',
                        color: gapColor,
                      }}>
                        {gap > 0 ? `+${gap}` : gap}
                      </span>
                    </td>

                    {/* Vendor dropdown */}
                    <td style={tdStyle}>
                      <select
                        value={item.vendor_id || ''}
                        onChange={(e) => updateItem(item.id, 'vendor_id', e.target.value || null)}
                        disabled={isDispatched}
                        style={{ ...cellInput, minWidth: '150px' }}
                      >
                        <option value="">— Select Vendor —</option>
                        {vendors.map((v: any) => (
                          <option key={v.id} value={v.id}>
                            {v.company_name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Status */}
                    <td style={tdStyle}>
                      <select
                        value={item.status}
                        onChange={(e) => updateItem(item.id, 'status', e.target.value as Status)}
                        style={{
                          ...cellInput,
                          background: cfg.bg,
                          color: cfg.color,
                          border: `1px solid ${cfg.border}`,
                          fontWeight: 600,
                          minWidth: '130px',
                        }}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>

                    {/* Notes */}
                    <td style={tdStyle}>
                      <input
                        type="text"
                        value={item.notes || ''}
                        onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                        disabled={isDispatched}
                        placeholder="Notes..."
                        style={{ ...cellInput, minWidth: '130px' }}
                      />
                    </td>

                    {/* Delete */}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {!isDispatched && (
                        <button onClick={() => handleDeleteRow(item)} style={deleteBtnStyle}>×</button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom save bar */}
      {hasDirty && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px',
          background: '#1d4ed8', color: '#fff', padding: '12px 24px',
          borderRadius: '8px', boxShadow: '0 4px 16px rgba(29,78,216,0.4)',
          display: 'flex', gap: '12px', alignItems: 'center', fontSize: '13px', fontWeight: 600,
        }}>
          <span>You have unsaved changes</span>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '6px 16px', border: '2px solid #fff', borderRadius: '6px', background: 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}
          >
            {saving ? 'Saving...' : 'Save Now'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding: '10px 10px',
  textAlign: 'center',
  fontSize: '10px',
  fontWeight: 700,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 8px',
  verticalAlign: 'middle',
};

const cellInput: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  border: '1px solid #e5e7eb',
  borderRadius: '4px',
  fontSize: '12px',
  background: '#fff',
  outline: 'none',
  fontFamily: 'inherit',
};

const deleteBtnStyle: React.CSSProperties = {
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  color: '#9ca3af',
  fontSize: '18px',
  lineHeight: 1,
  padding: '0 4px',
  fontWeight: 300,
};

const btnOutline: React.CSSProperties = {
  padding: '7px 14px',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  background: '#fff',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
  color: '#374151',
};

const btnPrimary: React.CSSProperties = {
  padding: '7px 16px',
  border: 'none',
  borderRadius: '6px',
  background: '#1d4ed8',
  color: '#fff',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};
