import { useState } from 'react';
import { useSubcontractorLedger, LedgerEntry, WorkOrderWithValue } from '../hooks/useSubcontractorLedger';
import { WorkOrderAmendmentModal } from './WorkOrderAmendmentModal';
import { AmendmentApprovalPanel } from './AmendmentApprovalPanel';
import { TDSPaymentPanel } from './TDSPaymentPanel';
import { exportLedgerPDF } from '../utils/exportLedgerPDF';
import { formatCurrency } from '../utils/formatters';
import { Download, Plus, FileText, CheckCircle, Clock } from 'lucide-react';

interface SubcontractorLedgerProps {
  subcontractorId: string;
  subcontractorName: string;
  onBack?: () => void;
}

export function SubcontractorLedger({ subcontractorId, subcontractorName, onBack }: SubcontractorLedgerProps) {
  const { data, isLoading, error, refetch } = useSubcontractorLedger(subcontractorId);
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
        Error loading ledger: {error.message}
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
                  <td className="border border-black p-2 text-center">{wo.status}</td>
                  <td className="border border-black p-2 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateAmendment(wo);
                      }}
                      className="px-2 py-1 border border-black text-xs hover:bg-zinc-100 flex items-center gap-1"
                    >
                      <Plus size={12} />
                      Amend
                    </button>
                  </td>
                </tr>
              );
            })}
            
            {/* Amendments as sub-rows */}
            {amendments.map((amd) => {
              const parentWO = workOrders.find(wo => wo.id === amd.parent_work_order_id);
              const isVisible = !selectedWO || selectedWO === parentWO?.work_order_no;
              
              if (!isVisible) return null;
              
              return (
                <tr key={amd.id} className="bg-zinc-50 text-sm">
                  <td className="border border-black p-2 pl-6">
                    └─ AMD-{String(amd.amendment_no).padStart(3, '0')}
                  </td>
                  <td className="border border-black p-2 text-zinc-600">{amd.work_description}</td>
                  <td className="border border-black p-2 text-right">
                    {amd.total_amount > 0 ? '+' : ''}{formatCurrency(amd.total_amount)}
                  </td>
                  <td className="border border-black p-2 text-center text-xs">{amd.status}</td>
                  <td className="border border-black p-2 text-center">-</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Amendment Panel */}
      {showAmendmentPanel && (
        <div className="mb-6 border border-black p-4">
          <AmendmentApprovalPanel
            subcontractorId={subcontractorId}
            onApprove={() => refetch()}
          />
        </div>
      )}

      {/* TDS Panel */}
      {showTDSPanel && (
        <div className="mb-6 border border-black p-4">
          <TDSPaymentPanel
            subcontractorId={subcontractorId}
          />
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="mb-6">
          <h3 className="font-bold mb-4">
            SUMMARY {selectedWO ? `- ${selectedWO}` : '(All Work Orders)'}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="ledger-summary-card border border-black p-4">
              <div className="ledger-summary-label text-xs uppercase tracking-wider">Contract Value</div>
              <div className="ledger-summary-value text-lg font-bold mt-2">
                {formatCurrency(summary.contractValue)}
              </div>
            </div>
            <div className="ledger-summary-card border border-black p-4">
              <div className="ledger-summary-label text-xs uppercase tracking-wider">Total Invoiced</div>
              <div className="ledger-summary-value text-lg font-bold mt-2">
                {formatCurrency(summary.totalInvoiced)}
              </div>
            </div>
            <div className="ledger-summary-card border border-black p-4">
              <div className="ledger-summary-label text-xs uppercase tracking-wider">Total Paid</div>
              <div className="ledger-summary-value text-lg font-bold mt-2">
                {formatCurrency(summary.totalPaid)}
              </div>
            </div>
            <div className="ledger-summary-card border border-black p-4">
              <div className="ledger-summary-label text-xs uppercase tracking-wider">Balance Due</div>
              <div className={`ledger-summary-value text-lg font-bold mt-2 ${summary.balanceDue < 0 ? 'text-red-600' : ''}`}>
                {formatCurrency(summary.balanceDue)}
              </div>
            </div>
          </div>
          {summary.totalTDS > 0 && (
            <div className="mt-4 p-3 border border-black bg-zinc-50">
              <span className="text-sm">Total TDS Deducted: </span>
              <span className="font-bold">{formatCurrency(summary.totalTDS)}</span>
            </div>
          )}
        </div>
      )}

      {/* Ledger Table */}
      <div>
        <h3 className="font-bold mb-4">
          LEDGER {selectedWO ? `- ${selectedWO}` : '(All Transactions)'}
        </h3>
        
        {filteredLedger.length === 0 ? (
          <div className="text-center py-8 border border-black text-zinc-500">
            <FileText size={48} className="mx-auto mb-4 text-zinc-300" />
            <p>No transactions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger-table w-full border border-black">
              <thead>
                <tr className="bg-zinc-100">
                  <th className="border border-black p-2 text-left">DATE</th>
                  <th className="border border-black p-2 text-left">TYPE</th>
                  <th className="border border-black p-2 text-left">REFERENCE</th>
                  <th className="border border-black p-2 text-right">DEBIT</th>
                  <th className="border border-black p-2 text-right">CREDIT</th>
                  <th className="border border-black p-2 text-right">TDS DED</th>
                  <th className="border border-black p-2 text-right">BALANCE</th>
                </tr>
              </thead>
              <tbody>
                {filteredLedger.map((entry, index) => (
                  <tr
                    key={`${entry.id}-${index}`}
                    className={index % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}
                  >
                    <td className="border border-black p-2">{entry.date}</td>
                    <td className="border border-black p-2">
                      <span className={`text-xs px-2 py-1 border ${
                        entry.type === 'WO-ISSUED' ? 'border-blue-500 text-blue-600' :
                        entry.type === 'WO-AMD' ? 'border-orange-500 text-orange-600' :
                        entry.type === 'INVOICE' ? 'border-green-500 text-green-600' :
                        'border-red-500 text-red-600'
                      }`}>
                        {entry.type}
                      </span>
                    </td>
                    <td className="border border-black p-2 font-bold">{entry.reference}</td>
                    <td className="border border-black p-2 text-right ledger-numeric">
                      {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                    </td>
                    <td className="border border-black p-2 text-right ledger-numeric">
                      {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                    </td>
                    <td className="border border-black p-2 text-right ledger-numeric">
                      {entry.tdsAmount > 0 ? formatCurrency(entry.tdsAmount) : '-'}
                    </td>
                    <td className="border border-black p-2 text-right ledger-numeric font-bold">
                      {formatCurrency(entry.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Amendment Modal */}
      {showAmendmentModal && selectedWorkOrderForAmendment && (
        <WorkOrderAmendmentModal
          workOrder={selectedWorkOrderForAmendment}
          onClose={() => {
            setShowAmendmentModal(false);
            setSelectedWorkOrderForAmendment(null);
          }}
          onSuccess={() => {
            refetch();
            setShowAmendmentModal(false);
            setSelectedWorkOrderForAmendment(null);
          }}
        />
      )}
    </div>
  );
}
