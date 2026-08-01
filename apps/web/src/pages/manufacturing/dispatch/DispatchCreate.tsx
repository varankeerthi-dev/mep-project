import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash, Loader2 } from 'lucide-react';
import { supabase } from '../../../supabase';
import { useMaterials } from '../../../hooks/useMaterials';
import { useCreateDispatchOrderMutation } from '../../../features/manufacturing';

type DispatchCreateProps = {
  onCancel: () => void;
  onSuccess: () => void;
};

interface DispatchItemFormLine {
  material_id: string;
  ordered_qty: number;
  picked_qty: number;
  unit: string;
  sales_order_item_id?: string;
  available_stock: number;
}

export default function DispatchCreate({ onCancel, onSuccess }: DispatchCreateProps) {
  const { organisation } = useAuth();
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [plannedDate, setPlannedDate] = useState(new Date().toISOString().split('T')[0]);
  const [transportMode, setTransportMode] = useState('road');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverContact, setDriverContact] = useState('');
  const [freightCharges, setFreightCharges] = useState(0);
  const [remarks, setRemarks] = useState('');
  const [selectedSOId, setSelectedSOId] = useState<string>('');

  const [items, setItems] = useState<DispatchItemFormLine[]>([]);

  // Fetch Materials
  const { data: materials = [], isLoading: materialsLoading } = useMaterials();

  // Create Mutation
  const createDispatchOrder = useCreateDispatchOrderMutation();

  // Fetch open Sales Orders
  const { data: salesOrders = [], isLoading: salesOrdersLoading } = useQuery({
    queryKey: ['open-sales-orders-dispatch', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          client:clients(client_name, shipping_address)
        `)
        .eq('organisation_id', organisation.id)
        .neq('status', 'draft')
        .neq('status', 'closed');

      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id
  });

  // Fetch items for selected Sales Order
  const { data: salesOrderItems = [], isLoading: soItemsLoading } = useQuery({
    queryKey: ['sales-order-items-dispatch', selectedSOId],
    queryFn: async () => {
      if (!selectedSOId) return [];
      const { data, error } = await supabase
        .from('sales_order_items')
        .select(`
          *,
          material:materials(id, name, unit)
        `)
        .eq('sales_order_id', selectedSOId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedSOId
  });

  // When Sales Order is selected, auto-populate customer details and items
  useEffect(() => {
    if (!selectedSOId) return;
    const so = salesOrders.find((s: any) => s.id === selectedSOId);
    if (so) {
      setCustomerName(so.client?.client_name || so.customer_name || '');
      setCustomerAddress(so.client?.shipping_address || so.shipping_address || '');
    }
  }, [selectedSOId, salesOrders]);

  // When Sales Order items are loaded, populate items table
  useEffect(() => {
    if (salesOrderItems.length === 0) return;

    const loadStock = async () => {
      // Find FG warehouses to get stock
      const { data: warehouses } = await supabase
        .from('warehouses')
        .select('id')
        .eq('organisation_id', organisation?.id)
        .eq('warehouse_purpose', 'fg');

      const fgWarehouseId = warehouses?.[0]?.id;

      const itemLines: DispatchItemFormLine[] = [];

      for (const item of salesOrderItems) {
        // Fetch current stock
        let stock = 0;
        if (fgWarehouseId) {
          const { data: stockRow } = await supabase
            .from('item_stock')
            .select('current_stock')
            .eq('item_id', item.material_id)
            .eq('warehouse_id', fgWarehouseId)
            .maybeSingle();
          stock = stockRow?.current_stock || 0;
        }

        // Only add items that aren't already fully shipped
        const remaining = Math.max(0, (item.qty || 0) - (item.shipped_qty || 0));
        if (remaining > 0) {
          itemLines.push({
            material_id: item.material_id,
            ordered_qty: remaining,
            picked_qty: remaining,
            unit: item.uom || item.material?.unit || 'Nos',
            sales_order_item_id: item.id,
            available_stock: stock
          });
        }
      }

      setItems(itemLines);
    };

    loadStock();
  }, [salesOrderItems, organisation?.id]);

  const handleAddManualItem = async () => {
    if (materials.length === 0) return;
    const firstMaterial = materials[0];

    // Find stock
    const { data: warehouses } = await supabase
      .from('warehouses')
      .select('id')
      .eq('organisation_id', organisation?.id)
      .eq('warehouse_purpose', 'fg');

    const fgWarehouseId = warehouses?.[0]?.id;
    let stock = 0;
    if (fgWarehouseId) {
      const { data: stockRow } = await supabase
        .from('item_stock')
        .select('current_stock')
        .eq('item_id', firstMaterial.id)
        .eq('warehouse_id', fgWarehouseId)
        .maybeSingle();
      stock = stockRow?.current_stock || 0;
    }

    setItems([...items, {
      material_id: firstMaterial.id,
      ordered_qty: 1,
      picked_qty: 1,
      unit: firstMaterial.unit || 'Nos',
      available_stock: stock
    }]);
  };

  const handleMaterialChange = async (index: number, materialId: string) => {
    const selectedMat = materials.find(m => m.id === materialId);
    if (!selectedMat) return;

    // Find stock
    const { data: warehouses } = await supabase
      .from('warehouses')
      .select('id')
      .eq('organisation_id', organisation?.id)
      .eq('warehouse_purpose', 'fg');

    const fgWarehouseId = warehouses?.[0]?.id;
    let stock = 0;
    if (fgWarehouseId) {
      const { data: stockRow } = await supabase
        .from('item_stock')
        .select('current_stock')
        .eq('item_id', materialId)
        .eq('warehouse_id', fgWarehouseId)
        .maybeSingle();
      stock = stockRow?.current_stock || 0;
    }

    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      material_id: materialId,
      unit: selectedMat.unit || 'Nos',
      available_stock: stock
    };
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItemQty = (index: number, field: 'ordered_qty' | 'picked_qty', value: number) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]: Math.max(0, value)
    };
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('Please enter a customer name');
      return;
    }
    if (items.length === 0) {
      alert('Please add at least one item to dispatch');
      return;
    }

    // Verify pick quantities are valid (optional: warning if it exceeds available stock, but allow draft)
    createDispatchOrder.mutate({
      order: {
        sales_order_id: selectedSOId || null,
        customer_name: customerName,
        customer_address: customerAddress,
        planned_dispatch_date: plannedDate,
        status: 'draft',
        transport_mode: transportMode,
        vehicle_number: vehicleNumber || undefined,
        driver_name: driverName || undefined,
        driver_contact: driverContact || undefined,
        freight_charges: freightCharges,
        remarks: remarks || undefined
      },
      items: items.map(item => ({
        sales_order_item_id: item.sales_order_item_id || null,
        material_id: item.material_id,
        ordered_qty: item.ordered_qty,
        picked_qty: item.picked_qty,
        packed_qty: 0,
        dispatched_qty: 0,
        unit: item.unit,
        status: 'pending'
      })),
      orgId: organisation?.id || ''
    }, {
      onSuccess: () => {
        onSuccess();
      }
    });
  };

  const inputClass = "w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none";

  return (
    <div style={{ minHeight: '100%', background: '#fafafa', paddingBottom: '40px' }}>
      {/* Header Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '16px', position: 'sticky', top: 0, zIndex: 40 }}>
        <button
          onClick={onCancel}
          style={{ display: 'flex', alignItems: 'center', justifyCenter: 'center', width: '28px', height: '28px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}
        >
          <ArrowLeft size={14} />
        </button>
        <div>
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Create Dispatch Order</h1>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Select sales order or add materials manually for dispatch</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Core Settings Card */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>Dispatch Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Link to Sales Order (Optional)</label>
              {salesOrdersLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '32px' }}><Loader2 size={12} className="animate-spin text-zinc-400" /> <span style={{ fontSize: '11px', color: '#6b7280' }}>Loading orders...</span></div>
              ) : (
                <select
                  value={selectedSOId}
                  onChange={e => { setSelectedSOId(e.target.value); setItems([]); }}
                  className={inputClass}
                >
                  <option value="">-- Manual/No Link --</option>
                  {salesOrders.map((so: any) => (
                    <option key={so.id} value={so.id}>{so.sales_order_no} - {so.client?.client_name || so.customer_name}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Customer Name *</label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className={inputClass}
                placeholder="Enter customer name"
                required
                disabled={!!selectedSOId}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Planned Dispatch Date</label>
              <input
                type="date"
                value={plannedDate}
                onChange={e => setPlannedDate(e.target.value)}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Shipping Address</label>
            <textarea
              value={customerAddress}
              onChange={e => setCustomerAddress(e.target.value)}
              className={inputClass}
              placeholder="Enter customer shipping address"
              rows={2}
              style={{ resize: 'none' }}
              disabled={!!selectedSOId}
            />
          </div>
        </div>

        {/* Transport Settings Card */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>Logistics & Transportation</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Transport Mode</label>
              <select
                value={transportMode}
                onChange={e => setTransportMode(e.target.value)}
                className={inputClass}
              >
                <option value="road">Road</option>
                <option value="rail">Rail</option>
                <option value="air">Air</option>
                <option value="sea">Sea</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Vehicle Number</label>
              <input
                type="text"
                value={vehicleNumber}
                onChange={e => setVehicleNumber(e.target.value)}
                className={inputClass}
                placeholder="e.g. DL 1C AB 1234"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Driver Name</label>
              <input
                type="text"
                value={driverName}
                onChange={e => setDriverName(e.target.value)}
                className={inputClass}
                placeholder="Driver full name"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Driver Contact</label>
              <input
                type="text"
                value={driverContact}
                onChange={e => setDriverContact(e.target.value)}
                className={inputClass}
                placeholder="Contact number"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Freight Charges (₹)</label>
              <input
                type="number"
                value={freightCharges}
                onChange={e => setFreightCharges(parseFloat(e.target.value) || 0)}
                className={inputClass}
                min={0}
              />
            </div>
          </div>
        </div>

        {/* Materials picking table card */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', margin: 0 }}>Materials to Dispatch</h3>
            {!selectedSOId && (
              <button
                type="button"
                onClick={handleAddManualItem}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: '4px', background: '#fff', fontSize: '11px', color: '#185FA5', cursor: 'pointer', fontWeight: 500 }}
              >
                <Plus size={12} /> Add Item Manually
              </button>
            )}
          </div>

          {soItemsLoading ? (
            <div style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
              <Loader2 size={16} className="animate-spin text-zinc-400" />
              <span style={{ fontSize: '11px', color: '#6b7280' }}>Loading items...</span>
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
              No items added yet. Click 'Add Item Manually' or select a Sales Order above to import.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                    <th style={{ padding: '8px 12px', fontWeight: 500, color: '#4b5563' }}>Material Name</th>
                    <th style={{ padding: '8px 12px', fontWeight: 500, color: '#4b5563', width: '100px' }}>Available FG Stock</th>
                    <th style={{ padding: '8px 12px', fontWeight: 500, color: '#4b5563', width: '100px' }}>Ordered Qty</th>
                    <th style={{ padding: '8px 12px', fontWeight: 500, color: '#4b5563', width: '100px' }}>Picked Qty</th>
                    <th style={{ padding: '8px 12px', fontWeight: 500, color: '#4b5563', width: '60px' }}>Unit</th>
                    {!selectedSOId && <th style={{ padding: '8px 12px', width: '50px' }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const selectedMat = materials.find(m => m.id === item.material_id);
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 12px' }}>
                          {selectedSOId ? (
                            <span style={{ fontWeight: 500, color: '#111827' }}>
                              {selectedMat?.name || 'Loading material name...'}
                            </span>
                          ) : (
                            <select
                              value={item.material_id}
                              onChange={e => handleMaterialChange(idx, e.target.value)}
                              className="rounded border border-zinc-300 px-2 py-1 text-xs focus:outline-none"
                              style={{ width: '100%', height: '28px' }}
                            >
                              {materials.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', color: item.available_stock < item.picked_qty ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                          {item.available_stock.toFixed(3)}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {selectedSOId ? (
                            <span style={{ fontWeight: 500, color: '#374151' }}>{item.ordered_qty}</span>
                          ) : (
                            <input
                              type="number"
                              value={item.ordered_qty}
                              onChange={e => updateItemQty(idx, 'ordered_qty', parseFloat(e.target.value) || 0)}
                              className="rounded border border-zinc-300 px-2 py-1 text-xs focus:outline-none"
                              style={{ width: '80px', height: '28px' }}
                            />
                          )}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            type="number"
                            value={item.picked_qty}
                            onChange={e => updateItemQty(idx, 'picked_qty', parseFloat(e.target.value) || 0)}
                            className="rounded border border-zinc-300 px-2 py-1 text-xs focus:outline-none"
                            style={{ width: '80px', height: '28px' }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', color: '#4b5563' }}>{item.unit}</td>
                        {!selectedSOId && (
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              style={{ color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer' }}
                            >
                              <Trash size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Remarks / Notes</label>
          <textarea
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            className={inputClass}
            placeholder="Add general remarks for the dispatch team..."
            rows={3}
            style={{ resize: 'none' }}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ padding: '6px 16px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', fontSize: '12px', color: '#374151', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createDispatchOrder.isPending}
            style={{
              padding: '6px 16px',
              background: '#185FA5',
              border: '1px solid #185FA5',
              color: '#fff',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: createDispatchOrder.isPending ? 'not-allowed' : 'pointer',
              opacity: createDispatchOrder.isPending ? 0.7 : 1
            }}
          >
            {createDispatchOrder.isPending ? 'Creating...' : 'Create Draft Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
