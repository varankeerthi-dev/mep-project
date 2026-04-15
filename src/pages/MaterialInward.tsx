import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { timedSupabaseQuery } from '../utils/queryTimeout';
import { useMaterials } from '../hooks/useMaterials';
import { useWarehouses } from '../hooks/useWarehouses';
import { useVariants } from '../hooks/useVariants';
import { useProjects } from '../hooks/useProjects';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';

const createEmptyItem = (id) => ({
  id,
  item_id: '',
  variant_id: '',
  quantity: '',
  rate: '',
  amount: 0,
  uses_variant: false,
  supply_type: 'WAREHOUSE',
  project_id: '',
  valid: false,
  is_service: false
});

export default function MaterialInward({ onSuccess, onCancel }) {
  const { data: materials = [] } = useMaterials();
  const { data: warehouses = [] } = useWarehouses();
  const { data: variants = [] } = useVariants();
  const { data: projects = [] } = useProjects();
  
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteData, setPasteData] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [viewMode, setViewMode] = useState('form'); // 'form' or 'list'
  const [selectedInward, setSelectedInward] = useState<any>(null);
  const [formData, setFormData] = useState({
    invoice_date: '',
    inward_date: new Date().toISOString().split('T')[0],
    received_date: new Date().toISOString().split('T')[0],
    vendor_name: '',
    invoice_no: '',
    warehouse_id: '',
    default_variant_id: '',
    received_by: '',
    acknowledged_by: '',
    remarks: '',
    supply_type: 'WAREHOUSE',
    project_id: ''
  });
  const [items, setItems] = useState([createEmptyItem(1)]);
  const [nextId, setNextId] = useState(2);

  const pricingQuery = useQuery({
    queryKey: ['materialInwardPricing'],
    queryFn: async () => {
      const pricingRows = await timedSupabaseQuery(
        supabase.from('item_variant_pricing').select('item_id, company_variant_id, sale_price'),
        'Material inward pricing',
      );

      const pricingMap = {};
      (pricingRows || []).forEach((row) => {
        if (!pricingMap[row.item_id]) pricingMap[row.item_id] = {};
        pricingMap[row.item_id][row.company_variant_id || 'default'] = parseFloat(row.sale_price) || 0;
      });

      return pricingMap;
    },
  });

  const pricing = pricingQuery.data || {};
  const activeVariants = useMemo(
    () => variants.filter((variant) => variant.variant_name !== 'No Variant'),
    [variants],
  );

  const inwardsQuery = useQuery({
    queryKey: ['materialInwardList'],
    queryFn: async () => {
      return timedSupabaseQuery(
        supabase.from('material_inward').select('*, warehouse:warehouses(warehouse_name), items:material_inward_items(*, item:materials(name, display_name))').order('created_at', { ascending: false }),
        'Material inward list'
      );
    }
  });

  const getMaterial = (id) => materials.find((material) => material.id === id);

  const getRate = (itemId, variantId) => {
    if (variantId && pricing[itemId]?.[variantId] !== undefined) {
      return pricing[itemId][variantId];
    }
    const material = getMaterial(itemId);
    return parseFloat(material?.sale_price) || 0;
  };

  const recalculateItem = (baseItem, overrides = {}) => {
    const nextItem = { ...baseItem, ...overrides };
    const material = getMaterial(nextItem.item_id);
    const quantity = parseFloat(nextItem.quantity) || 0;
    const usesVariant = material?.item_type === 'service' ? false : !!material?.uses_variant;
    const isService = material?.item_type === 'service';
    const variantId = usesVariant ? nextItem.variant_id : '';
    const supplyType = nextItem.supply_type || 'WAREHOUSE';
    const projectId = supplyType === 'DIRECT_SUPPLY' ? nextItem.project_id : '';
    const rate = nextItem.rate === '' ? 0 : parseFloat(nextItem.rate) || 0;
    const hasVariantMissing = usesVariant && !variantId;
    const hasProjectMissing = supplyType === 'DIRECT_SUPPLY' && !projectId;

    return {
      ...nextItem,
      is_service: isService,
      uses_variant: usesVariant,
      variant_id: variantId,
      project_id: projectId,
      amount: quantity * rate,
      valid: !!nextItem.item_id && quantity > 0 && !hasVariantMissing && !hasProjectMissing
    };
  };

  const resetForm = () => {
    setItems([createEmptyItem(1)]);
    setNextId(2);
    setFormData({
      invoice_date: '',
      inward_date: new Date().toISOString().split('T')[0],
      received_date: new Date().toISOString().split('T')[0],
      vendor_name: '',
      invoice_no: '',
      warehouse_id: '',
      default_variant_id: '',
      received_by: '',
      acknowledged_by: '',
      remarks: '',
      supply_type: 'WAREHOUSE',
      project_id: ''
    });
    setSaveError('');
  };

  const addItem = () => {
    setItems((current) => [...current, createEmptyItem(nextId)]);
    setNextId((current) => current + 1);
  };

  const removeItem = (id) => {
    setItems((current) => {
      const nextItems = current.filter((item) => item.id !== id);
      return nextItems.length > 0 ? nextItems : [createEmptyItem(1)];
    });
  };

  const updateItem = (id, field, value) => {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;

        const overrides = { [field]: value };

        if (field === 'item_id') {
          const material = getMaterial(value);
          const usesVariant = material?.item_type === 'service' ? false : !!material?.uses_variant;
          const nextVariantId = usesVariant ? (formData.default_variant_id || '') : '';
          overrides.variant_id = nextVariantId;
          overrides.uses_variant = usesVariant;
          overrides.is_service = material?.item_type === 'service';
          overrides.rate = String(getRate(value, nextVariantId || null));
        }

        if (field === 'variant_id' && item.item_id) {
          overrides.rate = String(getRate(item.item_id, value || null));
        }

        if (field === 'supply_type' && value !== 'DIRECT_SUPPLY') {
          overrides.project_id = '';
        }

        return recalculateItem(item, overrides);
      }),
    );
  };

  const handleDefaultVariantChange = (variantId) => {
    setFormData((current) => ({ ...current, default_variant_id: variantId }));
    setItems((current) =>
      current.map((item) => {
        if (!item.item_id || !item.uses_variant) return item;
        return recalculateItem(item, {
          variant_id: variantId,
          rate: String(getRate(item.item_id, variantId || null)),
        });
      }),
    );
  };

  const validateForm = () => {
    if (!formData.received_date) return 'Please enter Received Date.';
    if (!formData.vendor_name) return 'Please enter Vendor.';
    if (!formData.invoice_no) return 'Please enter Invoice No.';
    if (!formData.received_by) return 'Please enter Received By.';

    const validItems = items.filter((item) => item.item_id);
    if (validItems.length === 0) return 'Please add at least one item.';

    for (const item of validItems) {
      const material = getMaterial(item.item_id);
      const itemName = material?.display_name || material?.name || 'Selected item';
      const itemSupplyType = item.supply_type || formData.supply_type;

      if (itemSupplyType === 'WAREHOUSE' && !formData.warehouse_id) {
        return 'Please select Warehouse for WAREHOUSE supply type.';
      }
      if (itemSupplyType === 'DIRECT_SUPPLY' && !item.project_id) {
        return `Project is required for DIRECT SUPPLY item: ${itemName}.`;
      }
      if (item.uses_variant && !item.variant_id) {
        return `Variant is required for item: ${itemName}.`;
      }
      if (!item.quantity || parseFloat(item.quantity) <= 0) {
        return `Invalid quantity for item: ${itemName}.`;
      }
    }

    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaveError('');

    const validationMessage = validateForm();
    if (validationMessage) {
      setSaveError(validationMessage);
      return;
    }

    const validItems = items.filter((item) => item.valid);
    if (validItems.length === 0) {
      setSaveError('Please add at least one valid item.');
      return;
    }

    setSaving(true);
    try {
      const inward = await timedSupabaseQuery(
        supabase.from('material_inward').insert({
          invoice_date: formData.invoice_date || null,
          inward_date: formData.inward_date || null,
          received_date: formData.received_date,
          vendor_name: formData.vendor_name,
          invoice_no: formData.invoice_no,
          warehouse_id: formData.warehouse_id || null,
          variant_id: formData.default_variant_id || null,
          received_by: formData.received_by,
          acknowledged_by: formData.acknowledged_by || null,
          remarks: formData.remarks || null,
          supply_type: formData.supply_type,
          project_id: formData.project_id || null
        }).select().single(),
        'Material inward save',
      );

      for (const item of validItems) {
        const material = getMaterial(item.item_id);
        if (!material) continue;

        const itemSupplyType = item.supply_type || formData.supply_type;
        const itemWarehouseId = itemSupplyType === 'WAREHOUSE' ? formData.warehouse_id : null;
        const itemProjectId = itemSupplyType === 'DIRECT_SUPPLY' ? item.project_id : null;
        const itemVariantId = item.uses_variant && item.variant_id ? item.variant_id : null;
        const quantity = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.rate) || 0;

        await timedSupabaseQuery(
          supabase.from('material_inward_items').insert({
            inward_id: inward.id,
            material_id: item.item_id,
            material_name: material.display_name || material.name || 'Unknown Item',
            unit: material.unit || 'nos',
            quantity,
            rate,
            amount: quantity * rate,
            warehouse_id: itemWarehouseId,
            variant_id: itemVariantId,
            supply_type: itemSupplyType,
            project_id: itemProjectId
          }),
          'Material inward line save',
        );

        if (!item.is_service && itemSupplyType === 'WAREHOUSE' && itemWarehouseId) {
          const existingStock = await timedSupabaseQuery(
            supabase
              .from('item_stock')
              .select('*')
              .eq('item_id', item.item_id)
              .eq('company_variant_id', itemVariantId)
              .eq('warehouse_id', itemWarehouseId)
              .maybeSingle(),
            'Material inward stock lookup',
          );

          if (existingStock?.id) {
            await timedSupabaseQuery(
              supabase
                .from('item_stock')
                .update({
                  current_stock: (parseFloat(existingStock.current_stock) || 0) + quantity,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingStock.id),
              'Material inward stock update',
            );
          } else {
            await timedSupabaseQuery(
              supabase.from('item_stock').insert({
                item_id: item.item_id,
                company_variant_id: itemVariantId,
                warehouse_id: itemWarehouseId,
                current_stock: quantity
              }),
              'Material inward stock create',
            );
          }
        }
      }

      resetForm();
      alert('Material inward submitted successfully!');
      onSuccess?.();
    } catch (error) {
      setSaveError(error.message || 'Unable to save material inward.');
    } finally {
      setSaving(false);
    }
  };

  const totalQty = items.filter((item) => item.valid).reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  const totalAmount = items.filter((item) => item.valid).reduce((sum, item) => sum + (item.amount || 0), 0);

  if (pricingQuery.isPending && !pricingQuery.data) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading inward data...</div>;
  }

  if (pricingQuery.isError) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ color: '#b91c1c', fontWeight: 600, marginBottom: '12px' }}>
          {(pricingQuery.error instanceof Error && pricingQuery.error.message) || 'Unable to load inward data.'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <button type="button" className="btn btn-primary" onClick={() => pricingQuery.refetch()}>Retry</button>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Back</button>
        </div>
      </div>
    );
  }

  const handleView = (inward: any) => {
    setSelectedInward(inward);
    setViewMode('view');
  };

  const handleEdit = (inward: any) => {
    setSelectedInward(inward);
    setViewMode('edit');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this inward entry?')) {
      await supabase.from('material_inward').delete().eq('id', id);
      inwardsQuery.refetch();
    }
  };

  const formatDate = (date: string) => date ? new Date(date).toLocaleDateString() : '-';

  if (viewMode === 'list' || viewMode === 'view' || viewMode === 'edit') {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Material Inward {viewMode === 'list' ? ' - Past Entries' : ''}</h1>
          <div style={{ display: 'flex', gap: '8px' }}>
            {viewMode !== 'list' && (
              <button className="btn btn-secondary" onClick={() => { setViewMode('list'); setSelectedInward(null); }}>Back to List</button>
            )}
            <button className="btn btn-primary" onClick={() => { setViewMode('form'); setSelectedInward(null); }}>+ New Entry</button>
          </div>
        </div>

        {viewMode === 'list' && (
          <div className="card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inwardsQuery.isLoading ? (
                  <TableRow><TableCell colSpan={6}>Loading...</TableCell></TableRow>
                ) : inwardsQuery.data?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>No entries found</TableCell></TableRow>
                ) : (
                  inwardsQuery.data?.map((inward: any) => (
                    <TableRow key={inward.id}>
                      <TableCell>{formatDate(inward.received_date)}</TableCell>
                      <TableCell>{inward.invoice_no}</TableCell>
                      <TableCell>{inward.vendor_name}</TableCell>
                      <TableCell>{inward.warehouse?.warehouse_name || '-'}</TableCell>
                      <TableCell>{inward.items?.length || 0} items</TableCell>
                      <TableCell>
                        <button className="btn btn-sm btn-secondary" style={{ marginRight: '4px' }} onClick={() => handleView(inward)}>View</button>
                        <button className="btn btn-sm btn-secondary" style={{ marginRight: '4px' }} onClick={() => handleEdit(inward)}>Edit</button>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleDelete(inward.id)}>Delete</button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {viewMode === 'view' && selectedInward && (
          <div className="card">
            <h3 style={{ marginBottom: '16px' }}>Inward Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div><strong>Invoice No:</strong> {selectedInward.invoice_no}</div>
              <div><strong>Vendor:</strong> {selectedInward.vendor_name}</div>
              <div><strong>Date:</strong> {formatDate(selectedInward.received_date)}</div>
              <div><strong>Warehouse:</strong> {selectedInward.warehouse?.warehouse_name || '-'}</div>
            </div>
            <h4 style={{ marginBottom: '8px' }}>Items</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedInward.items?.map((item: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell>{item.item?.display_name || item.item?.name || '-'}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{item.rate}</TableCell>
                    <TableCell>{(item.quantity * item.rate).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {viewMode === 'edit' && selectedInward && (
          <div className="card">
            <h3>Edit Inward - {selectedInward.invoice_no}</h3>
            {/* Edit mode - pre-populate form with selectedInward data */}
            {/* For now, show message. Full edit implementation will need more work */}
            <p style={{ color: '#666', padding: '20px' }}>Edit functionality coming soon...</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Material Inward</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={() => setViewMode('list')}>View Past Entries</button>
          <button className="btn btn-secondary" onClick={() => setShowPasteModal(true)}>Paste From Excel</button>
        </div>
      </div>

      {saveError && (
        <div className="alert alert-error" style={{ marginBottom: '16px' }}>{saveError}</div>
      )}

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{
          background: '#f8f9fa',
          padding: '16px 20px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
            <label className="form-label">Invoice Date</label>
            <input type="date" className="form-input" value={formData.invoice_date} onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })} />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
            <label className="form-label">Inward Date *</label>
            <input type="date" className="form-input" value={formData.inward_date} onChange={(e) => setFormData({ ...formData, inward_date: e.target.value })} />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
            <label className="form-label">Received Date *</label>
            <input type="date" className="form-input" value={formData.received_date} onChange={(e) => setFormData({ ...formData, received_date: e.target.value })} />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '160px' }}>
            <label className="form-label">Vendor *</label>
            <input type="text" className="form-input" value={formData.vendor_name} onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })} placeholder="Vendor name" />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
            <label className="form-label">Invoice No *</label>
            <input type="text" className="form-input" value={formData.invoice_no} onChange={(e) => setFormData({ ...formData, invoice_no: e.target.value })} placeholder="Invoice #" />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
            <label className="form-label">Warehouse *</label>
            <select className="form-select" value={formData.warehouse_id} onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}>
              <option value="">Select</option>
              {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.warehouse_name || warehouse.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
            <label className="form-label">Default Variant</label>
            <select className="form-select" value={formData.default_variant_id} onChange={(e) => handleDefaultVariantChange(e.target.value)}>
              <option value="">Select</option>
              {activeVariants.map((variant) => <option key={variant.id} value={variant.id}>{variant.variant_name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '130px' }}>
            <label className="form-label">Received By *</label>
            <input type="text" className="form-input" value={formData.received_by} onChange={(e) => setFormData({ ...formData, received_by: e.target.value })} placeholder="Name" />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '130px' }}>
            <label className="form-label">Acknowledged By</label>
            <input type="text" className="form-input" value={formData.acknowledged_by} onChange={(e) => setFormData({ ...formData, acknowledged_by: e.target.value })} placeholder="Name" />
          </div>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <table className="grid-table" style={{ margin: 0, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ width: '40px', textAlign: 'center', fontSize: '11px', padding: '8px' }}>#</th>
                <th style={{ minWidth: '200px', fontSize: '11px', padding: '8px' }}>Item</th>
                <th style={{ width: '100px', fontSize: '11px', padding: '8px' }}>Type</th>
                <th style={{ width: '120px', fontSize: '11px', padding: '8px' }}>Variant</th>
                <th style={{ width: '150px', fontSize: '11px', padding: '8px' }}>Project</th>
                <th style={{ width: '80px', fontSize: '11px', padding: '8px', textAlign: 'right' }}>Qty</th>
                <th style={{ width: '90px', fontSize: '11px', padding: '8px', textAlign: 'right' }}>Rate</th>
                <th style={{ width: '100px', fontSize: '11px', padding: '8px', textAlign: 'right' }}>Amount</th>
                <th style={{ width: '40px', fontSize: '11px', padding: '8px' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const itemSupplyType = item.supply_type || formData.supply_type;
                return (
                  <tr key={item.id} style={{ background: !item.valid && item.item_id ? '#fff3cd' : '#fff', borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ textAlign: 'center', color: '#666', padding: '8px', fontSize: '12px' }}>{index + 1}</td>
                    <td style={{ padding: '6px' }}>
                      <select value={item.item_id} onChange={(e) => updateItem(item.id, 'item_id', e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '12px' }}>
                        <option value="">Select Item</option>
                        {materials.map((material) => <option key={material.id} value={material.id}>{material.display_name || material.name}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px' }}>
                      <select value={item.supply_type || formData.supply_type} onChange={(e) => updateItem(item.id, 'supply_type', e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '12px' }}>
                        <option value="WAREHOUSE">Warehouse</option>
                        <option value="DIRECT_SUPPLY">Direct</option>
                      </select>
                    </td>
                    <td style={{ padding: '6px' }}>
                      <select
                        value={item.variant_id || ''}
                        onChange={(e) => updateItem(item.id, 'variant_id', e.target.value)}
                        disabled={!item.uses_variant}
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', background: item.uses_variant ? '#fff' : '#f5f5f5', fontSize: '12px' }}
                      >
                        <option value="">{item.uses_variant ? 'Select' : 'N/A'}</option>
                        {activeVariants.map((variant) => <option key={variant.id} value={variant.id}>{variant.variant_name}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px' }}>
                      <select
                        value={item.project_id || ''}
                        onChange={(e) => updateItem(item.id, 'project_id', e.target.value)}
                        disabled={itemSupplyType !== 'DIRECT_SUPPLY'}
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', background: itemSupplyType === 'DIRECT_SUPPLY' ? '#fff' : '#f5f5f5', fontSize: '12px' }}
                      >
                        <option value="">{itemSupplyType === 'DIRECT_SUPPLY' ? 'Select Project' : 'N/A'}</option>
                        {projects.map((project) => <option key={project.id} value={project.id}>{project.project_name || project.name}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px', textAlign: 'right' }}>
                      <input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', e.target.value)} placeholder="0" style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', textAlign: 'right', fontSize: '12px' }} />
                    </td>
                    <td style={{ padding: '6px', textAlign: 'right' }}>
                      <input type="number" value={item.rate} onChange={(e) => updateItem(item.id, 'rate', e.target.value)} placeholder="0" step="0.01" style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', textAlign: 'right', fontSize: '12px' }} />
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '600', padding: '6px', fontSize: '12px' }}>
                      Rs {item.amount.toFixed(2)}
                    </td>
                    <td>
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '18px' }}>
                          x
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button type="button" onClick={addItem} style={{ margin: '12px 20px', padding: '8px 16px', background: '#fff', border: '1px dashed #3498db', borderRadius: '4px', color: '#3498db', cursor: 'pointer' }}>
          + Add Row
        </button>

        <div style={{ background: '#f0f7ff', padding: '12px 20px', borderTop: '2px solid #3498db', display: 'flex', gap: '40px', justifyContent: 'flex-end', position: 'sticky', bottom: 0 }}>
          <div>
            <span style={{ color: '#666', marginRight: '8px' }}>Total Qty:</span>
            <strong style={{ fontSize: '18px', color: '#333' }}>{totalQty.toFixed(2)}</strong>
          </div>
          <div>
            <span style={{ color: '#666', marginRight: '8px' }}>Total Amount:</span>
            <strong style={{ fontSize: '18px', color: '#333' }}>Rs {totalAmount.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
        <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Submitting...' : 'Submit Inward'}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>

      {showPasteModal && (
        <div className="modal-overlay open" onClick={() => setShowPasteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2>Paste From Excel</h2>
              <button onClick={() => setShowPasteModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>x</button>
            </div>
            <p style={{ color: '#666', marginBottom: '12px' }}>
              Format: <strong>Item Name | Quantity | Rate (optional)</strong>
            </p>
            <textarea
              value={pasteData}
              onChange={(e) => setPasteData(e.target.value)}
              placeholder={'Item Name\tQuantity\tRate\nBall Valve\t100\t250'}
              style={{ width: '100%', height: '200px', padding: '12px', fontFamily: 'monospace', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button className="btn btn-primary" onClick={() => setShowPasteModal(false)}>Import</button>
              <button className="btn btn-secondary" onClick={() => setShowPasteModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
