import { useState } from 'react';
import { usePendingAmendments } from '../hooks/useSubcontractorLedger';
import { supabase } from '../supabase';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

interface AmendmentApprovalPanelProps {
  subcontractorId: string;
  onApprove: () => void;
}

export function AmendmentApprovalPanel({ subcontractorId, onApprove }: AmendmentApprovalPanelProps) {
  const { data: amendments, isLoading, error, refetch } = usePendingAmendments(subcontractorId);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleApprove = async (amendmentId: string, workOrderId: string, newAmount: number, difference: number) => {
    setProcessingId(amendmentId);
    
    try {
      // Update amendment status
      const { error: amdError } = await supabase
        .from('subcontractor_work_order_amendments')
        .update({ 
          status: 'Approved',
          approved_at: new Date().toISOString()
        })
        .eq('id', amendmentId);

      if (amdError) throw amdError;

      // Update work order total_amount
      const { error: woError } = await supabase
        .from('subcontractor_work_orders')
        .update({ 
          total_amount: newAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', workOrderId);

      if (woError) throw woError;

      refetch();
      onApprove();
    } catch (err) {
      console.error('Error approving amendment:', err);
      alert('Failed to approve amendment');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (amendmentId: string) => {
    setProcessingId(amendmentId);
    
    try {
      const { error } = await supabase
        .from('subcontractor_work_order_amendments')
        .update({ status: 'Rejected' })
        .eq('id', amendmentId);

      if (error) throw error;

      refetch();
    } catch (err) {
      console.error('Error rejecting amendment:', err);
      alert('Failed to reject amendment');
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-4" style={{ fontFamily: 'Courier New, monospace' }}>
        <Clock size={20} className="animate-spin mx-auto mb-2" />
        Loading pending amendments...
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

  if (!amendments || amendments.length === 0) {
    return (
      <div className="text-gray-500 py-4 text-center" style={{ fontFamily: 'Courier New, monospace' }}>
        <CheckCircle size={24} className="mx-auto mb-2 text-green-500" />
        No pending amendments
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Courier New, monospace' }}>
      <h4 className="font-bold mb-4 text-sm uppercase tracking-wider border-b border-black pb-2">
        Pending Amendments ({amendments.length})
      </h4>
      
      <table className="w-full border border-black text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black p-2 text-left">AMD NO</th>
            <th className="border border-black p-2 text-left">WO REF</th>
            <th className="border border-black p-2 text-right">PREVIOUS</th>
            <th className="border border-black p-2 text-right">NEW</th>
            <th className="border border-black p-2 text-right">DIFF</th>
            <th className="border border-black p-2 text-left">REASON</th>
            <th className="border border-black p-2 text-center">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {amendments.map((amd: any) => (
            <tr key={amd.id}>
              <td className="border border-black p-2 font-bold">
                AMD-{String(amd.amendment_no).padStart(3, '0')}
              </td>
              <td className="border border-black p-2">
                {amd.subcontractor_work_orders?.work_order_no || 'N/A'}
              </td>
              <td className="border border-black p-2 text-right">
                {formatCurrency(amd.previous_amount)}
              </td>
              <td className="border border-black p-2 text-right font-bold">
                {formatCurrency(amd.new_amount)}
              </td>
              <td className={`border border-black p-2 text-right ${amd.difference_amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {amd.difference_amount >= 0 ? '+' : ''}{formatCurrency(amd.difference_amount)}
              </td>
              <td className="border border-black p-2 max-w-xs truncate" title={amd.reason}>
                {amd.reason}
              </td>
              <td className="border border-black p-2 text-center">
                <div className="flex gap-1 justify-center">
                  <button
                    onClick={() => handleApprove(amd.id, amd.work_order_id, amd.new_amount, amd.difference_amount)}
                    disabled={processingId === amd.id}
                    className="px-2 py-1 border border-green-500 text-green-600 hover:bg-green-50 text-xs flex items-center gap-1 disabled:opacity-50"
                  >
                    <CheckCircle size={12} />
                    {processingId === amd.id ? '...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleReject(amd.id)}
                    disabled={processingId === amd.id}
                    className="px-2 py-1 border border-red-500 text-red-600 hover:bg-red-50 text-xs flex items-center gap-1 disabled:opacity-50"
                  >
                    <XCircle size={12} />
                    Reject
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
