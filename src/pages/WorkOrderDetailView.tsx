import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { MeasurementSheetList } from '../components/MeasurementSheetList';
import { SpreadsheetMeasurementSheet } from '../components/SpreadsheetMeasurementSheet';
import { FinalPaymentModal } from '../components/FinalPaymentModal';
import { useSubcontractorLedger } from '../hooks/useSubcontractorLedger';
import { useMeasurementSheets } from '../hooks/useMeasurementSheets';
import { formatCurrency } from '../utils/formatters';
import { ArrowLeft, FileText, Ruler, DollarSign, History, Plus, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface WorkOrderDetailViewProps {
  workOrderId: string;
  onBack: () => void;
}

type TabType = 'details' | 'measurements' | 'payments' | 'ledger';

export function WorkOrderDetailView({ workOrderId, onBack }: WorkOrderDetailViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [showFinalPaymentModal, setShowFinalPaymentModal] = useState(false);
  const queryClient = useQueryClient();

  // Fetch work order details
  const { data: workOrder, isLoading: woLoading } = useQuery({
    queryKey: ['work-order-detail', workOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subcontractor_work_orders')
        .select(`
          *,
          subcontractors(id, company_name, contact_person, phone, email)
        `)
        .eq('id', workOrderId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!workOrderId
  });

  // Fetch measurement sheets
  const { data: measurementSheets } = useMeasurementSheets(workOrderId);

  // Fetch payments for this work order
  const { data: payments } = useQuery({
    queryKey: ['work-order-payments', workOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subcontractor_payments')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!workOrderId
  });

  // Calculate totals
  const totalPaid = payments?.reduce((sum, p) => sum + (parseFloat(p.gross_amount || p.amount) || 0), 0) || 0;
  const totalTDS = payments?.reduce((sum, p) => sum + (parseFloat(p.tds_amount) || 0), 0) || 0;
  const contractValue = parseFloat(workOrder?.total_amount) || 0;
  const balanceDue = contractValue - totalPaid;
  const measurementsCount = measurementSheets?.length || 0;

  // Generate WO PDF
  const handleDownloadPDF = () => {
    if (!workOrder) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(16);
    doc.text('WORK ORDER', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`WO No: ${workOrder.work_order_no}`, 20, 35);
    doc.text(`Date: ${workOrder.issue_date}`, 20, 42);
    doc.text(`Sub-contractor: ${workOrder.subcontractors?.company_name || '-'}`, 20, 49);
    doc.text(`Site: ${workOrder.site_location || '-'}`, 20, 56);
    
    const lineItems = workOrder.line_items || [];
    const tableData = lineItems.map((item: any, idx: number) => [
      idx + 1,
      item.description,
      item.quantity,
      item.unit,
      item.rate?.toFixed(2),
      item.amount?.toFixed(2),
    ]);
    
    autoTable(doc, {
      startY: 65,
      head: [['S.No', 'Description', 'Qty', 'Unit', 'Rate', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 64, 86] },
    });
    
    const finalY = (doc as any).lastAutoTable?.finalY || 120;
    doc.text(`Subtotal: ₹${workOrder.subtotal?.toFixed(2)}`, 150, finalY + 10);
    doc.text(`CGST (${workOrder.cgst_percent}%): ₹${workOrder.cgst_amount?.toFixed(2)}`, 150, finalY + 17);
    doc.text(`SGST (${workOrder.sgst_percent}%): ₹${workOrder.sgst_amount?.toFixed(2)}`, 150, finalY + 24);
    doc.text(`Total: ₹${workOrder.total_amount?.toFixed(2)}`, 150, finalY + 31);
    
    doc.save(`Work_Order_${workOrder.work_order_no}.pdf`);
  };

  if (woLoading) {
    return (
      <div className="p-6 text-center" style={{ fontFamily: 'Courier New, monospace' }}>
        <div className="animate-pulse">Loading work order...</div>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="p-6 text-center text-red-600" style={{ fontFamily: 'Courier New, monospace' }}>
        Work order not found
        <button onClick={onBack} className="ml-4 px-3 py-1 border border-black">Go Back</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'Courier New, monospace' }}>
      {/* Header */}
      <div className="sticky top-0 bg-white border-b-2 border-black px-6 py-4 z-50">
        <div className="flex justify-between items-start">
          <div>
            <button
              onClick={onBack}
              className="mb-2 flex items-center gap-1 text-sm hover:underline text-gray-600"
            >
              <ArrowLeft size={16} /> Back to Work Orders
            </button>
            <h1 className="text-2xl font-bold">{workOrder.work_order_no}</h1>
            <p className="text-sm text-gray-600 mt-1">{workOrder.work_description}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{formatCurrency(contractValue)}</div>
            <div className="text-sm text-gray-600">Contract Value</div>
            <button
              onClick={handleDownloadPDF}
              className="mt-2 px-3 py-1 border border-black text-sm hover:bg-gray-100 flex items-center gap-1"
            >
              <Download size={14} /> Export PDF
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="border border-black p-4 bg-white">
            <div className="text-xs uppercase text-gray-600 mb-1">Status</div>
            <div className="font-bold text-lg">{workOrder.status}</div>
            <div className="text-xs text-gray-500 mt-1">
              {workOrder.start_date && `Start: ${workOrder.start_date}`}
            </div>
          </div>
          <div className="border border-black p-4 bg-white">
            <div className="text-xs uppercase text-gray-600 mb-1">Total Paid</div>
            <div className="font-bold text-lg text-green-600">{formatCurrency(totalPaid)}</div>
            <div className="text-xs text-gray-500 mt-1">
              {payments?.length || 0} payments
            </div>
          </div>
          <div className="border border-black p-4 bg-white">
            <div className="text-xs uppercase text-gray-600 mb-1">Balance Due</div>
            <div className={`font-bold text-lg ${balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(balanceDue)}
            </div>
            {totalTDS > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                TDS: {formatCurrency(totalTDS)}
              </div>
            )}
          </div>
          <div className="border border-black p-4 bg-white">
            <div className="text-xs uppercase text-gray-600 mb-1">Measurements</div>
            <div className="font-bold text-lg">{measurementsCount}</div>
            <div className="text-xs text-gray-500 mt-1">
              {measurementSheets?.filter((s: any) => s.status === 'Approved').length || 0} approved
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mb-4">
          {balanceDue > 0 && workOrder.status !== 'Completed' && (
            <button
              onClick={() => setShowFinalPaymentModal(true)}
              className="px-4 py-2 border-2 border-green-600 text-green-600 hover:bg-green-50 font-bold"
 >
              <DollarSign size={16} className="inline mr-1" />
              Make Payment - {formatCurrency(balanceDue)}
            </button>
          )}
          <button
            onClick={() => {
              setActiveTab('measurements');
              setShowMeasurementModal(true);
            }}
            className="px-4 py-2 border border-black hover:bg-gray-100 flex items-center gap-1"
          >
            <Plus size={16} />
            Create Measurement Sheet
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b-2 border-black mb-4">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-6 py-3 flex items-center gap-2 ${activeTab === 'details' ? 'border-b-2 border-black font-bold bg-gray-50' : 'text-gray-600'}`}
          >
            <FileText size={16} /> Details
          </button>
          <button
            onClick={() => setActiveTab('measurements')}
            className={`px-6 py-3 flex items-center gap-2 ${activeTab === 'measurements' ? 'border-b-2 border-black font-bold bg-gray-50' : 'text-gray-600'}`}
          >
            <Ruler size={16} /> Measurements
            {measurementsCount > 0 && (
              <span className="bg-black text-white text-xs px-2 py-0.5 rounded-full ml-1">
                {measurementsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-6 py-3 flex items-center gap-2 ${activeTab === 'payments' ? 'border-b-2 border-black font-bold bg-gray-50' : 'text-gray-600'}`}
          >
            <DollarSign size={16} /> Payments
            {payments && payments.length > 0 && (
              <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full ml-1">
                {payments.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-6 py-3 flex items-center gap-2 ${activeTab === 'ledger' ? 'border-b-2 border-black font-bold bg-gray-50' : 'text-gray-600'}`}
          >
            <History size={16} /> Ledger
          </button>
        </div>

        {/* Tab Content */}
        <div className="border border-black p-6 min-h-[400px]">
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs uppercase text-gray-500 font-bold">Subcontractor</label>
                    <div className="text-lg font-bold">{workOrder.subcontractors?.company_name}</div>
                    <div className="text-sm text-gray-600">
                      {workOrder.subcontractors?.contact_person && `Contact: ${workOrder.subcontractors.contact_person}`}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs uppercase text-gray-500 font-bold">Site Location</label>
                    <div className="text-lg">{workOrder.site_location || '-'}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs uppercase text-gray-500 font-bold">Start Date</label>
                      <div>{workOrder.start_date || '-'}</div>
                    </div>
                    <div>
                      <label className="text-xs uppercase text-gray-500 font-bold">End Date</label>
                      <div>{workOrder.end_date || '-'}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs uppercase text-gray-500 font-bold">Issue Date</label>
                    <div>{workOrder.issue_date}</div>
                  </div>
                  <div>
                    <label className="text-xs uppercase text-gray-500 font-bold">Valid Until</label>
                    <div>{workOrder.valid_until || '-'}</div>
                  </div>
                  <div>
                    <label className="text-xs uppercase text-gray-500 font-bold">Remarks</label>
                    <div className="text-sm">{workOrder.remarks || '-'}</div>
                  </div>
                </div>
              </div>

              {/* Line Items Summary */}
              <div className="border-t-2 border-black pt-4">
                <h3 className="font-bold mb-3">WORK ITEMS</h3>
                <table className="w-full border border-black">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-black p-2 text-left">Description</th>
                      <th className="border border-black p-2 text-center">Qty</th>
                      <th className="border border-black p-2 text-center">Unit</th>
                      <th className="border border-black p-2 text-right">Rate</th>
                      <th className="border border-black p-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(workOrder.line_items || []).map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td className="border border-black p-2">{item.description}</td>
                        <td className="border border-black p-2 text-center">{item.quantity}</td>
                        <td className="border border-black p-2 text-center">{item.unit}</td>
                        <td className="border border-black p-2 text-right">{formatCurrency(item.rate)}</td>
                        <td className="border border-black p-2 text-right">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'measurements' && (
            <MeasurementSheetList
              workOrderId={workOrderId}
              workOrderNo={workOrder.work_order_no}
              currentContractValue={contractValue}
              onCreateNew={() => setShowMeasurementModal(true)}
            />
          )}

          {activeTab === 'payments' && (
            <div>
              {payments && payments.length > 0 ? (
                <table className="w-full border border-black">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-black p-2 text-left">Date</th>
                      <th className="border border-black p-2 text-right">Gross Amount</th>
                      <th className="border border-black p-2 text-right">TDS</th>
                      <th className="border border-black p-2 text-right">Net Amount</th>
                      <th className="border border-black p-2 text-center">Mode</th>
                      <th className="border border-black p-2 text-left">Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment: any) => (
                      <tr key={payment.id}>
                        <td className="border border-black p-2">{payment.payment_date}</td>
                        <td className="border border-black p-2 text-right">{formatCurrency(payment.gross_amount || payment.amount)}</td>
                        <td className="border border-black p-2 text-right">{payment.tds_amount ? formatCurrency(payment.tds_amount) : '-'}</td>
                        <td className="border border-black p-2 text-right font-bold">{formatCurrency(payment.net_amount || payment.amount)}</td>
                        <td className="border border-black p-2 text-center">{payment.payment_mode}</td>
                        <td className="border border-black p-2">{payment.reference_no || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  No payments recorded yet.
                </div>
              )}
            </div>
          )}

          {activeTab === 'ledger' && (
            <div className="text-center py-12 text-gray-500">
              <History size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Full ledger view coming soon.</p>
              <p className="text-sm mt-2">Use the Subcontractor Ledger for complete transaction history.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showMeasurementModal && (
        <SpreadsheetMeasurementSheet
          workOrderId={workOrderId}
          workOrderNo={workOrder.work_order_no}
          workDescription={workOrder.work_description}
          subcontractorName={workOrder.subcontractors?.company_name}
          currentContractValue={contractValue}
          existingSheetsCount={measurementsCount}
          onClose={() => setShowMeasurementModal(false)}
          onSuccess={() => {
            setShowMeasurementModal(false);
            queryClient.invalidateQueries({ queryKey: ['measurement-sheets', workOrderId] });
            queryClient.invalidateQueries({ queryKey: ['work-order-detail', workOrderId] });
          }}
        />
      )}

      {showFinalPaymentModal && (
        <FinalPaymentModal
          workOrderId={workOrderId}
          workOrderNo={workOrder.work_order_no}
          contractValue={contractValue}
          totalPaid={totalPaid}
          balanceDue={balanceDue}
          onClose={() => setShowFinalPaymentModal(false)}
          onSuccess={(retentionData) => {
            setShowFinalPaymentModal(false);
            queryClient.invalidateQueries({ queryKey: ['work-order-payments', workOrderId] });
            queryClient.invalidateQueries({ queryKey: ['work-order-detail', workOrderId] });
            alert(retentionData 
              ? `Payment recorded with retention: ${formatCurrency(retentionData.amount)}` 
              : 'Payment recorded successfully'
            );
          }}
        />
      )}
    </div>
  );
}
