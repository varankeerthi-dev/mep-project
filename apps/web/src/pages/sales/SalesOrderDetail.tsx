import { useState, useEffect, useRef, useMemo } from 'react';
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
  ShoppingCart,
  Download as DownloadIcon,
  X as XIcon,
  Mail as MailIcon,
  Paperclip as PaperclipIcon,
  Upload as UploadIcon,
  Trash2 as Trash2Icon
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from '../../lib/logger';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { ApprovalIntegration } from '../../approvals/integration';
import { useSalesOrder, useSalesOrderItems, useSalesOrderActivity, salesKeys } from './hooks';
import StockCheckPanel from './components/StockCheckPanel';
import { SalesOrderListPane } from './components/SalesOrderListPane';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../../components/ui/resizable';
import { DocumentActions } from '../../components/document/DocumentActions';
import { DocumentTimeline } from '../../components/document/DocumentTimeline';
import { DocumentPreviewTabs } from '../../components/document/DocumentPreviewTabs';
import { previewSalesOrderPdf } from './utils/soPdf';
import { ChecklistConfirmationDialog } from '../../features/document-checklists/ChecklistConfirmationDialog';
import { useDocumentChecklistGate } from '../../features/document-checklists/useDocumentChecklistGate';

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
  const checklistGate = useDocumentChecklistGate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');

  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [showStockCheck, setShowStockCheck] = useState(false);
  const [previewTab, setPreviewTab] = useState('Preview');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Attachments in the private sales-order bucket: <org_id>/<so_id>/<file>
  const attachPrefix = orgId && id ? `${orgId}/${id}` : null;
  const { data: attachments = [], refetch: refetchAttachments } = useQuery({
    queryKey: ['sales-order-attachments', id],
    queryFn: async () => {
      if (!attachPrefix) return [];
      const { data, error } = await supabase.storage
        .from('sales-order-attachments')
        .list(attachPrefix, { limit: 100, sortBy: { column: 'created_at', order: false } });
      if (error) return [];
      return (data || []).filter((f: any) => f.id);
    },
    enabled: !!attachPrefix,
  });

  const handleAttachUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !attachPrefix) return;
    setUploading(true);
    try {
      const path = `${attachPrefix}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('sales-order-attachments').upload(path, file);
      if (error) throw error;
      toast.success('Attachment uploaded');
      refetchAttachments();
    } catch (err: any) {
      toast.error('Upload failed: ' + (err.message || err));
    } finally {
      setUploading(false);
    }
  };

  const handleAttachDelete = async (name: string) => {
    if (!attachPrefix) return;
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      const { error } = await supabase.storage.from('sales-order-attachments').remove([`${attachPrefix}/${name}`]);
      if (error) throw error;
      refetchAttachments();
    } catch (err: any) {
      toast.error('Delete failed: ' + (err.message || err));
    }
  };

  const handleAttachDownload = async (name: string) => {
    if (!attachPrefix) return;
    try {
      const { data, error } = await supabase.storage
        .from('sales-order-attachments')
        .createSignedUrl(`${attachPrefix}/${name}`, 300);
      if (error || !data?.signedUrl) throw error || new Error('No URL');
      window.open(data.signedUrl, '_blank');
    } catch (err: any) {
      toast.error('Download failed: ' + (err.message || err));
    }
  };
  const openPdfPreview = async () => {
    if (!id || !orgId || pdfLoading) return;
    setPdfLoading(true);
    try {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      const { url } = await previewSalesOrderPdf(orgId, id);
      setPdfUrl(url);
      setShowPdfPreview(true);
    } catch (e: any) {
      toast.error('PDF preview failed: ' + (e.message || e));
    } finally {
      setPdfLoading(false);
    }
  };

  // Fetch Sales Order details (statement-managed)
  const { data: order, isLoading } = useSalesOrder(id);


  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showTemplateSelect, setShowTemplateSelect] = useState(false);
  const [showPoDialog, setShowPoDialog] = useState(false);
  const [poVendorId, setPoVendorId] = useState('');
  const [poLines, setPoLines] = useState<any[]>([]);
  const [poCreating, setPoCreating] = useState(false);
  const [poSessionKey, setPoSessionKey] = useState('');
  const poAutoOpened = useRef(false);

  const { data: poVendors = [] } = useQuery({
    queryKey: ['so-po-vendors', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('purchase_vendors')
        .select('id, company_name')
        .eq('organisation_id', orgId)
        .eq('status', 'Active')
        .order('company_name');
      if (error) return [];
      return data || [];
    },
    enabled: !!orgId && showPoDialog,
  });

  const openPoDialog = () => {
    const remaining = (items || [])
      .map((it: any) => ({
        so_item_id: it.id,
        item_id: it.item_id,
        description: it.description || it.material?.name || 'Item',
        uom: it.uom || 'nos',
        rate: parseFloat(it.rate) || 0,
        discount_percent: parseFloat(it.discount_percent) || 0,
        tax_percent: parseFloat(it.tax_percent) || 0,
        make: it.make || null,
        variant: it.variant?.variant_name || null,
        qty: Math.max(0, (parseFloat(it.qty) || 0) - (parseFloat(it.shipped_qty) || 0) - (parseFloat(it.produced_qty) || 0)),
      }))
      .filter((l: any) => l.qty > 0 && l.rate > 0);
    setPoLines(remaining);
    setPoVendorId('');
    setPoSessionKey(`po:so:${id}:${Date.now()}`);
    setShowPoDialog(true);
  };

  useEffect(() => {
    if (searchParams.get('po') === '1' && id && items.length > 0 && !poAutoOpened.current) {
      poAutoOpened.current = true;
      openPoDialog();
    }
  }, [id, items.length]);

  const handleCreatePo = async () => {
    if (!poVendorId) { toast.error('Select a vendor'); return; }
    const lines = poLines.filter((l: any) => (parseFloat(l.qty) || 0) > 0);
    if (lines.length === 0) { toast.error('No quantities to order'); return; }
    if (!orgId) return;
    setPoCreating(true);
    try {
      const gateResult = await checklistGate.run({
        organisationId: orgId,
        documentType: 'purchase_order',
        action: async () => {
          const { data, error } = await supabase.rpc('create_purchase_order_atomic', {
            p_organisation_id: orgId,
            p_vendor_id: poVendorId,
            p_project_id: order?.project_id || order?.project?.id || null,
            p_internal_notes: `From sales order ${order?.sales_order_no || ''}`,
            p_items: lines.map((l: any) => ({
              item_id: l.item_id,
              item_name: l.description,
              quantity: parseFloat(l.qty) || 0,
              unit: l.uom || 'Nos',
              rate: parseFloat(l.rate) || 0,
              discount_percent: parseFloat(l.discount_percent) || 0,
              tax_percent: parseFloat(l.tax_percent) || 0,
              make: l.make,
              variant: l.variant,
            })),
            p_idempotency_key: poSessionKey,
          });
          if (error) throw error;
          if ((data as any)?.idempotent_replayed) {
            toast.success(`Purchase order already created (${(data as any).po_number})`);
          } else {
            const poId = (data as any).po_id;
            const { data: poItems } = await supabase
              .from('purchase_order_items')
              .select('id')
              .eq('po_id', poId)
              .order('sr', { ascending: true });
            let linkOk = !!(poItems && poItems.length > 0);
            if (poItems) {
              for (let i = 0; i < lines.length && i < poItems.length; i++) {
                const { error: linkErr } = await supabase.from('purchase_order_items').update({ sales_order_item_id: lines[i].so_item_id }).eq('id', (poItems as any)[i].id);
                if (linkErr) linkOk = false;
              }
            }
            const { error: soLinkErr } = await supabase.from('purchase_orders').update({ sales_order_id: id }).eq('id', poId);
            if (soLinkErr) linkOk = false;
            if (!linkOk) {
              toast.error(`PO ${(data as any).po_number} created, but linking it back to this order failed (check purchase edit permission). Open the PO to verify.`);
            } else {
              toast.success(`Purchase order ${(data as any).po_number} created`);
            }
            try {
              await supabase.from('sales_order_activity_log').insert({
                organisation_id: orgId,
                sales_order_id: id,
                event_type: 'po_raised',
                summary: { po_id: poId, po_number: (data as any).po_number, total: (data as any).total_amount },
                created_by: null,
              });
            } catch { /* activity is best-effort */ }
          }
          setShowPoDialog(false);
          queryClient.invalidateQueries({ queryKey: ['sales-order-purchase-orders', id] });
          queryClient.invalidateQueries({ queryKey: salesKeys.activity(id || '') });
        },
      });
      if (gateResult.kind === 'failed') throw new Error(gateResult.error);
      if (gateResult.kind === 'incomplete') toast.error('Complete every required checklist item before continuing.');
    } catch (e: any) {
      toast.error('PO creation failed: ' + (e.message || e));
    } finally {
      setPoCreating(false);
    }
  };

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
      queryClient.invalidateQueries({ queryKey: salesKeys.detail(id || '') });
    } catch (err: any) {
      console.error('Error selecting template:', err);
      toast.error('Error: ' + err.message);
    }
  };

  // Fetch Sales Order items (statement-managed)
  const { data: items = [] } = useSalesOrderItems(id);

  // Fetch linked Job Cards
  const { data: jobCards = [] } = useQuery({
    queryKey: salesKeys.jobCards(id || ''),
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

  // Fetch activity trail (statement-managed)
  const { data: activityLog = [] } = useSalesOrderActivity(id);

  // Fetch linked invoices via line linkage (invoice_items.meta_json.source_item_id)
  const soItemIds = useMemo(
    () => (items || []).map((i: any) => i.id).filter(Boolean),
    [items]
  );
  const { data: linkedInvoices = [] } = useQuery({
    queryKey: ['sales-order-invoices', id, soItemIds.join('|')],
    queryFn: async () => {
      if (!id || soItemIds.length === 0) return [];
      const { data, error } = await supabase
        .from('invoice_items')
        .select('id, qty, rate, amount, meta_json, invoice_id, invoice:invoices(id, invoice_no, invoice_date, grand_total, status)')
        .filter('meta_json->>source_item_id', 'in', `(${soItemIds.join(',')})`);
      if (error) return [];
      return data || [];
    },
    enabled: !!id && soItemIds.length > 0,
  });
  const invoiceSummary = useMemo(() => {
    const byInvoice = new Map<string, any>();
    const billedByItem: Record<string, number> = {};
    (linkedInvoices || []).forEach((li: any) => {
      const srcId = li.meta_json?.source_item_id;
      if (srcId) billedByItem[srcId] = (billedByItem[srcId] || 0) + (parseFloat(li.qty) || 0);
      const inv = li.invoice;
      if (inv && !byInvoice.has(inv.id)) byInvoice.set(inv.id, inv);
    });
    return { invoices: [...byInvoice.values()], billedByItem };
  }, [linkedInvoices]);

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

  const performSubmitApproval = async () => {
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
        queryClient.invalidateQueries({ queryKey: salesKeys.detail(id || '') });
      } else {
        toast.error(res.error || 'Failed to submit for approval');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error submitting approval');
    } finally {
      setSubmittingApproval(false);
    }
  };

  const handleSubmitApproval = async () => {
    if (!id || !order || !orgId) return;
    const result = await checklistGate.run({
      organisationId: orgId,
      documentType: 'sales_order',
      action: performSubmitApproval,
    });
    if (result.kind === 'failed') {
      toast.error('Checklist verification failed. Nothing was submitted.', { description: result.error });
    } else if (result.kind === 'incomplete') {
      toast.error('Complete every required checklist item before continuing.');
    }
  };

  if (isLoading) {
    return (
      <ResizablePanelGroup direction="horizontal" autoSaveId="sales-order-split" className="flex h-[calc(100vh-48px)] bg-zinc-100 overflow-hidden">
        <ResizablePanel defaultSize={32} minSize={26} maxSize={42} className="flex flex-col bg-white border-r border-[#EEF0F3]">
          <SalesOrderListPane selectedId={id} onSelect={(soId) => navigate(`/sales-orders/view?id=${soId}`)} />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={78} className="bg-zinc-50">
          <div className="h-full overflow-auto flex flex-col items-center justify-center py-40">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            <span className="text-sm text-zinc-500 mt-2">Loading Sales Order details...</span>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  }

  if (!order) {
    return (
      <ResizablePanelGroup direction="horizontal" autoSaveId="sales-order-split" className="flex h-[calc(100vh-48px)] bg-zinc-100 overflow-hidden">
        <ResizablePanel defaultSize={32} minSize={26} maxSize={42} className="flex flex-col bg-white border-r border-[#EEF0F3]">
          <SalesOrderListPane selectedId={id} onSelect={(soId) => navigate(`/sales-orders/view?id=${soId}`)} />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={78} className="bg-zinc-50">
          <div className="h-full overflow-auto">
            <div className="text-center py-20 text-sm text-zinc-500 italic">
              Select a sales order to preview.
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  }

  const statusMeta = STATUS_COLORS[order.status] || { bg: 'bg-zinc-100', color: 'text-zinc-700', label: order.status };

  return (
    <ResizablePanelGroup direction="horizontal" autoSaveId="sales-order-split" className="flex h-[calc(100vh-48px)] bg-zinc-100 overflow-hidden">
      <ResizablePanel defaultSize={32} minSize={26} maxSize={42} className="flex flex-col bg-white border-r border-[#EEF0F3]">
        <SalesOrderListPane selectedId={id} onSelect={(soId) => navigate(`/sales-orders/view?id=${soId}`)} />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={78} className="bg-zinc-50">
        <div className="h-full overflow-auto">
          <div className="max-w-5xl mx-auto pt-6 pb-12 px-4 sm:px-6 lg:px-8">
            <div className="space-y-6">
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
            submitForApproval={order.status === 'draft' ? { visible: true, onClick: handleSubmitApproval, loading: submittingApproval || checklistGate.isBusy } : undefined}
            print={{ onClick: openPdfPreview, loading: pdfLoading }}
            menuItems={[
              {
                label: 'Convert',
                children: [
                  { label: 'Tax Invoice', onClick: () => navigate(`/invoices/create?convertFrom=sales-order-to-invoice&sourceId=${id}`) },
                  { label: 'Delivery Challan', onClick: () => navigate(`/dc/create?convertFrom=sales-order-to-challan&sourceId=${id}`) },
                  { label: 'Purchase Order', onClick: () => openPoDialog() },
                ],
              },
              {
                label: 'Send to Client',
                hint: order?.email_sent ? `Sent${order?.email_sent_to ? ' to ' + order.email_sent_to : ''}` : 'Record send (email transport later)',
                icon: MailIcon,
                onClick: async () => {
                  if (!id) return;
                  try {
                    const { data, error } = await supabase.rpc('record_so_send_atomic', { p_so_id: id });
                    if (error) throw error;
                    if ((data as any)?.already_sent) {
                      toast.success(`Already sent${(data as any)?.sent_to ? ' to ' + (data as any).sent_to : ''}`);
                    } else {
                      toast.success(`Send recorded${(data as any)?.sent_to ? ' for ' + (data as any).sent_to : ''}`);
                    }
                    queryClient.invalidateQueries({ queryKey: salesKeys.detail(id || '') });
                    queryClient.invalidateQueries({ queryKey: salesKeys.activity(id || '') });
                  } catch (e: any) {
                    toast.error('Send failed: ' + (e.message || e));
                  }
                },
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

      {/* Linked Invoices */}
      {previewTab === 'Preview' && invoiceSummary.invoices.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 pb-2 border-b">
            Linked Invoices ({invoiceSummary.invoices.length})
          </h2>
          <div className="mt-4 space-y-1.5">
            {invoiceSummary.invoices.map((inv: any) => (
              <div
                key={inv.id}
                onClick={() => navigate(`/invoices/view?id=${inv.id}`)}
                className="p-2 border rounded-lg hover:bg-zinc-50 cursor-pointer flex justify-between items-center text-xs"
              >
                <div>
                  <span className="font-semibold text-zinc-900 block">{inv.invoice_no || 'Invoice'}</span>
                  <span className="text-[10px] text-zinc-400">Date: {inv.invoice_date ? formatDate(inv.invoice_date) : '-'}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-zinc-900 block">{formatCurrency(inv.grand_total)}</span>
                  <span className="text-[10px] text-zinc-400">{inv.status || ''}</span>
                </div>
              </div>
            ))}
          </div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 pb-2 border-b mt-6 mb-2">
            Billed vs Remaining
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-400 uppercase text-[10px]">
                  <th className="text-left py-1.5 pr-2">Item</th>
                  <th className="text-right py-1.5 px-2">Ordered</th>
                  <th className="text-right py-1.5 px-2">Billed</th>
                  <th className="text-right py-1.5 pl-2">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(items || []).map((it: any) => {
                  const ordered = parseFloat(it.qty) || 0;
                  const billed = invoiceSummary.billedByItem[it.id] || 0;
                  const remaining = Math.max(0, ordered - billed);
                  return (
                    <tr key={it.id}>
                      <td className="py-1.5 pr-2 text-zinc-800 truncate max-w-[220px]">{it.description || it.material?.name || 'Item'}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-zinc-600">{ordered}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-zinc-600">{billed}</td>
                      <td className={`py-1.5 pl-2 text-right tabular-nums font-semibold ${remaining > 0 ? 'text-amber-700' : 'text-emerald-600'}`}>{remaining}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                  : l.event_type === 'po_raised'
                    ? `Purchase order raised${s.po_number ? ' ' + s.po_number : ''}`
                    : l.event_type === 'sent'
                      ? `Sent to client${s.sent_to ? ' ' + s.sent_to : ''}`
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
        <div className="py-6 max-w-2xl">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold text-zinc-900">
              Attachments ({(attachments || []).length})
            </div>
            <label className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-[#E5E7EB] text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer">
              <UploadIcon className="w-3.5 h-3.5" />
              {uploading ? 'Uploading...' : 'Upload'}
              <input type="file" className="hidden" disabled={uploading} onChange={handleAttachUpload} />
            </label>
          </div>
          {(attachments || []).length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-sm font-medium text-zinc-500">No attachments</div>
              <div className="mt-1 text-[13px] text-zinc-400">Files attached to this sales order will appear here.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {(attachments || []).map((f: any) => (
                <div key={f.name} className="flex items-center justify-between gap-3 bg-white border border-[#EEF0F3] rounded-lg px-3.5 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <PaperclipIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="text-[13px] text-zinc-800 truncate">{f.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleAttachDownload(f.name)}
                      className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAttachDelete(f.name)}
                      className="p-1.5 text-zinc-400 hover:text-red-600 transition-colors"
                      aria-label="Delete attachment"
                    >
                      <Trash2Icon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PDF Preview Modal */}
      {showPdfPreview && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => setShowPdfPreview(false)}>
          <div className="bg-white rounded-lg w-full max-w-[210mm] h-[90vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center px-4 py-2 bg-zinc-100 border-b border-zinc-200 select-none shrink-0 justify-between" style={{ gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280' }}>{order?.sales_order_no || 'Sales Order'}</span>
              <div className="flex items-center" style={{ gap: '6px' }}>
                <button
                  onClick={async () => {
                    if (!id || !orgId) return;
                    try {
                      const { downloadSalesOrderPdf } = await import('./utils/soPdf');
                      await downloadSalesOrderPdf(orgId, id);
                    } catch (e: any) {
                      toast.error('PDF download failed: ' + (e.message || e));
                    }
                  }}
                  style={{ padding: '7px 16px', background: 'transparent', border: '1px solid #d1d5db', color: '#374151', fontSize: '12px', fontWeight: 500, borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <DownloadIcon size={14} /> Download
                </button>
                <button
                  onClick={() => { setShowPdfPreview(false); if (pdfUrl) { URL.revokeObjectURL(pdfUrl); setPdfUrl(null); } }}
                  style={{ padding: '6px', background: 'transparent', border: 'none', color: '#9ca3af', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <XIcon size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-zinc-900 min-h-0">
              {pdfUrl ? (
                <iframe src={pdfUrl} className="w-full h-full" style={{ border: 'none' }} title="Sales Order PDF Preview" />
              ) : (
                <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-zinc-400" /></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Purchase Order Convert Dialog */}
      {showPoDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setShowPoDialog(false)}>
          <div className="w-full max-w-[640px] max-h-[85vh] flex flex-col rounded-xl bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[#E2E8F0]">
              <h3 className="text-[15px] font-bold text-[#0B1C30]">Create Purchase Order</h3>
              <p className="text-xs text-[#475569] mt-0.5">Remaining line quantities from {order?.sales_order_no}. One PO per vendor.</p>
            </div>
            <div className="px-5 py-4 overflow-y-auto">
              <label className="block">
                <span className="text-xs font-semibold text-[#0B1C30]">Vendor</span>
                <select
                  value={poVendorId}
                  onChange={(e) => setPoVendorId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-[13px] focus:outline-none focus:border-[#2563EB]"
                >
                  <option value="">Select vendor...</option>
                  {(poVendors || []).map((v: any) => (
                    <option key={v.id} value={v.id}>{v.company_name}</option>
                  ))}
                </select>
              </label>
              <div className="mt-4 rounded-xl border border-[#E2E8F0] overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#EFF4FF] text-[11px] uppercase tracking-wider text-[#334155]">
                      <th className="text-left px-3 py-2 font-semibold">Item</th>
                      <th className="text-right px-3 py-2 font-semibold w-24">Qty</th>
                      <th className="text-right px-3 py-2 font-semibold w-28">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poLines.length === 0 ? (
                      <tr><td colSpan={3} className="px-3 py-8 text-center text-[13px] text-[#64748B]">No remaining quantities to order.</td></tr>
                    ) : (
                      poLines.map((l: any, i: number) => (
                        <tr key={l.so_item_id} className="border-t border-[#F1F5F9]">
                          <td className="px-3 py-2 text-[#0B1C30]">{l.description}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              value={l.qty}
                              min="0"
                              step="0.01"
                              onChange={(e) => setPoLines((prev) => prev.map((p, pi) => (pi === i ? { ...p, qty: parseFloat(e.target.value) || 0 } : p)))}
                              className="w-20 rounded-md border border-[#CBD5E1] px-2 py-1 text-right tabular-nums focus:outline-none focus:border-[#2563EB]"
                            />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-[#0B1C30]">{l.rate}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-[#E2E8F0] flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowPoDialog(false)}
                className="h-9 px-4 text-[13px] font-semibold text-[#0B1C30] bg-white border border-[#CBD5E1] rounded-lg hover:bg-zinc-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreatePo}
                disabled={poCreating || checklistGate.isBusy || poLines.length === 0}
                className="h-9 px-4 text-[13px] font-bold text-white bg-[#2563EB] rounded-lg hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {poCreating ? 'Creating...' : 'Create PO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Check Modal / Panel */}
      {showStockCheck && (
        <StockCheckPanel
          isOpen={showStockCheck}
          onClose={() => {
            setShowStockCheck(false);
            queryClient.invalidateQueries({ queryKey: salesKeys.detail(id || '') });
            queryClient.invalidateQueries({ queryKey: salesKeys.items(id || '') });
            queryClient.invalidateQueries({ queryKey: salesKeys.jobCards(id || '') });
          }}
          salesOrderId={id || ''}
          items={items}
          order={order}
        />
      )}
      {/* One confirmation surface serves the sales_order approval and purchase_order create gates. */}
      <ChecklistConfirmationDialog
        policy={checklistGate.policy}
        policyChanged={checklistGate.policyChanged}
        onContinue={checklistGate.continueWith}
        onCancel={checklistGate.cancel}
      />
      </div>
      </div>
      </div>
    </ResizablePanel>
    </ResizablePanelGroup>
  );
}
