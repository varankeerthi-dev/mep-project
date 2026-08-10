/**
 * PurchaseOrdersV2 — Unified entry form for Purchase Orders
 *
 * Uses shared document-editor components per quoteui design system.
 * Business logic follows the existing PurchaseOrders patterns from Purchase module.
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { toast } from '../../../lib/logger';
import {
  DocumentActionBar,
  PrimaryButton,
  SecondaryButton,
  HeaderFormGrid,
  HeaderCard,
  HeaderField,
  CustomDatePicker,
  sharedStyles,
  SummaryFooter,
} from '../../../components/document-editor';
import { User, FileText, Briefcase, Truck } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';

interface POItem {
  description: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  rate: number;
  tax_percent: number;
  amount: number;
}

export default function PurchaseOrdersV2() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const orgId = organisation?.id;
  const queryClient = useQueryClient();

  const [saving, setSaving] = useState(false);
  const [vendorId, setVendorId] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState<POItem[]>([{ description: '', hsn_code: '', quantity: 1, unit: 'nos', rate: 0, tax_percent: 18, amount: 0 }]);

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors', orgId],
    queryFn: async () => { if (!orgId) return []; const { data } = await supabase.from('purchase_vendors').select('id, company_name').eq('organisation_id', orgId).eq('is_active', true); return data || []; },
    enabled: !!orgId,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', orgId],
    queryFn: async () => { if (!orgId) return []; const { data } = await supabase.from('projects').select('id, project_name').eq('organisation_id', orgId); return data || []; },
    enabled: !!orgId,
  });

  const totals = useMemo(() => {
    let subtotal = 0, taxTotal = 0, grandTotal = 0;
    items.forEach((item) => {
      const amount = item.quantity * item.rate;
      const tax = amount * (item.tax_percent / 100);
      subtotal += amount;
      taxTotal += tax;
      grandTotal += amount + tax;
    });
    return { subtotal, taxTotal, grandTotal };
  }, [items]);

  const addItem = () => setItems([...items, { description: '', hsn_code: '', quantity: 1, unit: 'nos', rate: 0, tax_percent: 18, amount: 0 }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const updateItem = (index: number, patch: Partial<POItem>) => {
    setItems(items.map((item, i) => {
      if (i !== index) return item;
      const next = { ...item, ...patch };
      next.amount = next.quantity * next.rate;
      return next;
    }));
  };

  const handleSave = async () => {
    if (!orgId) return;
    if (!vendorId) { toast.error('Please select a vendor'); return; }
    if (items.length === 0 || items.every(i => !i.description)) { toast.error('Please add at least one item'); return; }
    setSaving(true);
    try {
      const payload = {
        vendor_id: vendorId,
        po_number: poNumber || null,
        po_date: poDate,
        delivery_date: deliveryDate || null,
        project_id: projectId || null,
        remarks: remarks || null,
        subtotal: totals.subtotal,
        tax_amount: totals.taxTotal,
        total_amount: totals.grandTotal,
        status: 'Draft',
        organisation_id: orgId,
        items: items.map(item => ({
          description: item.description,
          hsn_code: item.hsn_code || null,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          tax_percent: item.tax_percent,
          amount: item.amount,
        })),
      };
      const { error } = await supabase.from('purchase_orders').insert(payload);
      if (error) throw error;
      toast.success('Purchase Order created');
      navigate('/purchase/orders');
    } catch (err: any) { toast.error(err.message || 'Failed to save'); } finally { setSaving(false); }
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
      <DocumentActionBar
        title="Create Purchase Order"
        fixed={{ top: 32, left: 220 }}
        rightActions={
          <>
            <SecondaryButton onClick={() => navigate('/purchase/orders')} disabled={saving}>Cancel</SecondaryButton>
            <PrimaryButton onClick={handleSave} disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {saving ? 'Saving...' : 'Save'}</PrimaryButton>
          </>
        }
      />

      <div style={{ paddingTop: '84px', paddingLeft: '16px', paddingRight: '16px', paddingBottom: '16px', maxWidth: '1400px', margin: '0 auto' }}>
        <HeaderFormGrid columns={3}>
          <HeaderCard icon={<User size={14} style={{ color: '#2563eb' }} />} title="Vendor">
            <HeaderField label="Vendor" required labelWidth="100px">
              <select className="form-select" style={sharedStyles.inputStyle} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                <option value="">Select vendor</option>
                {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.company_name}</option>)}
              </select>
            </HeaderField>
            <HeaderField label="Project" labelWidth="100px">
              <select className="form-select" style={sharedStyles.inputStyle} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">Select project</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
              </select>
            </HeaderField>
          </HeaderCard>

          <HeaderCard icon={<FileText size={14} style={{ color: '#2563eb' }} />} title="Document">
            <HeaderField label="PO Number" labelWidth="100px"><input type="text" className="form-input" style={{ ...sharedStyles.inputStyle, background: '#f3f4f6' }} value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Auto" /></HeaderField>
            <HeaderField label="Date" required labelWidth="100px"><CustomDatePicker value={poDate} onChange={setPoDate} inputStyle={sharedStyles.inputStyle} /></HeaderField>
            <HeaderField label="Delivery Date" labelWidth="100px"><CustomDatePicker value={deliveryDate} onChange={setDeliveryDate} inputStyle={sharedStyles.inputStyle} minDate={poDate} /></HeaderField>
          </HeaderCard>

          <HeaderCard icon={<Truck size={14} style={{ color: '#2563eb' }} />} title="Details">
            <HeaderField label="Remarks" labelWidth="100px"><textarea className="form-input" style={{ ...sharedStyles.inputStyle, minHeight: '36px', resize: 'vertical', fontFamily: 'inherit' }} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Remarks..." /></HeaderField>
          </HeaderCard>
        </HeaderFormGrid>

        {/* Line Items */}
        <div className="bg-white rounded-none border border-zinc-200 shadow-sm mb-6 mt-8">
          <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Line Items</span>
            <button type="button" onClick={addItem} style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', fontSize: '12px', fontWeight: 500, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Plus size={13} /> Add Item
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#1e3a8a', color: 'white' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700 }}>#</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700 }}>DESCRIPTION</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700 }}>HSN</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700 }}>QTY</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700 }}>UNIT</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700 }}>RATE</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700 }}>TAX %</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700 }}>AMOUNT</th>
                  <th style={{ padding: '8px 12px', width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px', fontSize: '11px', textAlign: 'center' }}>{index + 1}</td>
                    <td style={{ padding: '4px 8px' }}><input type="text" className="form-input" style={sharedStyles.inputStyle} value={item.description} onChange={(e) => updateItem(index, { description: e.target.value })} /></td>
                    <td style={{ padding: '4px 8px' }}><input type="text" className="form-input" style={sharedStyles.inputStyle} value={item.hsn_code} onChange={(e) => updateItem(index, { hsn_code: e.target.value })} /></td>
                    <td style={{ padding: '4px 8px' }}><input type="number" className="form-input" style={{ ...sharedStyles.inputStyle, textAlign: 'right' }} value={item.quantity || ''} onChange={(e) => updateItem(index, { quantity: parseFloat(e.target.value) || 0 })} /></td>
                    <td style={{ padding: '4px 8px', fontSize: '11px' }}>{item.unit}</td>
                    <td style={{ padding: '4px 8px' }}><input type="number" className="form-input" style={{ ...sharedStyles.inputStyle, textAlign: 'right' }} value={item.rate || ''} onChange={(e) => updateItem(index, { rate: parseFloat(e.target.value) || 0 })} /></td>
                    <td style={{ padding: '4px 8px' }}><input type="number" className="form-input" style={{ ...sharedStyles.inputStyle, textAlign: 'right' }} value={item.tax_percent || ''} onChange={(e) => updateItem(index, { tax_percent: parseFloat(e.target.value) || 0 })} /></td>
                    <td style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, textAlign: 'right' }}>{formatCurrency(item.amount || 0)}</td>
                    <td style={{ padding: '8px' }}><button type="button" onClick={() => removeItem(index)} style={{ padding: '4px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <SummaryFooter
          rows={[{ label: 'Subtotal', value: totals.subtotal }, { label: 'Tax', value: totals.taxTotal }]}
          grandTotal={{ label: 'Grand Total', amount: totals.grandTotal }}
        />
      </div>
    </div>
  );
}
