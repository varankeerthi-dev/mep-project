/**
 * MaterialHistoryDrawer — right-side panel opened by the small "Recent" button
 * under a PO line's Rate cell.
 *
 * Shows what this item actually cost before: invoice no, supplier, rate and
 * line amount, grouped under month headers. Read-only; closes with X or
 * backdrop click. Data loads only while open (see poHistory.ts).
 */
import { X, Loader2, History } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import { useMaterialPurchaseHistory, groupHistoryByMonth } from './poHistory';

interface Props {
  orgId: string | null | undefined;
  materialId: string | null;
  materialName: string;
  onClose: () => void;
}

export function MaterialHistoryDrawer({ orgId, materialId, materialName, onClose }: Props) {
  const { data: lines = [], isLoading, isError } = useMaterialPurchaseHistory(orgId, materialId, !!materialId);
  const groups = groupHistoryByMonth(lines);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 10000 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 400, maxWidth: '94vw',
          background: '#fff', boxShadow: '-8px 0 24px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <History size={15} style={{ color: '#2563eb', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Recent purchases
            </h3>
            <p style={{ margin: 0, fontSize: '11px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {materialName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close purchase history"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px', color: '#6b7280' }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '40px 0', color: '#6b7280', fontSize: '12px' }}>
              <Loader2 size={15} className="animate-spin" /> Loading purchase history…
            </div>
          ) : isError ? (
            <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: '12px', color: '#b45309' }}>
              Could not load purchase history. Close and try again.
            </div>
          ) : lines.length === 0 ? (
            <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>
              No previous purchases recorded for this item.
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.label} style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px solid #e5e7eb' }}>
                  {g.label}
                </div>
                {g.lines.map((l, i) => (
                  <div
                    key={`${l.billNumber || l.invoiceNo || 'x'}-${i}`}
                    style={{ padding: '7px 0', borderBottom: '1px solid #f3f4f6', fontSize: '12px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontWeight: 600, color: '#111827' }}>
                        {l.invoiceNo || l.billNumber || '—'}
                      </span>
                      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(l.lineTotal)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '2px', fontSize: '11px', color: '#6b7280' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.vendorName}
                        {l.billDate ? ` · ${new Date(l.billDate).toLocaleDateString('en-IN')}` : ''}
                      </span>
                      <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {l.quantity} {l.unit || ''} @ {formatCurrency(l.rate)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
