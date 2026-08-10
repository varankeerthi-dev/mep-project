import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../../supabase';
import { Button } from '../../../components/ui/button';
import { useMaterials } from '../../../hooks/useMaterials';
import { useCreateGoodsReceiptNoteMutation } from '../../../features/manufacturing';

type GRNCreateProps = {
  onCancel: () => void;
  onSuccess: () => void;
};

interface LocalGRNItem {
  material_id: string;
  ordered_qty: number;
  received_qty: number;
  unit: string;
  batch_no?: string;
  expiry_date?: string;
}

export default function GRNCreate({ onCancel, onSuccess }: GRNCreateProps) {
  const { organisation, user } = useAuth();

  const [poId, setPoId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [challanNumber, setChallanNumber] = useState('');
  const [remarks, setRemarks] = useState('');

  const [grnItems, setGrnItems] = useState<LocalGRNItem[]>([]);

  // Fetch materials for manual adding option
  const { data: materials = [] } = useMaterials();
  const [manualMaterialId, setManualMaterialId] = useState('');

  // 1. Fetch approved purchase orders
  const { data: purchaseOrders = [], isLoading: poLoading } = useQuery({
    queryKey: ['approved-purchase-orders', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          vendor_name
        `)
        .eq('organisation_id', organisation.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id
  });

  // 2. Fetch items for selected PO
  const { data: poItems = [], isLoading: poItemsLoading } = useQuery({
    queryKey: ['po-items', poId],
    queryFn: async () => {
      if (!poId) return [];
      
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select(`
          id,
          material_id,
          quantity,
          unit,
          materials:material_id (
            name
          )
        `)
        .eq('purchase_order_id', poId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!poId
  });

  // Sync PO vendor and items
  useEffect(() => {
    if (poId && purchaseOrders.length > 0) {
      const selected = purchaseOrders.find(p => p.id === poId);
      if (selected) {
        setVendorName(selected.vendor_name || '');
      }
    }
  }, [poId, purchaseOrders]);

  useEffect(() => {
    if (poId && poItems.length > 0) {
      const mapped = poItems.map(item => ({
        material_id: item.material_id,
        ordered_qty: item.quantity,
        received_qty: item.quantity, // Default received to ordered
        unit: item.unit || 'Nos',
        batch_no: '',
        expiry_date: ''
      }));
      setGrnItems(mapped);
    }
  }, [poItems, poId]);

  const addManualItem = () => {
    if (!manualMaterialId) return;
    const material = materials.find(m => m.id === manualMaterialId);
    if (!material) return;

    // Check duplicate
    if (grnItems.some(i => i.material_id === manualMaterialId)) {
      alert('Material already added to checklist');
      return;
    }

    setGrnItems(prev => [
      ...prev,
      {
        material_id: manualMaterialId,
        ordered_qty: 0,
        received_qty: 0,
        unit: material.unit || 'Nos',
        batch_no: '',
        expiry_date: ''
      }
    ]);
    setManualMaterialId('');
  };

  const removeGrnItem = (index: number) => {
    setGrnItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemFieldChange = (index: number, field: keyof LocalGRNItem, val: any) => {
    setGrnItems(prev => prev.map((item, i) => (i === index ? { ...item, [field]: val } : item)));
  };

  const createGrnMutation = useCreateGoodsReceiptNoteMutation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim()) {
      alert('Please enter a vendor name');
      return;
    }
    if (grnItems.length === 0) {
      alert('Please add at least one material to the receipt list');
      return;
    }

    createGrnMutation.mutate({
      grn: {
        purchase_order_id: poId || null,
        vendor_name: vendorName,
        invoice_number: invoiceNumber || undefined,
        invoice_date: invoiceDate || undefined,
        receipt_date: receiptDate,
        received_by: user?.id || null,
        status: 'qc_pending', // Starts in QC pending state
        vehicle_number: vehicleNumber || undefined,
        challan_number: challanNumber || undefined,
        remarks: remarks || undefined,
        organisation_id: organisation?.id || ''
      },
      items: grnItems.map(item => ({
        material_id: item.material_id,
        ordered_qty: item.ordered_qty,
        received_qty: item.received_qty,
        accepted_qty: 0, // Set during verification/qc pass
        rejected_qty: 0,
        unit: item.unit,
        batch_no: item.batch_no || undefined,
        expiry_date: item.expiry_date || undefined,
        status: 'pending',
        organisation_id: organisation?.id || ''
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
        <Button variant="secondary" size="icon-sm" onClick={onCancel} aria-label="Back">
          <ArrowLeft size={14} />
        </Button>
        <div>
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Log Goods Receipt Note (GRN)</h1>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Record incoming raw goods quantities and transport details</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '24px', maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Core settings */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>
            Inward Receipt Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Linked Purchase Order</label>
              {poLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '32px' }}><Loader2 size={12} className="animate-spin text-zinc-400" /></div>
              ) : (
                <select
                  value={poId}
                  onChange={e => setPoId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">-- Manual GRN (No PO Link) --</option>
                  {purchaseOrders.map((po: any) => (
                    <option key={po.id} value={po.id}>{po.po_number} (Vendor: {po.vendor_name})</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Vendor Name *</label>
              <input
                type="text"
                value={vendorName}
                onChange={e => setVendorName(e.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Invoice Number</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                className={inputClass}
                placeholder="INV-0001"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Receipt Date</label>
              <input
                type="date"
                value={receiptDate}
                onChange={e => setReceiptDate(e.target.value)}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4" style={{ marginTop: '16px' }}>
            <div className="col-span-2">
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Vehicle Number</label>
              <input
                type="text"
                value={vehicleNumber}
                onChange={e => setVehicleNumber(e.target.value)}
                className={inputClass}
                placeholder="MH-12-AB-1234"
              />
            </div>

            <div className="col-span-2">
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Challan / Consignment No</label>
              <input
                type="text"
                value={challanNumber}
                onChange={e => setChallanNumber(e.target.value)}
                className={inputClass}
                placeholder="CH-0987"
              />
            </div>
          </div>
        </div>

        {/* Goods received item details */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', margin: 0 }}>Goods Checklist</h3>
            
            {/* Manual adding select */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                value={manualMaterialId}
                onChange={e => setManualMaterialId(e.target.value)}
                className={inputClass}
                style={{ width: '180px', height: '28px' }}
              >
                <option value="">-- Add raw material --</option>
                {materials.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <Button variant="outline" size="xs" type="button" onClick={addManualItem}>Add</Button>
            </div>
          </div>

          {poItemsLoading ? (
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}><Loader2 size={16} className="animate-spin text-zinc-400" /></div>
          ) : grnItems.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: '11px', color: '#6b7280' }}>
              No items added to checklist. Select a Purchase Order or add manual materials above.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '6px 12px', fontWeight: 500 }}>Material Name</th>
                  <th style={{ padding: '6px 12px', fontWeight: 500, width: '100px', textAlign: 'right' }}>Ordered Qty</th>
                  <th style={{ padding: '6px 12px', fontWeight: 500, width: '100px', textAlign: 'right' }}>Received Qty</th>
                  <th style={{ padding: '6px 12px', fontWeight: 500, width: '120px' }}>Batch No</th>
                  <th style={{ padding: '6px 12px', fontWeight: 500, width: '120px' }}>Expiry Date</th>
                  <th style={{ padding: '6px 12px', fontWeight: 500, width: '40px', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {grnItems.map((item, idx) => {
                  const matName = materials.find(m => m.id === item.material_id)?.name || 'Loading...';
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 500, color: '#111827' }}>{matName}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <input
                          type="number"
                          value={item.ordered_qty}
                          onChange={e => handleItemFieldChange(idx, 'ordered_qty', parseFloat(e.target.value) || 0)}
                          className={inputClass}
                          style={{ height: '24px', textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <input
                          type="number"
                          value={item.received_qty}
                          onChange={e => handleItemFieldChange(idx, 'received_qty', parseFloat(e.target.value) || 0)}
                          className={inputClass}
                          style={{ height: '24px', textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="text"
                          placeholder="e.g. LOT-AB"
                          value={item.batch_no || ''}
                          onChange={e => handleItemFieldChange(idx, 'batch_no', e.target.value)}
                          className={inputClass}
                          style={{ height: '24px' }}
                        />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="date"
                          value={item.expiry_date || ''}
                          onChange={e => handleItemFieldChange(idx, 'expiry_date', e.target.value)}
                          className={inputClass}
                          style={{ height: '24px' }}
                        />
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <Button variant="ghost" size="icon-xs" type="button" onClick={() => removeGrnItem(idx)} aria-label="Remove item" className="text-red-500 hover:text-red-600">
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Remarks / Inwarding notes</label>
          <textarea
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            className={inputClass}
            placeholder="Log check results, packaging condition, or vehicle seal details..."
            rows={3}
            style={{ resize: 'none' }}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={createGrnMutation.isPending} loading={createGrnMutation.isPending} loadingText="Saving..." leftIcon={<Save size={14} />}>
            Submit GRN checklist
          </Button>
        </div>
      </form>
    </div>
  );
}
