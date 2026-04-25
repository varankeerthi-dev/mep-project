import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { timedSupabaseQuery } from '../utils/queryTimeout';
import { useMaterials } from '../hooks/useMaterials';
import { useWarehouses } from '../hooks/useWarehouses';
import { useVariants } from '../hooks/useVariants';
import { useProjects } from '../hooks/useProjects';

const createEmptyItem = (id) => ({
  id,
  item_id: '',
  quantity: '',
  available_qty: 0,
  valid: false,
  is_service: false,
});

export default function MaterialOutward({ onSuccess, onCancel }) {
  const { organisation } = useAuth();
  const { data: materials = [] } = useMaterials();
  const { data: warehouses = [] } = useWarehouses();
  const { data: variants = [] } = useVariants();
  const { data: projects = [] } = useProjects();
  
  const [formData, setFormData] = useState({
    outward_date: new Date().toISOString().split('T')[0],
    project_id: '',
    remarks: '',
    warehouse_id: '',
    variant_id: '',
  });
  const [items, setItems] = useState([createEmptyItem(1)]);
  const [nextId, setNextId] = useState(2);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const initQuery = useQuery({
    queryKey: ['materialOutwardInit'],
    queryFn: async () => {
      
      return {
        materials: materials || [],
        warehouses: warehouses || [],
        variants: variants || [],
        projects: projects || [],
      };
    },
  });

  const stockQuery = useQuery({
    queryKey: ['materialOutwardStock', formData.warehouse_id, formData.variant_id, organisation?.id],
    enabled: !!formData.warehouse_id && !!formData.variant_id && !!organisation?.id,
    queryFn: async () => {
      const stockRows = await timedSupabaseQuery(
        supabase
          .from('item_stock')
          .select('item_id, company_variant_id, warehouse_id, current_stock')
          .eq('organisation_id', organisation?.id)
          .eq('warehouse_id', formData.warehouse_id)
          .eq('company_variant_id', formData.variant_id),
        'Material outward stock',
      );

      return stockRows || [];
    },
  });

    const stockRows = stockQuery.data || [];

  const stockMap = useMemo(() => {
    const map = {};
    stockRows.forEach((row) => {
      map[row.item_id] = parseFloat(row.current_stock) || 0;
    });
    return map;
  }, [stockRows]);

  const getMaterial = (id) => materials.find((material) => material.id === id);

  const recalculateItem = (baseItem, overrides = {}) => {
    const nextItem = { ...baseItem, ...overrides };
    const material = getMaterial(nextItem.item_id);
    const quantity = parseFloat(nextItem.quantity) || 0;
    const isService = material?.item_type === 'service';
    const availableQty = isService ? Number.MAX_SAFE_INTEGER : (stockMap[nextItem.item_id] || 0);

    return {
      ...nextItem,
      is_service: isService,
      available_qty: isService ? 0 : availableQty,
      valid: !!nextItem.item_id && quantity > 0 && (isService || quantity <= availableQty),
    };
  };

  useEffect(() => {
    setItems((current) => current.map((item) => recalculateItem(item)));
  }, [stockMap, materials]);

  const addItem = () => {
    setItems((current) => [...current, createEmptyItem(nextId)]);
    setNextId((current) => current + 1);
  };

  const removeItem = (id) => {
    setItems((current) => {
      const nextItems = current.filter((item) => item.id !== id);
      return nextItems.length ? nextItems : [createEmptyItem(1)];
    });
  };

  const updateItem = (id, field, value) => {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        return recalculateItem(item, { [field]: value });
      }),
    );
  };

  const retryAll = async () => {
    await Promise.all([initQuery.refetch(), stockQuery.refetch()]);
  };

  const validateForm = () => {
    if (!formData.outward_date) return 'Please select the outward date.';
    if (!formData.warehouse_id) return 'Please select a warehouse.';
    if (!formData.variant_id) return 'Please select a variant.';

    const populatedItems = items.filter((item) => item.item_id);
    if (populatedItems.length === 0) return 'Please add at least one item.';

    for (const item of populatedItems) {
      const material = getMaterial(item.item_id);
      const itemName = material?.display_name || material?.name || 'Selected item';
      const quantity = parseFloat(item.quantity) || 0;

      if (quantity <= 0) {
        return `Invalid quantity for item: ${itemName}.`;
      }

      if (!item.is_service && quantity > (stockMap[item.item_id] || 0)) {
        return `Insufficient stock for item: ${itemName}.`;
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
      const outward = await timedSupabaseQuery(
        supabase.from('material_outward').insert({ ...formData, organisation_id: organisation?.id }).select().single(),
        'Material outward save',
      );

      for (const item of validItems) {
        const material = getMaterial(item.item_id);
        if (!material) continue;

        const quantity = parseFloat(item.quantity) || 0;

        await timedSupabaseQuery(
          supabase.from('material_outward_items').insert({
            outward_id: outward.id,
            material_id: item.item_id,
            material_name: material.display_name || material.name || 'Unknown Item',
            unit: material.unit || 'nos',
            variant_id: formData.variant_id,
            warehouse_id: formData.warehouse_id,
            quantity,
            organisation_id: organisation?.id,
          }),
          'Material outward line save',
        );

        if (!item.is_service) {
          const existingStock = await timedSupabaseQuery(
            supabase
              .from('item_stock')
              .select('id, current_stock')
              .eq('item_id', item.item_id)
              .eq('company_variant_id', formData.variant_id)
              .eq('warehouse_id', formData.warehouse_id)
              .maybeSingle(),
            'Material outward stock lookup',
          );

          if (!existingStock?.id) {
            throw new Error(`Stock entry not found for ${material.display_name || material.name || 'the selected item'}.`);
          }

          const nextStock = Math.max(0, (parseFloat(existingStock.current_stock) || 0) - quantity);

          await timedSupabaseQuery(
            supabase
              .from('item_stock')
              .update({ current_stock: nextStock, updated_at: new Date().toISOString() })
              .eq('id', existingStock.id),
            'Material outward stock update',
          );
        }
      }

      onSuccess?.();
    } catch (error) {
      setSaveError(error.message || 'Unable to save material outward.');
    } finally {
      setSaving(false);
    }
  };

  if (initQuery.isPending && !initQuery.data) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading outward data...</div>;
  }

  if (initQuery.isError) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ color: '#b91c1c', fontWeight: 600, marginBottom: '12px' }}>
          {(initQuery.error instanceof Error && initQuery.error.message) || 'Unable to load outward data.'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <button type="button" className="btn btn-primary" onClick={retryAll}>Retry</button>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Material Outward</h1>
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
          <span>{(stockQuery.error instanceof Error && stockQuery.error.message) || 'Unable to load stock.'}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => stockQuery.refetch()}>Retry</button>
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date</label>
              <input
                type="date"
                className="form-input"
                value={formData.outward_date}
                onChange={(e) => setFormData({ ...formData, outward_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Warehouse *</label>
              <select
                className="form-select"
                value={formData.warehouse_id}
                onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                required
              >
                <option value="">Select Warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.warehouse_name || warehouse.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Variant *</label>
              <select
                className="form-select"
                value={formData.variant_id}
                onChange={(e) => setFormData({ ...formData, variant_id: e.target.value })}
                required
              >
                <option value="">Select Variant</option>
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.variant_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Project</label>
              <select
                className="form-select"
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
              >
                <option value="">Select Project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.project_name || project.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Remarks</label>
              <input
                type="text"
                className="form-input"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="Optional remarks"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Items</label>
            <div className="item-list">
              <div className="item-row header" style={{ display: 'grid', gridTemplateColumns: '2fr 100px 100px 40px', gap: '12px' }}>
                <span>Item</span>
                <span>Available</span>
                <span>Qty</span>
                <span></span>
              </div>
              {items.map((item) => (
                <div
                  className="item-row"
                  key={item.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 100px 100px 40px',
                    gap: '12px',
                    alignItems: 'center',
                    marginTop: '8px',
                    padding: '8px',
                    borderRadius: '8px',
                    background: !item.valid && item.item_id ? '#fff7ed' : 'transparent',
                  }}
                >
                  <select value={item.item_id} onChange={(e) => updateItem(item.id, 'item_id', e.target.value)}>
                    <option value="">Select Item</option>
                    {materials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.display_name || material.name}
                      </option>
                    ))}
                  </select>
                  <span style={{ textAlign: 'right', color: item.is_service ? '#6b7280' : '#111827' }}>
                    {item.is_service ? 'Service' : item.available_qty}
                  </span>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                    placeholder="Qty"
                  />
                  <button
                    type="button"
                    className="delete-btn"
                    onClick={() => removeItem(item.id)}
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addItem} style={{ marginTop: '12px' }}>
              + Add Item
            </button>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving || stockQuery.isFetching}>
              {saving ? 'Submitting...' : 'Submit'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
