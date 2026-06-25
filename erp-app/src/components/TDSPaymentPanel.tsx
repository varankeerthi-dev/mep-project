import { useState } from 'react';
import { useTDSPayments } from '../hooks/useSubcontractorLedger';
import { supabase } from '../supabase';
import { formatCurrency } from '../utils/formatters';
import { CheckCircle, Clock, FileText } from 'lucide-react';

interface TDSPaymentPanelProps {
  subcontractorId: string;
}

export function TDSPaymentPanel({ subcontractorId }: TDSPaymentPanelProps) {
  const { data: tdsPayments, isLoading, error, refetch } = useTDSPayments(subcontractorId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [challanNo, setChallanNo] = useState('');
  const [challanDate, setChallanDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleMarkAsPaid = async (tdsPaymentId: string) => {
    if (!challanNo.trim() || !challanDate) {
      alert('Please enter challan number and date');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('subcontractor_tds_payments')
        .update({
          challan_no: challanNo.trim(),
          challan_date: challanDate,
          status: 'Paid'
        })
        .eq('id', tdsPaymentId);

      if (error) throw error;

      setEditingId(null);
      setChallanNo('');
      setChallanDate('');
      refetch();
    } catch (err) {
      console.error('Error marking TDS as paid:', err);
      alert('Failed to update TDS payment');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-4" style={{ fontFamily: 'Courier New, monospace' }}>
        <Clock size={20} className="animate-spin mx-auto mb-2" />
        Loading TDS payments...
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

  // Group by quarter
  const groupedByQuarter: Record<string, typeof tdsPayments> = {};
  tdsPayments?.forEach((payment: any) => {
    const quarter = payment.quarter || 'Unknown';
    if (!groupedByQuarter[quarter]) {
      groupedByQuarter[quarter] = [];
    }
    groupedByQuarter[quarter].push(payment);
  });

  return (
    <div style={{ fontFamily: 'Courier New, monospace' }}>
      <h4 className="font-bold mb-4 text-sm uppercase tracking-wider border-b border-black pb-2">
        TDS Payment Tracking
      </h4>

      {(!tdsPayments || tdsPayments.length === 0) ? (
        <div className="text-zinc-500 py-4 text-center">
          <FileText size={24} className="mx-auto mb-2 text-zinc-300" />
          No TDS payments recorded
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByQuarter).map(([quarter, payments]) => {
            const pendingTotal = payments?.filter((p: any) => p.status === 'Pending').reduce((sum: number, p: any) => sum + (p.tds_amount || 0), 0) || 0;
            const paidTotal = payments?.filter((p: any) => p.status === 'Paid').reduce((sum: number, p: any) => sum + (p.tds_amount || 0), 0) || 0;

            return (
              <div key={quarter} className="border border-black">
                <div className="bg-zinc-100 p-2 border-b border-black flex justify-between items-center">
                  <span className="font-bold">{quarter}</span>
                  <div className="text-xs">
                    <span className="mr-3">Pending: {formatCurrency(pendingTotal)}</span>
                    <span>Paid: {formatCurrency(paidTotal)}</span>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-50">
                      <th className="border border-black p-1">Date</th>
                      <th className="border border-black p-1">TDS Amount</th>
                      <th className="border border-black p-1">Status</th>
                      <th className="border border-black p-1">Challan</th>
                      <th className="border border-black p-1">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments?.map((payment: any) => (
                      <tr key={payment.id}>
                        <td className="border border-black p-1 text-center">
                          {new Date(payment.created_at).toLocaleDateString('en-IN')}
                        </td>
                        <td className="border border-black p-1 text-right">
                          {formatCurrency(payment.tds_amount)}
                        </td>
                        <td className="border border-black p-1 text-center">
                          <span className={`text-xs px-2 py-0.5 border ${
                            payment.status === 'Paid' 
                              ? 'border-green-500 text-green-600' 
                              : 'border-orange-500 text-orange-600'
                          }`}>
                            {payment.status}
                          </span>
                        </td>
                        <td className="border border-black p-1 text-center">
                          {payment.challan_no ? (
                            <div className="text-xs">
                              <div>{payment.challan_no}</div>
                              <div className="text-zinc-500">{payment.challan_date}</div>
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="border border-black p-1 text-center">
                          {payment.status === 'Pending' && (
                            editingId === payment.id ? (
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  placeholder="Challan No"
                                  value={challanNo}
                                  onChange={(e) => setChallanNo(e.target.value)}
                                  className="w-full border border-black p-1 text-xs"
                                />
                                <input
                                  type="date"
                                  value={challanDate}
                                  onChange={(e) => setChallanDate(e.target.value)}
                                  className="w-full border border-black p-1 text-xs"
                                />
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleMarkAsPaid(payment.id)}
                                    disabled={isSaving}
                                    className="flex-1 px-2 py-1 bg-green-600 text-white text-xs border border-black disabled:opacity-50"
                                  >
                                    {isSaving ? '...' : 'Save'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingId(null);
                                      setChallanNo('');
                                      setChallanDate('');
                                    }}
                                    className="px-2 py-1 border border-black text-xs"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingId(payment.id)}
                                className="px-2 py-1 border border-green-500 text-green-600 hover:bg-green-50 text-xs flex items-center gap-1"
                              >
                                <CheckCircle size={12} />
                                Mark Paid
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
