import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface OverbillingReasonData {
  reason: 'client_email_approval' | 'client_verbal_confirmation' | 'site_variation_extra_work' | 'rate_revision_agreed' | 'correction_short_billing' | 'other';
  reference?: string;
  approved_by?: string;
}

const OVERBILLING_REASONS: { value: OverbillingReasonData['reason']; label: string }[] = [
  { value: 'client_email_approval', label: 'Client email approval' },
  { value: 'client_verbal_confirmation', label: 'Client verbal confirmation' },
  { value: 'site_variation_extra_work', label: 'Site variation / extra work' },
  { value: 'rate_revision_agreed', label: 'Rate revision agreed' },
  { value: 'correction_short_billing', label: 'Correction of previous short-billing' },
  { value: 'other', label: 'Other (specify)' },
];

interface OverbillingReasonPanelProps {
  itemId: string;
  originalQty: number;
  originalRate: number;
  billedQty: number;
  enteredQty: number;
  enteredRate: number;
  reasonData?: OverbillingReasonData;
  onChange: (itemId: string, data: OverbillingReasonData) => void;
}

export default function OverbillingReasonPanel({
  itemId,
  originalQty,
  originalRate,
  enteredQty,
  enteredRate,
  reasonData,
  onChange,
}: OverbillingReasonPanelProps) {
  const qtyOverage = enteredQty > originalQty;
  const rateOverage = enteredRate > originalRate;
  const overageQty = Math.max(0, enteredQty - originalQty);
  const rateDiff = Math.max(0, enteredRate - originalRate);

  if (!qtyOverage && !rateOverage) return null;

  return (
    <div style={{
      marginTop: '8px',
      padding: '12px',
      backgroundColor: '#fffbeb',
      border: '1px solid #fde68a',
      borderRadius: '6px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        marginBottom: '10px',
      }}>
        <AlertTriangle size={16} style={{ color: '#d97706', marginTop: '2px', flexShrink: 0 }} />
        <div style={{ fontSize: '12px', color: '#92400e' }}>
          <strong>Over-billing detected</strong>
          {qtyOverage && (
            <div>Quantity exceeds PO by <strong>{overageQty}</strong> (PO: {originalQty}, Billing: {enteredQty})</div>
          )}
          {rateOverage && (
            <div>Rate exceeds PO by <strong>₹{rateDiff}</strong> (PO: ₹{originalRate}, Billing: ₹{enteredRate})</div>
          )}
          <div style={{ marginTop: '4px', color: '#b45309' }}>
            Please provide a reason for this over-billing.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Reason selector */}
        <select
          value={reasonData?.reason ?? ''}
          onChange={(e) => {
            const reason = e.target.value as OverbillingReasonData['reason'];
            onChange(itemId, {
              reason,
              reference: reason === 'other' ? '' : (reasonData?.reference ?? ''),
              approved_by: reasonData?.approved_by,
            });
          }}
          style={{
            width: '100%',
            padding: '6px 10px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#171717',
            backgroundColor: '#fff',
          }}
        >
          <option value="">Select a reason...</option>
          {OVERBILLING_REASONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        {/* Reference field — required when reason is 'other', optional otherwise */}
        {(reasonData?.reason === 'other') && (
          <input
            type="text"
            placeholder="Specify reason (required)"
            value={reasonData?.reference ?? ''}
            onChange={(e) => onChange(itemId, {
              ...reasonData!,
              reference: e.target.value,
            })}
            style={{
              width: '100%',
              padding: '6px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#171717',
              backgroundColor: '#fff',
            }}
          />
        )}

        {/* Optional reference field */}
        {(reasonData?.reason && reasonData?.reason !== 'other') && (
          <input
            type="text"
            placeholder="Reference (e.g. Email dated 15-Jun, Meeting minutes)..."
            value={reasonData?.reference ?? ''}
            onChange={(e) => onChange(itemId, {
              ...reasonData!,
              reference: e.target.value,
            })}
            style={{
              width: '100%',
              padding: '6px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#6b7280',
              backgroundColor: '#fff',
            }}
          />
        )}

        {/* Approved by */}
        <input
          type="text"
          placeholder="Approved by (optional)"
          value={reasonData?.approved_by ?? ''}
          onChange={(e) => onChange(itemId, {
            ...(reasonData ?? { reason: '' as OverbillingReasonData['reason'] }),
            approved_by: e.target.value,
          })}
          style={{
            width: '100%',
            padding: '6px 10px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#6b7280',
            backgroundColor: '#fff',
          }}
        />
      </div>
    </div>
  );
}
