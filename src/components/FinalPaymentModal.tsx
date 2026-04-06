import { useState } from 'react';
import { useRetentionTracking, useCreateRetention } from '../hooks/useMeasurementSheets';
import { formatCurrency } from '../utils/formatters';
import { format } from 'date-fns';
import { Lock, Unlock, AlertTriangle, Save, X } from 'lucide-react';

interface FinalPaymentModalProps {
  workOrderId: string;
  workOrderNo: string;
  contractValue: number;
  totalPaid: number;
  balanceDue: number;
  onClose: () => void;
  onSuccess: (retentionData?: { percentage: number; amount: number; releaseDate: string }) => void;
}

export function FinalPaymentModal({
  workOrderId,
  workOrderNo,
  contractValue,
  totalPaid,
  balanceDue,
  onClose,
  onSuccess
}: FinalPaymentModalProps) {
  const { data: existingRetention } = useRetentionTracking(workOrderId);
  const createRetention = useCreateRetention();

  const [applyRetention, setApplyRetention] = useState(false);
  const [retentionPercentage, setRetentionPercentage] = useState(5);
  const [retentionAmount, setRetentionAmount] = useState(balanceDue * 0.05);
  const [releaseDate, setReleaseDate] = useState(() => {
    const sixMonthsLater = new Date();
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
    return sixMonthsLater.toISOString().split('T')[0];
  });
  const [retentionNotes, setRetentionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If retention already exists, show info
  if (existingRetention) {
    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <div
          className="bg-white border border-black p-6 max-w-md w-full mx-4"
          onClick={e => e.stopPropagation()}
          style={{ fontFamily: 'Courier New, monospace' }}
        >
          <div className="flex justify-between items-center mb-4 border-b border-black pb-2">
            <h3 className="text-lg font-bold">RETENTION ALREADY HELD</h3>
            <button onClick={onClose} className="p-1 hover:bg-gray-100">
              <X size={20} />
            </button>
          </div>

          <div className="p-4 border border-black bg-gray-50 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Lock size={20} className="text-orange-600" />
              <span className="font-bold">Retention Money Held</span>
            </div>
            <div className="text-2xl font-bold mb-1">{formatCurrency(existingRetention.retention_amount)}</div>
            <div className="text-sm text-gray-600">
              {existingRetention.retention_percentage}% of contract value
            </div>
            <div className="mt-2 text-sm">
              <strong>Release Date:</strong> {existingRetention.scheduled_release_date}
            </div>
            <div className="mt-1">
              <span className={`text-xs px-2 py-0.5 border ${
                existingRetention.status === 'Held' 
                  ? 'border-orange-500 text-orange-600' 
                  : 'border-green-500 text-green-600'
              }`}>
                {existingRetention.status}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-black hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleRetentionPercentageChange = (value: number) => {
    setRetentionPercentage(value);
    setRetentionAmount(balanceDue * (value / 100));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (applyRetention) {
        await createRetention.mutateAsync({
          workOrderId,
          retentionPercentage,
          retentionAmount,
          scheduledReleaseDate: releaseDate,
          notes: retentionNotes
        });

        onSuccess({
          percentage: retentionPercentage,
          amount: retentionAmount,
          releaseDate
        });
      } else {
        onSuccess();
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to process');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white border border-black p-6 max-w-lg w-full mx-4"
        onClick={e => e.stopPropagation()}
        style={{ fontFamily: 'Courier New, monospace' }}
      >
        <div className="flex justify-between items-center mb-4 border-b border-black pb-2">
          <h3 className="text-lg font-bold">FINAL PAYMENT - {workOrderNo}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Summary */}
          <div className="border border-black p-4 mb-4 bg-gray-50">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-xs uppercase tracking-wider">Contract Value</div>
                <div className="text-lg font-bold">{formatCurrency(contractValue)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider">Total Paid</div>
                <div className="text-lg font-bold">{formatCurrency(totalPaid)}</div>
              </div>
            </div>
            <div className="border-t border-black pt-3">
              <div className="flex justify-between items-center">
                <span className="font-bold">Balance Due:</span>
                <span className="text-xl font-bold">{formatCurrency(balanceDue)}</span>
              </div>
            </div>
          </div>

          {/* Retention Toggle */}
          <div className="mb-4 p-4 border border-black">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={applyRetention}
                onChange={(e) => setApplyRetention(e.target.checked)}
                className="w-5 h-5"
              />
              <span className="font-bold">Apply Retention Money?</span>
            </label>

            {applyRetention && (
              <div className="mt-4 space-y-4">
                <div className="p-3 bg-orange-50 border border-orange-300 flex items-start gap-2">
                  <AlertTriangle size={20} className="text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-orange-800">
                    Retention money will be held until the release date. This amount will be deducted from the final payment.
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-1">Retention %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={retentionPercentage}
                      onChange={(e) => handleRetentionPercentageChange(parseFloat(e.target.value) || 0)}
                      className="w-full border border-black p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Retention Amount</label>
                    <input
                      type="number"
                      value={retentionAmount}
                      onChange={(e) => setRetentionAmount(parseFloat(e.target.value) || 0)}
                      className="w-full border border-black p-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1">Release Date *</label>
                  <input
                    type="date"
                    value={releaseDate}
                    onChange={(e) => setReleaseDate(e.target.value)}
                    className="w-full border border-black p-2"
                    required={applyRetention}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Typically 6 months after work completion (defect liability period)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1">Notes</label>
                  <textarea
                    value={retentionNotes}
                    onChange={(e) => setRetentionNotes(e.target.value)}
                    placeholder="Reason for retention, conditions for release, etc."
                    rows={2}
                    className="w-full border border-black p-2"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Final Calculation */}
          {applyRetention && (
            <div className="border border-black p-4 mb-4">
              <div className="flex justify-between mb-2">
                <span>Balance Due:</span>
                <span className="font-bold">{formatCurrency(balanceDue)}</span>
              </div>
              <div className="flex justify-between mb-2 text-orange-600">
                <span>Less Retention:</span>
                <span className="font-bold">-{formatCurrency(retentionAmount)}</span>
              </div>
              <div className="border-t border-black pt-2 flex justify-between">
                <span className="font-bold">Final Payment:</span>
                <span className="text-xl font-bold">{formatCurrency(balanceDue - retentionAmount)}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-black hover:bg-gray-100"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 border border-black bg-black text-white hover:bg-gray-800 flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={16} />
              {isSubmitting 
                ? 'Processing...' 
                : applyRetention 
                  ? 'Hold Retention & Continue' 
                  : 'Continue without Retention'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
