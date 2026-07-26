import { useState, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, Clock, FileText } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

interface RevisionSnapshot {
  revision_no: number;
  saved_at: string;
  reason?: string;
  items: any[];
  header?: {
    subtotal?: number;
    total?: number;
    discount_amount?: number;
    discount_percent?: number;
  };
  header_discounts?: Record<string, number>;
  extra_discount_percent?: number;
  extra_discount_amount?: number;
}

interface RevisionHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  revisionHistory: RevisionSnapshot[];
  currentRevisionNo: number;
  currentTotal: number;
  documentNumber: string;
}

/**
 * Modal dialog that displays revision history with a comparison view.
 * Users can select two revisions to compare or view the details of each revision.
 */
export function RevisionHistoryDialog({
  open,
  onClose,
  revisionHistory,
  currentRevisionNo,
  currentTotal,
  documentNumber,
}: RevisionHistoryDialogProps) {
  const [selectedRev, setSelectedRev] = useState<number | null>(null);

  // Combine history + current revision
  const allRevisions = useMemo(() => {
    const list = [
      ...revisionHistory.map((r) => ({
        revision_no: r.revision_no,
        saved_at: r.saved_at,
        total: r.header?.total ?? 0,
        reason: r.reason || '',
      })),
      {
        revision_no: currentRevisionNo,
        saved_at: 'Current',
        total: currentTotal,
        reason: '',
      },
    ];
    return list.sort((a, b) => b.revision_no - a.revision_no);
  }, [revisionHistory, currentRevisionNo, currentTotal]);

  const selectedData = useMemo(() => {
    if (selectedRev === null) return null;
    // Check if it's the current revision
    if (selectedRev === currentRevisionNo) {
      return null; // Current data is shown live, not stored in revision_history
    }
    const snap = revisionHistory.find((r) => r.revision_no === selectedRev);
    return snap || null;
  }, [selectedRev, revisionHistory, currentRevisionNo]);

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
        zIndex: 200,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '600px',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh',
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
            <FileText size={16} style={{ color: '#2563eb' }} />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>
              Revision History — {documentNumber}
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
        <div style={{ padding: '1.25rem', overflow: 'auto', flex: 1 }}>
          {/* Summary bar */}
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              marginBottom: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                fontSize: '0.8125rem',
              }}
            >
              <span style={{ color: '#64748b' }}>Revisions: </span>
              <strong style={{ color: '#1e293b' }}>{currentRevisionNo}</strong>
            </div>
            <div
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                fontSize: '0.8125rem',
              }}
            >
              <span style={{ color: '#64748b' }}>Current Total: </span>
              <strong style={{ color: '#059669' }}>{formatCurrency(currentTotal)}</strong>
            </div>
          </div>

          {/* Revision list */}
          {allRevisions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.875rem' }}>
              No revision history available.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '0 0.25rem',
                  marginBottom: '0.25rem',
                }}
              >
                Version Timeline
              </div>
              {allRevisions.map((rev, idx) => (
                <div
                  key={rev.revision_no}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.625rem 0.75rem',
                    borderRadius: '8px',
                    background:
                      selectedRev === rev.revision_no
                        ? '#eff6ff'
                        : rev.saved_at === 'Current'
                        ? '#f0fdf4'
                        : '#f8fafc',
                    border: `1px solid ${
                      selectedRev === rev.revision_no
                        ? '#bfdbfe'
                        : rev.saved_at === 'Current'
                        ? '#bbf7d0'
                        : '#e2e8f0'
                    }`,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onClick={() =>
                    setSelectedRev(selectedRev === rev.revision_no ? null : rev.revision_no)
                  }
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background:
                        rev.saved_at === 'Current' ? '#d1fae5' : '#dbeafe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Clock
                      size={14}
                      style={{
                        color:
                          rev.saved_at === 'Current' ? '#059669' : '#2563eb',
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        color: '#1e293b',
                      }}
                    >
                      Rev {String(rev.revision_no).padStart(2, '0')}
                      {rev.saved_at === 'Current' ? ' (Current)' : ''}
                    </div>
                    {rev.saved_at !== 'Current' && (
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                        {new Date(rev.saved_at).toLocaleString()}
                      </div>
                    )}
                    {rev.reason && (
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: '#64748b',
                          marginTop: '2px',
                          fontStyle: 'italic',
                        }}
                      >
                        "{rev.reason}"
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      color: '#059669',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatCurrency(rev.total)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Selected revision detail */}
          {selectedRev !== null && selectedData && (
            <div
              style={{
                marginTop: '1rem',
                padding: '0.75rem',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.5rem',
                }}
              >
                Rev {String(selectedData.revision_no).padStart(2, '0')} — Line Items
              </div>
              {selectedData.items && selectedData.items.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {selectedData.items
                    .filter((i: any) => !i.is_header && !i.is_subtotal)
                    .map((item: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.375rem 0',
                          borderBottom: '1px solid #e2e8f0',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              color: '#1e293b',
                              fontWeight: 500,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.description || item.item_name || `Item ${idx + 1}`}
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                            {item.qty} × {formatCurrency(item.rate)}
                          </div>
                        </div>
                        <div style={{ fontWeight: 600, color: '#059669', whiteSpace: 'nowrap' }}>
                          {formatCurrency(item.line_total || item.amount || 0)}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '0.8125rem', textAlign: 'center', padding: '1rem' }}>
                  No items saved in this revision snapshot.
                </div>
              )}
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
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
