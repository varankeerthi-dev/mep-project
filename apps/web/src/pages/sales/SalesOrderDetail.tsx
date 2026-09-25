import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronDown as ChevronDownIcon,
  Play as PlayIcon,
  Printer as PrinterIcon,
  CheckCircle,
  Clock,
  AlertTriangle,
  FolderLock,
  Loader2,
  FileText,
  Hammer,
  Truck,
  ShoppingCart
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from '../../lib/logger';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { ApprovalIntegration } from '../../approvals/integration';
import StockCheckPanel from './components/StockCheckPanel';
import { SalesOrderListPane } from './components/SalesOrderListPane';
import { DocumentActions } from '../../components/document/DocumentActions';
import { DocumentTimeline } from '../../components/document/DocumentTimeline';
import { DocumentPreviewTabs } from '../../components/document/DocumentPreviewTabs';

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  draft:            { bg: 'bg-zinc-100', color: 'text-zinc-700', label: 'Draft' },
  waiting_approval: { bg: 'bg-amber-100', color: 'text-amber-700', label: 'Waiting Approval' },
  open:             { bg: 'bg-blue-100', color: 'text-blue-700', label: 'Open / Approved' },
  in_production:    { bg: 'bg-purple-100', color: 'text-purple-700', label: 'In Production' },
  partially_shipped:{ bg: 'bg-orange-100', color: 'text-orange-700', label: 'Partially Shipped' },
  completed:        { bg: 'bg-emerald-100', color: 'text-emerald-700', label: 'Completed' },
  cancelled:        { bg: 'bg-red-100', color: 'text-red-700', label: 'Cancelled' }
};

export default function SalesOrderDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  const orgId = organisation?.id;
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');

  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [showStockCheck, setShowStockCheck] = useState(false);
  const [previewTab, setPreviewTab] = useState('Preview');

  // Fetch Sales Order details
  const { data: order, isLoading } = useQuery({
    queryKey: ['sales-order', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          client:clients(*),
          project:projects(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id
  });


  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showTemplateSelect, setShowTemplateSelect] = useState(false);

  useEffect(() => { setPreviewTab('Preview'); }, [id]);

  const { data: soTemplates = [] } = useQuery({
    queryKey: ['documentTemplates', 'Sales Order'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .eq('document_type', 'Sales Order')
        .eq('active', true)
        .order('is_default', { ascending: false });
      if (error) return [];
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (order) setSelectedTemplateId((order as any).template_id || null);
  }, [order]);

  const getSelectedTemplateName = () => {
    if (!selectedTemplateId) return 'Default';
    const template = (soTemplates || []).find((t: any) => t.id === selectedTemplateId);
    return template?.template_name || 'Default';
  };

  const handleSelectTemplate = async (templateId: string) => {
    if (!id) return;
    try {
      const { error } = await supabase
        .from('sales_orders')
        .update({ template_id: templateId })
        .eq('id', id);
      if (error) throw error;
      setSelectedTemplateId(templateId);
      queryClient.invalidateQueries({ queryKey: ['sales-order', id] });
    } catch (err: any) {
      console.error('Error selecting template:', err);
      toast.error('Error: ' + err.message);
    }
  };

  // Fetch Sales Order items
  const { data: items = [] } = useQuery({
    queryKey: ['sales-order-items', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('sales_order_items')
        .select(`
          *,
          material:materials(*),
          variant:company_variants(variant_name)
        `)
        .eq('sales_order_id', id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!id
  });

  // Fetch linked Job Cards
  const { data: jobCards = [] } = useQuery({
    queryKey: ['sales-order-job-cards', id],
    queryFn: async () => {
      if (!id || items.length === 0) return [];
      const itemIds = items.map((i: any) => i.id);
      const { data, error } = await supabase
        .from('job_cards')
        .select('*')
        .in('sales_order_item_id', itemIds);

      if (error) throw error;
      return data || [];
    },
    enabled: !!id && items.length > 0
  });

  // Fetch linked Purchase Orders
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['sales-order-purchase-orders', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          vendor:purchase_vendors(company_name)
        `)
        .eq('sales_order_id', id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!id
  });

  // Fetch activity trail
  const { data: activityLog = [] } = useQuery({
    queryKey: ['sales-order-activity', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('sales_order_activity_log')
        .select('*')
        .eq('sales_order_id', id)
        .order('created_at', { ascending: true });
      if (error) return [];
      return data || [];
    },
    enabled: !!id
  });

  // Fetch linked Delivery Challans
  const { data: deliveryChallans = [] } = useQuery({
    queryKey: ['sales-order-delivery-challans', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('delivery_challans')
        .select('*')
        .eq('sales_order_id', id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!id
  });

  const handleSubmitApproval = async () => {
    if (!id || !order) return;
    try {
      setSubmittingApproval(true);
      const res = await ApprovalIntegration.createSalesOrderApproval(
        id,
        order.client?.client_name || 'Client',
        order.sales_order_no,
        order.grand_total
      );

      if (res.success) {
        toast.success(res.error || 'Sales Order submitted for approval');
        queryClient.invalidateQueries({ queryKey: ['sales-order', id] });
      } else {
        toast.error(res.error || 'Failed to submit for approval');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error submitting approval');
    } finally {
      setSubmittingApproval(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full min-h-0">
        <SalesOrderListPane selectedId={id} onSelect={(soId) => navigate(`/sales-orders/view?id=${soId}`)} />
        <div className="flex-1 overflow-y-auto min-w-0 flex flex-col items-center justify-center py-40">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
          <span className="text-sm text-zinc-500 mt-2">Loading Sales Order details...</span>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex h-full min-h-0">
        <SalesOrderListPane selectedId={id} onSelect={(soId) => navigate(`/sales-orders/view?id=${soId}`)} />
        <div className="flex-1 overflow-y-auto min-w-0">
          <div className="text-center py-20 text-sm text-zinc-500 italic">
            Select a sales order to preview.
          </div>
        </div>
      </div>
    );
  }

  const statusMeta = STATUS_COLORS[order.status] || { bg: 'bg-zinc-100', color: 'text-zinc-700', label: order.status };

  return (
    <div className="flex h-full min-h-0">
      <SalesOrderListPane selectedId={id} onSelect={(soId) => navigate(`/sales-orders/view?id=${soId}`)} />
      <div className="flex-1 overflow-y-auto min-w-0">
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/sales-orders')}>
            <ChevronLeftIcon className="h-5 w-5 text-zinc-500" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-zinc-900">{order.sales_order_no}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusMeta.bg} ${statusMeta.color}`}>
                {statusMeta.label}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Client: <span className="font-semibold">{order.client?.client_name}</span> | Project: <span className="font-semibold">{order.project?.name || 'None'}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <DocumentActions
            submitForApproval={order.status === 'draft' ? { visible: true, onClick: handleSubmitApproval, loading: submittingApproval } : undefined}
            print={{ onClick: () => window.print() }}
            menuItems={[
              {
                label: 'Convert',
                children: [
                  { label: 'Tax Invoice', onClick: () => navigate(`/invoices/create?convertFrom=sales-order-to-invoice&sourceId=${id}`) },
                  { label: 'Delivery Challan', onClick: () => navigate(`/dc/create?convertFrom=sales-order-to-challan&sourceId=${id}`) },
                ],
              },
              {
                label: 'Run Stock Check',
                hint: 'Check warehouse stock and reserve',
                icon: PlayIcon,
                onClick: () => setShowStockCheck(true),
              },
            ]}
          />
        </div>
      </div>

      {/* Warnings & Notices */}
      {order.status === 'waiting_approval' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <strong>Waiting for Approval:</strong> This Sales Order is pending CEO/Manager approval. 
            The production team can view this order and plan (draft Job Cards), but physical material issuance is locked.
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <DocumentPreviewTabs
          tabs={[
            { key: 'Preview', label: 'Preview' },
            { key: 'History', label: 'History', count: activityLog.length },
            { key: 'Attachments', label: 'Attachments', count: 0 },
          ]}
          active={previewTab}
          onChange={setPreviewTab}
        />
        <div className="relative">
          <button
            onClick={() => setShowTemplateSelect((v) => !v)}
            className="inline-flex items-center gap-1.5 h-8 px-3 mb-1 rounded-md border border-[#E5E7EB] text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            {getSelectedTemplateName()}
            <ChevronDownIcon className="w-3.5 h-3.5 text-zinc-400" />
          </button>
          {showTemplateSelect && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowTemplateSelect(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[210px] max-h-[300px] overflow-y-auto bg-white border border-zinc-200 rounded-md shadow-lg p-1">
                {(soTemplates || []).map((t: any) => (
                  <button
                    key={t.id}
                    onClick={() => { handleSelectTemplate(t.id); setShowTemplateSelect(false); }}
                    className={`block w-full text-left px-2.5 py-2 text-[13px] rounded transition-colors ${selectedTemplateId === t.id ? 'bg-[#EFF6FF] text-[#2563EB] font-medium' : 'text-zinc-700 hover:bg-zinc-50'}`}
                  >
                    {t.template_name}
                    {t.is_default && <span className="ml-2 text-[11px] text-zinc-400 font-normal italic">(Default)</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ display: previewTab === 'Preview' ? undefined : 'none' }}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Details & Addresses */}
        <div className="md:col-span-2 space-y-6 bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 pb-2 border-b">
              Delivery & Address details
            </h2>
            <div className="grid grid-cols-2 gap-6 mt-4">
              <div>
                <span className="text-xs text-zinc-400 block uppercase font-semibold">Order Date</span>
                <span className="text-sm font-medium text-zinc-900">{formatDate(order.order_date)}</span>
              </div>
              <div>
                <span className="text-xs text-zinc-400 block uppercase font-semibold">Delivery Target</span>
                <span className="text-sm font-medium text-zinc-900">{formatDate(order.delivery_date) || '-'}</span>
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-zinc-400 block uppercase font-semibold">Billing Address</span>
                  <span className="text-sm text-zinc-700 block whitespace-pre-wrap">{order.billing_address}</span>
                </div>
                <div>
                  <span className="text-xs text-zinc-400 block uppercase font-semibold">Shipping Address</span>
                  <span className="text-sm text-zinc-700 block whitespace-pre-wrap">{order.shipping_address}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Items Grid */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 pb-2 border-b">
              Ordered Products
            </h2>
            <div className="mt-4 overflow-hidden rounded-lg border border-zinc-100">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold uppercase">
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3 text-right">Ordered</th>
                    <th className="py-2.5 px-3 text-right">Reserved</th>
                    <th className="py-2.5 px-3 text-right">Produced</th>
                    <th className="py-2.5 px-3 text-right">Shipped</th>
                    <th className="py-2.5 px-3 text-right">Rate</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {items.map((item: any) => (
                    <tr key={item.id} className="hover:bg-zinc-50/50">
                      <td className="py-3 px-3">
                        <span className="font-semibold text-zinc-900 block">
                          {item.material?.name}
                          {item.variant?.variant_name && (
                            <span className="ml-1 text-zinc-500 font-normal">({item.variant.variant_name})</span>
                          )}
                        </span>
                        <div className="flex gap-2 items-center mt-0.5">
                          <span className="text-[10px] text-zinc-400 font-mono block">{item.material?.code}</span>
                          {item.make && (
                            <span className="text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.2 rounded uppercase font-medium block h-fit">
                              Make: {item.make}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-medium">{item.qty} {item.uom}</td>
                      <td className="py-3 px-3 text-right text-emerald-600 font-semibold">{item.reserved_qty} {item.uom}</td>
                      <td className="py-3 px-3 text-right text-purple-600 font-medium">{item.produced_qty} {item.uom}</td>
                      <td className="py-3 px-3 text-right text-orange-600 font-medium">{item.shipped_qty} {item.uom}</td>
                      <td className="py-3 px-3 text-right font-medium">{formatCurrency(item.rate)}</td>
                      <td className="py-3 px-3 text-right font-bold text-zinc-900">{formatCurrency(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Traceability Panel */}
        <div className="space-y-6 bg-white p-6 rounded-xl border border-zinc-200 shadow-sm h-fit">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 pb-2 border-b">
            Production & Procurement Link
          </h2>

          <div className="space-y-4">
            {/* Job Cards */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                <Hammer className="h-4 w-4 text-purple-500" />
                Manufacturing Orders ({jobCards.length})
              </div>
              {jobCards.length === 0 ? (
                <div className="text-xs text-zinc-400 italic">No job cards generated yet.</div>
              ) : (
                <div className="space-y-1.5">
                  {jobCards.map((jc: any) => (
                    <div
                      key={jc.id}
                      onClick={() => navigate(`/manufacturing/job-card/view?id=${jc.id}`)}
                      className="p-2 border rounded-lg hover:bg-zinc-50 cursor-pointer flex justify-between items-center text-xs"
                    >
                      <div>
                        <span className="font-semibold text-zinc-900 block">{jc.job_card_no}</span>
                        <span className="text-[10px] text-zinc-400">Qty: {jc.planned_qty}</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-purple-50 text-purple-700 font-medium capitalize">
                        {jc.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Purchase Orders */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                <ShoppingCart className="h-4 w-4 text-blue-500" />
                Linked Vendor POs ({purchaseOrders.length})
              </div>
              {purchaseOrders.length === 0 ? (
                <div className="text-xs text-zinc-400 italic">No purchase orders generated.</div>
              ) : (
                <div className="space-y-1.5">
                  {purchaseOrders.map((po: any) => (
                    <div
                      key={po.id}
                      className="p-2 border rounded-lg flex justify-between items-center text-xs"
                    >
                      <div>
                        <span className="font-semibold text-zinc-900 block">{po.po_number}</span>
                        <span className="text-[10px] text-zinc-400 block truncate max-w-[150px]">{po.vendor?.company_name}</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-blue-50 text-blue-700 font-medium">
                        {po.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Delivery Challans */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                <Truck className="h-4 w-4 text-orange-500" />
                Delivery Challans ({deliveryChallans.length})
              </div>
              {deliveryChallans.length === 0 ? (
                <div className="text-xs text-zinc-400 italic">No shipments sent yet.</div>
              ) : (
                <div className="space-y-1.5">
                  {deliveryChallans.map((dc: any) => (
                    <div
                      key={dc.id}
                      className="p-2 border rounded-lg flex justify-between items-center text-xs"
                    >
                      <div>
                        <span className="font-semibold text-zinc-900 block">{dc.dc_number}</span>
                        <span className="text-[10px] text-zinc-400">Date: {formatDate(dc.dc_date)}</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-orange-50 text-orange-700 font-medium">
                        {dc.status || 'Shipped'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      </div>

      {previewTab === 'History' && (
        <div className="py-6 max-w-2xl">
          <DocumentTimeline
            events={(activityLog || []).map((l: any) => {
              const s = l.summary || {};
              return {
                key: l.id,
                color: '#2563EB',
                title: l.event_type === 'created'
                  ? (s.converted_from_quotation ? `Converted from ${s.quotation_no || 'quotation'}` : 'Sales order created')
                  : l.event_type,
                time: l.created_at ? new Date(l.created_at).toLocaleString() : '',
                desc: s.total != null && s.total !== '' ? `Total ${formatCurrency(s.total)}` : '',
              };
            })}
            emptyTitle="No history yet"
            emptyHint="Events for this sales order will appear here."
          />
        </div>
      )}
      {previewTab === 'Attachments' && (
        <div className="py-16 text-center">
          <div className="text-sm font-medium text-zinc-500">No attachments</div>
          <div className="mt-1 text-[13px] text-zinc-400">Files attached to this sales order will appear here.</div>
        </div>
      )}

      {/* Stock Check Modal / Panel */}
      {showStockCheck && (
        <StockCheckPanel
          isOpen={showStockCheck}
          onClose={() => {
            setShowStockCheck(false);
            queryClient.invalidateQueries({ queryKey: ['sales-order', id] });
            queryClient.invalidateQueries({ queryKey: ['sales-order-items', id] });
            queryClient.invalidateQueries({ queryKey: ['sales-order-job-cards', id] });
          }}
          salesOrderId={id || ''}
          items={items}
          order={order}
        />
      )}
      </div>
      </div>
    </div>
  );
}
