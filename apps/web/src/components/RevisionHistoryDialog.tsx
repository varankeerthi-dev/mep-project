import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Clock, FileText, Table2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { QuotationRevisionCompareModal, RevisionSnapshot } from './QuotationRevisionCompareModal';

interface RevisionHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  quotationId?: string;
  revisionHistory: RevisionSnapshot[];
  currentRevisionNo: number;
  currentTotal: number;
  currentItems?: any[];
  currentHeader?: any;
  documentNumber: string;
  onRestoreRevision?: (revision: RevisionSnapshot) => void;
}

/**
 * Modal dialog that displays revision history with a comparison view.
 * Users can select two revisions to compare or view the details of each revision.
 */
export function RevisionHistoryDialog({
  open,
  onClose,
  quotationId,
  revisionHistory,
  currentRevisionNo,
  currentTotal,
  currentItems,
  currentHeader,
  documentNumber,
  onRestoreRevision,
}: RevisionHistoryDialogProps) {
  const [selectedRev, setSelectedRev] = useState<number | null>(null);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Combine history + current revision
  const allRevisions = useMemo(() => {
    const list = [
      ...revisionHistory.map((r) => ({
        revision_no: r.revision_no,
        saved_at: r.saved_at,
        total: r.header?.total ?? r.header?.grand_total ?? 0,
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

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9990,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setShowCompareModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 11px',
                borderRadius: '6px',
                background: '#185FA5',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#0C447C'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#185FA5'; }}
              title="Open full comparison spreadsheet grid"
            >
              <Table2 size={13} /> Compare All Revisions
            </button>
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
              alignItems: 'center',
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
            <button
              type="button"
              onClick={() => setShowCompareModal(true)}
              style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.5rem 0.875rem',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                color: '#1e293b',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
            >
              <Table2 size={14} style={{ color: '#185FA5' }} /> Compare Grid View
            </button>
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
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                }}
              >
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Rev {String(selectedData.revision_no).padStart(2, '0')} — Line Items
                </div>
                {onRestoreRevision && (
                  <button
                    type="button"
                    onClick={() => onRestoreRevision(selectedData)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '5px',
                      background: '#185FA5',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#0C447C'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#185FA5'; }}
                  >
                    Restore Rev {String(selectedData.revision_no).padStart(2, '0')}
                  </button>
                )}
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

      {showCompareModal && (
        <QuotationRevisionCompareModal
          open={showCompareModal}
          onClose={() => setShowCompareModal(false)}
          quotationId={quotationId}
          documentNumber={documentNumber}
          revisionHistory={revisionHistory}
          currentRevisionNo={currentRevisionNo}
          currentItems={currentItems}
          currentTotal={currentTotal}
          currentHeader={currentHeader}
          onRestoreRevision={(rev) => {
            setShowCompareModal(false);
            if (onRestoreRevision) onRestoreRevision(rev);
          }}
        />
      )}
    </div>,
    document.body
  );
}
