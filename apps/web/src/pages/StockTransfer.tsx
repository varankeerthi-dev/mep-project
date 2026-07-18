import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { timedSupabaseQuery, withTimeout } from '../utils/queryTimeout';
import { useAuth } from '../contexts/AuthContext';
import { useMaterials } from '../hooks/useMaterials';
import { useWarehouses } from '../hooks/useWarehouses';
import { useVariants } from '../hooks/useVariants';


const createEmptyItem = (id) => ({
  id,
  item_id: '',
  variant_id: '',
  available_qty: 0,
  quantity: '',
  received_qty: '',
  valid: false,
});

const createInitialFormData = () => ({
  transfer_date: new Date().toISOString().split('T')[0],
  from_warehouse_id: '',
  to_warehouse_id: '',
  vehicle_no: '',
  transporter_name: '',
  status: 'ON_TRANSIT',
  remarks: '',
});

const STATUS_COLORS = { DRAFT: '#fff3cd', ON_TRANSIT: '#cce5ff', STOCK_RECEIVED: '#d4edda' };

export default function StockTransfer({ onCancel }) {
  const { organisation, user } = useAuth();
  const queryClient = useQueryClient();
  const { data: materials = [] } = useMaterials();
  const { data: warehouses = [] } = useWarehouses();
  const { data: variants = [] } = useVariants();

  const [view, setView] = useState('list');
  const [editingTransfer, setEditingTransfer] = useState(null);
  const [receivingTransfer, setReceivingTransfer] = useState(null);
  const [viewingTransfer, setViewingTransfer] = useState(null);
  const [formData, setFormData] = useState(createInitialFormData);
  const [items, setItems] = useState([createEmptyItem(1)]);
  const [nextId, setNextId] = useState(2);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Bulk add picker state
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [pickerItems, setPickerItems] = useState<any[]>([]);

  const transfersQuery = useQuery({
    queryKey: ['stockTransfers', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const rows = await timedSupabaseQuery(
        supabase.from('stock_transfers').select('*').eq('organisation_id', organisation.id).order('created_at', { ascending: false }),
        'Stock transfers',
      );
      return rows || [];
    },
    enabled: !!organisation?.id,
  });

  const stockQuery = useQuery({
    queryKey: ['stockTransferStock', formData.from_warehouse_id, organisation?.id],
    enabled: view === 'form' && !!formData.from_warehouse_id && !!organisation?.id,
    queryFn: async () => {
      const rows = await timedSupabaseQuery(
        supabase
          .from('item_stock')
          .select('item_id, company_variant_id, warehouse_id, current_stock')
          .eq('warehouse_id', formData.from_warehouse_id)
          .eq('organisation_id', organisation.id),
        'Stock transfer stock',
      );
      return rows || [];
    },
  });

  const editItemsQuery = useQuery({
    queryKey: ['stockTransferItems', editingTransfer?.id],
    enabled: view === 'form' && !!editingTransfer?.id && !!organisation?.id,
    queryFn: async () => {
      const rows = await timedSupabaseQuery(
        supabase
          .from('stock_transfer_items')
          .select('*')
          .eq('transfer_id', editingTransfer.id)
          .eq('organisation_id', organisation.id)
          .order('id'),
        'Stock transfer items',
      );
      return rows || [];
    },
  });

  const detailItemsQuery = useQuery({
    queryKey: ['stockTransferDetailItems', viewingTransfer?.id],
    enabled: !!viewingTransfer?.id && !!organisation?.id,
    queryFn: async () => {
      const rows = await timedSupabaseQuery(
        supabase
          .from('stock_transfer_items')
          .select('*, item:materials!inner(name, display_name, unit)')
          .eq('transfer_id', viewingTransfer.id)
          .eq('organisation_id', organisation.id)
          .order('id'),
        'Stock transfer detail items',
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
      valid: !!nextItem.item_id && quantity > 0,
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
      status: editingTransfer.status || 'ON_TRANSIT',
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

  const openReceiveForm = (transfer) => {
    setReceivingTransfer(transfer);
    setView('receive');
  };

  const openViewForm = (transfer) => {
    setViewingTransfer(transfer);
  };

  const returnToList = () => {
    setView('list');
    setEditingTransfer(null);
    setReceivingTransfer(null);
    setViewingTransfer(null);
    setFormData(createInitialFormData());
    setItems([createEmptyItem(1)]);
    setNextId(2);
    setSaveError('');
  };

  const getMaterial = (id) => materials.find((material) => material.id === id);

  const getStatusBadge = (status) => (
    <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', background: STATUS_COLORS[status] || STATUS_COLORS.DRAFT }}>
      {status}
    </span>
  );

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
    if (formData.from_warehouse_id === formData.to_warehouse_id) return 'From and to warehouses must be different.';
    const populatedItems = items.filter((item) => item.item_id);
    if (populatedItems.length === 0) return 'Add at least one item.';
    for (const item of populatedItems) {
      const material = getMaterial(item.item_id);
      const itemName = material?.display_name || material?.name || 'Selected item';
      const quantity = parseFloat(item.quantity) || 0;
      if (quantity <= 0) return `Invalid quantity for item: ${itemName}.`;
    }
    return '';
  };

  const generateTransferNo = async () => {
    const result = await withTimeout(
      supabase.from('stock_transfers').select('id', { count: 'exact', head: true }).eq('organisation_id', organisation.id),
      15000,
      'Stock transfer number',
    );
    if (result.error) throw new Error(`Stock transfer number: ${result.error.message || 'Unknown error'}`);
    const num = (result.count || 0) + 1;
    return `TRF-${String(num).padStart(5, '0')}`;
  };

  // ─── Bulk add ─────────────────────────────────────────────────────
  const filteredMaterials = useMemo(() => {
    const search = itemSearch.toLowerCase();
    return materials.filter((m) =>
      !search ||
      m.name?.toLowerCase().includes(search) ||
      m.item_code?.toLowerCase().includes(search) ||
      m.display_name?.to.toLowerCase().includes(search)
    );
  }, [materials, itemSearch]);

  const handleAddItemToPicker = (material) => {
    const existing = pickerItems.find((p) => p.item_id === material.id);
    if (existing) {
      setPickerItems(pickerItems.map((p) =>
        p.item_id === material.id ? { ...p, qty: p.qty + 1 } : p
      ));
    } else {
      setPickerItems([...pickerItems, { item_id: material.id, material, qty: 1, variant_id: '' }]);
    }
  };

  const handlePickerQtyChange = (itemId, value) => {
    const num = parseFloat(value) || 1;
    setPickerItems(pickerItems.map((p) =>
      p.item_id === itemId ? { ...p, qty: Math.max(1, num) } : p
    ));
  };

  const handleRemoveFromPicker = (itemId) => {
    setPickerItems(pickerItems.filter((p) => p.item_id !== itemId));
  };

  const handleAddItemsToTransfer = () => {
    const newItems = pickerItems.map((p, idx) => {
      const material = getMaterial(p.item_id);
      const availableQty = getAvailableQty(p.item_id, p.variant_id);
      return {
        id: Date.now() + idx,
        item_id: p.item_id,
        variant_id: p.variant_id || '',
        quantity: String(p.qty),
        available_qty: availableQty,
        valid: true,
      };
    });
    setItems((current) => [...current, ...newItems]);
    setNextId((prev) => Math.max(prev, Date.now() + pickerItems.length + 1));
    setShowItemPicker(false);
    setPickerItems([]);
    setItemSearch('');
  };

  // ─── Submit (Create / Update) ─────────────────────────────────────
  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaveError('');
    const validationMessage = validateForm();
    if (validationMessage) { setSaveError(validationMessage); return; }
    if (isLocked) { setSaveError('Only draft transfers can be edited.'); return; }
    const validItems = items.filter((item) => item.valid);
    if (validItems.length === 0) { setSaveError('Add at least one valid item.'); return; }
    setSaving(true);
    try {
      let transferId = editingTransfer?.id;
      if (isEditing) {
        await timedSupabaseQuery(
          supabase.from('stock_transfers').update(formData).eq('id', editingTransfer.id).eq('organisation_id', organisation.id),
          'Stock transfer update',
        );
        await timedSupabaseQuery(
          supabase.from('stock_transfer_items').delete().eq('transfer_id', editingTransfer.id).eq('organisation_id', organisation.id),
          'Stock transfer item reset',
        );
      } else {
        const transferNo = await generateTransferNo();
        const transfer = await timedSupabaseQuery(
          supabase.from('stock_transfers').insert({ ...formData, status: 'ON_TRANSIT', transfer_no: transferNo, organisation_id: organisation.id }).select().single(),
          'Stock transfer save',
        );
        transferId = transfer.id;
      }
      const itemsToSave = validItems.map((item) => ({
        transfer_id: transferId,
        item_id: item.item_id,
        company_variant_id: item.variant_id || null,
        quantity: parseFloat(item.quantity) || 0,
        received_qty: 0,
        organisation_id: organisation.id,
      }));
      await timedSupabaseQuery(supabase.from('stock_transfer_items').insert(itemsToSave), 'Stock transfer items save');
      await transfersQuery.refetch();
      returnToList();
    } catch (error) {
      setSaveError(error.message || 'Unable to save stock transfer.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Receive Stock ────────────────────────────────────────────────
  const receiveItemsQuery = useQuery({
    queryKey: ['stockTransferReceiveItems', receivingTransfer?.id],
    enabled: view === 'receive' && !!receivingTransfer?.id && !!organisation?.id,
    queryFn: async () => {
      const rows = await timedSupabaseQuery(
        supabase.from('stock_transfer_items').select('*, item:materials!inner(name, display_name, unit)').eq('transfer_id', receivingTransfer.id).eq('organisation_id', organisation.id).order('id'),
        'Stock transfer receive items',
      );
      return rows || [];
    },
  });

  const [receivedQtys, setReceivedQtys] = useState<Record<string, string>>({});

  useEffect(() => {
    if (view !== 'receive' || !receiveItemsQuery.data) return;
    const initial = {};
    receiveItemsQuery.data.forEach((item) => {
      initial[item.id] = String(item.quantity || 0);
    });
    setReceivedQtys(initial);
  }, [view, receiveItemsQuery.data]);

  const handleReceiveSubmit = async () => {
    if (!receivingTransfer?.id || !organisation?.id || !user?.id) return;
    setSaving(true);
    setSaveError('');

    try {
      const itemsData = receiveItemsQuery.data || [];
      const mismatches: string[] = [];

      for (const item of itemsData) {
        const receivedQty = parseFloat(receivedQtys[item.id]) || 0;
        const transferredQty = parseFloat(item.quantity) || 0;

        await timedSupabaseQuery(
          supabase.from('stock_transfer_items').update({ received_qty: receivedQty }).eq('id', item.id).eq('organisation_id', organisation.id),
          'Stock transfer item receive update',
        );

        // Update stock at destination warehouse
        if (receivedQty > 0) {
          const { data: destStock } = await supabase
            .from('item_stock')
            .select('id, current_stock')
            .eq('item_id', item.item_id)
            .eq('company_variant_id', item.company_variant_id)
            .eq('warehouse_id', receivingTransfer.to_warehouse_id)
            .eq('organisation_id', organisation.id)
            .maybeSingle();

          if (destStock?.id) {
            await supabase.from('item_stock').update({ current_stock: (parseFloat(destStock.current_stock) || 0) + receivedQty }).eq('id', destStock.id);
          } else {
            await supabase.from('item_stock').insert({
              item_id: item.item_id,
              company_variant_id: item.company_variant_id,
              warehouse_id: receivingTransfer.to_warehouse_id,
              current_stock: receivedQty,
              organisation_id: organisation.id,
            });
          }

          // Deduct from source warehouse
          const { data: srcStock } = await supabase
            .from('item_stock')
            .select('id, current_stock')
            .eq('item_id', item.item_id)
            .eq('company_variant_id', item.company_variant_id)
            .eq('warehouse_id', receivingTransfer.from_warehouse_id)
            .eq('organisation_id', organisation.id)
            .maybeSingle();
          if (srcStock?.id) {
            await supabase.from('item_stock').update({ current_stock: Math.max(0, (parseFloat(srcStock.current_stock) || 0) - transferredQty) }).eq('id', srcStock.id);
          }
        }

        if (receivedQty !== transferredQty) {
          mismatches.push(`${item.item?.display_name || item.item?.name || item.item_id}: sent ${transferredQty}, received ${receivedQty}`);
        }
      }

      await supabase.from('stock_transfers').update({ status: 'STOCK_RECEIVED' }).eq('id', receivingTransfer.id).eq('organisation_id', organisation.id);

      // Log to activity log
      const logDetails: any = {
        transfer_no: receivingTransfer.transfer_no,
        from_warehouse: warehouses.find(w => w.id === receivingTransfer.from_warehouse_id)?.warehouse_name,
        to_warehouse: warehouses.find(w => w.id === receivingTransfer.to_warehouse_id)?.warehouse_name,
      };
      if (mismatches.length > 0) {
        logDetails.mismatches = mismatches;
      }
      await supabase.from('manufacturing_activity_log').insert({
        entity_type: 'stock_transfer',
        entity_id: receivingTransfer.id,
        action: mismatches.length > 0 ? 'received_with_mismatch' : 'received',
        action_details: logDetails,
        user_id: user.id,
        user_name: user.email || 'Unknown',
        organisation_id: organisation.id,
      });

      await transfersQuery.refetch();
      returnToList();
    } catch (error) {
      setSaveError(error.message || 'Failed to receive stock.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (transfer) => {
    if (!window.confirm(`Delete transfer ${transfer.transfer_no}? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await supabase.from('stock_transfer_items').delete().eq('transfer_id', transfer.id).eq('organisation_id', organisation.id);
      await supabase.from('stock_transfers').delete().eq('id', transfer.id).eq('organisation_id', organisation.id);
      await transfersQuery.refetch();
    } catch (error) {
      setSaveError(error.message || 'Failed to delete transfer.');
    } finally {
      setSaving(false);
    }
  };

  const retryFormDependencies = async () => {
    await Promise.all([stockQuery.refetch(), editItemsQuery.refetch()]);
  };

  // ─── List View ────────────────────────────────────────────────────
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
            <button className="btn btn-primary" onClick={() => transfersQuery.refetch()}>Retry</button>
            <button className="btn btn-secondary" onClick={onCancel}>Back</button>
          </div>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
        <div style={{ flex: 1, minWidth: 0, maxWidth: viewingTransfer ? 'none' : '1200px', margin: viewingTransfer ? '0' : '0 auto' }}>
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
                  <th>From</th>
                  <th>To</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transfers.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No transfers found</td></tr>
                ) : (
                  transfers.map((transfer) => (
                    <tr key={transfer.id}>
                      <td><strong>{transfer.transfer_no}</strong></td>
                      <td>{transfer.transfer_date}</td>
                      <td>{warehouses.find(w => w.id === transfer.from_warehouse_id)?.warehouse_name || '-'}</td>
                      <td>{warehouses.find(w => w.id === transfer.to_warehouse_id)?.warehouse_name || '-'}</td>
                      <td>{getStatusBadge(transfer.status)}</td>
                      <td style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => openViewForm(transfer)}>View</button>
                        {(transfer.status === 'DRAFT' || transfer.status === 'ON_TRANSIT') && (
                          <button className="btn btn-sm btn-secondary" onClick={() => openEditForm(transfer)}>Edit</button>
                        )}
                        {(transfer.status === 'ON_TRANSIT') && (
                          <button className="btn btn-sm btn-primary" onClick={() => openReceiveForm(transfer)}>Receive Stock</button>
                        )}
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(transfer)}>x</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {viewingTransfer && (
          <div className="card" style={{ width: '420px', flexShrink: 0, position: 'sticky', top: '80px', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 100px)', borderLeft: '1px solid #e5e7eb', borderRadius: 0, boxShadow: '-2px 0 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
              <h2 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{viewingTransfer.transfer_no}</h2>
              <button onClick={() => setViewingTransfer(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9ca3af', padding: '2px 6px', lineHeight: 1 }}>x</button>
            </div>
            {saveError && <div className="alert alert-error" style={{ margin: '8px 14px 0' }}>{saveError}</div>}
            <div style={{ padding: '12px 14px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {detailItemsQuery.isPending ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Loading...</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px', marginBottom: '12px', color: '#374151' }}>
                    <div><span style={{ color: '#6b7280' }}>Date:</span> {viewingTransfer.transfer_date}</div>
                    <div><span style={{ color: '#6b7280' }}>Status:</span> {getStatusBadge(viewingTransfer.status)}</div>
                    <div><span style={{ color: '#6b7280' }}>From:</span> {warehouses.find(w => w.id === viewingTransfer.from_warehouse_id)?.warehouse_name || '-'}</div>
                    <div><span style={{ color: '#6b7280' }}>To:</span> {warehouses.find(w => w.id === viewingTransfer.to_warehouse_id)?.warehouse_name || '-'}</div>
                    <div><span style={{ color: '#6b7280' }}>Vehicle:</span> {viewingTransfer.vehicle_no || '-'}</div>
                    <div><span style={{ color: '#6b7280' }}>Transporter:</span> {viewingTransfer.transporter_name || '-'}</div>
                    <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#6b7280' }}>Remarks:</span> {viewingTransfer.remarks || '-'}</div>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '4px 4px', textAlign: 'left', fontWeight: 600, color: '#6b7280', width: '24px' }}>#</th>
                        <th style={{ padding: '4px 4px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Item</th>
                        <th style={{ padding: '4px 4px', textAlign: 'right', fontWeight: 600, color: '#6b7280', width: '48px' }}>Sent</th>
                        <th style={{ padding: '4px 4px', textAlign: 'right', fontWeight: 600, color: '#6b7280', width: '52px' }}>Recv</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detailItemsQuery.data || []).length === 0 ? (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>No items</td></tr>
                      ) : (
                        (detailItemsQuery.data || []).map((item, idx) => {
                          const transferred = parseFloat(item.quantity) || 0;
                          const received = parseFloat(item.received_qty) || 0;
                          const hasMismatch = transferred !== received;
                          return (
                            <tr key={item.id} style={{ background: hasMismatch ? '#fffbeb' : 'transparent', borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '5px 4px', color: '#9ca3af' }}>{idx + 1}</td>
                              <td style={{ padding: '5px 4px', color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>{item.item?.display_name || item.item?.name || '-'}</td>
                              <td style={{ padding: '5px 4px', textAlign: 'right', color: '#374151' }}>{transferred}</td>
                              <td style={{ padding: '5px 4px', textAlign: 'right', color: '#374151' }}>
                                {received}
                                {hasMismatch && <span style={{ marginLeft: '4px', fontSize: '10px', color: '#d97706' }}>!</span>}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </>
              )}
            </div>
            <div style={{ padding: '10px 14px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '6px', flexShrink: 0 }}>
              {(viewingTransfer.status === 'DRAFT' || viewingTransfer.status === 'ON_TRANSIT') && (
                <button className="btn btn-secondary btn-sm" onClick={() => { openEditForm(viewingTransfer); setViewingTransfer(null); }}>Edit</button>
              )}
              {viewingTransfer.status === 'ON_TRANSIT' && (
                <button className="btn btn-primary btn-sm" onClick={() => { openReceiveForm(viewingTransfer); setViewingTransfer(null); }}>Receive</button>
              )}
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(viewingTransfer)}>Delete</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Receive View ─────────────────────────────────────────────────
  if (view === 'receive') {
    const itemsData = receiveItemsQuery.data || [];
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div className="page-header">
          <h1 className="page-title">Receive Stock</h1>
        </div>
        {saveError && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{saveError}</div>}
        <div className="card">
          <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
              <div><strong>Transfer No:</strong> {receivingTransfer?.transfer_no}</div>
              <div><strong>Date:</strong> {receivingTransfer?.transfer_date}</div>
              <div><strong>From:</strong> {warehouses.find(w => w.id === receivingTransfer?.from_warehouse_id)?.warehouse_name}</div>
              <div><strong>To:</strong> {warehouses.find(w => w.id === receivingTransfer?.to_warehouse_id)?.warehouse_name}</div>
              <div><strong>Vehicle:</strong> {receivingTransfer?.vehicle_no || '-'}</div>
              <div><strong>Transporter:</strong> {receivingTransfer?.transporter_name || '-'}</div>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Transferred Qty</th>
                <th>Received Qty</th>
              </tr>
            </thead>
            <tbody>
              {itemsData.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px' }}>No items</td></tr>
              ) : (
                itemsData.map((item, idx) => (
                  <tr key={item.id}>
                    <td>{idx + 1}</td>
                    <td>{item.item?.display_name || item.item?.name || '-'}</td>
                    <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                    <td>
                      <input
                        type="number"
                        value={receivedQtys[item.id] ?? item.quantity ?? 0}
                        onChange={(e) => setReceivedQtys((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        style={{ width: '100px', padding: '6px', textAlign: 'right' }}
                        min="0"
                        step="0.01"
                      />
                      {parseFloat(receivedQtys[item.id]) !== parseFloat(item.quantity) && (
                        <span style={{ marginLeft: '8px', fontSize: '11px', color: '#d97706' }}>mismatch</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '12px' }}>
            <button className="btn btn-primary" onClick={handleReceiveSubmit} disabled={saving || itemsData.length === 0}>
              {saving ? 'Saving...' : 'Confirm Stock Received'}
            </button>
            <button className="btn btn-secondary" onClick={returnToList} disabled={saving}>Back</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Form View ────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="page-header">
        <h1 className="page-title">{isEditing ? 'Edit Transfer' : 'New Stock Transfer'}</h1>
      </div>

      {saveError && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{saveError}</div>}

      {stockQuery.isError && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
          <span>{(stockQuery.error instanceof Error && stockQuery.error.message) || 'Unable to load warehouse stock.'}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => stockQuery.refetch()}>Retry</button>
        </div>
      )}

      {isLocked && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8' }}>
          This transfer is {editingTransfer?.status}. It can be viewed but not edited.
        </div>
      )}

      <div className="card" style={{ padding: '0' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ background: '#f8f9fa', padding: '16px', borderBottom: '1px solid #e0e0e0' }}>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <label className="form-label">Transfer Date *</label>
                <input type="date" className="form-input" value={formData.transfer_date}
                  onChange={(e) => setFormData({ ...formData, transfer_date: e.target.value })} disabled={isLocked} />
              </div>
              <div>
                <label className="form-label">From Warehouse *</label>
                <select className="form-select" value={formData.from_warehouse_id}
                  onChange={(e) => setFormData({ ...formData, from_warehouse_id: e.target.value })} disabled={isLocked}>
                  <option value="">Select</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.warehouse_name || w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">To Warehouse *</label>
                <select className="form-select" value={formData.to_warehouse_id}
                  onChange={(e) => setFormData({ ...formData, to_warehouse_id: e.target.value })} disabled={isLocked}>
                  <option value="">Select</option>
                  {warehouses.filter((w) => w.id !== formData.from_warehouse_id).map((w) =>
                    <option key={w.id} value={w.id}>{w.warehouse_name || w.name}</option>
                  )}
                </select>
              </div>
              <div>
                <label className="form-label">Vehicle No</label>
                <input type="text" className="form-input" value={formData.vehicle_no}
                  onChange={(e) => setFormData({ ...formData, vehicle_no: e.target.value })} placeholder="XX-XX-XXXX" disabled={isLocked} />
              </div>
              <div>
                <label className="form-label">Transporter</label>
                <input type="text" className="form-input" value={formData.transporter_name}
                  onChange={(e) => setFormData({ ...formData, transporter_name: e.target.value })} placeholder="Transporter Name" disabled={isLocked} />
              </div>
            </div>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Variant</th>
                <th style={{ textAlign: 'right' }}>Available</th>
                <th style={{ textAlign: 'right' }}>Transfer Qty</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id} style={{ background: !item.valid && item.item_id ? '#fff7ed' : 'transparent' }}>
                  <td>{index + 1}</td>
                  <td>
                    <select value={item.item_id || ''} onChange={(e) => updateItem(item.id, 'item_id', e.target.value)}
                      style={{ width: '100%', padding: '6px' }} disabled={isLocked}>
                      <option value="">Select</option>
                      {materials.map((m) => <option key={m.id} value={m.id}>{m.display_name || m.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={item.variant_id || ''} onChange={(e) => updateItem(item.id, 'variant_id', e.target.value)}
                      style={{ width: '100%', padding: '6px' }} disabled={isLocked}>
                      <option value="">Select</option>
                      {variants.map((v) => <option key={v.id} value={v.id}>{v.variant_name}</option>)}
                    </select>
                  </td>
                  <td style={{ textAlign: 'right' }}>{item.available_qty}</td>
                  <td>
                    <input type="number" value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                      style={{ width: '80px', padding: '6px', textAlign: 'right' }} disabled={isLocked} />
                  </td>
                  <td>
                    <button type="button" onClick={() => removeItem(item.id)}
                      style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer' }} disabled={isLocked}>x</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!isLocked && (
            <div style={{ display: 'flex', gap: '8px', margin: '12px' }}>
              <button type="button" onClick={addItem}
                style={{ padding: '8px 16px', background: '#fff', border: '1px dashed #3498db', borderRadius: '4px', color: '#3498db', cursor: 'pointer' }}>
                + Add Item
              </button>
              <button type="button" onClick={() => { setPickerItems([]); setItemSearch(''); setShowItemPicker(true); }}
                style={{ padding: '8px 16px', background: '#fff', border: '1px dashed #10b981', borderRadius: '4px', color: '#10b981', cursor: 'pointer' }}>
                + Bulk Add
              </button>
            </div>
          )}

          <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '12px' }}>
            {!isLocked && (
              <button className="btn btn-primary" type="submit" disabled={saving || stockQuery.isFetching}>
                {saving ? 'Saving...' : isEditing ? 'Update Transfer' : 'Create Transfer'}
              </button>
            )}
            {isLocked && editingTransfer?.status === 'DRAFT' && (
              <button className="btn btn-primary" type="submit" disabled={saving || stockQuery.isFetching}>
                {saving ? 'Saving...' : 'Update Transfer'}
              </button>
            )}
            <button className="btn btn-secondary" type="button" onClick={returnToList} disabled={saving}>Back</button>
          </div>
        </form>
      </div>

      {/* Bulk Add Modal */}
      {showItemPicker && (
        <div className="modal-overlay open" onClick={() => setShowItemPicker(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', width: '90%', height: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: 0 }}>Add Multiple Items</h3>
              <button className="btn-close" onClick={() => setShowItemPicker(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: '4px 8px' }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div style={{ borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                  <input type="text" className="form-input" placeholder="Search items..." value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)} autoFocus style={{ width: '100%' }} />
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e5e7eb', background: '#f8fafc', position: 'sticky', top: 0, zIndex: 2 }}>Item Name</th>
                        <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e5e7eb', width: '60px', background: '#f8fafc', position: 'sticky', top: 0, zIndex: 2 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMaterials.map((material) => {
                        const isSelected = pickerItems.some((p) => p.item_id === material.id);
                        return (
                          <tr key={material.id} style={{ cursor: isSelected ? 'default' : 'pointer', background: isSelected ? '#f0fdf4' : '#fff' }}
                            onClick={() => { if (!isSelected) handleAddItemToPicker(material); }}>
                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9' }}>
                              <div style={{ fontWeight: 500, color: '#1e293b' }}>{material.display_name || material.name}</div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>{material.item_code}</div>
                            </td>
                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>
                              {isSelected ? (
                                <span style={{ color: '#16a34a', fontSize: '14px' }}>✓</span>
                              ) : (
                                <button style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 500 }}>+</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, margin: 0, color: '#334155' }}>Selected Items ({pickerItems.length})</h4>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px' }}>
                  {pickerItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: '13px' }}>No items selected.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {pickerItems.map((p) => (
                        <div key={p.item_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff' }}>
        <div style={{ flex: 1, minWidth: 0, maxWidth: viewingTransfer ? 'none' : '1200px', margin: viewingTransfer ? '0' : '0 auto' }}>
                            <div style={{ fontSize: '12px', fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.material?.display_name || p.material?.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{p.material?.item_code}</div>
                          </div>
                          <input type="number" value={p.qty} onChange={(e) => handlePickerQtyChange(p.item_id, e.target.value)}
                            min="1" step="0.01" style={{ width: '60px', padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} />
                          <button onClick={() => handleRemoveFromPicker(p.item_id)}
                            style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setShowItemPicker(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddItemsToTransfer} disabled={pickerItems.length === 0}>
                Add to Transfer ({pickerItems.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}