import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { timedSupabaseQuery, withTimeout } from '../utils/queryTimeout';
import { useMaterials } from '../hooks/useMaterials';
import { useWarehouses } from '../hooks/useWarehouses';
import { useVariants } from '../hooks/useVariants';

const createEmptyItem = (id) => ({
  id,
  item_id: '',
  variant_id: '',
  available_qty: 0,
  quantity: '',
  valid: false,
});

const createInitialFormData = () => ({
  transfer_date: new Date().toISOString().split('T')[0],
  from_warehouse_id: '',
  to_warehouse_id: '',
  vehicle_no: '',
  transporter_name: '',
  status: 'DRAFT',
  remarks: '',
});

export default function StockTransfer({ onCancel }) {
  const { data: materials = [] } = useMaterials();
  const { data: warehouses = [] } = useWarehouses();
  const { data: variants = [] } = useVariants();
  
  const [view, setView] = useState('list');
  const [editingTransfer, setEditingTransfer] = useState(null);
  const [formData, setFormData] = useState(createInitialFormData);
  const [items, setItems] = useState([createEmptyItem(1)]);
  const [nextId, setNextId] = useState(2);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const transfersQuery = useQuery({
    queryKey: ['stockTransfers'],
    queryFn: async () => {
      const rows = await timedSupabaseQuery(
        supabase.from('stock_transfers').select('*').order('created_at', { ascending: false }),
        'Stock transfers',
      );
      return rows || [];
    },
  });

  const formInitQuery = useQuery({
    queryKey: ['stockTransferInit'],
    enabled: view === 'form',
    queryFn: async () => {
      return {
        materials,
        warehouses,
        variants: variants.filter((variant) => variant.is_active !== false),
      };
    },
  });

  const stockQuery = useQuery({
    queryKey: ['stockTransferStock', formData.from_warehouse_id],
    enabled: view === 'form' && !!formData.from_warehouse_id,
    queryFn: async () => {
      const rows = await timedSupabaseQuery(
        supabase
          .from('item_stock')
          .select('item_id, company_variant_id, warehouse_id, current_stock')
          .eq('warehouse_id', formData.from_warehouse_id),
        'Stock transfer stock',
      );
      return rows || [];
    },
  });

  const editItemsQuery = useQuery({
    queryKey: ['stockTransferItems', editingTransfer?.id],
    enabled: view === 'form' && !!editingTransfer?.id,
    queryFn: async () => {
      const rows = await timedSupabaseQuery(
        supabase
          .from('stock_transfer_items')
          .select('*')
          .eq('transfer_id', editingTransfer.id)
          .order('id'),
        'Stock transfer items',
      );
      return rows || [];
    },
  });

  const transfers = transfersQuery.data || [];
  const stockRows = stockQuery.data || [];
  const isEditing = !!editingTransfer;
  const isLocked = editingTransfer?.status && editingTransfer.status !== 'DRAFT';

  const stockMap = useMemo(() => {
    const map = {};
    stockRows.forEach((row) => {
      const itemKey = row.item_id || '';
      const variantKey = row.company_variant_id || 'default';
      map[`${itemKey}:${variantKey}`] = parseFloat(row.current_stock) || 0;
      if (row.company_variant_id == null && map[`${itemKey}:default`] === undefined) {
        map[`${itemKey}:default`] = parseFloat(row.current_stock) || 0;
      }
    });
    return map;
  }, [stockRows]);

  const getAvailableQty = (itemId, variantId) => {
    if (!itemId) return 0;
    const exactKey = `${itemId}:${variantId || 'default'}`;
    if (stockMap[exactKey] !== undefined) return stockMap[exactKey];
    return stockMap[`${itemId}:default`] || 0;
  };

  const recalculateItem = (baseItem, overrides = {}) => {
    const nextItem = { ...baseItem, ...overrides };
    const availableQty = getAvailableQty(nextItem.item_id, nextItem.variant_id);
    const quantity = parseFloat(nextItem.quantity) || 0;

    return {
      ...nextItem,
      available_qty: availableQty,
      valid: !!nextItem.item_id && quantity > 0 && quantity <= availableQty,
    };
  };

  useEffect(() => {
    if (view !== 'form' || !editingTransfer) return;

    setFormData({
      transfer_date: editingTransfer.transfer_date || new Date().toISOString().split('T')[0],
      from_warehouse_id: editingTransfer.from_warehouse_id || '',
      to_warehouse_id: editingTransfer.to_warehouse_id || '',
      vehicle_no: editingTransfer.vehicle_no || '',
      transporter_name: editingTransfer.transporter_name || '',
      status: editingTransfer.status || 'DRAFT',
      remarks: editingTransfer.remarks || '',
    });
    setSaveError('');
  }, [view, editingTransfer]);

  useEffect(() => {
    if (view !== 'form' || !isEditing || editItemsQuery.isPending) return;

    const loadedItems = (editItemsQuery.data || []).map((item, index) =>
      recalculateItem({
        id: index + 1,
        item_id: item.item_id || '',
        variant_id: item.company_variant_id || '',
        quantity: item.quantity ? String(item.quantity) : '',
        available_qty: 0,
        valid: false,
      }),
    );

    setItems(loadedItems.length ? loadedItems : [createEmptyItem(1)]);
    setNextId(loadedItems.length > 0 ? loadedItems.length + 1 : 2);
  }, [view, isEditing, editItemsQuery.data, editItemsQuery.isPending, stockMap]);

  useEffect(() => {
    if (view !== 'form' || isEditing) return;
    setItems((current) => current.map((item) => recalculateItem(item)));
  }, [view, isEditing, stockMap]);

  const openNewForm = () => {
    setEditingTransfer(null);
    setFormData(createInitialFormData());
    setItems([createEmptyItem(1)]);
    setNextId(2);
    setSaveError('');
    setView('form');
  };

  const openEditForm = (transfer) => {
    setEditingTransfer(transfer);
    setItems([createEmptyItem(1)]);
    setNextId(2);
    setSaveError('');
    setView('form');
  };

  const returnToList = () => {
    setView('list');
    setEditingTransfer(null);
    setFormData(createInitialFormData());
    setItems([createEmptyItem(1)]);
    setNextId(2);
    setSaveError('');
  };

  const getMaterial = (id) => materials.find((material) => material.id === id);

  const getStatusBadge = (status) => {
    const colors = { DRAFT: '#fff3cd', ON_TRANSIT: '#cce5ff', STOCK_RECEIVED: '#d4edda' };
    return (
      <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', background: colors[status] || colors.DRAFT }}>
        {status}
      </span>
    );
  };

  const addItem = () => {
    if (isLocked) return;
    setItems((current) => [...current, createEmptyItem(nextId)]);
    setNextId((current) => current + 1);
  };

  const removeItem = (id) => {
    if (isLocked) return;
    setItems((current) => {
      const nextItems = current.filter((item) => item.id !== id);
      return nextItems.length ? nextItems : [createEmptyItem(1)];
    });
  };

  const updateItem = (id, field, value) => {
    if (isLocked) return;
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        return recalculateItem(item, { [field]: value });
      }),
    );
  };

  const validateForm = () => {
    if (!formData.transfer_date) return 'Select transfer date.';
    if (!formData.from_warehouse_id) return 'Select the from warehouse.';
    if (!formData.to_warehouse_id) return 'Select the to warehouse.';
    if (formData.from_warehouse_id === formData.to_warehouse_id) {
      return 'From and to warehouses must be different.';
    }

    const populatedItems = items.filter((item) => item.item_id);
    if (populatedItems.length === 0) return 'Add at least one item.';

    for (const item of populatedItems) {
      const material = getMaterial(item.item_id);
      const itemName = material?.display_name || material?.name || 'Selected item';
      const quantity = parseFloat(item.quantity) || 0;

      if (quantity <= 0) {
        return `Invalid quantity for item: ${itemName}.`;
      }

      if (quantity > item.available_qty) {
        return `Insufficient stock for item: ${itemName}.`;
      }
    }

    return '';
  };

  const generateTransferNo = async () => {
    const result = await withTimeout(
      supabase.from('stock_transfers').select('id', { count: 'exact', head: true }),
      15000,
      'Stock transfer number',
    );

    if (result.error) {
      throw new Error(`Stock transfer number: ${result.error.message || 'Unknown error'}`);
    }

    const num = (result.count || 0) + 1;
    return `TRF-${String(num).padStart(5, '0')}`;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaveError('');

    const validationMessage = validateForm();
    if (validationMessage) {
      setSaveError(validationMessage);
      return;
    }

    if (isLocked) {
      setSaveError('Only draft transfers can be edited.');
      return;
    }

    const validItems = items.filter((item) => item.valid);
    if (validItems.length === 0) {
      setSaveError('Add at least one valid item.');
      return;
    }

    setSaving(true);
    try {
      let transferId = editingTransfer?.id;

      if (isEditing) {
        await timedSupabaseQuery(
          supabase.from('stock_transfers').update(formData).eq('id', editingTransfer.id),
          'Stock transfer update',
        );

        await timedSupabaseQuery(
          supabase.from('stock_transfer_items').delete().eq('transfer_id', editingTransfer.id),
          'Stock transfer item reset',
        );
      } else {
        const transferNo = await generateTransferNo();
        const transfer = await timedSupabaseQuery(
          supabase.from('stock_transfers').insert({ ...formData, transfer_no: transferNo }).select().single(),
          'Stock transfer save',
        );
        transferId = transfer.id;
      }

      const itemsToSave = validItems.map((item) => ({
        transfer_id: transferId,
        item_id: item.item_id,
        company_variant_id: item.variant_id || null,
        quantity: parseFloat(item.quantity) || 0,
      }));

      await timedSupabaseQuery(
        supabase.from('stock_transfer_items').insert(itemsToSave),
        'Stock transfer items save',
      );

      await transfersQuery.refetch();
      returnToList();
    } catch (error) {
      setSaveError(error.message || 'Unable to save stock transfer.');
    } finally {
      setSaving(false);
    }
  };

  const retryFormDependencies = async () => {
    await Promise.all([formInitQuery.refetch(), stockQuery.refetch(), editItemsQuery.refetch()]);
  };

  if (view === 'list') {
    if (transfersQuery.isPending && !transfersQuery.data) {
      return <div style={{ padding: '40px', textAlign: 'center' }}>Loading transfers...</div>;
    }

    if (transfersQuery.isError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ color: '#b91c1c', fontWeight: 600, marginBottom: '12px' }}>
            {(transfersQuery.error instanceof Error && transfersQuery.error.message) || 'Unable to load transfers.'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button type="button" className="btn btn-primary" onClick={() => transfersQuery.refetch()}>Retry</button>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Back</button>
          </div>
        </div>
      );
    }

    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Stock Transfers</h1>
          <button className="btn btn-primary" onClick={openNewForm}>+ New Transfer</button>
        </div>
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Transfer No</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={4}>No transfers</td>
                </tr>
              ) : (
                transfers.map((transfer) => (
                  <tr key={transfer.id}>
                    <td><strong>{transfer.transfer_no}</strong></td>
                    <td>{transfer.transfer_date}</td>
                    <td>{getStatusBadge(transfer.status)}</td>
                    <td>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEditForm(transfer)}>Edit</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (formInitQuery.isPending && !formInitQuery.data) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading transfer form...</div>;
  }

  if (formInitQuery.isError || editItemsQuery.isError) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ color: '#b91c1c', fontWeight: 600, marginBottom: '12px' }}>
          {(formInitQuery.error instanceof Error && formInitQuery.error.message)
            || (editItemsQuery.error instanceof Error && editItemsQuery.error.message)
            || 'Unable to load transfer form.'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <button type="button" className="btn btn-primary" onClick={retryFormDependencies}>Retry</button>
          <button type="button" className="btn btn-secondary" onClick={returnToList}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{isEditing ? 'Edit Transfer' : 'New Stock Transfer'}</h1>
      </div>

      {saveError && (
        <div className="alert alert-error" style={{ marginBottom: '16px' }}>{saveError}</div>
      )}

      {stockQuery.isError && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#b91c1c',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          <span>{(stockQuery.error instanceof Error && stockQuery.error.message) || 'Unable to load warehouse stock.'}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => stockQuery.refetch()}>Retry</button>
        </div>
      )}

      {isLocked && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid #bfdbfe',
            background: '#eff6ff',
            color: '#1d4ed8',
          }}
        >
          This transfer is {editingTransfer?.status}. It can be viewed but not edited.
        </div>
      )}

      <div className="card" style={{ padding: '0' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ background: '#f8f9fa', padding: '16px', borderBottom: '1px solid #e0e0e0' }}>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <label className="form-label">Transfer Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.transfer_date}
                  onChange={(e) => setFormData({ ...formData, transfer_date: e.target.value })}
                  disabled={isLocked}
                />
              </div>
              <div>
                <label className="form-label">From Warehouse *</label>
                <select
                  className="form-select"
                  value={formData.from_warehouse_id}
                  onChange={(e) => setFormData({ ...formData, from_warehouse_id: e.target.value })}
                  disabled={isLocked}
                >
                  <option value="">Select</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.warehouse_name || warehouse.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">To Warehouse *</label>
                <select
                  className="form-select"
                  value={formData.to_warehouse_id}
                  onChange={(e) => setFormData({ ...formData, to_warehouse_id: e.target.value })}
                  disabled={isLocked}
                >
                  <option value="">Select</option>
                  {warehouses
                    .filter((warehouse) => warehouse.id !== formData.from_warehouse_id)
                    .map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.warehouse_name || warehouse.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="form-label">Vehicle No</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.vehicle_no}
                  onChange={(e) => setFormData({ ...formData, vehicle_no: e.target.value })}
                  placeholder="XX-XX-XXXX"
                  disabled={isLocked}
                />
              </div>
              <div>
                <label className="form-label">Transporter</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.transporter_name}
                  onChange={(e) => setFormData({ ...formData, transporter_name: e.target.value })}
                  placeholder="Transporter Name"
                  disabled={isLocked}
                />
              </div>
            </div>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Variant</th>
                <th>Available</th>
                <th>Qty</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id} style={{ background: !item.valid && item.item_id ? '#fff7ed' : 'transparent' }}>
                  <td>{index + 1}</td>
                  <td>
                    <select
                      value={item.item_id || ''}
                      onChange={(e) => updateItem(item.id, 'item_id', e.target.value)}
                      style={{ width: '100%', padding: '6px' }}
                      disabled={isLocked}
                    >
                      <option value="">Select</option>
                      {materials.map((material) => (
                        <option key={material.id} value={material.id}>
                          {material.display_name || material.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={item.variant_id || ''}
                      onChange={(e) => updateItem(item.id, 'variant_id', e.target.value)}
                      style={{ width: '100%', padding: '6px' }}
                      disabled={isLocked}
                    >
                      <option value="">Select</option>
                      {variants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.variant_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ textAlign: 'right' }}>{item.available_qty}</td>
                  <td>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                      style={{ width: '80px', padding: '6px' }}
                      disabled={isLocked}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer' }}
                      disabled={isLocked}
                    >
                      x
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!isLocked && (
            <button
              type="button"
              onClick={addItem}
              style={{ margin: '12px', padding: '8px 16px', background: '#fff', border: '1px dashed #3498db', borderRadius: '4px', color: '#3498db' }}
            >
              + Add Item
            </button>
          )}

          <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '12px' }}>
            {!isLocked && (
              <button className="btn btn-primary" type="submit" disabled={saving || stockQuery.isFetching}>
                {saving ? 'Saving...' : isEditing ? 'Update Transfer' : 'Create Transfer'}
              </button>
            )}
            <button className="btn btn-secondary" type="button" onClick={returnToList} disabled={saving}>
              Back
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
