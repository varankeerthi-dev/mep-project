import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { MeasurementSheetList } from '../components/MeasurementSheetList';
import { FinalPaymentModal } from '../components/FinalPaymentModal';
import { useMeasurementSheets } from '../hooks/useMeasurementSheets';
import { formatCurrency } from '../utils/formatters';
import { ArrowLeft, FileText, Ruler, DollarSign, History, Plus, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface WorkOrderDetailViewProps {
  onBack?: () => void;
  workOrderId?: string;
  onNavigate?: (path: string) => void;
}

type TabType = 'details' | 'measurements' | 'payments' | 'ledger';

export function WorkOrderDetailView({ onBack, workOrderId: propWorkOrderId, onNavigate }: WorkOrderDetailViewProps) {
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [showFinalPaymentModal, setShowFinalPaymentModal] = useState(false);
  const [workOrderId, setWorkOrderId] = useState<string>(propWorkOrderId || '');
  const queryClient = useQueryClient();

  // Get work order ID from URL on mount (fallback for query param support)
  useEffect(() => {
    if (!propWorkOrderId) {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      if (id) {
        setWorkOrderId(id);
      }
    }
  }, [propWorkOrderId]);

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
      <div className="p-6 text-center" style={{ fontFamily: 'Inter, sans-serif' }}>
        <div className="animate-pulse">Loading work order...</div>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="p-6 text-center text-red-600" style={{ fontFamily: 'Inter, sans-serif' }}>
        Work order not found
        <button onClick={handleBack} className="ml-4 px-3 py-1 border border-black">Go Back</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="sticky top-0 bg-white border-b-2 border-black px-6 py-4 z-50">
        <div className="flex justify-between items-start">
          <div>
            <button
              onClick={handleBack}
              className="mb-2 flex items-center gap-1 text-sm hover:underline text-zinc-600"
            >
              <ArrowLeft size={16} /> Back to Work Orders
            </button>
            <h1 className="text-2xl font-bold">{workOrder.work_order_no}</h1>
            <p className="text-sm text-zinc-600 mt-1">{workOrder.work_description}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{formatCurrency(contractValue)}</div>
            <div className="text-sm text-zinc-600">Contract Value</div>
            <button
              onClick={handleDownloadPDF}
              className="mt-2 px-3 py-1 border border-black text-sm hover:bg-zinc-100 flex items-center gap-1"
            >
              <Download size={14} /> Export PDF
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: '#fff',
            padding: '16px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
              Status
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>{workOrder.status}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              {workOrder.start_date && `Start: ${workOrder.start_date}`}
            </div>
          </div>
          <div style={{
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: '#fff',
            padding: '16px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
              Total Paid
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#16a34a' }}>{formatCurrency(totalPaid)}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              {payments?.length || 0} payments
            </div>
          </div>
          <div style={{
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: '#fff',
            padding: '16px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
              Balance Due
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: balanceDue > 0 ? '#dc2626' : '#16a34a' }}>
              {formatCurrency(balanceDue)}
            </div>
            {totalTDS > 0 && (
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                TDS: {formatCurrency(totalTDS)}
              </div>
            )}
          </div>
          <div style={{
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: '#fff',
            padding: '16px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
              Measurements
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>{measurementsCount}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              {measurementSheets?.filter((s: any) => s.status === 'Approved').length || 0} approved
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {balanceDue > 0 && workOrder.status !== 'Completed' && (
            <button
              onClick={() => setShowFinalPaymentModal(true)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: '#fff',
                color: '#16a34a',
                border: '2px solid #16a34a',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <DollarSign size={16} />
              Make Payment - {formatCurrency(balanceDue)}
            </button>
          )}
          <button
            onClick={() => {
              onNavigate?.(`/subcontractors/workorders/${workOrderId}/create-measurement`);
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: '#0f172a',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={14} />
            Create Measurement
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid #0f172a', marginBottom: '16px' }}>
          <button
            onClick={() => setActiveTab('details')}
            style={{
              padding: '12px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: '500',
              color: activeTab === 'details' ? '#0f172a' : '#64748b',
              background: activeTab === 'details' ? '#f8fafc' : 'transparent',
              borderBottom: activeTab === 'details' ? '2px solid #0f172a' : 'none',
              marginBottom: '-2px',
              cursor: 'pointer',
              borderLeft: 'none',
              borderRight: 'none',
              borderTop: 'none'
            }}
          >
            <FileText size={16} /> Details
          </button>
          <button
            onClick={() => setActiveTab('measurements')}
            style={{
              padding: '12px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: '500',
              color: activeTab === 'measurements' ? '#0f172a' : '#64748b',
              background: activeTab === 'measurements' ? '#f8fafc' : 'transparent',
              borderBottom: activeTab === 'measurements' ? '2px solid #0f172a' : 'none',
              marginBottom: '-2px',
              cursor: 'pointer',
              borderLeft: 'none',
              borderRight: 'none',
              borderTop: 'none'
            }}
          >
            <Ruler size={16} /> Measurements
            {measurementsCount > 0 && (
              <span style={{
                background: '#0f172a',
                color: '#fff',
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '9999px',
                marginLeft: '4px'
              }}>
                {measurementsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            style={{
              padding: '12px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: '500',
              color: activeTab === 'payments' ? '#0f172a' : '#64748b',
              background: activeTab === 'payments' ? '#f8fafc' : 'transparent',
              borderBottom: activeTab === 'payments' ? '2px solid #0f172a' : 'none',
              marginBottom: '-2px',
              cursor: 'pointer',
              borderLeft: 'none',
              borderRight: 'none',
              borderTop: 'none'
            }}
          >
            <DollarSign size={16} /> Payments
            {payments && payments.length > 0 && (
              <span style={{
                background: '#e2e8f0',
                color: '#475569',
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '9999px',
                marginLeft: '4px'
              }}>
                {payments.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            style={{
              padding: '12px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: '500',
              color: activeTab === 'ledger' ? '#0f172a' : '#64748b',
              background: activeTab === 'ledger' ? '#f8fafc' : 'transparent',
              borderBottom: activeTab === 'ledger' ? '2px solid #0f172a' : 'none',
              marginBottom: '-2px',
              cursor: 'pointer',
              borderLeft: 'none',
              borderRight: 'none',
              borderTop: 'none'
            }}
          >
            <History size={16} /> Ledger
          </button>
        </div>

        {/* Tab Content */}
        <div style={{
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          background: '#fff',
          padding: '24px',
          minHeight: '400px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
        }}>
          {activeTab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
                      Subcontractor
                    </label>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>{workOrder.subcontractors?.company_name}</div>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>
                      {workOrder.subcontractors?.contact_person && `Contact: ${workOrder.subcontractors.contact_person}`}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
                      Site Location
                    </label>
                    <div style={{ fontSize: '16px', color: '#334155' }}>{workOrder.site_location || '-'}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
                        Start Date
                      </label>
                      <div style={{ fontSize: '14px', color: '#334155' }}>{workOrder.start_date || '-'}</div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
                        End Date
                      </label>
                      <div style={{ fontSize: '14px', color: '#334155' }}>{workOrder.end_date || '-'}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
                      Issue Date
                    </label>
                    <div style={{ fontSize: '14px', color: '#334155' }}>{workOrder.issue_date}</div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
                      Valid Until
                    </label>
                    <div style={{ fontSize: '14px', color: '#334155' }}>{workOrder.valid_until || '-'}</div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
                      Remarks
                    </label>
                    <div style={{ fontSize: '14px', color: '#334155' }}>{workOrder.remarks || '-'}</div>
                  </div>
                </div>
              </div>

              {/* Line Items Summary */}
              <div style={{ borderTop: '2px solid #0f172a', paddingTop: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '12px' }}>WORK ITEMS</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', border: '1px solid #e2e8f0' }}>Description</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', border: '1px solid #e2e8f0' }}>Qty</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', border: '1px solid #e2e8f0' }}>Unit</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', border: '1px solid #e2e8f0' }}>Rate</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', border: '1px solid #e2e8f0' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(workOrder.line_items || []).map((item: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '16px', fontSize: '14px', color: '#334155', border: '1px solid #e2e8f0' }}>{item.description}</td>
                        <td style={{ padding: '16px', fontSize: '14px', color: '#64748b', textAlign: 'center', border: '1px solid #e2e8f0' }}>{item.quantity}</td>
                        <td style={{ padding: '16px', fontSize: '14px', color: '#64748b', textAlign: 'center', border: '1px solid #e2e8f0' }}>{item.unit}</td>
                        <td style={{ padding: '16px', fontSize: '14px', color: '#64748b', textAlign: 'right', border: '1px solid #e2e8f0' }}>{formatCurrency(item.rate)}</td>
                        <td style={{ padding: '16px', fontSize: '14px', color: '#0f172a', fontWeight: '600', textAlign: 'right', border: '1px solid #e2e8f0' }}>{formatCurrency(item.amount)}</td>
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
              onCreateNew={() => onNavigate?.(`/subcontractors/workorders/${workOrderId}/create-measurement`)}
            />
          )}

          {activeTab === 'payments' && (
            <div>
              {payments && payments.length > 0 ? (
                <div style={{
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                  overflow: 'hidden'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>Date</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>Gross Amount</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>TDS</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>Net Amount</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>Mode</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment: any) => (
                        <tr key={payment.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#334155' }}>{payment.payment_date}</td>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#64748b', textAlign: 'right' }}>{formatCurrency(payment.gross_amount || payment.amount)}</td>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#64748b', textAlign: 'right' }}>{payment.tds_amount ? formatCurrency(payment.tds_amount) : '-'}</td>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#0f172a', fontWeight: '600', textAlign: 'right' }}>{formatCurrency(payment.net_amount || payment.amount)}</td>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#64748b', textAlign: 'center' }}>{payment.payment_mode}</td>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#334155' }}>{payment.reference_no || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '64px 24px', textAlign: 'center', color: '#94a3b8' }}>
                  <p style={{ fontSize: '14px' }}>No payments recorded yet.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'ledger' && (
            <div style={{ padding: '64px 24px', textAlign: 'center', color: '#94a3b8' }}>
              <History size={48} style={{ margin: '0 auto 16px', color: '#cbd5e1' }} />
              <p style={{ fontSize: '14px' }}>Full ledger view coming soon.</p>
              <p style={{ fontSize: '13px', marginTop: '8px' }}>Use the Subcontractor Ledger for complete transaction history.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
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
