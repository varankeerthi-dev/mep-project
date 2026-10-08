import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatCurrency, formatDateTable } from '../utils/formatters';
import { useAuth } from '../App';
import { PermissionGuard } from '../rbac';
import { timedSupabaseQuery } from '../utils/queryTimeout';
import { ApprovalAPI } from '../approvals/api';
import { initiateQuotationRevision } from '../lib/quotation-workflow';
import { duplicateQuotation } from '../api';
import { DocumentListShell, type ShellColumn } from '../components/document/DocumentListShell';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Calendar } from '../components/ui/Calendar';
import { Filter as FilterIcon, X as ClearIcon, User as UserIcon } from 'lucide-react';
import {

  Download as DownloadIcon,
  Eye as EyeIcon,
  Trash2 as Trash2Icon,
  Printer as PrinterIcon,
  MessageSquare,
  Loader2,
  Share2,
  Edit,
  XCircle,
  RotateCcw,
  Table2,
} from 'lucide-react';
import { RevisionHistoryDialog } from '../components/RevisionHistoryDialog';
import { QuotationRevisionCompareModal } from '../components/QuotationRevisionCompareModal';

const QUOTATION_STATUSES = ['All', 'Draft', 'Sent', 'Under Negotiation', 'Approved', 'Rejected', 'Converted', 'Cancelled', 'Expired'];


const STATUS_FILTER_OPTIONS = ['All', 'Drafts', 'Sent', 'Under Negotiation', 'Approved', 'Rejected', 'Converted', 'Cancelled', 'Expired'];
const toDbStatus = (s: string) => (s === 'Drafts' ? 'Draft' : s);

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Draft:              { bg: '#f3f4f6', color: '#6b7280' },
  Sent:               { bg: '#dbeafe', color: '#1d4ed8' },
  'Under Negotiation':{ bg: '#fef3c7', color: '#b45309' },
  Approved:           { bg: '#d1fae5', color: '#047857' },
  'Approved (Sent)':  { bg: '#bfdbfe', color: '#1e40af' },
  Rejected:           { bg: '#fee2e2', color: '#dc2626' },
  'Returned/Query':   { bg: '#ffedd5', color: '#c2410c' },
  'Revision Requested':{ bg: '#ffedd5', color: '#c2410c' },
  Converted:          { bg: '#d1fae5', color: '#065f46' },
  Cancelled:          { bg: '#fee2e2', color: '#991b1b' },
  Expired:            { bg: '#f3f4f6', color: '#9ca3af' },
  INVOICED:           { bg: '#d1fae5', color: '#065f46' },
  PENDING_APPROVAL:   { bg: '#fee2e2', color: '#b91c1c' },
  'Pending Approval': { bg: '#fee2e2', color: '#b91c1c' },
};

const getStatusColor = (status?: string) =>
  STATUS_COLORS[status ?? ''] ?? STATUS_COLORS['Draft'];

const displayStatus = (q: any) =>
  q.status === 'Approved' && q.sent_at ? 'Approved (Sent)' : q.status;

const MANDATORY_COLUMNS = ['date', 'quotation_no', 'client', 'grand_total'];
const ALL_COLUMNS = [
    { id: 'date', label: 'Date', width: '100px' },
  { id: 'quotation_no', label: 'Quote No', width: '120px' },
  { id: 'revision_no', label: 'Rev No', width: '90px' },
  { id: 'project', label: 'Project', width: '200px' },
  { id: 'client', label: 'Client', width: '400px' },
  { id: 'prepared_by', label: 'Created By', width: '150px' },
  { id: 'status', label: 'Status', width: '140px' },
  { id: 'subtotal', label: 'Sub-total', width: '100px' },
  { id: 'total_tax', label: 'Tax Amount', width: '100px' },
  { id: 'grand_total', label: 'Amount', width: '100px' },
];

export default function QuotationList() {
  const navigate = useNavigate();
  const { organisation, user } = useAuth();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [createdByFilter, setCreatedByFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [returnComment, setReturnComment] = useState<{ open: boolean; quotationId: string | null; comment: string; loading: boolean }>({ open: false, quotationId: null, comment: '', loading: false });
  const [selectedHistoryQuotation, setSelectedHistoryQuotation] = useState<any | null>(null);
  const [selectedCompareQuotation, setSelectedCompareQuotation] = useState<any | null>(null);
  
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('quotation_list_columns');
    return saved ? JSON.parse(saved) : ALL_COLUMNS.map(c => c.id);
  });
  const [tempVisibleColumns, setVisibleColumnsTemp] = useState<string[]>(visibleColumns);

  const columnCustomizerRef = useRef<HTMLDivElement>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // PDF Preview modal state
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
  const [previewQuotationNo, setPreviewQuotationNo] = useState('');
  const [previewQuotationId, setPreviewQuotationId] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);

  const toggleSelectAll = () => {
    if (selectedIds.size === paginationData.currentItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginationData.currentItems.map((q: any) => q.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  useEffect(() => {
    if (!showColumnCustomizer) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (columnCustomizerRef.current && !columnCustomizerRef.current.contains(event.target as Node)) {
        setShowColumnCustomizer(false);
        setVisibleColumnsTemp(visibleColumns);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowColumnCustomizer(false);
        setVisibleColumnsTemp(visibleColumns);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showColumnCustomizer, visibleColumns]);

  // Reset status filter when switching sub-tabs
  // Reset to first page when search, status or date filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, fromDate, toDate, createdByFilter]);

  const generateSinglePdfUint8Array = async (quotationId: string): Promise<Uint8Array | null> => {
    if (!organisation) return null;
    const org = organisation;

    try {
      const { data: quotation, error: quoteError } = await supabase
        .from('quotation_header')
        .select(`
          *,
          client:clients(*),
          project:projects(id, project_name, project_code),
          items:quotation_items(
            *,
            item:materials(id, item_code, display_name, name, hsn_code)
          )
        `)
        .eq('id', quotationId)
        .single();

      if (quoteError || !quotation) return null;

      // Fetch Terms & Conditions
      const { data: termsConditions } = await supabase
        .from('quotation_terms_conditions')
        .select('*')
        .eq('quotation_id', quotationId)
        .maybeSingle();

      let template = null;
      if (quotation.template_id) {
        const { data } = await supabase
          .from('document_templates')
          .select('*')
          .eq('id', quotation.template_id)
          .single();
        template = data;
      }
      
      if (!template) {
        // Org-specific default wins over the global one (multiple defaults
        // can coexist across scopes); .single() would error on multiples.
        const { data } = await supabase
          .from('document_templates')
          .select('*')
          .eq('document_type', 'Quotation')
          .eq('is_default', true);
        template = (data || []).find((t: any) => t.organisation_id) || (data || [])[0] || null;
      }

      if (!template) {
        // Last resort: any quotation template at all (covers deleted-template
        // references and orgs with no default configured).
        const { data } = await supabase
          .from('document_templates')
          .select('*')
          .eq('document_type', 'Quotation')
          .limit(1)
          .maybeSingle();
        template = data || null;
      }

      if (!template) return null;

      let doc: any = null;

      if (template.template_code === 'QTN_TALLY') {
        const { generateQuotationTally } = await import('./QuotationTallyTemplate');
        doc = generateQuotationTally(quotation, org, template);
      } else if (template.template_code === 'QTN_PROFESSIONAL') {
        const { generateProfessionalTemplate } = await import('./ProfessionalTemplate');
        doc = generateProfessionalTemplate(quotation, org, template);
      } else if (template.template_code === 'QTN_ZOHO') {
        const { generateZohoTemplate } = await import('./ZohoTemplate');
        doc = generateZohoTemplate(quotation, org, template);
      } else if (template.template_code === 'QTN_CLASSIC') {
        const { generateClassicQuotationTemplate } = await import('./ClassicQuotationTemplate');
        const quotationWithTerms = { ...quotation, terms_conditions: termsConditions?.custom_content || null };
        doc = generateClassicQuotationTemplate(quotationWithTerms, org, template);
      } else if (template.template_code === 'QTN_GRID_PRO') {
        const { generateProGridQuotationPdf } = await import('../pdf/proGridQuotationPdf');
        const quotationWithTerms = { ...quotation, terms_conditions: termsConditions?.custom_content || null };
        doc = generateProGridQuotationPdf(quotationWithTerms, org, template);
      } else if (template.column_settings?.print?.style === 'sakthi' || template.template_code === 'QTN_SAKTHI') {
        const { generateSakthiPdf } = await import('../pdf/sakthiTemplatePdf');
        const quotationWithTerms = { ...quotation, terms_conditions: termsConditions?.custom_content || null };
        doc = await generateSakthiPdf(quotationWithTerms, org, 'Quotation', template);
      } else if (template.template_code === 'QTN_ENTERPRISE') {
        const { generateQuotationPdf } = await import('../pdf/enterpriseQuotationPdf');
        const quotationWithTerms = { ...quotation, terms_conditions: termsConditions?.custom_content || null };
        const isInterState = quotation.state && org?.state &&
          String(quotation.state).trim().toLowerCase() !== String(org.state).trim().toLowerCase();
        const selectedSignatory = (org?.signatures || []).find((s: any) => s.id == quotation.authorized_signatory_id);
        const entDoc = generateQuotationPdf({
          org: {
            name: org?.name || '', address: org?.address || '', city: org?.city || '', state: org?.state || '',
            pincode: org?.pincode || '', gstin: org?.gstin || '', phone: org?.phone || '', email: org?.email || '', logo_url: org?.logo_url || ''
          },
          client: {
            display_name: quotation.client?.client_name || quotation.client?.name || '',
            billing_address: quotation.billing_address || '',
            gstin: quotation.client?.gstin || quotation.gstin || '',
            state: quotation.client?.state || quotation.state || ''
          },
          header: {
            quotation_no: quotation.quotation_no || '', revision_no: quotation.revision_no || 1,
            date: quotation.date, valid_till: quotation.valid_till, payment_terms: quotation.payment_terms || '',
            reference: quotation.reference || '', prepared_by: quotation.prepared_by || '', remarks: quotation.remarks || '',
            project_name: quotation.project?.project_name || quotation.project?.project_code || ''
          },
          items: (quotation.items || []).map((item: any) => ({
            is_header: item.is_header, is_subtotal: item.is_subtotal, subtotal_label: item.subtotal_label,
            description: item.description || item.item?.name || item.item?.display_name || '',
            item_code: item.item?.item_code || '', hsn_code: item.sac_code || item.item?.hsn_code || '',
            variant_name: item.variant?.variant_name || '', qty: item.qty, uom: item.uom,
            base_rate_snapshot: item.base_rate_snapshot || item.rate, discount_percent: item.discount_percent,
            rate: item.rate, tax_percent: item.tax_percent, line_total: item.line_total,
            custom1: item.custom1, custom2: item.custom2
          })),
          calculations: {
            subtotal: quotation.subtotal || 0, totalItemDiscount: quotation.total_item_discount || 0,
            extraDiscountAmount: quotation.extra_discount_amount || 0,
            cgst: isInterState ? 0 : (quotation.total_tax || 0) / 2,
            sgst: isInterState ? 0 : (quotation.total_tax || 0) / 2,
            igst: isInterState ? (quotation.total_tax || 0) : 0,
            isInterState,
            totalTax: quotation.total_tax || 0, roundOff: quotation.round_off || 0,
            grandTotal: quotation.grand_total || 0, amountInWords: quotation.amount_in_words || ''
          },
          columnSettings: template.column_settings,
          templateFlags: {
            show_logo: template.show_logo !== false,
            show_bank_details: template.show_bank_details !== false,
            show_terms: template.show_terms !== false,
            show_signature: template.show_signature !== false,
          },
          signatory: {
            name: selectedSignatory?.name || '',
            designation: org?.signatory_designation || 'Authorised Signatory',
            for_company: org?.name || ''
          },
          bankDetails: {
            bank_name: org?.bank_name, branch: org?.bank_branch,
            account_name: org?.bank_account_name || org?.name, account_no: org?.bank_account_no,
            ifsc: org?.bank_ifsc, account_type: org?.bank_account_type, swift: org?.bank_swift
          },
          termsAndConditions: termsConditions?.custom_content
            ? [String(termsConditions.custom_content)]
            : ['Payment as per terms mentioned above.', 'This is a system-generated document.'],
          companyLogoBase64: org?.logo_url
        } as any);
        doc = entDoc;
      } else if (template.column_settings?.print?.style === 'vertical' || template.template_code === 'QTN_VERTICAL'
        || template.column_settings?.print?.style === 'saas') {
        const VerticalTemplate = (await import('../templates/VerticalTemplate')).default;
        const SaaSTemplate = (await import('../templates/SaaSTemplate')).default;
        const { createRoot } = await import('react-dom/client');
        const { flushSync } = await import('react-dom');
        const { htmlToPdf } = await import('../utils/htmlTemplateRenderer');
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = '210mm';
        container.style.background = 'white';
        document.body.appendChild(container);
        const root = createRoot(container);
        try {
          const quotationWithTerms = { ...quotation, terms_conditions: termsConditions?.custom_content || null };
          const showFlags = {
            show_logo: template.show_logo !== false,
            show_bank_details: template.show_bank_details !== false,
            show_terms: template.show_terms !== false,
            show_signature: template.show_signature !== false,
          };
          flushSync(() => {
            root.render(template.column_settings?.print?.style === 'saas'
              ? <SaaSTemplate data={quotationWithTerms} organisation={org} templateConfig={template.column_settings} showFlags={showFlags} />
              : <VerticalTemplate data={quotationWithTerms} organisation={org} templateConfig={template.column_settings} showFlags={showFlags} />);
          });
          await new Promise(resolve => setTimeout(resolve, 2000));
          const blob = await htmlToPdf(container, `${quotation.quotation_no || 'quotation'}.pdf`);
          const buf = await blob.arrayBuffer();
          return new Uint8Array(buf);
        } finally {
          root.unmount();
          document.body.removeChild(container);
        }
      } else {
        const { jsPDF } = await import('jspdf');
        doc = new jsPDF();
        doc.setFontSize(16);
        doc.text('Quotation', 10, 10);
        doc.setFontSize(12);
        doc.text(`Quote No: ${quotation.quotation_no}`, 10, 25);
        doc.text(`Date: ${formatDate(quotation.date)}`, 10, 35);
      }

      if (doc) {
        return new Uint8Array(doc.output('arraybuffer'));
      }
      return null;
    } catch (err) {
      console.error('Error generating single PDF:', err);
      return null;
    }
  };

  const handleBulkPrint = async () => {
    if (selectedIds.size === 0) return;
    
    const count = selectedIds.size;
    const confirmMessage = `Generate a single document for ${count} selected quotation(s)? This may take a moment.`;
    if (!confirm(confirmMessage)) return;

    try {
      const { PDFDocument } = await import('pdf-lib');
      const mergedPdf = await PDFDocument.create();
      const ids = Array.from(selectedIds);
      let successCount = 0;

      for (const id of ids) {
        const pdfBytes = await generateSinglePdfUint8Array(id);
        if (pdfBytes) {
          const doc = await PDFDocument.load(pdfBytes);
          const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
          pages.forEach((page) => mergedPdf.addPage(page));
          successCount++;
        }
      }

      if (successCount === 0) {
        alert('Failed to generate any documents.');
        return;
      }

      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Bulk_Quotations_${new Date().getTime()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      
      setSelectedIds(new Set());
    } catch (err: any) {
      alert('Bulk print failed: ' + err.message);
    }
  };

  const downloadQuotationPDF = async (quotationId: string) => {
    if (!organisation) {
      alert('Organisation data not available');
      return;
    }
    const pdfBytes = await generateSinglePdfUint8Array(quotationId);
    if (pdfBytes) {
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Quotation_${quotationId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } else {
      alert('Error generating PDF');
    }
  };

  const previewQuotationPdf = async (quotationId: string, quotationNo: string) => {
    setPreviewLoading(true);
    setPreviewLoadingId(quotationId);
    setPreviewQuotationNo(quotationNo);
    setPreviewQuotationId(quotationId);
    try {
      const pdfBytes = await generateSinglePdfUint8Array(quotationId);
      if (pdfBytes) {
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
        setPdfPreviewUrl(url);
        setShowPdfPreviewModal(true);
      } else {
        alert('No usable quotation template found. Set a default in Settings → Templates → Quotations.');
      }
    } catch (err: any) {
      console.error('Error generating PDF preview:', err);
      alert('Error generating PDF preview: ' + (err?.message || err));
    }
    setPreviewLoading(false);
    setPreviewLoadingId(null);
  };

  const quotationsQuery = useQuery({
    queryKey: ['quotations', statusFilter, organisation?.id],
    queryFn: async () => {
      let query = supabase
        .from('quotation_header')
        .select(`
          *, 
          client:clients(id, client_name, gstin, state), 
          project:projects(id, project_name),
          creator:user_profiles(full_name)
        `)
        .eq('organisation_id', organisation?.id)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'All') query = query.eq('status', toDbStatus(statusFilter));

      const data = await timedSupabaseQuery(query, 'Quotation list');
      const today = new Date().toISOString().split('T')[0];

      return (data || []).map((q: any) =>
        q.status === 'Draft' && q.valid_till && q.valid_till < today
          ? { ...q, status: 'Expired' }
          : q
      );
    },
    enabled: !!organisation?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const quotations = quotationsQuery.data || [];
  const loading = quotationsQuery.isPending && !quotationsQuery.data;

  // Quotation ids that have at least one invoice linked (dedicated Invoiced badge).
  const invoicedQuery = useQuery({
    queryKey: ['invoicedQuotationIds', organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('quotation_id')
        .eq('organisation_id', organisation?.id)
        .not('quotation_id', 'is', null);
      if (error) throw error;
      return new Set((data || []).map((r: any) => r.quotation_id));
    },
    enabled: !!organisation?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const invoicedIds: Set<string> = invoicedQuery.data || new Set();

  const creatorOptions = useMemo(() => {
    const names = new Set<string>();
    quotations.forEach((qt: any) => {
      const n = qt.creator?.full_name || qt.prepared_by;
      if (n) names.add(n);
    });
    return ['All', ...Array.from(names).sort()];
  }, [quotations]);

  const filteredQuotations = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const fromStr = fromDate ? fromDate.toISOString().slice(0, 10) : null;
    const toStr = toDate ? toDate.toISOString().slice(0, 10) : null;
    const items = quotations.filter((qt: any) => {
      if (!(qt.quotation_no?.toLowerCase().includes(q) ||
        qt.client?.client_name?.toLowerCase().includes(q))) return false;
      const d = String(qt.date || '').slice(0, 10);
      if (fromStr && d < fromStr) return false;
      if (toStr && d > toStr) return false;
      if (createdByFilter !== 'All' && (qt.creator?.full_name || qt.prepared_by) !== createdByFilter) return false;
      return true;
    });

    if (sortOrder) {
      items.sort((a: any, b: any) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      });
    }

    return items;
  }, [quotations, searchTerm, sortOrder, fromDate, toDate, createdByFilter]);

  const fmtShort = (d: Date | undefined) => (d ? formatDateTable(d) : '');

  const sameDay = (a?: Date, b?: Date) =>
    !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const datePresets = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const startOfMonth = new Date(y, m, 1);
    const endOfMonth = new Date(y, m + 1, 0);
    const startOfLastMonth = new Date(y, m - 1, 1);
    const endOfLastMonth = new Date(y, m, 0);
    const fyStartYear = m >= 3 ? y : y - 1;
    const fyStart = new Date(fyStartYear, 3, 1);
    const fyEnd = new Date(fyStartYear + 1, 2, 31);
    const fyLabel = `FY${String(fyStartYear).slice(2)}-${String(fyStartYear + 1).slice(2)}`;
    return [
      { key: 'year', label: `This Year (${y})`, from: new Date(y, 0, 1), to: new Date(y, 11, 31) },
      { key: 'fy', label: fyLabel, from: fyStart, to: fyEnd },
      { key: 'month', label: 'This Month', from: startOfMonth, to: endOfMonth },
      { key: 'last', label: 'Last Month', from: startOfLastMonth, to: endOfLastMonth },
    ];
  }, []);

  const activePreset = datePresets.find(p => sameDay(p.from, fromDate) && sameDay(p.to, toDate))?.key || null;
  const [customOpen, setCustomOpen] = useState(false);

  const dateFilterTitle = fromDate || toDate
    ? `Dates: ${fromDate ? fmtShort(fromDate) : '…'} → ${toDate ? fmtShort(toDate) : '…'}`
    : 'Filter by date';

  const [createdByOpen, setCreatedByOpen] = useState(false);

  const dateFilterExtra = (
    <div className="flex items-center gap-2">
      <Popover open={createdByOpen} onOpenChange={setCreatedByOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={createdByFilter === 'All' ? 'Filter by creator' : `Created by ${createdByFilter}`}
            className={`relative h-[26px] px-2 flex items-center gap-1.5 rounded-md text-sm font-medium transition-colors ${
              createdByFilter !== 'All' ? 'text-blue-600 bg-blue-50' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            <span className="max-w-[110px] truncate">{createdByFilter === 'All' ? 'Creator' : createdByFilter}</span>
            {(createdByFilter !== 'All') && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="start">
          {creatorOptions.map(name => (
            <button
              key={name}
              type="button"
              onClick={() => { setCreatedByFilter(name); setCreatedByOpen(false); }}
              className={`flex w-full items-center justify-between rounded px-2 py-1 text-xs transition-colors ${
                createdByFilter === name ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <span className="truncate">{name === 'All' ? 'All creators' : name}</span>
              {createdByFilter === name && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />}
            </button>
          ))}
        </PopoverContent>
      </Popover>
      <Popover onOpenChange={(open) => { if (!open) setCustomOpen(false); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={dateFilterTitle}
            className={`relative h-[26px] w-[26px] flex items-center justify-center rounded-md transition-colors ${
              (fromDate || toDate) ? 'text-blue-600 bg-blue-50' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <FilterIcon className="w-4 h-4" />
            {(fromDate || toDate) && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-600" />}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="start">
          {datePresets.map(p => (
            <button
              key={p.key}
              type="button"
              onClick={() => { setFromDate(p.from); setToDate(p.to); setCustomOpen(false); }}
              className={`flex w-full items-center justify-between rounded px-2 py-1 text-xs transition-colors ${
                activePreset === p.key ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              {p.label}
              {activePreset === p.key && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCustomOpen(v => !v)}
            className={`flex w-full items-center justify-between rounded px-2 py-1 text-xs transition-colors ${
              customOpen || (activePreset === null && (fromDate || toDate)) ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            Custom
            <span className="text-[11px] text-zinc-400">single or range</span>
          </button>
          {customOpen && (
            <div className="border-t border-zinc-100 mt-1 pt-1 flex justify-center">
              <Calendar
                mode="range"
                selected={fromDate ? { from: fromDate, to: toDate } : undefined}
                onSelect={(range: any) => {
                  setFromDate(range?.from);
                  setToDate(range?.to);
                }}
                initialFocus
              />
            </div>
          )}
          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={() => { setFromDate(undefined); setToDate(undefined); setCustomOpen(false); }}
              className="flex w-full items-center justify-center gap-2 rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50 transition-colors"
            >
              <ClearIcon className="w-3.5 h-3.5" />
              Clear dates
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );

  // Pagination calculations (header stats/total-value removed from display)
  const paginationData = useMemo(() => {
    const totalItems = filteredQuotations.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentItems = filteredQuotations.slice(startIndex, endIndex);

    return {
      totalItems,
      totalPages,
      startIndex,
      endIndex,
      currentItems,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1
    };
  }, [filteredQuotations, currentPage, itemsPerPage]);

  const toggleSort = () => {
    if (sortOrder === null) setSortOrder('desc');
    else if (sortOrder === 'desc') setSortOrder('asc');
    else setSortOrder(null);
  };

  const handleBulkStatusUpdate = async (status: string) => {
    if (selectedIds.size === 0) return;
    
    const confirmMessage = `Are you sure you want to mark ${selectedIds.size} quotation(s) as ${status}?`;
    if (!confirm(confirmMessage)) return;

    try {
      const { error } = await supabase
        .from('quotation_header')
        .update({ status, updated_at: new Date().toISOString() })
        .in('id', Array.from(selectedIds))
        .eq('organisation_id', organisation?.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      setSelectedIds(new Set());
    } catch (err: any) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const QUOTE_SHELL_COLUMNS: ShellColumn[] = [
    { id: 'date', label: 'Date', width: '120px', sortable: true },
    { id: 'quotation_no', label: 'Quote No', width: '120px' },
    { id: 'revision_no', label: 'Rev No', width: '90px' },
    { id: 'project', label: 'Project', width: '200px' },
    { id: 'client', label: 'Client', width: '260px' },
    { id: 'prepared_by', label: 'Created By', width: '150px' },
    { id: 'status', label: 'Status', width: '140px', tdClass: 'text-left whitespace-nowrap' },
    { id: 'subtotal', label: 'Sub-total', width: '100px', align: 'left', tdClass: 'font-medium text-zinc-900 tabular-nums whitespace-nowrap' },
    { id: 'total_tax', label: 'Tax Amount', width: '100px', align: 'left', tdClass: 'font-medium text-zinc-900 tabular-nums whitespace-nowrap' },
    { id: 'grand_total', label: 'Amount', width: '100px', align: 'left', tdClass: 'font-medium text-zinc-900 tabular-nums whitespace-nowrap' },
  ];

  const renderQuoteCell = (col: ShellColumn, q: any) => {
    if (col.id === 'date') return <span className="font-medium text-zinc-900 whitespace-nowrap">{formatDateTable(q.date)}</span>;
    if (col.id === 'quotation_no') return (
      <span className="whitespace-nowrap">
        <span className="font-semibold" style={{ color: '#2d62cd' }}>{q.quotation_no}</span>
        {q.revision_no && q.revision_no > 1 ? (
          <span className="ml-1.5 px-1.5 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 rounded inline-block">
            (Rev {String(q.revision_no).padStart(2, '0')})
          </span>
        ) : null}
      </span>
    );
    if (col.id === 'revision_no') return (
      <span className="px-2 py-0.5 text-xs font-semibold bg-zinc-100 text-zinc-700 rounded border border-zinc-200 inline-block">
        Rev {String(q.revision_no || 1).padStart(2, '0')}
      </span>
    );
    if (col.id === 'project') return (
      <div className="max-w-[180px] truncate" title={q.project?.project_name || '-'}>
        {q.project?.project_name || '-'}
      </div>
    );
    if (col.id === 'client') return (
      <div className="max-w-[220px] truncate" title={q.client?.client_name || '-'}>
        {q.client?.client_name || '-'}
      </div>
    );
    if (col.id === 'prepared_by') return (
      <div className="truncate" title={q.creator?.full_name || q.prepared_by || '-'}>
        {q.creator?.full_name || q.prepared_by || '-'}
      </div>
    );
    if (col.id === 'status') return (
      <div className="flex flex-col gap-1">
        <span
          className="text-sm font-medium"
          style={{ color: getStatusColor(displayStatus(q)).color }}
        >
          {displayStatus(q)}
        </span>
        {invoicedIds.has(q.id) && (
          <span
            title="At least one invoice is linked to this quotation"
            className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 border border-sky-200 w-fit"
          >
            Invoiced
          </span>
        )}
        {q.approval_status && q.approval_status !== 'none' && (
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                q.approval_status === 'Revision Requested'
                  ? 'bg-orange-100 text-orange-700'
                  : q.approval_status === 'Pending'
                  ? 'bg-amber-100 text-amber-700'
                  : q.approval_status === 'Approved'
                  ? 'bg-emerald-100 text-emerald-700'
                  : q.approval_status === 'Rejected'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-zinc-100 text-zinc-600'
              }`}
            >
              {q.approval_status === 'Revision Requested' ? 'Returned/Query' : q.approval_status === 'Pending' ? 'Pending Approval' : q.approval_status}
            </span>
            {q.approval_status === 'Revision Requested' && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  setReturnComment({ open: true, quotationId: q.id, comment: '', loading: true });
                  try {
                    const { data: approvals } = await supabase
                      .from('approvals')
                      .select('id')
                      .eq('reference_id', q.id)
                      .eq('reference_type', 'quotations')
                      .maybeSingle();
                    if (approvals) {
                      const res = await ApprovalAPI.getApprovalHistory(approvals.id);
                      const returned = (res.data || []).filter((a: any) => a.action === 'RETURNED');
                      const comment = returned.length > 0 ? (returned[returned.length - 1].comments || 'No details') : 'No details';
                      setReturnComment({ open: true, quotationId: q.id, comment, loading: false });
                    } else {
                      setReturnComment({ open: true, quotationId: q.id, comment: 'No approval record found', loading: false });
                    }
                  } catch {
                    setReturnComment({ open: true, quotationId: q.id, comment: 'Failed to load', loading: false });
                  }
                }}
                className="text-[11px] text-blue-600 hover:underline font-medium"
              >
                View
              </button>
            )}
          </div>
        )}
      </div>
    );
    if (col.id === 'subtotal') return <div className="text-left">{formatCurrency(q.subtotal)}</div>;
    if (col.id === 'total_tax') return <div className="text-left">{formatCurrency(q.total_tax)}</div>;
    if (col.id === 'grand_total') return <div className="text-left">{formatCurrency(q.grand_total)}</div>;
    return null;
  };

  const quoteRowMenuItems = (q: any) => {
    const items: any[] = [
      { label: 'View Details', icon: EyeIcon, onClick: () => navigate(`/quotation/view?id=${q.id}`) },
      { label: 'Download PDF', icon: DownloadIcon, onClick: () => downloadQuotationPDF(q.id) },
      { label: `Revision History ${q.revision_history?.length ? `(${q.revision_history.length})` : ''}`, icon: RotateCcw, onClick: () => setSelectedHistoryQuotation(q) },
    ];
    if (q.revision_history?.length > 0) {
      items.push({ label: 'Compare Revisions (Excel View)', icon: Table2, tone: 'blue', onClick: () => setSelectedCompareQuotation(q) });
    }
    items.push(
      { label: 'Convert to Invoice', dividerBefore: true, onClick: () => navigate(`/invoices/create?convertFrom=quotation-to-invoice&sourceId=${q.id}`) },
      { label: 'Convert to Proforma', onClick: () => navigate(`/proforma-invoices/create?convertFrom=quotation-to-proforma&sourceId=${q.id}`) },
      { label: 'Convert to Delivery', onClick: () => navigate(`/dc/create?convertFrom=quotation-to-dc&sourceId=${q.id}`) },
      { label: 'Convert to Sales Order', onClick: () => navigate(`/sales-orders/create?quotationId=${q.id}`) },
      { label: 'Edit', dividerBefore: true, onClick: () => navigate(`/quotation/edit?id=${q.id}`) },
    );
    if (q.status === 'Draft' || q.status === 'Approved') {
      items.push({
        label: 'Mark as Sent', tone: 'blue',
        onClick: async () => {
          const now = new Date().toISOString();
          const update: any = { updated_at: now, sent_at: now };
          if (q.status === 'Draft') update.status = 'Sent';
          const { error } = await supabase
            .from('quotation_header')
            .update(update)
            .eq('id', q.id)
            .eq('organisation_id', organisation?.id);
          if (error) {
            alert('Failed to mark as sent: ' + error.message);
            return;
          }
          queryClient.invalidateQueries({ queryKey: ['quotations'] });
        },
      });
    }
    items.push(
      {
        label: 'Duplicate',
        onClick: async () => {
          try {
            await duplicateQuotation(q.id);
            await queryClient.invalidateQueries({
              queryKey: ['quotations', statusFilter, organisation?.id]
            });
          } catch (err: any) {
            console.error('Duplicate exception:', err);
            alert('Error duplicating quotation: ' + (err?.message || err));
          }
        },
      },
      {
        label: 'Request Revision', tone: 'amber',
        onClick: async () => {
          if (organisation?.id && q.id) {
            await initiateQuotationRevision(organisation.id, q.id);
          }
        },
      },
      {
        label: 'Delete', danger: true, dividerBefore: true,
        onClick: () => {
          if (confirm('Are you sure you want to delete this quotation?')) {
            supabase.from('approvals').delete().eq('reference_id', q.id).then(() => supabase.from('quotation_header').delete().eq('id', q.id)).then(() => {
              queryClient.invalidateQueries({ queryKey: ['quotations'] });
            });
          }
        },
      },
    );
    return items;
  };

  return (
    <>
      <DocumentListShell

        title="Quotations"
        count={paginationData.totalItems}
        actionsInHeader
        rowDensity="compact"
        filterExtra={dateFilterExtra}
        search={searchTerm}
        onSearch={setSearchTerm}
        searchPlaceholder="Search quotations..."
        statusOptions={STATUS_FILTER_OPTIONS}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        sort={{ value: sortOrder, onToggle: toggleSort, columnId: 'date' }}
        columns={QUOTE_SHELL_COLUMNS}
        visibleIds={visibleColumns}
        onVisibleChange={setVisibleColumns}
        columnCustomizer={(
          <div className="relative" ref={columnCustomizerRef}>
            <button
              onClick={() => setShowColumnCustomizer(!showColumnCustomizer)}
              className="inline-flex items-center justify-center text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100 transition-colors active:scale-[0.98]"
              style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '10px', paddingRight: '10px' }}
            >
              Columns
            </button>
            {showColumnCustomizer && (
              <div className="absolute right-0 top-full mt-2 z-[110] w-64 bg-white border border-zinc-200 rounded-xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="mb-4">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Visible Columns</h3>
                  <div className="space-y-[10px]">
                    {ALL_COLUMNS.map((col) => {
                      const isMandatory = MANDATORY_COLUMNS.includes(col.id);
                      return (
                        <label
                          key={col.id}
                          className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                            isMandatory ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-50 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={tempVisibleColumns.includes(col.id)}
                            disabled={isMandatory}
                            onChange={(e) => {
                              if (isMandatory) return;
                              if (e.target.checked) {
                                setVisibleColumnsTemp([...tempVisibleColumns, col.id]);
                              } else {
                                setVisibleColumnsTemp(tempVisibleColumns.filter(id => id !== col.id));
                              }
                            }}
                            className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm font-medium text-zinc-700">{col.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-4 border-t border-zinc-100">
                  <button
                    onClick={() => {
                      setVisibleColumns(tempVisibleColumns);
                      localStorage.setItem('quotation_list_columns', JSON.stringify(tempVisibleColumns));
                      setShowColumnCustomizer(false);
                    }}
                    className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-600 transition-colors active:scale-[0.98]"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setVisibleColumnsTemp(visibleColumns);
                      setShowColumnCustomizer(false);
                    }}
                    className="flex-1 px-3 py-1.5 bg-zinc-100 text-zinc-600 text-xs font-medium rounded-lg hover:bg-zinc-200 transition-colors active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        createButton={(
          <PermissionGuard permission="quotations.create">
            <button
              onClick={() => navigate('/quotation/create')}
              className="inline-flex items-center justify-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors active:scale-[0.98]"
              style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '10px', paddingRight: '10px' }}
            >
              Create Quotation
            </button>
          </PermissionGuard>
        )}
        rows={paginationData.currentItems}
        getRowId={(q: any) => q.id}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onClearSelection={() => setSelectedIds(new Set())}
        onRowClick={(q: any) => {
          if (selectedIds.size === 0) {
            navigate(`/quotation/view?id=${q.id}`);
          } else {
            toggleSelect(q.id);
          }
        }}
        renderCell={renderQuoteCell}
        eyeButton={(q: any) => ({
          onPreview: () => { if (!previewLoading) previewQuotationPdf(q.id, q.quotation_no); },
          loading: previewLoadingId === q.id,
        })}
        rowMenuItems={quoteRowMenuItems}
        bulkBar={{
          render: (ids, clear) => (
            <>
              <button
                onClick={handleBulkPrint}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-zinc-900 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-zinc-100 transition-all active:scale-[0.98]"
              >
                <PrinterIcon className="w-3.5 h-3.5" />
                Print Selected
              </button>
              <button
                onClick={() => {
                  if (confirm(`Are you sure you want to delete ${ids.size} quotation(s)?`)) {
                    supabase
                      .from('quotation_header')
                      .delete()
                      .in('id', Array.from(ids))
                      .eq('organisation_id', organisation?.id)
                      .then(({ error }) => {
                        if (error) alert('Error: ' + error.message);
                        else {
                          queryClient.invalidateQueries({ queryKey: ['quotations'] });
                          clear();
                        }
                      });
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-red-700 transition-all active:scale-[0.98]"
              >
                <Trash2Icon className="w-3.5 h-3.5" />
                Delete All
              </button>
            </>
          ),
        }}
        paginationRender={(
          <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 bg-zinc-50/50">
            <div className="text-sm font-medium text-zinc-600">
              Showing {paginationData.totalItems === 0 ? 0 : paginationData.startIndex + 1} to {Math.min(paginationData.endIndex, paginationData.totalItems)} of {paginationData.totalItems} quotes
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={!paginationData.hasPrevPage}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors h-[32px] min-w-[80px] flex items-center justify-center ${
                  paginationData.hasPrevPage
                    ? 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm'
                    : 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed'
                }`}
              >
                Previous
              </button>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: Math.max(1, Math.min(5, paginationData.totalPages)) }, (_, i) => {
                  let pageNum;
                  if (paginationData.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= paginationData.totalPages - 2) {
                    pageNum = paginationData.totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors h-[32px] min-w-[32px] flex items-center justify-center ${
                        currentPage === pageNum
                          ? 'bg-blue-600/10 text-blue-600 border border-blue-600/20 shadow-sm'
                          : 'text-zinc-600 hover:bg-zinc-100 bg-white border border-zinc-200'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={!paginationData.hasNextPage}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors h-[32px] min-w-[80px] flex items-center justify-center ${
                  paginationData.hasNextPage
                    ? 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm'
                    : 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed'
                }`}
              >
                Next
              </button>
            </div>
          </div>
        )}
        loading={loading}
        loadingText="Loading quotations..."
        emptyTitle="No quotations found"
      />
      {/* Return Comment Dialog */}
      {returnComment.open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setReturnComment({ open: false, quotationId: null, comment: '', loading: false })}>
          <div className="fixed inset-0 bg-black/40" />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-orange-600" />
              <h3 className="text-sm font-semibold text-zinc-800">Return Comments</h3>
            </div>
            <div className="min-h-[60px]">
              {returnComment.loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                </div>
              ) : (
                <p className="text-sm text-zinc-700 bg-orange-50 border border-orange-200 rounded-lg p-3">
                  {returnComment.comment}
                </p>
              )}
            </div>
            <div className="flex justify-end mt-3">
              <button
                onClick={() => setReturnComment({ open: false, quotationId: null, comment: '', loading: false })}
                className="px-4 py-1.5 text-sm font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {showPdfPreviewModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-[210mm] h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center px-4 py-2 bg-zinc-100 border-b border-zinc-200 select-none shrink-0 justify-between" style={{ gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280' }}>{previewQuotationNo || 'Quotation'}</span>
              <div className="flex items-center" style={{ gap: '6px' }}>
                <button
                  onClick={() => { setShowPdfPreviewModal(false); navigate(`/quotation/edit?id=${previewQuotationId}`); }}
                  style={{
                    padding: '7px 16px',
                    background: 'transparent',
                    border: '1px solid #185FA5',
                    color: '#185FA5',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f0f5ff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Edit className="w-[14px] h-[14px]" /> Edit
                </button>
                <button
                  onClick={async () => {
                    if (!pdfPreviewUrl) return;
                    try {
                      if (navigator.share) {
                        const response = await fetch(pdfPreviewUrl);
                        const blob = await response.blob();
                        const file = new File([blob], `${previewQuotationNo || 'quotation'}.pdf`, { type: 'application/pdf' });
                        await navigator.share({ files: [file], title: previewQuotationNo || 'Quotation' });
                      } else {
                        await navigator.clipboard.writeText(window.location.href);
                      }
                    } catch (e) {
                      if (e.name !== 'AbortError') {
                        try { await navigator.clipboard.writeText(window.location.href); } catch {}
                      }
                    }
                  }}
                  style={{
                    padding: '7px 16px',
                    background: 'transparent',
                    border: '1px solid #d1d5db',
                    color: '#374151',
                    fontSize: '12px',
                    fontWeight: 500,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Share2 className="w-[14px] h-[14px]" /> Share
                </button>
                <button
                  onClick={() => { setShowPdfPreviewModal(false); if (pdfPreviewUrl) { URL.revokeObjectURL(pdfPreviewUrl); setPdfPreviewUrl(null); } }}
                  style={{
                    padding: '6px',
                    background: 'transparent',
                    border: 'none',
                    color: '#9ca3af',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#374151'; e.currentTarget.style.background = '#e5e7eb'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <XCircle className="w-[18px] h-[18px]" />
                </button>
              </div>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 bg-zinc-900 min-h-0">
              {pdfPreviewUrl ? (
                <iframe src={pdfPreviewUrl} className="w-full h-full" style={{ border: 'none' }} title="PDF Preview" />
              ) : (
                <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-zinc-400" /></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Revision History Modal */}
      {selectedHistoryQuotation && (
        <RevisionHistoryDialog
          open={!!selectedHistoryQuotation}
          onClose={() => setSelectedHistoryQuotation(null)}
          quotationId={selectedHistoryQuotation.id}
          revisionHistory={selectedHistoryQuotation.revision_history || []}
          currentRevisionNo={selectedHistoryQuotation.revision_no || 1}
          currentTotal={selectedHistoryQuotation.grand_total || 0}
          documentNumber={selectedHistoryQuotation.quotation_no || 'Quotation'}
          onRestoreRevision={(rev) => {
            const qId = selectedHistoryQuotation.id;
            setSelectedHistoryQuotation(null);
            navigate(`/quotation/edit?id=${qId}&restoreRev=${rev.revision_no}`);
          }}
        />
      )}

      {/* Revision Compare Modal */}
      {selectedCompareQuotation && (
        <QuotationRevisionCompareModal
          open={!!selectedCompareQuotation}
          onClose={() => setSelectedCompareQuotation(null)}
          quotationId={selectedCompareQuotation.id}
          documentNumber={selectedCompareQuotation.quotation_no || 'Quotation'}
          revisionHistory={selectedCompareQuotation.revision_history || []}
          currentRevisionNo={selectedCompareQuotation.revision_no || 1}
          currentTotal={selectedCompareQuotation.grand_total || 0}
          onRestoreRevision={(rev) => {
            const qId = selectedCompareQuotation.id;
            setSelectedCompareQuotation(null);
            navigate(`/quotation/edit?id=${qId}&restoreRev=${rev.revision_no}`);
          }}
        />
      )}
    </>
  );
}