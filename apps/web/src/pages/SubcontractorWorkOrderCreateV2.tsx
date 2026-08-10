/**
 * SubcontractorWorkOrderCreateV2 — Unified entry form for Work Orders
 *
 * Uses shared document-editor components per quoteui design system.
 * Business logic is identical to SubcontractorWorkOrderCreate.
 */
import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { calculateFinance } from '../features/subcontractor/domain/financeCalculator';
import { Plus, Trash2, Save, GripVertical, AlertTriangle } from 'lucide-react';
import { ApprovalIntegration } from '../approvals/integration';
import { toast } from '@/lib/logger';
import { useUnits } from '../hooks/useUnits';
import { useVendorHolds } from '../modules/Purchase/hooks/usePurchaseQueries';
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
} from '../components/document-editor';
import { User, FileText, Briefcase, Truck } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

interface WorkOrderItem {
  id?: string;
  description: string;
  sac_code?: string;
  hsn_code?: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
  tax_percent: number;
  tax_amount: number;
  total: number;
}

interface WorkOrderForm {
  wo_number: string;
  wo_date: string;
  due_date: string;
  subcontractor_id: string;
  project_id: string;
  scope_of_work: string;
  payment_terms: string;
  status: string;
  items: WorkOrderItem[];
  remarks: string;
  authorized_signatory_id: string;
}

export default function SubcontractorWorkOrderCreateV2({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { organisation, user } = useAuth();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const isEditing = !!editId;
  const queryClient = useQueryClient();

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<WorkOrderForm>({
    wo_number: '',
    wo_date: new Date().toISOString().split('T')[0],
    due_date: '',
    subcontractor_id: '',
    project_id: '',
    scope_of_work: '',
    payment_terms: 'Net 30 Days',
    status: 'Draft',
    items: [{ description: '', qty: 1, unit: 'nos', rate: 0, amount: 0, tax_percent: 18, tax_amount: 0, total: 0 }],
    remarks: '',
    authorized_signatory_id: '',
  });

  const { data: units = [] } = useUnits();
  const { data: vendorHolds = [] } = useVendorHolds(organisation?.id);

  // ─── Data queries ───────────────────────────────────────────
  const { data: subcontractors = [] } = useQuery({
    queryKey: ['subcontractors', organisation?.id],
    queryFn: async () => { if (!organisation?.id) return []; const { data } = await supabase.from('subcontractors').select('id, name, company_name').eq('organisation_id', organisation.id).eq('status', 'active'); return data || []; },
    enabled: !!organisation?.id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', organisation?.id],
    queryFn: async () => { if (!organisation?.id) return []; const { data } = await supabase.from('projects').select('id, project_name, project_code').eq('organisation_id', organisation.id); return data || []; },
    enabled: !!organisation?.id,
  });

  // ─── Load existing WO for edit ──────────────────────────────
  useEffect(() => {
    if (!editId || !organisation?.id) return;
    const loadWO = async () => {
      const { data: wo } = await supabase.from('subcontractor_work_orders').select('*').eq('id', editId).single();
      if (wo) {
        setForm({
          wo_number: wo.wo_number || '',
          wo_date: wo.wo_date || new Date().toISOString().split('T')[0],
          due_date: wo.due_date || '',
          subcontractor_id: wo.subcontractor_id || '',
          project_id: wo.project_id || '',
          scope_of_work: wo.scope_of_work || '',
          payment_terms: wo.payment_terms || 'Net 30 Days',
          status: wo.status || 'Draft',
          items: wo.items?.length > 0 ? wo.items : [{ description: '', qty: 1, unit: 'nos', rate: 0, amount: 0, tax_percent: 18, tax_amount: 0, total: 0 }],
          remarks: wo.remarks || '',
          authorized_signatory_id: wo.authorized_signatory_id || '',
        });
      }
    };
    loadWO();
  }, [editId, organisation?.id]);

  // ─── Calculations ───────────────────────────────────────────
  const totals = useMemo(() => {
    let subtotal = 0, taxTotal = 0, grandTotal = 0;
    form.items.forEach((item) => {
      const amount = item.qty * item.rate;
      const tax = amount * (item.tax_percent / 100);
      subtotal += amount;
      taxTotal += tax;
      grandTotal += amount + tax;
    });
    return { subtotal, taxTotal, grandTotal };
  }, [form.items]);

  const addItem = () => setForm((prev) => ({ ...prev, items: [...prev.items, { description: '', qty: 1, unit: 'nos', rate: 0, amount: 0, tax_percent: 18, tax_amount: 0, total: 0 }] }));
  const removeItem = (index: number) => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  const updateItem = (index: number, patch: Partial<WorkOrderItem>) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };
        next.amount = next.qty * next.rate;
        next.tax_amount = next.amount * (next.tax_percent / 100);
        next.total = next.amount + next.tax_amount;
        return next;
      }),
    }));
  };

  // ─── Save ───────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (status: string) => {
      if (!organisation?.id) throw new Error('No organisation');
      const payload = {
        ...form,
        status,
        subtotal: totals.subtotal,
        tax_amount: totals.taxTotal,
        grand_total: totals.grandTotal,
        organisation_id: organisation.id,
        created_by: user?.id,
      };
      if (isEditing && editId) {
        const { error } = await supabase.from('subcontractor_work_orders').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('subcontractor_work_orders').insert(payload).select().single();
        if (error) throw error;
        if (status === 'Pending') {
          try { await ApprovalIntegration.createWorkOrderApproval(data.id, organisation.id); } catch (e) { console.warn('Approval creation failed:', e); }
        }
      }
    },
    onSuccess: () => { toast.success(isEditing ? 'Work Order updated' : 'Work Order created'); queryClient.invalidateQueries({ queryKey: ['work-orders'] }); if (onNavigate) onNavigate('/subcontractors/workorders'); },
    onError: (err: any) => toast.error(err.message || 'Failed to save'),
  });

  const handleSave = async (status: string) => {
    if (!form.subcontractor_id) { toast.error('Please select a subcontractor'); return; }
    if (form.items.length === 0 || form.items.every(i => !i.description)) { toast.error('Please add at least one item'); return; }
    setSaving(true);
    try { await saveMutation.mutateAsync(status); } finally { setSaving(false); }
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
      <DocumentActionBar
        title={isEditing ? `Edit ${form.wo_number}` : 'Create Work Order'}
        fixed={{ top: 32, left: 220 }}
        rightActions={
          <>
            <SecondaryButton onClick={() => handleSave('Draft')} disabled={saving}>Save as Draft</SecondaryButton>
            <PrimaryButton onClick={() => handleSave('Pending')} disabled={saving}>{saving ? 'Saving...' : 'Submit for Approval'}</PrimaryButton>
          </>
        }
      />

      <div style={{ paddingTop: '84px', paddingLeft: '16px', paddingRight: '16px', paddingBottom: '16px', maxWidth: '1400px', margin: '0 auto' }}>
        <HeaderFormGrid columns={3}>
          {/* Card 1: Vendor */}
          <HeaderCard icon={<User size={14} style={{ color: '#2563eb' }} />} title="Subcontractor">
            <HeaderField label="Subcontractor" required labelWidth="110px">
              <select className="form-select" style={sharedStyles.inputStyle} value={form.subcontractor_id} onChange={(e) => setForm((prev) => ({ ...prev, subcontractor_id: e.target.value }))}>
                <option value="">Select subcontractor</option>
                {subcontractors.map((s: any) => <option key={s.id} value={s.id}>{s.company_name || s.name}</option>)}
              </select>
            </HeaderField>
            {form.subcontractor_id && vendorHolds.some((h: any) => h.vendor_id === form.subcontractor_id && h.on_hold) && (
              <div style={{ padding: '8px 12px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', fontSize: '12px', color: '#92400e' }}><AlertTriangle size={14} style={{ display: 'inline', marginRight: '4px' }} /> Vendor is on hold</div>
            )}
            <HeaderField label="Project" labelWidth="110px">
              <select className="form-select" style={sharedStyles.inputStyle} value={form.project_id} onChange={(e) => setForm((prev) => ({ ...prev, project_id: e.target.value }))}>
                <option value="">Select project</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.project_name || p.project_code}</option>)}
              </select>
            </HeaderField>
            <HeaderField label="Signatory" labelWidth="110px">
              <select className="form-select" style={sharedStyles.inputStyle} value={form.authorized_signatory_id} onChange={(e) => setForm((prev) => ({ ...prev, authorized_signatory_id: e.target.value }))}>
                <option value="">Select...</option>
                {((organisation as any)?.signatures || []).map((sig: any) => <option key={sig.id} value={sig.id}>{sig.name}</option>)}
              </select>
            </HeaderField>
          </HeaderCard>

          {/* Card 2: Document */}
          <HeaderCard icon={<FileText size={14} style={{ color: '#2563eb' }} />} title="Document">
            <HeaderField label="WO Number" labelWidth="110px"><input type="text" className="form-input" style={{ ...sharedStyles.inputStyle, background: '#f3f4f6' }} value={form.wo_number} readOnly placeholder="Auto-generating..." /></HeaderField>
            <HeaderField label="WO Date" labelWidth="110px"><CustomDatePicker value={form.wo_date} onChange={(val) => setForm((prev) => ({ ...prev, wo_date: val }))} inputStyle={sharedStyles.inputStyle} /></HeaderField>
            <HeaderField label="Due Date" labelWidth="110px"><CustomDatePicker value={form.due_date} onChange={(val) => setForm((prev) => ({ ...prev, due_date: val }))} inputStyle={sharedStyles.inputStyle} minDate={form.wo_date} /></HeaderField>
            <HeaderField label="Payment Terms" labelWidth="110px"><input type="text" className="form-input" style={sharedStyles.inputStyle} value={form.payment_terms} onChange={(e) => setForm((prev) => ({ ...prev, payment_terms: e.target.value }))} /></HeaderField>
          </HeaderCard>

          {/* Card 3: Scope */}
          <HeaderCard icon={<Truck size={14} style={{ color: '#2563eb' }} />} title="Scope & Remarks">
            <HeaderField label="Scope" labelWidth="110px"><textarea className="form-input" style={{ ...sharedStyles.inputStyle, minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }} value={form.scope_of_work} onChange={(e) => setForm((prev) => ({ ...prev, scope_of_work: e.target.value }))} placeholder="Describe scope of work..." /></HeaderField>
            <HeaderField label="Remarks" labelWidth="110px"><textarea className="form-input" style={{ ...sharedStyles.inputStyle, minHeight: '36px', resize: 'vertical', fontFamily: 'inherit' }} value={form.remarks} onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))} placeholder="Additional remarks..." /></HeaderField>
          </HeaderCard>
        </HeaderFormGrid>

        {/* ── Line Items Table ────────────────────────────────── */}
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
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700 }}>QTY</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700 }}>UNIT</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700 }}>RATE</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700 }}>TAX %</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700 }}>AMOUNT</th>
                  <th style={{ padding: '8px 12px', width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {form.items.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: '48px', color: '#94a3b8', fontSize: '14px', textAlign: 'center' }}>No items added. Click "Add Item".</td></tr>
                ) : (
                  form.items.map((item, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontSize: '11px', textAlign: 'center' }}>{index + 1}</td>
                      <td style={{ padding: '4px 8px' }}><input type="text" className="form-input" style={sharedStyles.inputStyle} value={item.description} onChange={(e) => updateItem(index, { description: e.target.value })} placeholder="Work description" /></td>
                      <td style={{ padding: '4px 8px' }}><input type="number" className="form-input" style={{ ...sharedStyles.inputStyle, textAlign: 'right' }} value={item.qty || ''} onChange={(e) => updateItem(index, { qty: parseFloat(e.target.value) || 0 })} /></td>
                      <td style={{ padding: '4px 8px' }}>
                        <select className="form-select" style={sharedStyles.inputStyle} value={item.unit} onChange={(e) => updateItem(index, { unit: e.target.value })}>
                          {units.map((u: any) => <option key={u.id || u.unit_name} value={u.unit_name || u}>{u.unit_name || u}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '4px 8px' }}><input type="number" className="form-input" style={{ ...sharedStyles.inputStyle, textAlign: 'right' }} value={item.rate || ''} onChange={(e) => updateItem(index, { rate: parseFloat(e.target.value) || 0 })} /></td>
                      <td style={{ padding: '4px 8px' }}><input type="number" className="form-input" style={{ ...sharedStyles.inputStyle, textAlign: 'right' }} value={item.tax_percent || ''} onChange={(e) => updateItem(index, { tax_percent: parseFloat(e.target.value) || 0 })} /></td>
                      <td style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, textAlign: 'right' }}>{formatCurrency(item.total || 0)}</td>
                      <td style={{ padding: '8px' }}><button type="button" onClick={() => removeItem(index)} style={{ padding: '4px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><Trash2 size={14} /></button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Summary Footer ──────────────────────────────────── */}
        <SummaryFooter
          rows={[
            { label: 'Subtotal', value: totals.subtotal },
            { label: 'Tax', value: totals.taxTotal },
          ]}
          grandTotal={{ label: 'Grand Total', amount: totals.grandTotal }}
        />
      </div>
    </div>
  );
}
