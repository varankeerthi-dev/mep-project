import { useState, useRef, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface RevisionReasonDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  currentRevisionNo: number;
  documentNumber: string;
}

const SUGGESTED_REASONS = [
  { value: 'rate_updated', label: 'Rate updated as per client approval' },
  { value: 'quantity_revised', label: 'Quantity revised based on site requirement' },
  { value: 'item_added_removed', label: 'Item added / removed' },
  { value: 'discount_changed', label: 'Discount / pricing adjustment' },
  { value: 'tax_gst_updated', label: 'Tax / GST revised' },
  { value: 'client_requested_changes', label: 'Client requested changes' },
  { value: 'correction_error_fix', label: 'Correction of previous error' },
];

/**
 * Modal dialog shown before saving a revision to an existing document.
 * Requires the user to provide a reason for the revision.
 */
export function RevisionReasonDialog({
  open,
  onClose,
  onConfirm,
  currentRevisionNo,
  documentNumber,
}: RevisionReasonDialogProps) {
  const [reason, setReason] = useState('');
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setSelectedSuggestion(null);
      setError('');
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = () => {
    const finalReason = selectedSuggestion === 'other' ? reason : selectedSuggestion || reason;
    if (!finalReason?.trim()) {
      setError('Please provide a reason for this revision.');
      return;
    }
    onConfirm(finalReason.trim());
    setReason('');
    setSelectedSuggestion(null);
    setError('');
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 300,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '480px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={16} style={{ color: '#d97706' }} />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>
              Revision Reason Required
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.25rem' }}>
          <p
            style={{
              margin: '0 0 1rem',
              fontSize: '0.8125rem',
              color: '#64748b',
              lineHeight: 1.5,
            }}
          >
            You are about to create <strong>Rev {String(currentRevisionNo + 1).padStart(2, '0')}</strong>{' '}
            for <strong>{documentNumber}</strong>. Please select or describe the reason
            for this revision.
          </p>

          {/* Suggested reasons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>
              Select a reason:
            </div>
            {SUGGESTED_REASONS.map((sr) => (
              <button
                key={sr.value}
                type="button"
                onClick={() => {
                  setSelectedSuggestion(sr.value);
                  setReason(sr.label);
                  setError('');
                }}
                style={{
                  textAlign: 'left',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  border: `1px solid ${
                    selectedSuggestion === sr.value ? '#2563eb' : '#e2e8f0'
                  }`,
                  background:
                    selectedSuggestion === sr.value ? '#eff6ff' : '#fff',
                  color: '#1e293b',
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {sr.label}
              </button>
            ))}
          </div>

          {/* Or free-form text */}
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.375rem' }}>
            Or type your own:
          </div>
          <textarea
            ref={textareaRef}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setSelectedSuggestion(null);
              setError('');
            }}
            placeholder="e.g., Rate updated as per client email approval dated 25-Jul-2026"
            rows={2}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: `1px solid ${error ? '#ef4444' : '#e2e8f0'}`,
              fontSize: '0.8125rem',
              lineHeight: 1.5,
              resize: 'vertical',
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {error && (
            <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.375rem' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              background: '#fff',
              color: '#64748b',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#1d4ed8';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#2563eb';
            }}
          >
            Save Revision
          </button>
        </div>
      </div>
    </div>
  );
}
