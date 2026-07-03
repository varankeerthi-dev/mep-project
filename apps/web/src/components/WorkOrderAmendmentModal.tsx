import { useState } from 'react';
import { supabase } from '../supabase';
import { WorkOrderWithValue } from '../hooks/useSubcontractorLedger';
import { X, Save } from 'lucide-react';

interface WorkOrderAmendmentModalProps {
  workOrder: WorkOrderWithValue;
  onClose: () => void;
  onSuccess: () => void;
}

export function WorkOrderAmendmentModal({ workOrder, onClose, onSuccess }: WorkOrderAmendmentModalProps) {
  const [newAmount, setNewAmount] = useState(workOrder.total_amount.toString());
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const currentAmount = workOrder.total_amount;
  const newAmountNum = parseFloat(newAmount) || 0;
  const difference = newAmountNum - currentAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      setError('Reason is required');
      return;
    }

    if (newAmountNum <= 0) {
      setError('New amount must be greater than 0');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Get next amendment number for this work order
      const { data: existingAmendments, error: countError } = await supabase
        .from('subcontractor_work_order_amendments')
        .select('amendment_no')
        .eq('work_order_id', workOrder.id)
        .order('amendment_no', { ascending: false })
        .limit(1);

      if (countError) throw countError;

      const nextAmendmentNo = (existingAmendments?.[0]?.amendment_no || 0) + 1;

      // Create amendment record
      const { error: insertError } = await supabase
        .from('subcontractor_work_order_amendments')
        .insert({
          work_order_id: workOrder.id,
          amendment_no: nextAmendmentNo,
          previous_amount: currentAmount,
          new_amount: newAmountNum,
          difference_amount: difference,
          reason: reason.trim(),
          status: 'Pending'
        });

      if (insertError) throw insertError;

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create amendment');
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
          <h3 className="text-lg font-bold">CREATE WORK ORDER AMENDMENT</h3>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-bold mb-1">Work Order</label>
            <div className="border border-black p-2 bg-zinc-50">
              {workOrder.work_order_no} - {workOrder.work_description}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold mb-1">Current Amount</label>
            <div className="border border-black p-2 bg-zinc-50 text-right">
              ₹ {currentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold mb-1">New Amount *</label>
            <input
              type="number"
              step="0.01"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              className="w-full border border-black p-2 text-right"
              required
            />
          </div>

          <div className="mb-4 p-3 border border-black bg-zinc-50">
            <div className="flex justify-between">
              <span>Difference:</span>
              <span className={difference >= 0 ? 'text-green-600' : 'text-red-600'}>
                {difference >= 0 ? '+' : ''}₹ {difference.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold mb-1">Reason for Amendment *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full border border-black p-2"
              placeholder="e.g., Extra excavation due to hard rock formation"
              required
            />
          </div>

          {error && (
            <div className="mb-4 p-2 border border-red-500 text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-black hover:bg-zinc-100"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 border border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={16} />
              {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
