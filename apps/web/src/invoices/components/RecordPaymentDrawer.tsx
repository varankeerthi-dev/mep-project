import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';
import { useRecordPayment, useNextReceiptNo } from '../../ledger/hooks';
import { RecordPaymentSchema, PAYMENT_MODES, PAYMENT_MODE_LABELS } from '../../ledger/schemas';
import type { InvoiceWithRelations } from '../api';
import { formatCurrency } from '../ui-utils';
import { toast } from '../../lib/logger';

interface RecordPaymentDrawerProps {
  open: boolean;
  onClose: () => void;
  invoice: InvoiceWithRelations;
  onSuccess: () => void;
  editPayment?: {
    id: string;
    receipt_no: string;
    amount: number;
    receipt_date: string;
    payment_mode: string | null;
    reference_no: string | null;
    notes: string | null;
    status: string | null;
  } | null;
}

type PaymentFormValues = {
  client_name: string;
  receipt_no: string;
  amount: number;
  receipt_date: string;
  payment_mode: (typeof PAYMENT_MODES)[number];
  reference_no: string;
  notes: string;
  status: 'draft' | 'paid';
};

export default function RecordPaymentDrawer({ open, onClose, invoice, onSuccess, editPayment }: RecordPaymentDrawerProps) {
  const [slideIn, setSlideIn] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const nextReceiptNo = useNextReceiptNo();
  const recordPayment = useRecordPayment();

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(RecordPaymentSchema.omit({ client_id: true, invoice_id: true }).extend({
      client_name: z.string(),
    })),
    defaultValues: {
      client_name: invoice.client?.name || 'Unknown Client',
      receipt_no: editPayment?.receipt_no || '',
      amount: editPayment?.amount || invoice.total || 0,
      receipt_date: editPayment?.receipt_date || new Date().toISOString().split('T')[0],
      payment_mode: (editPayment?.payment_mode as any) || 'bank_transfer',
      reference_no: editPayment?.reference_no || '',
      notes: editPayment?.notes || '',
      status: (editPayment?.status as any) || 'paid',
    },
  });

  useEffect(() => {
    if (open) {
      setSlideIn(true);
      if (!editPayment && nextReceiptNo.data) {
        form.setValue('receipt_no', nextReceiptNo.data);
      }
    } else {
      setSlideIn(false);
    }
  }, [open, editPayment, nextReceiptNo.data, form]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  const onSubmit = async (data: PaymentFormValues, status: 'draft' | 'paid') => {
    const valid = await form.trigger();
    if (!valid) return;

    try {
      await recordPayment.mutateAsync({
        client_id: invoice.client_id,
        invoice_id: invoice.id!,
        receipt_no: data.receipt_no,
        amount: data.amount,
        receipt_date: data.receipt_date,
        payment_mode: data.payment_mode,
        reference_no: data.reference_no || null,
        notes: data.notes || null,
        status,
      });
      form.reset();
      toast.success('Payment recorded successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error recording payment:', err);
      alert('Failed to record payment: ' + (err?.message || 'Unknown error'));
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(0, 0, 0, 0.4)',
        transition: 'opacity 0.3s ease',
        opacity: slideIn ? 1 : 0,
      }}
    >
      <div
        ref={drawerRef}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '420px',
          maxWidth: '100vw',
          background: '#fff',
          boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.1)',
          transform: slideIn ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
        }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827' }}>
            {editPayment ? 'Edit Payment' : 'Record Payment'}
          </h2>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: '#6b7280',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          <form>
            {/* Client Name (readonly) */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Client Name
              </label>
              <input
                type="text"
                value={form.watch('client_name')}
                readOnly
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: '#f9fafb',
                  color: '#6b7280',
                }}
              />
            </div>

            {/* Payment No */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Payment No
              </label>
              <input
                type="text"
                {...form.register('receipt_no')}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: form.formState.errors.receipt_no ? '1px solid #ef4444' : '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
              {form.formState.errors.receipt_no && (
                <span style={{ fontSize: '11px', color: '#ef4444', marginTop: '2px', display: 'block' }}>
                  {form.formState.errors.receipt_no.message}
                </span>
              )}
            </div>

            {/* Amount Received */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Amount Received
              </label>
              <input
                type="number"
                step="0.01"
                {...form.register('amount', { valueAsNumber: true })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: form.formState.errors.amount ? '1px solid #ef4444' : '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
              {form.formState.errors.amount && (
                <span style={{ fontSize: '11px', color: '#ef4444', marginTop: '2px', display: 'block' }}>
                  {form.formState.errors.amount.message}
                </span>
              )}
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                Invoice Total: {formatCurrency(invoice.total)}
              </div>
            </div>

            {/* Payment Date */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Payment Date
              </label>
              <input
                type="date"
                {...form.register('receipt_date')}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: form.formState.errors.receipt_date ? '1px solid #ef4444' : '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
              {form.formState.errors.receipt_date && (
                <span style={{ fontSize: '11px', color: '#ef4444', marginTop: '2px', display: 'block' }}>
                  {form.formState.errors.receipt_date.message}
                </span>
              )}
            </div>

            {/* Payment Mode */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Payment Mode
              </label>
              <select
                {...form.register('payment_mode')}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: form.formState.errors.payment_mode ? '1px solid #ef4444' : '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: '#fff',
                }}
              >
                <option value="">Select mode</option>
                {PAYMENT_MODES.map((mode) => (
                  <option key={mode} value={mode}>{PAYMENT_MODE_LABELS[mode]}</option>
                ))}
              </select>
              {form.formState.errors.payment_mode && (
                <span style={{ fontSize: '11px', color: '#ef4444', marginTop: '2px', display: 'block' }}>
                  {form.formState.errors.payment_mode.message}
                </span>
              )}
            </div>

            {/* Reference No */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Reference No
              </label>
              <input
                type="text"
                {...form.register('reference_no')}
                placeholder="UTR, Cheque No, etc."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Notes
              </label>
              <textarea
                {...form.register('notes')}
                rows={3}
                placeholder="Additional notes..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </form>
        </div>

        {/* Footer Buttons */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: '8px',
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: '#fff',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#374151',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => form.handleSubmit((data) => onSubmit(data, 'draft'))()}
            disabled={recordPayment.isPending}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: '#fff',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#374151',
              cursor: recordPayment.isPending ? 'not-allowed' : 'pointer',
              opacity: recordPayment.isPending ? 0.6 : 1,
            }}
            onMouseEnter={(e) => { if (!recordPayment.isPending) e.currentTarget.style.background = '#f9fafb'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
          >
            {recordPayment.isPending ? <Loader2 className="animate-spin" size={16} /> : 'Save as Draft'}
          </button>
          <button
            type="button"
            onClick={form.handleSubmit((data) => onSubmit(data, 'paid'))}
            disabled={recordPayment.isPending}
            style={{
              flex: 1.5,
              padding: '10px 16px',
              background: '#059669',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#fff',
              cursor: recordPayment.isPending ? 'not-allowed' : 'pointer',
              opacity: recordPayment.isPending ? 0.6 : 1,
            }}
            onMouseEnter={(e) => { if (!recordPayment.isPending) e.currentTarget.style.background = '#047857'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#059669'; }}
          >
            {recordPayment.isPending ? <Loader2 className="animate-spin" size={16} /> : 'Save as Paid'}
          </button>
        </div>
      </div>
    </div>
  );
}
