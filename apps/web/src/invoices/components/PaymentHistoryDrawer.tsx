import { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, ChevronRight, Edit2, Trash2, RotateCcw, Loader2 } from 'lucide-react';
import { useInvoicePayments, useDeletePayment, useRefundPayment } from '../../ledger/hooks';
import { PAYMENT_MODE_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from '../../ledger/schemas';
import type { InvoiceWithRelations } from '../api';
import { formatCurrency, formatDate } from '../ui-utils';

interface PaymentHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  invoice: InvoiceWithRelations;
  onEdit: (payment: {
    id: string;
    receipt_no: string;
    amount: number;
    receipt_date: string;
    payment_mode: string | null;
    reference_no: string | null;
    notes: string | null;
    status: string | null;
  }) => void;
}

export default function PaymentHistoryDrawer({ open, onClose, invoice, onEdit }: PaymentHistoryDrawerProps) {
  const [slideIn, setSlideIn] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const paymentsQuery = useInvoicePayments(invoice.id ?? undefined);
  const deletePayment = useDeletePayment();
  const refundPayment = useRefundPayment();

  const payments = paymentsQuery.data ?? [];
  const totalPaid = payments.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
  const totalDraft = payments.filter((p) => p.status === 'draft').reduce((sum, p) => sum + p.amount, 0);
  const totalRefunded = payments.filter((p) => p.status === 'refunded').reduce((sum, p) => sum + p.amount, 0);

  useEffect(() => {
    if (open) {
      setSlideIn(true);
    } else {
      setSlideIn(false);
      setExpandedId(null);
    }
  }, [open]);

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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment? This action cannot be undone.')) return;
    try {
      await deletePayment.mutateAsync(id);
    } catch (err: any) {
      alert('Failed to delete payment: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleRefund = async (id: string) => {
    if (!confirm('Are you sure you want to refund this payment? This will reverse the ledger entry.')) return;
    try {
      await refundPayment.mutateAsync(id);
    } catch (err: any) {
      alert('Failed to refund payment: ' + (err?.message || 'Unknown error'));
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
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827' }}>
              Payment History
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

          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div style={{ padding: '8px', background: '#d1fae5', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#047857', textTransform: 'uppercase' }}>Paid</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#047857' }}>{formatCurrency(totalPaid)}</div>
            </div>
            <div style={{ padding: '8px', background: '#fef3c7', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#b45309', textTransform: 'uppercase' }}>Draft</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#b45309' }}>{formatCurrency(totalDraft)}</div>
            </div>
            <div style={{ padding: '8px', background: '#fee2e2', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#dc2626', textTransform: 'uppercase' }}>Refunded</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(totalRefunded)}</div>
            </div>
          </div>
        </div>

        {/* Payment List */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {paymentsQuery.isPending ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '13px' }}>Loading payments...</div>
            </div>
          ) : payments.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>No payments recorded</div>
              <div style={{ fontSize: '12px' }}>Click "Record Payment" to add a payment</div>
            </div>
          ) : (
            <div>
              {payments.map((payment) => {
                const isExpanded = expandedId === payment.id;
                const statusColor = PAYMENT_STATUS_COLORS[(payment.status as any) || 'paid'];
                return (
                  <div key={payment.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : payment.id)}
                      style={{
                        padding: '12px 20px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                    >
                      {isExpanded ? <ChevronDown size={16} color="#9ca3af" /> : <ChevronRight size={16} color="#9ca3af" />}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
                            {payment.receipt_no || '—'}
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: statusColor.bg,
                              color: statusColor.color,
                            }}
                          >
                            {PAYMENT_STATUS_LABELS[(payment.status as any) || 'paid']}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>
                          {formatDate(payment.receipt_date)} • {PAYMENT_MODE_LABELS[(payment.payment_mode as any)] || '—'}
                        </div>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                        {formatCurrency(payment.amount)}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: '0 20px 12px 48px' }}>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                          {payment.reference_no && (
                            <div><span style={{ fontWeight: 500 }}>Ref:</span> {payment.reference_no}</div>
                          )}
                          {payment.notes && (
                            <div><span style={{ fontWeight: 500 }}>Notes:</span> {payment.notes}</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit({
                                id: payment.id,
                                receipt_no: payment.receipt_no || '',
                                amount: payment.amount,
                                receipt_date: payment.receipt_date,
                                payment_mode: payment.payment_mode,
                                reference_no: payment.reference_no,
                                notes: payment.notes,
                                status: payment.status,
                              });
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 500,
                              background: '#fff',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              color: '#374151',
                              cursor: 'pointer',
                            }}
                          >
                            <Edit2 size={12} />
                            Edit
                          </button>
                          {payment.status === 'paid' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRefund(payment.id);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                fontSize: '11px',
                                fontWeight: 500,
                                background: '#fff',
                                border: '1px solid #fca5a5',
                                borderRadius: '4px',
                                color: '#dc2626',
                                cursor: 'pointer',
                              }}
                            >
                              <RotateCcw size={12} />
                              Refund
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(payment.id);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 500,
                              background: '#fff',
                              border: '1px solid #fca5a5',
                              borderRadius: '4px',
                              color: '#dc2626',
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
