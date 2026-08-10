import { useState } from 'react';
import { useSubcontractorLedger } from '../../hooks/useSubcontractorLedger';
import type { WorkOrderWithValue } from '../../types/subcontractor';
import { WorkOrderAmendmentModal } from '../../../../components/WorkOrderAmendmentModal';
import { AmendmentApprovalPanel } from '../../../../components/AmendmentApprovalPanel';
import { TDSPaymentPanel } from '../../../../components/TDSPaymentPanel';
import { exportLedgerPDF } from '../../../../utils/exportLedgerPDF';
import { formatCurrency } from '../../../../utils/formatters';
import { useAppDateFormat } from '@/contexts/DateFormatContext';
import { Download, Clock } from 'lucide-react';

interface SubcontractorLedgerProps {
  subcontractorId: string;
  subcontractorName: string;
  onBack?: () => void;
}

export function SubcontractorLedger({ subcontractorId, subcontractorName, onBack }: SubcontractorLedgerProps) {
  const { data, isLoading, error, refetch } = useSubcontractorLedger(subcontractorId);
  const { formatDate } = useAppDateFormat();
  const [selectedWO, setSelectedWO] = useState<string | null>(null);
  const [showAmendmentModal, setShowAmendmentModal] = useState(false);
  const [showAmendmentPanel, setShowAmendmentPanel] = useState(false);
  const [showTDSPanel, setShowTDSPanel] = useState(false);
  const [selectedWorkOrderForAmendment, setSelectedWorkOrderForAmendment] = useState<WorkOrderWithValue | null>(null);

  if (isLoading) {
    return (
      <div className="p-6 text-center" style={{ fontFamily: 'Courier New, monospace' }}>
        <div className="animate-pulse">Loading ledger...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-600" style={{ fontFamily: 'Courier New, monospace' }}>
        Error loading ledger: {error?.message}
        <button onClick={() => refetch()} className="ml-4 px-3 py-1 border border-black">
          Retry
        </button>
      </div>
    );
  }

  const { workOrders, ledger, summary } = data || { workOrders: [], ledger: [], summary: null };

  // Filter ledger by selected work order
  const filteredLedger = selectedWO
    ? ledger.filter(entry => entry.workOrderRef === selectedWO || entry.reference === selectedWO)
    : ledger;

  // Filter work orders for display (parent WOs + their amendments)
  const displayWorkOrders = workOrders.filter(wo => !wo.is_amendment);
  const amendments = workOrders.filter(wo => wo.is_amendment);

  const handleExportPDF = () => {
    if (!summary) return;
    exportLedgerPDF({
      subcontractorName,
      workOrderRef: selectedWO || 'All Work Orders',
      ledger: filteredLedger,
      summary,
      date: new Date().toISOString().split('T')[0]
    });
  };

  const handleCreateAmendment = (wo: WorkOrderWithValue) => {
    setSelectedWorkOrderForAmendment(wo);
    setShowAmendmentModal(true);
  };

  return (
    <div className="ledger-container p-6" style={{ fontFamily: 'Courier New, monospace' }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6 border-b border-black pb-4">
        <div>
          <h2 className="text-xl font-bold">SUBCONTRACTOR LEDGER</h2>
          <p className="text-sm mt-1">{subcontractorName}</p>
        </div>
        <div className="flex gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 border border-black hover:bg-zinc-100"
            >
              Back
            </button>
          )}
          <button
            onClick={handleExportPDF}
            disabled={!summary}
            className="px-4 py-2 border border-black hover:bg-zinc-100 flex items-center gap-2 disabled:opacity-50"
          >
            <Download size={16} />
            Export PDF
          </button>
        </div>
      </div>

      {/* Work Orders Section */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">WORK ORDERS</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAmendmentPanel(!showAmendmentPanel)}
              className="px-3 py-1 border border-black text-sm hover:bg-zinc-100 flex items-center gap-1"
            >
              <Clock size={14} />
              Pending Amendments
            </button>
            <button
              onClick={() => setShowTDSPanel(!showTDSPanel)}
              className="px-3 py-1 border border-black text-sm hover:bg-zinc-100"
            >
              TDS Tracking
            </button>
            {selectedWO && (
              <button
                onClick={() => setSelectedWO(null)}
                className="px-3 py-1 border border-black text-sm bg-zinc-100"
              >
                Show All
              </button>
            )}
          </div>
        </div>

        <table className="ledger-table w-full border border-black">
          <thead>
            <tr className="bg-zinc-100">
              <th className="border border-black p-2 text-left">WO NO</th>
              <th className="border border-black p-2 text-left">DESCRIPTION</th>
              <th className="border border-black p-2 text-right">VALUE</th>
              <th className="border border-black p-2 text-center">STATUS</th>
              <th className="border border-black p-2 text-center">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {displayWorkOrders.map((wo) => {
              const woAmendments = amendments.filter(a => a.parent_work_order_id === wo.id);
              const isSelected = selectedWO === wo.work_order_no;
              
              return (
                <tr
                  key={wo.id}
                  className={`cursor-pointer hover:bg-zinc-50 ${isSelected ? 'ledger-selected-row' : ''}`}
                  onClick={() => setSelectedWO(isSelected ? null : wo.work_order_no)}
                >
                  <td className="border border-black p-2 font-bold">{wo.work_order_no}</td>
                  <td className="border border-black p-2">{wo.work_description}</td>
                  <td className="border border-black p-2 text-right">{formatCurrency(wo.total_amount)}</td>
                  <td className="border border-black p-2 text-center">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                      wo.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {wo.status}
                    </span>
                  </td>
                  <td className="border border-black p-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleCreateAmendment(wo)}
                      className="px-2 py-1 text-xs border border-black hover:bg-zinc-100"
                    >
                      Amend
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Main Ledger Table */}
      <div className="mb-6">
        <h3 className="font-bold text-lg mb-4">TRANSACTIONS</h3>
        <table className="ledger-table w-full border border-black">
          <thead>
            <tr className="bg-zinc-100">
              <th className="border border-black p-2 text-left">DATE</th>
              <th className="border border-black p-2 text-left">TYPE</th>
              <th className="border border-black p-2 text-left">REF</th>
              <th className="border border-black p-2 text-left">WO NO</th>
              <th className="border border-black p-2 text-left">DESCRIPTION</th>
              <th className="border border-black p-2 text-right">DEBIT (DR)</th>
              <th className="border border-black p-2 text-right">CREDIT (CR)</th>
              <th className="border border-black p-2 text-right">BALANCE</th>
            </tr>
          </thead>
          <tbody>
            {filteredLedger.map((entry) => (
              <tr key={entry.id} className="hover:bg-zinc-50">
                <td className="border border-black p-2 whitespace-nowrap">{formatDate(entry.date)}</td>
                <td className="border border-black p-2 font-semibold text-xs">{entry.type}</td>
                <td className="border border-black p-2 font-mono text-xs">{entry.reference}</td>
                <td className="border border-black p-2 font-bold text-xs">{entry.workOrderRef || '-'}</td>
                <td className="border border-black p-2 text-xs max-w-[200px] truncate" title={entry.description}>{entry.description}</td>
                <td className="border border-black p-2 text-right">{entry.debit > 0 ? formatCurrency(entry.debit) : '-'}</td>
                <td className="border border-black p-2 text-right">{entry.credit > 0 ? formatCurrency(entry.credit) : '-'}</td>
                <td className="border border-black p-2 text-right font-bold">{formatCurrency(entry.balance)}</td>
              </tr>
            ))}
            {filteredLedger.length === 0 && (
              <tr>
                <td colSpan={8} className="border border-black p-8 text-center text-zinc-500">
                  No transaction history found for selected criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Box */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border border-black bg-zinc-50">
          <div>
            <span className="block text-xs text-zinc-500">CONTRACT VALUE</span>
            <span className="text-lg font-bold">{formatCurrency(summary.contractValue)}</span>
          </div>
          <div>
            <span className="block text-xs text-zinc-500">TOTAL INVOICED</span>
            <span className="text-lg font-bold">{formatCurrency(summary.totalInvoiced)}</span>
          </div>
          <div>
            <span className="block text-xs text-zinc-500">TOTAL PAID</span>
            <span className="text-lg font-bold text-green-700">{formatCurrency(summary.totalPaid)}</span>
          </div>
          <div>
            <span className="block text-xs text-zinc-500">LEDGER BALANCE</span>
            <span className="text-lg font-bold text-red-700">{formatCurrency(summary.balanceDue)}</span>
          </div>
        </div>
      )}

      {/* Slide-out Panels & Modals */}
      {showAmendmentPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-50">
          <div className="w-full max-w-2xl bg-white h-full overflow-y-auto">
            <AmendmentApprovalPanel
              subcontractorId={subcontractorId}
              onClose={() => {
                setShowAmendmentPanel(false);
                refetch();
              }}
            />
          </div>
        </div>
      )}

      {showTDSPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-50">
          <div className="w-full max-w-2xl bg-white h-full overflow-y-auto">
            <TDSPaymentPanel
              subcontractorId={subcontractorId}
              onClose={() => setShowTDSPanel(false)}
            />
          </div>
        </div>
      )}

      {showAmendmentModal && selectedWorkOrderForAmendment && (
        <WorkOrderAmendmentModal
          workOrder={selectedWorkOrderForAmendment}
          isOpen={showAmendmentModal}
          onClose={() => {
            setShowAmendmentModal(false);
            setSelectedWorkOrderForAmendment(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
export default SubcontractorLedger;
