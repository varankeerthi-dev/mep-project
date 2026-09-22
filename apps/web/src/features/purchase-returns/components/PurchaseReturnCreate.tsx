import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabase';
import { useAuth } from '@/App';
import { purchaseReturnService } from '../services/purchaseReturnService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Save, Loader2, AlertTriangle } from 'lucide-react';

type ReturnType = 'credit_note' | 'delivery_challan';

export function PurchaseReturnCreate({ onCancel, onSuccess }: { onCancel: () => void; onSuccess?: () => void }) {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();

  const [vendorId, setVendorId] = useState('');
  const [grnId, setGrnId] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [returnType, setReturnType] = useState<ReturnType>('credit_note');
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const { data: vendors = [] } = useQuery({
    queryKey: ['purchase-vendors', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase.from('purchase_vendors').select('id, company_name').eq('organisation_id', organisation.id).eq('status', 'Active');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  const { data: grns = [] } = useQuery({
    queryKey: ['goods-receipt-notes', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase.from('goods_receipt_notes').select('id, grn_no, vendor_name, receipt_date').eq('organisation_id', organisation.id).order('receipt_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  const { data: grnItems = [] } = useQuery({
    queryKey: ['grn-items-for-return', grnId],
    queryFn: async () => {
      if (!grnId) return [];
      const { data, error } = await supabase
        .from('grn_items')
        .select('*, materials:material_id (name, has_serial_number, has_warranty)')
        .eq('grn_id', grnId)
        .not('serial_number', 'is', null);
      if (error) throw error;
      return data || [];
    },
    enabled: !!grnId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!organisation?.id) throw new Error('No organisation');
      if (!vendorId) throw new Error('Vendor is required');
      if (!reason.trim()) throw new Error('Reason is required');

      const items = selectedItems.map((item: any) => ({
        material_id: item.material_id,
        grn_item_id: item.id,
        serial_number: item.serial_number,
        quantity: item.quantity || 1,
        unit: item.unit || 'Nos',
        batch_no: item.batch_no || null,
        warranty_start_date: item.warranty_start_date || null,
        warranty_end_date: item.warranty_end_date || null,
        reason: item.reason || null,
      }));

      return purchaseReturnService.createPurchaseReturn({
        organisation_id: organisation.id,
        vendor_id: vendorId,
        grn_id: grnId || null,
        return_date: returnDate,
        reason: reason.trim(),
        return_type: returnType,
        items,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-returns'] });
      onSuccess?.();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  const handleItemToggle = (grnItem: any) => {
    setSelectedItems(prev => {
      const exists = prev.find((i: any) => i.id === grnItem.id);
      if (exists) {
        return prev.filter((i: any) => i.id !== grnItem.id);
      }
      return [...prev, { ...grnItem, quantity: grnItem.received_qty || 1, reason: '' }];
    });
  };

  const handleItemQuantityChange = (grnItemId: string, qty: number) => {
    setSelectedItems(prev =>
      prev.map((item: any) => item.id === grnItemId ? { ...item, quantity: qty } : item)
    );
  };

  const selectedTotal = selectedItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

  return (
    <div style={{ padding: '24px', background: '#fafafa', minHeight: '100vh' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <Button variant="secondary" size="icon-sm" onClick={onCancel} aria-label="Back">
            <ArrowLeft size={14} />
          </Button>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>Create Purchase Return</h1>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Return items to supplier with serial tracking</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Return Details</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Vendor *</label>
                <select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
                  required
                >
                  <option value="">Select vendor</option>
                  {vendors.map((v: any) => (<option key={v.id} value={v.id}>{v.company_name}</option>))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Linked GRN</label>
                <select
                  value={grnId}
                  onChange={(e) => { setGrnId(e.target.value); setSelectedItems([]); }}
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
                >
                  <option value="">Select GRN (optional)</option>
                  {grns.map((g: any) => (<option key={g.id} value={g.id}>{g.grn_no} - {g.vendor_name} ({g.receipt_date})</option>))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Return Date *</label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Return Type *</label>
                <select
                  value={returnType}
                  onChange={(e) => setReturnType(e.target.value as ReturnType)}
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
                >
                  <option value="credit_note">Credit Note</option>
                  <option value="delivery_challan">Delivery Challan</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Reason *</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Defect, recall, rectification..."
                rows={3}
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', outline: 'none', resize: 'vertical' }}
                required
              />
            </div>
          </div>

          {/* Items Selection */}
          {grnId && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Select Items to Return ({selectedItems.length} selected, {selectedTotal} qty)
              </h3>

              {grnItems.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
                  No items with serial numbers found in this GRN
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {grnItems.map((item: any) => {
                    const isSelected = selectedItems.some((i: any) => i.id === item.id);
                    const material = item.materials;
                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: '12px 16px', border: `1px solid ${isSelected ? '#2563eb' : '#e5e7eb'}`,
                          borderRadius: '6px', background: isSelected ? '#eff6ff' : '#fff',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{material?.name || 'Unknown'}</div>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                            Serial: {item.serial_number} | Warranty: {item.warranty_start_date} to {item.warranty_end_date}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {isSelected && (
                            <input
                              type="number"
                              min="1"
                              max={item.received_qty || 1}
                              value={selectedItems.find((i: any) => i.id === item.id)?.quantity || 1}
                              onChange={(e) => handleItemQuantityChange(item.id, parseInt(e.target.value) || 1)}
                              style={{ width: '60px', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
                            />
                          )}
                          <Button
                            type="button"
                            variant={isSelected ? 'default' : 'outline'}
                            size="xs"
                            onClick={() => handleItemToggle(item)}
                          >
                            {isSelected ? 'Selected' : 'Select'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={loading || createMutation.isPending || selectedItems.length === 0}>
              {loading || createMutation.isPending ? 'Creating...' : 'Create Purchase Return'}
            </Button>
          </div>

          {createMutation.isError && (
            <div style={{ marginTop: '16px', padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} color="#dc2626" />
              <span style={{ fontSize: '13px', color: '#991b1b' }}>
                {(createMutation.error as Error).message}
              </span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
