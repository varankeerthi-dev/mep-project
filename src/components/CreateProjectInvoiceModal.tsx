import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { X, AlertTriangle, Link2 } from 'lucide-react';
import { useAuth } from '../App';
import {
  projectTransactionKeys,
  type ProjectInvoice,
  type ProjectPO,
} from '../hooks/useProjectTransactions';

type Mode = 'create' | 'edit';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  mode: Mode;
  projectId: string;
  pos: ProjectPO[];
  invoice?: ProjectInvoice | null;
  defaultPoId?: string | null;
  onSaved?: (invoice: ProjectInvoice) => void;
};

type FormState = {
  invoice_number: string;
  invoice_date: string;
  po_id: string;
  invoice_amount: string;
  tax_amount: string;
  status: 'Pending' | 'Partially Paid' | 'Paid' | 'Cancelled';
  remarks: string;
};

const STATUS_OPTIONS: FormState['status'][] = ['Pending', 'Partially Paid', 'Paid', 'Cancelled'];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function makeEmptyForm(poId = ''): FormState {
  return {
    invoice_number: '',
    invoice_date: todayISO(),
    po_id: poId,
    invoice_amount: '',
    tax_amount: '0',
    status: 'Pending',
    remarks: '',
  };
}

function invoiceToForm(inv: ProjectInvoice): FormState {
  return {
    invoice_number: inv.invoice_number ?? '',
    invoice_date: inv.invoice_date ?? todayISO(),
    po_id: inv.po_id ?? '',
    invoice_amount: inv.invoice_amount != null ? String(inv.invoice_amount) : '',
    tax_amount: inv.tax_amount != null ? String(inv.tax_amount) : '0',
    status: (inv.status as FormState['status']) ?? 'Pending',
    remarks: inv.remarks ?? '',
  };
}

async function generateNextInvoiceNumber(projectId: string): Promise<string> {
  const { data, error } = await supabase
    .from('project_invoices')
    .select('invoice_number')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    console.warn('Could not fetch existing invoice numbers:', error);
    return `INV-${Date.now().toString().slice(-6)}`;
  }

  const used = new Set<string>((data ?? []).map(r => r.invoice_number).filter(Boolean));
  for (let i = 1; i < 10000; i++) {
    const candidate = `INV-${String(i).padStart(4, '0')}`;
    if (!used.has(candidate)) return candidate;
  }
  return `INV-${Date.now().toString().slice(-6)}`;
}

export default function CreateProjectInvoiceModal({
  isOpen,
  onClose,
  mode,
  projectId,
  pos,
  invoice,
  defaultPoId,
  onSaved,
}: Props) {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(() => makeEmptyForm(defaultPoId ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [overInvoiceWarning, setOverInvoiceWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'edit' && invoice) {
      setForm(invoiceToForm(invoice));
    } else {
      setForm(makeEmptyForm(defaultPoId ?? ''));
      if (mode === 'create') {
        generateNextInvoiceNumber(projectId).then(num => {
          setForm(prev => ({ ...prev, invoice_number: num }));
        }).catch(() => {});
      }
    }
    setError(null);
    setOverInvoiceWarning(null);
  }, [isOpen, mode, invoice, defaultPoId, projectId]);

  const totalAmount = useMemo(() => {
    const base = parseFloat(form.invoice_amount) || 0;
    const tax = parseFloat(form.tax_amount) || 0;
    return base + tax;
  }, [form.invoice_amount, form.tax_amount]);

  const selectedPO = useMemo(
    () => pos.find(p => p.id === form.po_id) ?? null,
    [pos, form.po_id],
  );

  useEffect(() => {
    if (!selectedPO) {
      setOverInvoiceWarning(null);
      return;
    }
    const poTotal = Number(selectedPO.po_total_value) || 0;
    const currentUtilized = Number(selectedPO.po_utilized_value) || 0;
    const available = poTotal - currentUtilized;
    if (mode === 'create' && totalAmount > available) {
      setOverInvoiceWarning(
        `Invoice total ${formatINR(totalAmount)} exceeds PO available ${formatINR(available)}. The trigger will clamp the utilization to the PO total.`,
      );
    } else if (mode === 'edit' && invoice) {
      const prior = Number(invoice.total_amount) || 0;
      const projected = currentUtilized - prior + totalAmount;
      if (projected > poTotal) {
        setOverInvoiceWarning(
          `After this edit, PO utilized would be ${formatINR(projected)}, exceeding PO total ${formatINR(poTotal)}.`,
        );
      } else {
        setOverInvoiceWarning(null);
      }
    } else {
      setOverInvoiceWarning(null);
    }
  }, [selectedPO, totalAmount, mode, invoice]);

  const save = useMutation({
    mutationFn: async () => {
      if (!organisation?.id) throw new Error('No active organisation');
      if (!form.invoice_number.trim()) throw new Error('Invoice number is required');
      if (!form.invoice_date) throw new Error('Invoice date is required');
      const base = parseFloat(form.invoice_amount);
      if (!Number.isFinite(base) || base < 0) throw new Error('Invoice amount must be a non-negative number');
      const tax = parseFloat(form.tax_amount);
      if (!Number.isFinite(tax) || tax < 0) throw new Error('Tax amount must be a non-negative number');

      const payload = {
        project_id: projectId,
        organisation_id: organisation.id,
        invoice_number: form.invoice_number.trim(),
        invoice_date: form.invoice_date,
        invoice_amount: base,
        tax_amount: tax,
        total_amount: base + tax,
        status: form.status,
        remarks: form.remarks.trim() || null,
        po_id: form.po_id || null,
      };

      if (mode === 'create') {
        const { data, error } = await supabase
          .from('project_invoices')
          .insert(payload)
          .select('*')
          .single();
        if (error) throw error;
        return data as ProjectInvoice;
      }

      if (!invoice?.id) throw new Error('Missing invoice id for edit');
      const { data, error } = await supabase
        .from('project_invoices')
        .update(payload)
        .eq('id', invoice.id)
        .select('*')
        .single();
      if (error) throw error;
      return data as ProjectInvoice;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: projectTransactionKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: ['project-details', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects', organisation?.id] });
      onSaved?.(saved);
      onClose();
    },
    onError: (e: Error) => {
      setError(e.message);
    },
  });

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '0.75rem',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>
              {mode === 'create' ? 'Create Invoice' : 'Edit Invoice'}
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
              Link the invoice to a Purchase Order to track PO utilization automatically.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0.25rem',
              cursor: 'pointer',
              color: '#64748b',
              borderRadius: '0.375rem',
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            save.mutate();
          }}
          style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Field label="Invoice Number" required>
              <input
                value={form.invoice_number}
                onChange={(e) => setForm(s => ({ ...s, invoice_number: e.target.value }))}
                required
                style={inputStyle}
              />
            </Field>
            <Field label="Invoice Date" required>
              <input
                type="date"
                value={form.invoice_date}
                onChange={(e) => setForm(s => ({ ...s, invoice_date: e.target.value }))}
                required
                style={inputStyle}
              />
            </Field>
          </div>

          <Field
            label={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <Link2 size={12} /> Linked Purchase Order
              </span>
            }
            hint={
              selectedPO
                ? `PO Value ${formatINR(Number(selectedPO.po_total_value) || 0)} · Available ${formatINR(Number(selectedPO.po_available_value) || 0)}`
                : 'Optional. Linking auto-updates PO utilization.'
            }
          >
            <select
              value={form.po_id}
              onChange={(e) => setForm(s => ({ ...s, po_id: e.target.value }))}
              style={inputStyle}
            >
              <option value="">— No PO / Unlinked —</option>
              {pos.map(po => (
                <option key={po.id} value={po.id}>
                  {po.po_number} · {formatINR(Number(po.po_total_value) || 0)}
                  {po.po_date ? ` · ${po.po_date}` : ''}
                </option>
              ))}
            </select>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Field label="Invoice Amount (₹)" required>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.invoice_amount}
                onChange={(e) => setForm(s => ({ ...s, invoice_amount: e.target.value }))}
                required
                style={inputStyle}
              />
            </Field>
            <Field label="Tax Amount (₹)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.tax_amount}
                onChange={(e) => setForm(s => ({ ...s, tax_amount: e.target.value }))}
                style={inputStyle}
              />
            </Field>
          </div>

          <Field label="Total">
            <div
              style={{
                ...inputStyle,
                background: '#f8fafc',
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 600,
                color: '#0f172a',
              }}
            >
              {formatINR(totalAmount)}
            </div>
          </Field>

          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => setForm(s => ({ ...s, status: e.target.value as FormState['status'] }))}
              style={inputStyle}
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </Field>

          <Field label="Remarks">
            <textarea
              value={form.remarks}
              onChange={(e) => setForm(s => ({ ...s, remarks: e.target.value }))}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>

          {overInvoiceWarning && (
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#92400e',
                padding: '0.625rem 0.75rem',
                borderRadius: '0.5rem',
                fontSize: '0.75rem',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'flex-start',
              }}
            >
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{overInvoiceWarning}</span>
            </div>
          )}

          {error && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '0.625rem 0.75rem',
                borderRadius: '0.5rem',
                fontSize: '0.75rem',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={onClose} style={btnSecondary}>
              Cancel
            </button>
            <button type="submit" disabled={save.isPending} style={btnPrimary}>
              {save.isPending ? 'Saving…' : mode === 'create' ? 'Create Invoice' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.625rem',
  fontSize: '0.8125rem',
  border: '1px solid #d1d5db',
  borderRadius: '0.375rem',
  outline: 'none',
  background: '#fff',
  color: '#0f172a',
};

const btnPrimary: React.CSSProperties = {
  padding: '0.5rem 1rem',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: '0.375rem',
  fontSize: '0.8125rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  padding: '0.5rem 1rem',
  background: '#fff',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: '0.375rem',
  fontSize: '0.8125rem',
  fontWeight: 500,
  cursor: 'pointer',
};

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: React.ReactNode;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: '0.75rem',
          fontWeight: 500,
          color: '#374151',
          marginBottom: '0.25rem',
        }}
      >
        {label}
        {required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {hint && (
        <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '0.25rem' }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);
}
