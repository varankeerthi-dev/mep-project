import { useState } from 'react';
import { usePendingRetentions, useReleaseRetention } from '../hooks/useMeasurementSheets';
import { formatCurrency } from '../utils/formatters';
import { differenceInDays } from 'date-fns';
import { Lock, Unlock, AlertCircle, CheckCircle, Save, X } from 'lucide-react';

interface RetentionReleasePanelProps {
  subcontractorId: string;
}

export function RetentionReleasePanel({ subcontractorId }: RetentionReleasePanelProps) {
  const { data: retentions, isLoading, error, refetch } = usePendingRetentions(subcontractorId);
  const releaseMutation = useReleaseRetention();
  
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [actualReleaseDate, setActualReleaseDate] = useState(() => 
    new Date().toISOString().split('T')[0]
  );

  const handleRelease = async (retentionId: string, workOrderId: string) => {
    if (!paymentReference.trim()) {
      alert('Please enter payment reference');
      return;
    }

    setReleasingId(retentionId);
    try {
      await releaseMutation.mutateAsync({
        retentionId,
        workOrderId,
        paymentReference: paymentReference.trim(),
        actualReleaseDate
      });
      
      setPaymentReference('');
      setReleasingId(null);
      refetch();
    } catch (err) {
      console.error('Error releasing retention:', err);
      alert('Failed to release retention');
      setReleasingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-4" style={{ fontFamily: 'Courier New, monospace' }}>
        <Lock size={20} className="animate-pulse mx-auto mb-2" />
        Loading retention records...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 py-4" style={{ fontFamily: 'Courier New, monospace' }}>
        Error: {error.message}
      </div>
    );
  }

  const today = new Date();

  return (
    <div style={{ fontFamily: 'Courier New, monospace' }}>
      <h4 className="font-bold mb-4 text-sm uppercase tracking-wider border-b border-black pb-2 flex items-center gap-2">
        <Lock size={16} />
        RETENTION MONEY TRACKING
      </h4>

      {retentions && retentions.length > 0 ? (
        <div className="space-y-3">
          {retentions.map((retention: any) => {
            const releaseDate = new Date(retention.scheduled_release_date);
            const daysUntilRelease = differenceInDays(releaseDate, today);
            const isOverdue = daysUntilRelease < 0;
            const isDueSoon = daysUntilRelease >= 0 && daysUntilRelease <= 7;

            return (
              <div
                key={retention.id}
                className={`border p-3 ${
                  isOverdue 
                    ? 'border-red-500 bg-red-50' 
                    : isDueSoon 
                      ? 'border-orange-500 bg-orange-50' 
                      : 'border-black'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold">{retention.subcontractor_work_orders?.work_order_no || 'N/A'}</div>
                    <div className="text-sm text-zinc-600">
                      Retention: {retention.retention_percentage}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">{formatCurrency(retention.retention_amount)}</div>
                    <div className={`text-xs ${
                      isOverdue ? 'text-red-600 font-bold' : isDueSoon ? 'text-orange-600' : 'text-zinc-500'
                    }`}>
                      {isOverdue 
                        ? `Overdue by ${Math.abs(daysUntilRelease)} days` 
                        : isDueSoon 
                          ? `Due in ${daysUntilRelease} days`
                          : `Release: ${retention.scheduled_release_date}`
                      }
                    </div>
                  </div>
                </div>

                {retention.notes && (
                  <div className="text-sm text-zinc-600 mb-2 border-t border-zinc-300 pt-2">
                    {retention.notes}
                  </div>
                )}

                {releasingId === retention.id ? (
                  <div className="mt-3 space-y-2 border-t border-zinc-300 pt-3">
                    <div>
                      <label className="block text-xs font-bold mb-1">Payment Reference *</label>
                      <input
                        type="text"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder="e.g., CHQ-9999 or NEFT-12345"
                        className="w-full border border-black p-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">Release Date</label>
                      <input
                        type="date"
                        value={actualReleaseDate}
                        onChange={(e) => setActualReleaseDate(e.target.value)}
                        className="w-full border border-black p-2 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRelease(retention.id, retention.work_order_id)}
                        className="flex-1 px-3 py-2 bg-green-600 text-white text-sm border border-black hover:bg-green-700 flex items-center justify-center gap-1"
                      >
                        <Unlock size={14} />
                        Confirm Release
                      </button>
                      <button
                        onClick={() => {
                          setReleasingId(null);
                          setPaymentReference('');
                        }}
                        className="px-3 py-2 border border-black text-sm hover:bg-zinc-100"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setReleasingId(retention.id)}
                    disabled={releaseMutation.isPending}
                    className="mt-2 w-full px-3 py-2 border border-green-500 text-green-600 hover:bg-green-50 text-sm flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <Unlock size={14} />
                    {isOverdue ? 'Release Now (Overdue)' : 'Release Retention'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 border border-dashed border-zinc-300 text-zinc-500">
          <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
          <p className="text-sm">No retention money held</p>
          <p className="text-xs mt-1">All retentions have been released</p>
        </div>
      )}
    </div>
  );
}
