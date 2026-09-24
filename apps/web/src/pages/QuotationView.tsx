import { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '../components/ui/button';
import DOMPurify from 'dompurify';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { duplicateQuotation } from '../api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatDate, formatCurrency } from '../utils/formatters';
import { useAuth } from '../App';
import { timedSupabaseQuery } from '../utils/queryTimeout';
import SaaSTemplate from '../templates/SaaSTemplate';
import VerticalTemplate from '../templates/VerticalTemplate';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Printer, Edit, Copy, MoreHorizontal, Trash2, XCircle, CheckCircle, ArrowLeft, ChevronDown, Mail, Download, Eye, FileText, Loader2, RotateCcw, Share2, Settings2, Search, X, Table2, PackageSearch, ClipboardList, FileEdit, Send, History, Paperclip, ScrollText, Building2, Truck } from 'lucide-react';
import { useVariants } from '../hooks/useVariants';
import { ApprovalAPI } from '../approvals/api';
import { ApprovalIntegration } from '../approvals/integration';
import { postQuotationChannelCard } from '../projects/features/collaboration/api';
import { initiateQuotationRevision } from '../lib/quotation-workflow';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../components/ui/resizable';
import DocumentSettingsDrawer from '../components/document-settings/DocumentSettingsDrawer';
import { numberToInrWords } from '../pdf/numberToWords';
import { RevisionHistoryDialog } from '../components/RevisionHistoryDialog';
import { generateQuotationPdf } from '../pdf/enterpriseQuotationPdf';
import { generateSakthiPdf } from '../pdf/sakthiTemplatePdf';
import { htmlToPdf } from '../utils/htmlTemplateRenderer';
import { QuotationRevisionCompareModal } from '../components/QuotationRevisionCompareModal';
import { FloatingQuoteChat } from '../projects/features/collaboration/components/FloatingQuoteChat';

const getStatusBadge = (status) => {
  const colors = {
    'Draft': { bg: '#f3f4f6', color: '#6b7280' },
    'Sent': { bg: '#dbeafe', color: '#1e40af' },
    'Under Negotiation': { bg: '#fef3c7', color: '#b45309' },
    'Approved': { bg: '#d1fae5', color: '#047857' },
    'PENDING_APPROVAL': { bg: '#fef3c7', color: '#d97706' },
    'Rejected': { bg: '#fee2e2', color: '#dc2626' },
    'Converted': { bg: '#dbeafe', color: '#1e40af' },
    'Cancelled': { bg: '#fee2e2', color: '#991b1b' },
    'Expired': { bg: '#f3f4f6', color: '#9ca3af' }
  };
  const style = colors[status] || colors['Draft'];
  return (
    <span style={{
      background: style.bg,
      color: style.color,
      padding: '4px 12px',
      borderRadius: '12px',
      fontSize: '13px',
      fontWeight: 600
    }}>
      {status}
    </span>
  );
};

const LIST_TABS = ['All', 'Draft', 'Sent', 'Approved', 'Pending', 'Expired'];

const LIST_TAB_STATUS: Record<string, string | null> = {
  All: null,
  Draft: 'Draft',
  Sent: 'Sent',
  Approved: 'Approved',
  Pending: 'PENDING_APPROVAL',
  Expired: 'Expired',
};

const formatCurrencyNoSymbol = (amount: any) => {
  const n = parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
};

const formatDateTime = (ts: any) => {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const LIST_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Draft: { bg: '#F3F4F6', color: '#6B7280' },
  Sent: { bg: '#DBEAFE', color: '#1D4ED8' },
  Approved: { bg: '#D1FAE5', color: '#047857' },
  Expired: { bg: '#FEE2E2', color: '#B91C1C' },
  'Under Negotiation': { bg: '#FEF3C7', color: '#B45309' },
  PENDING_APPROVAL: { bg: '#FEF3C7', color: '#B45309' },
  Rejected: { bg: '#FEE2E2', color: '#B91C1C' },
  Converted: { bg: '#DBEAFE', color: '#1D4ED8' },
  Cancelled: { bg: '#F3F4F6', color: '#9CA3AF' },
};

export default function QuotationView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quotationId = searchParams.get('id');
  const { organisation, user } = useAuth();
  
  const isEmbed = searchParams.get('embed') === 'true';
  const [embedPdfUrl, setEmbedPdfUrl] = useState<string | null>(null);
  const [embedLoading, setEmbedLoading] = useState(false);
  const [embedError, setEmbedError] = useState<string | null>(null);

  const [showConvertMenu, setShowConvertMenu] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewComments, setReviewComments] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [showStockCheckModal, setShowStockCheckModal] = useState(false);
  const [launchingStockCheck, setLaunchingStockCheck] = useState(false);
  // Informational stock availability (display-only - no reservations, no writes)
  const [showAvailability, setShowAvailability] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityRows, setAvailabilityRows] = useState<any[]>([]);
  const [launchingRevision, setLaunchingRevision] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [printLoading, setPrintLoading] = useState(false);
  const [showDocumentSettings, setShowDocumentSettings] = useState(false);
  
  // Preview modal state
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewHTML, setPreviewHTML] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [listSearch, setListSearch] = useState('');
  const [listStatusTab, setListStatusTab] = useState('All');
  const [listSortAsc, setListSortAsc] = useState(false);
  const [previewTab, setPreviewTab] = useState('Preview');
  const [historySubTab, setHistorySubTab] = useState<'timeline' | 'feedback'>('timeline');
  const [itemFilter, setItemFilter] = useState('');
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showTemplateSelect, setShowTemplateSelect] = useState(false);

  // PDF Preview modal state
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  
  const quotationQuery = useQuery({
    queryKey: ['quotation', quotationId, organisation?.id],
    queryFn: async () => {
      if (!quotationId) return null;
      const query = supabase
        .from('quotation_header')
        .select(`
          *,
          client:clients(*),
          project:projects(id, project_name, project_code),
          items:quotation_items(*, item:materials(id, item_code, display_name, name, hsn_code))
        `)
        .eq('id', quotationId)
        .eq('organisation_id', organisation?.id || '00000000-0000-0000-0000-000000000000')
        .single();

      const data = await timedSupabaseQuery(query, 'Quotation view');
      return data;
    },
    enabled: !!quotationId && !!organisation?.id,
  });

  const templatesQuery = useQuery({
    queryKey: ['documentTemplates', 'Quotation'],
    queryFn: async () => {
      const data = await timedSupabaseQuery(
        supabase
          .from('document_templates')
          .select('*')
          .eq('document_type', 'Quotation')
          .eq('active', true)
          .order('is_default', { ascending: false }),
        'Quotation templates',
      );
      return data || [];
    },
    staleTime: 10 * 60 * 1000
  });

  const quotation = quotationQuery.data;
  const templates = templatesQuery.data || [];
  const loading = quotationQuery.isPending;

  // Separate query for Terms & Conditions
  const termsConditionsQuery = useQuery({
    queryKey: ['quotation-terms', quotationId],
    queryFn: async () => {
      if (!quotationId) return null;
      const data = await timedSupabaseQuery(
        supabase
          .from('quotation_terms_conditions')
          .select('*')
          .eq('quotation_id', quotationId)
          .maybeSingle(),
        'Quotation terms conditions',
      );
      return data;
    },
    enabled: !!quotationId
  });

  const quotationsQuery = useQuery({
    queryKey: ['quotations', organisation?.id],
    queryFn: async () => {
      const data = await timedSupabaseQuery(
        supabase
          .from('quotation_header')
          .select(`*, client:clients(id, client_name, gstin, state), project:projects(id, project_name)`)
          .eq('organisation_id', organisation?.id)
          .order('created_at', { ascending: false }),
        'Quotation list sidebar'
      );
      return data || [];
    },
    enabled: !!organisation?.id
  });

  const quotations = quotationsQuery.data || [];
  const { data: allVariants = [] } = useVariants();

  const listStatusCounts = useMemo(() => {
    const byStatus: Record<string, number> = {};
    quotations.forEach((q: any) => {
      if (q.status) byStatus[q.status] = (byStatus[q.status] || 0) + 1;
    });
    const counts: Record<string, number> = { All: quotations.length };
    LIST_TABS.forEach((tab) => {
      if (tab === 'All') return;
      counts[tab] = byStatus[LIST_TAB_STATUS[tab] as string] || 0;
    });
    return counts;
  }, [quotations]);

  const quoteApprovalsQuery = useQuery({
    queryKey: ['quotation-approvals', quotationId],
    queryFn: async () => {
      if (!quotationId) return [];
      try {
        const { data, error } = await supabase
          .from('approvals')
          .select('id, title, amount, status, review_status, requested_at, requested_by, requester_name, requester_role, reviewer_id, reviewed_at, created_at, updated_at')
          .eq('reference_type', 'quotations')
          .eq('reference_id', quotationId)
          .order('requested_at', { ascending: true });
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.warn('Unable to load quotation approvals:', err);
        return [];
      }
    },
    enabled: !!quotationId,
  });

  const quoteApprovalIds = useMemo(
    () => (quoteApprovalsQuery.data || []).map((a: any) => a.id),
    [quoteApprovalsQuery.data]
  );

  const quoteApprovalActionsQuery = useQuery({
    queryKey: ['quotation-approval-actions', quotationId, quoteApprovalIds.join('|')],
    queryFn: async () => {
      if (quoteApprovalIds.length === 0) return [];
      try {
        const { data, error } = await supabase
          .from('approval_actions')
          .select('id, approval_id, action, approver_id, approver_role, comments, action_at, created_at')
          .in('approval_id', quoteApprovalIds)
          .order('action_at', { ascending: true });
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.warn('Unable to load approval actions:', err);
        return [];
      }
    },
    enabled: !!quotationId && quoteApprovalIds.length > 0,
  });

  const quoteActivityQuery = useQuery({
    queryKey: ['quotation-activity', quotationId],
    queryFn: async () => {
      if (!quotationId) return [];
      try {
        const { data, error } = await supabase
          .from('quotation_activity_log')
          .select('id, event_type, summary, created_by, created_at')
          .eq('quotation_id', quotationId)
          .order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.warn('Unable to load quotation activity:', err);
        return [];
      }
    },
    enabled: !!quotationId,
  });

  const historyUserIds = useMemo(() => {
    const ids = new Set<string>();
    const qq: any = quotation;
    if (qq?.created_by) ids.add(qq.created_by);
    (qq?.revision_history || []).forEach((r: any) => { if (r?.saved_by) ids.add(r.saved_by); });
    (quoteApprovalsQuery.data || []).forEach((a: any) => { if (a.requested_by) ids.add(a.requested_by); });
    (quoteApprovalActionsQuery.data || []).forEach((x: any) => { if (x.approver_id) ids.add(x.approver_id); });
    (quoteActivityQuery.data || []).forEach((l: any) => { if (l?.created_by) ids.add(l.created_by); });
    return Array.from(ids);
  }, [quotation, quoteApprovalsQuery.data, quoteApprovalActionsQuery.data, quoteActivityQuery.data]);

  const userNamesQuery = useQuery({
    queryKey: ['quotation-history-users', quotationId, historyUserIds.join('|')],
    queryFn: async () => {
      if (historyUserIds.length === 0) return {};
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, user_id, full_name, email')
          .or(`id.in.(${historyUserIds.join(',')}),user_id.in.(${historyUserIds.join(',')})`);
        if (error) throw error;
        const map: Record<string, string> = {};
        (data || []).forEach((u: any) => {
          const label = u.full_name || (u.email ? u.email.split('@')[0] : '') || 'Unknown user';
          if (u.id && !map[u.id]) map[u.id] = label;
          if (u.user_id && !map[u.user_id]) map[u.user_id] = label;
        });
        return map;
      } catch (err) {
        console.warn('Unable to load history user names:', err);
        return {};
      }
    },
    enabled: !!quotationId && historyUserIds.length > 0,
  });

  const previewTpl = templates.find((t: any) => t.id === selectedTemplateId);
  const previewOpt = previewTpl?.column_settings?.optional || {};
  const selectedSignatory = useMemo(() => {
    const sigs: any[] = ((organisation as any)?.signatures || []);
    const q: any = quotation;
    return sigs.find((s: any) => String(s.id) === String(q?.authorized_signatory_id)) || sigs[0] || null;
  }, [organisation, quotation]);
  const showPrev = {
    sno: previewOpt.sno !== false,
    hsn: previewOpt.hsn_code !== false,
    itemCode: previewOpt.item_code !== false,
    make: previewOpt.make !== false,
    variant: previewOpt.variant !== false,
    qty: previewOpt.qty !== false,
    uom: previewOpt.uom !== false,
    rate: previewOpt.rate !== false,
    disc: previewOpt.discount_percent !== false,
    netRate: previewOpt.rate_after_discount !== false,
    tax: previewOpt.tax_percent !== false,
    custom1: previewOpt.custom1 !== false,
    custom2: previewOpt.custom2 !== false,
  };

  const previewColCount = () => {
    let n = 0;
    if (showPrev.sno) n++;
    if (showPrev.hsn) n++;
    if (showPrev.itemCode) n++;
    if (showPrev.make) n++;
    n++;
    if (showPrev.variant) n++;
    if (showPrev.qty) n++;
    if (showPrev.uom) n++;
    if (showPrev.rate) n++;
    if (showPrev.disc) n++;
    if (showPrev.netRate) n++;
    if (showPrev.tax) n++;
    if (showPrev.custom1) n++;
    if (showPrev.custom2) n++;
    n++;
    return n;
  };

  const visibleItems = useMemo(() => {
    const q = (itemFilter || '').trim().toLowerCase();
    if (!q) return quotation?.items || [];
    return (quotation?.items || []).filter((it: any) =>
      !it.is_header && !it.is_subtotal &&
      (`${it.description || ''} ${it.item?.display_name || ''} ${it.item?.item_code || ''} ${it.hsn_code || ''}`.toLowerCase().includes(q))
    );
  }, [quotation?.items, itemFilter]);

  const quoteSuggestionQuery = useQuery({
    queryKey: ['quotation-suggestions', quotationId],
    queryFn: async () => {
      if (!quotationId) return [];
      try {
        const { data: parents, error: e1 } = await supabase
          .from('project_collaboration_messages')
          .select('id')
          .eq('message_type', 'system')
          .contains('metadata', { linked_entities: [{ type: 'quotation', id: quotationId }] });
        if (e1) throw e1;
        const ids = (parents || []).map((p: any) => p.id);
        if (ids.length === 0) return [];
        const { data, error } = await supabase
          .from('project_collaboration_messages')
          .select('id, content, created_at, sender_id, sender:user_profiles!sender_id(full_name, avatar_url)')
          .in('parent_message_id', ids)
          .order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.warn('Unable to load quotation suggestions:', err);
        return [];
      }
    },
    enabled: !!quotationId,
  });

  const historyEvents = useMemo(() => {
    const evts: any[] = [];
    const q: any = quotation;
    const userNames: Record<string, string> = userNamesQuery.data || {};
    const nameOf = (id: any) => (id && userNames[id]) || '';
    const activityLogs = quoteActivityQuery.data || [];
    const hasCreatedLog = activityLogs.some((l: any) => l.event_type === 'created');
    if (q?.created_at && !hasCreatedLog) {
      evts.push({
        key: 'created',
        at: q.created_at,
        color: '#2563EB',
        title: 'Quotation created',
        by: nameOf(q.created_by),
        desc: q.grand_total ? `Amount ${formatCurrency(q.grand_total)}` : '',
      });
    }
    (q?.revision_history || []).forEach((r: any, i: number) => {
      if (!r?.saved_at) return;
      evts.push({
        key: `rev-${r.revision_no ?? i}`,
        at: r.saved_at,
        color: '#D97706',
        title: `Revision ${r.revision_no ?? i + 1} saved`,
        by: r.saved_by_name || nameOf(r.saved_by),
        desc: r.header?.grand_total ? `Total ${formatCurrency(r.header.grand_total)}` : '',
      });
    });
    const approvals = quoteApprovalsQuery.data || [];
    const actions = quoteApprovalActionsQuery.data || [];
    const actionsByApproval: Record<string, any[]> = {};
    actions.forEach((a: any) => {
      if (!a?.approval_id) return;
      (actionsByApproval[a.approval_id] = actionsByApproval[a.approval_id] || []).push(a);
    });
    const decisionStyle: Record<string, { label: string; color: string }> = {
      APPROVED: { label: 'Approved', color: '#047857' },
      REJECTED: { label: 'Rejected', color: '#B91C1C' },
      RETURNED: { label: 'Returned for revision', color: '#B45309' },
      HOLD: { label: 'Put on hold', color: '#6B7280' },
      FORWARDED: { label: 'Forwarded', color: '#1D4ED8' },
      RESUBMITTED: { label: 'Resubmitted', color: '#1D4ED8' },
    };
    approvals.forEach((a: any) => {
      const requestedAt = a.requested_at || a.created_at;
      if (requestedAt) {
        evts.push({
          key: `req-${a.id}`,
          at: requestedAt,
          color: '#7C3AED',
          title: 'Submitted for approval',
          by: a.requester_name || nameOf(a.requested_by),
          desc: a.amount ? `Amount ${formatCurrency(a.amount)}` : '',
        });
      }
      const acts = (actionsByApproval[a.id] || []).filter((x: any) => x.action_at || x.created_at);
      if (acts.length > 0) {
        acts.forEach((x: any, xi: number) => {
          const d = decisionStyle[x.action] || { label: x.action, color: '#6B7280' };
          evts.push({
            key: `act-${x.id || `${a.id}-${xi}`}`,
            at: x.action_at || x.created_at,
            color: d.color,
            title: d.label,
            by: nameOf(x.approver_id),
            desc: [x.approver_role, x.comments].filter(Boolean).join(' \u00b7 '),
            hasFeedback: !!x.comments,
          });
        });
      } else if (a.status && decisionStyle[a.status]) {
        const d = decisionStyle[a.status];
        const at = a.reviewed_at || a.updated_at;
        if (at) evts.push({ key: `dec-${a.id}`, at, color: d.color, title: d.label, desc: '' });
      }
    });
    activityLogs.forEach((l: any) => {
      if (!l?.created_at) return;
      const s = l.summary || {};
      evts.push({
        key: `log-${l.id}`,
        at: l.created_at,
        color: l.event_type === 'created' ? '#2563EB' : '#6B7280',
        title: l.event_type === 'created' ? 'Quotation created' : 'Quotation edited',
        by: nameOf(l.created_by),
        desc: s.items != null ? `${s.items} items - Total ${formatCurrency(s.total || 0)}` : '',
      });
    });
    (quoteSuggestionQuery.data || []).forEach((m: any) => {
      if (!m?.created_at) return;
      evts.push({
        key: `sug-${m.id}`,
        at: m.created_at,
        color: '#0F766E',
        title: 'Change suggested',
        by: m.sender?.full_name || '',
        desc: m.content || '',
      });
    });
    const all = evts
      .filter((e) => e.at && !isNaN(new Date(e.at).getTime()))
      .sort((x, y) => new Date(x.at).getTime() - new Date(y.at).getTime());
    return {
      all,
      journey: all.filter((e) => !e.key.startsWith('sug-')),
      feedback: all.filter((e) => e.key.startsWith('sug-') || e.hasFeedback),
    };
  }, [quotation, quoteApprovalsQuery.data, quoteApprovalActionsQuery.data, userNamesQuery.data, quoteActivityQuery.data, quoteSuggestionQuery.data]);

  const visibleQuotations = useMemo(() => {
    const s = listSearch.trim().toLowerCase();
    const filtered = quotations.filter((q: any) => {
      if (listStatusTab !== 'All' && q.status !== LIST_TAB_STATUS[listStatusTab]) return false;
      if (!s) return true;
      const client = (q.client?.client_name || '').toLowerCase();
      return client.includes(s) || (q.quotation_no || '').toLowerCase().includes(s);
    });
    return [...filtered].sort((a: any, b: any) => {
      const da = new Date(a.date || a.created_at).getTime() || 0;
      const db = new Date(b.date || b.created_at).getTime() || 0;
      return listSortAsc ? da - db : db - da;
    });
  }, [quotations, listSearch, listStatusTab, listSortAsc]);

  useEffect(() => {
    if (quotation?.template_id) {
      setSelectedTemplateId(quotation.template_id);
    }
  }, [quotation?.template_id]);


  useEffect(() => {
    if (templatesQuery.isError) {
      console.error('Error loading templates:', templatesQuery.error);
    }
  }, [templatesQuery.isError, templatesQuery.error]);

  const generateEmbedPdf = async () => {
    try {
      setEmbedLoading(true);
      setEmbedError(null);

      const templates = templatesQuery.data || [];
      // Prioritize the default template from Template Settings
      let template = templates.find(t => t.is_default);

      if (!template) {
        // Fetch default manually
        const { data } = await supabase
          .from('document_templates')
          .select('*')
          .eq('document_type', 'Quotation')
          .eq('is_default', true)
          .maybeSingle();
        if (data) {
          template = data;
        }
      }

      // Fallback: If no default template exists, try the template from the quotation
      if (!template && quotation?.template_id) {
        template = templates.find(t => t.id === quotation.template_id);
      }

      // Fallback: If still no template, get the first active template
      if (!template) {
        template = templates[0];
      }

      // Fallback: Fetch any quotation template manually
      if (!template) {
        const { data } = await supabase
          .from('document_templates')
          .select('*')
          .eq('document_type', 'Quotation')
          .limit(1)
          .maybeSingle();
        template = data;
      }

      if (!template) {
        throw new Error('No template found. Please set up a template.');
      }

      console.log('PDF Embed mode generating PDF with template:', template.template_name);
      const blob = await downloadPDF(template, 'blob');
      if (blob instanceof Blob) {
        const url = URL.createObjectURL(blob);
        setEmbedPdfUrl(url);
      } else {
        throw new Error('PDF generation did not return a valid Blob.');
      }
    } catch (err: any) {
      console.error('Error generating embed PDF:', err);
      setEmbedError(err?.message || 'Failed to generate quotation PDF');
    } finally {
      setEmbedLoading(false);
    }
  };

  useEffect(() => {
    if (isEmbed && quotation && organisation && templatesQuery.data && !termsConditionsQuery.isPending && !embedPdfUrl && !embedLoading && !embedError) {
      generateEmbedPdf();
    }
  }, [isEmbed, quotation, organisation, templatesQuery.data, termsConditionsQuery.isPending]);

  useEffect(() => {
    return () => {
      if (embedPdfUrl) {
        URL.revokeObjectURL(embedPdfUrl);
      }
    };
  }, [embedPdfUrl]);

  const handleEdit = () => {
    navigate(`/quotation/edit?id=${quotationId}`);
  };

  const handleDuplicate = async () => {
    if (!quotation || !quotationId) return;
    try {
      const newQuote = await duplicateQuotation(quotationId);
      alert('Quotation duplicated!');
      navigate(`/quotation/edit?id=${newQuote.id}`);
    } catch (err: any) {
      console.error('Error duplicating quotation:', err);
      alert('Error duplicating quotation: ' + (err?.message || err));
    }
  };

  const handleConvert = (type) => {
    if (!quotation) return;
    if (type === 'proforma-invoice') {
      navigate(`/proforma-invoices/create?convertFrom=quotation-to-proforma&sourceId=${quotationId}`);
    } else if (type === 'invoice') {
      navigate(`/invoices/create?convertFrom=quotation-to-invoice&sourceId=${quotationId}`);
    } else if (type === 'delivery-challan') {
      navigate(`/dc/create?convertFrom=quotation-to-dc&sourceId=${quotationId}`);
    } else if (type === 'sales-order') {
      alert('Sales Order conversion not implemented yet.');
    }

    setShowConvertMenu(false);
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this quotation?')) return;

    try {
      await supabase
        .from('quotation_header')
        .update({ status: 'Cancelled' })
        .eq('id', quotationId);

      quotationQuery.refetch();
    } catch (err) {
      console.error('Error cancelling quotation:', err);
      alert('Error: ' + err.message);
    }
  };

  const handleDelete = async () => {
    if (!quotation) return;
    if (quotation.status !== 'Draft') {
      alert('Only Draft quotations can be deleted.');
      return;
    }
  };

  const handleApprovalAction = async (action: 'APPROVED' | 'REJECTED' | 'RETURNED', comments?: string) => {
    if (!quotationId || !quotation) return;
    
    try {
      const res = await ApprovalAPI.processApproval(
        quotation.approval_id || quotationId,
        { action, comments: comments || (action === 'APPROVED' ? 'Approved via quotation view' : action === 'REJECTED' ? 'Rejected via quotation view' : 'Changes requested via quotation view') }
      );

      if (res.success) {
        alert(`Quotation ${action.toLowerCase()} successfully!`);
        quotationQuery.refetch();
        if (quotation.project_id) {
          const ev = action === 'APPROVED' ? 'approved' : action === 'REJECTED' ? 'rejected' : 'returned';
          postQuotationChannelCard(quotationId, ev).catch((err: any) => {
            console.warn('Quotation channel post failed:', err?.message || err);
          });
        }
      } else {
        alert(res.error?.message || `Failed to ${action.toLowerCase()} quotation`);
      }
    } catch (error) {
      console.error('Error processing approval:', error);
      alert('Error processing approval. Please try again.');
    }
  };

  const submitReview = async (action: 'APPROVED' | 'REJECTED' | 'RETURNED') => {
    if (!reviewComments.trim()) return;
    setReviewSubmitting(true);
    try {
      await handleApprovalAction(action, reviewComments.trim());
      setShowReviewDialog(false);
      setReviewComments('');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!quotationId || !organisation?.id || !quotation) return;
    if (!window.confirm(`Submit ${quotation.quotation_no} for MD / manager approval?`)) return;
    try {
      const res = await ApprovalIntegration.createQuotationApproval(
        quotationId,
        quotation.client?.client_name || quotation.client?.name || 'Client',
        quotation.quotation_no,
        Number(quotation.grand_total) || 0
      );
      if (res.approvalId) {
        alert('Submitted for approval successfully!');
        quotationQuery.refetch();
        quotationsQuery.refetch();
        if (quotation.project_id) {
          postQuotationChannelCard(quotationId, 'submitted').catch((err: any) => {
            console.warn('Quotation channel post failed:', err?.message || err);
          });
        }
      } else {
        alert(res.error || 'No approval required for this quotation.');
      }
    } catch (err: any) {
      console.error('Error submitting for approval:', err);
      alert('Error submitting for approval: ' + (err?.message || err));
    }
  };

  const handleDeleteQuotation = async () => {
    if (!confirm('Are you sure you want to delete this quotation? This cannot be undone.')) return;

    try {
      await supabase.from('approvals').delete().eq('reference_id', quotationId);
      await supabase
        .from('quotation_header')
        .delete()
        .eq('id', quotationId);

      navigate('/quotation');
    } catch (err) {
      console.error('Error deleting quotation:', err);
      alert('Error: ' + err.message);
    }
  };

  const handleSelectTemplate = async (templateId) => {
    try {
      await supabase
        .from('quotation_header')
        .update({ template_id: templateId })
        .eq('id', quotationId);

      setSelectedTemplateId(templateId);
      quotationQuery.refetch();
    } catch (err) {
      console.error('Error selecting template:', err);
      alert('Error: ' + err.message);
    }
  };

  // Informational availability: batched read-only stock check per quotation line.
  // Deliberately writes NOTHING - quotations are offers, not demand. Reservations
  // and MRP apply only after conversion to a Sales Order (see docs/GLOSSARY.md).
  const availabilityBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string; border: string; label: string }> = {
      in_stock: { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0', label: 'In Stock' },
      partial: { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A', label: 'Partial' },
      out: { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: 'No Stock' },
      unlinked: { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0', label: 'Not linked' },
    };
    const s = map[status] || map.unlinked;
    return (
      <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
        {s.label}
      </span>
    );
  };

  const availabilitySummary = useMemo(() => {
    const rows = availabilityRows || [];
    return {
      total: rows.length,
      inStock: rows.filter((r: any) => r.status === 'in_stock').length,
      partial: rows.filter((r: any) => r.status === 'partial').length,
      out: rows.filter((r: any) => r.status === 'out').length,
      unlinked: rows.filter((r: any) => r.status === 'unlinked').length,
    };
  }, [availabilityRows]);

  const handleOpenAvailability = async () => {
    setShowHeaderMenu(false);
    setShowAvailability(true);
    setAvailabilityLoading(true);
    try {
      const items = (quotation.items || []).filter((i: any) => !i.is_header);
      const materialIds = Array.from(new Set(items.map((i: any) => i.item?.id || i.item_id).filter(Boolean)));

      const stockByMaterial = new Map<string, any[]>();
      const reservedByMaterialWarehouse = new Map<string, number>();

      if (materialIds.length > 0) {
        const [stockRes, resRes] = await Promise.all([
          timedSupabaseQuery(
            supabase
              .from('item_stock')
              .select('item_id, current_stock, warehouse_id, warehouse:warehouses(name, warehouse_name)')
              .in('item_id', materialIds as any),
            'Quotation availability stock',
          ),
          timedSupabaseQuery(
            supabase
              .from('sales_order_reservations')
              .select('item_id, warehouse_id, qty')
              .in('item_id', materialIds as any),
            'Quotation availability reservations',
          ),
        ]);
        ((stockRes as any) || []).forEach((s: any) => {
          const list = stockByMaterial.get(s.item_id) || [];
          list.push(s);
          stockByMaterial.set(s.item_id, list);
        });
        ((resRes as any) || []).forEach((r: any) => {
          const key = `${r.item_id}::${r.warehouse_id}`;
          reservedByMaterialWarehouse.set(key, (reservedByMaterialWarehouse.get(key) || 0) + (parseFloat(r.qty) || 0));
        });
      }

      const rows = items.map((item: any) => {
        const material = item.item || {};
        const materialId = material.id || item.item_id || null;
        const required = parseFloat(String(item.qty)) || 0;
        const name = material.display_name || material.name || item.description || 'Item';
        const code = material.item_code || '';

        if (!materialId) {
          return { id: item.id, name, code, required, available: null, status: 'unlinked', warehouses: [] };
        }

        const warehouses = (stockByMaterial.get(materialId) || []).map((s: any) => {
          const reserved = reservedByMaterialWarehouse.get(`${materialId}::${s.warehouse_id}`) || 0;
          const currentStock = parseFloat(s.current_stock) || 0;
          return {
            warehouse_name: s.warehouse?.name || s.warehouse?.warehouse_name || 'Main Warehouse',
            stock: currentStock,
            reserved,
            available: Math.max(0, currentStock - reserved),
          };
        });
        const available = warehouses.reduce((acc: number, w: any) => acc + w.available, 0);
        const status = required > 0 && available >= required ? 'in_stock' : available > 0 ? 'partial' : 'out';
        return { id: item.id, name, code, required, available, status, warehouses };
      });

      setAvailabilityRows(rows);
    } catch (e: any) {
      alert('Error loading stock availability: ' + e.message);
      setShowAvailability(false);
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const handleLaunchStockCheck = async () => {
    setLaunchingStockCheck(true);
    try {
      const client = quotation.client;
      const project = quotation.project;

      // Live warehouse cover drives the starting status: fully covered lines
      // open as In Stock instead of Pending, so only real gaps need sourcing.
      const launchIds = Array.from(new Set((quotation.items || [])
        .filter((item: any) => !item.is_header)
        .map((item: any) => item.item?.id || item.item_id)
        .filter(Boolean)));
      const launchCover = new Map<string, number>();
      if (launchIds.length > 0) {
        const coverRes: any = await timedSupabaseQuery(
          supabase.from('item_stock').select('item_id, current_stock').in('item_id', launchIds as any),
          'Stock check launch cover',
        );
        ((coverRes as any) || []).forEach((s: any) => {
          launchCover.set(s.item_id, (launchCover.get(s.item_id) || 0) + (parseFloat(s.current_stock) || 0));
        });
      }

      // Reuse the quote's open tracker when one exists: only genuinely new lines
      // are appended, so repeated launches never duplicate the tracker.
      const normLaunchName = (s: any) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const launchRowKey = (id: any, name: any) => `${id || ''}::${normLaunchName(name)}`;
      let targetListId: string | null = null;
      let displayBase = 0;
      const seenLaunchKeys = new Set<string>();
      if (quotation.id) {
        const { data: openLists } = await supabase
          .from('procurement_lists')
          .select('id')
          .eq('quotation_id', quotation.id)
          .eq('status', 'Active')
          .order('created_at', { ascending: false })
          .limit(1);
        if (openLists && openLists[0]) {
          targetListId = openLists[0].id;
          const { data: existingItems } = await supabase
            .from('procurement_items')
            .select('item_id, item_name, display_order')
            .eq('list_id', targetListId);
          (existingItems || []).forEach((ei: any) => {
            seenLaunchKeys.add(launchRowKey(ei.item_id, ei.item_name));
            if (typeof ei.display_order === 'number' && ei.display_order >= displayBase) displayBase = ei.display_order + 1;
          });
        }
      }

      const candidateRows = (quotation.items || [])
        .filter((item: any) => !item.is_header && (item.description || item.item_id || item.qty))
        .map((item: any) => {
          const material = item.item || {};
          const clientId = quotation.client_id || client?.id;
          const mapping = clientId && material?.mappings?.find((m: any) => m.client_id === clientId);
          const boqQty = parseFloat(String(item.qty)) || 0;
          const coverQty = launchCover.get(material.id || item.item_id) || 0;
          const rowName = mapping?.client_description || item.description || material.display_name || material.name || '';
          return {
            organisation_id: organisation?.id,
            item_id: material.id || item.item_id || null,
            item_name: rowName,
            make: item.make || material.make || null,
            variant_name: item.variant?.variant_name || null,
            uom: item.uom || material.unit || null,
            boq_qty: boqQty,
            stock_qty: 0,
            local_qty: 0,
            vendor_id: null,
            notes: null,
            status: boqQty > 0 && (material.id || item.item_id) && coverQty >= boqQty ? 'In Stock' : 'Pending',
            is_header_row: false,
            _key: launchRowKey(material.id || item.item_id, rowName),
          };
        })
        .filter((r: any) => {
          if (!(r.boq_qty > 0)) return false;
          if (seenLaunchKeys.has(r._key)) return false;
          seenLaunchKeys.add(r._key);
          return true;
        });

      if (!targetListId) {
        if (candidateRows.length === 0) { alert('No line items to send to procurement.'); return; }
        const { data: listData, error: listError } = await supabase
          .from('procurement_lists')
          .insert({
            organisation_id: organisation?.id,
            title: `${quotation.quotation_no || 'Quotation'} \u2014 Stock Check`,
            source: 'quotation',
            quotation_id: quotation.id || null,
            quotation_no: quotation.quotation_no || null,
            client_id: quotation.client_id || client?.id || null,
            client_name: client?.client_name || client?.name || null,
            project_id: quotation.project_id || project?.id || null,
            project_name: project?.project_name || null,
            status: 'Active',
          })
          .select()
          .single();

        if (listError) throw listError;
        targetListId = listData.id;
      }

      const rows = candidateRows.map((r: any, i: number) => {
        const { _key, ...rest } = r;
        return { ...rest, list_id: targetListId, display_order: displayBase + i };
      });

      if (rows.length > 0) {
        const { error } = await supabase.from('procurement_items').insert(rows);
        if (error) throw error;
      }

      setShowStockCheckModal(false);
      setShowHeaderMenu(false);
      navigate(`/procurement/detail?id=${targetListId}`);
    } catch (e: any) {
      alert('Error launching stock check: ' + e.message);
    } finally {
      setLaunchingStockCheck(false);
    }
  };

  const handlePrintAction = async (action, templateId = null) => {
    try {
      setPrintLoading(true);
      setShowHeaderMenu(false);
      let template = null;
      console.log('handlePrintAction called with:', { action, templateId, quotationId });

      if (templateId) {
        console.log('Fetching template by ID:', templateId);
        const { data, error } = await supabase
          .from('document_templates')
          .select('*')
          .eq('id', templateId)
          .single();
        console.log('Template query result:', { data, error });
        if (error) throw error;
        template = data;
      } else if (quotation.template_id) {
        console.log('Fetching template by quotation.template_id:', quotation.template_id);
        const { data, error } = await supabase
          .from('document_templates')
          .select('*')
          .eq('id', quotation.template_id)
          .single();
        console.log('Template query result:', { data, error });
        if (error) throw error;
        template = data;
      } else {
        console.log('Fetching default template');
        const { data, error } = await supabase
          .from('document_templates')
          .select('*')
          .eq('document_type', 'Quotation')
          .eq('is_default', true)
          .single();
        console.log('Default template query result:', { data, error });
        if (error) throw error;
        template = data;
      }

      if (!template) {
        alert('No template found. Please select a template from Template Settings.');
        return;
      }

      if (action === 'preview-html') {
        previewQuotation(template);
      } else if (action === 'preview') {
        await downloadPDF(template, 'preview');
      } else if (action === 'download') {
        await downloadPDF(template, 'download');
      } else if (action === 'email') {
        alert('Email feature coming soon!');
      } else if (action === 'print') {
        await downloadPDF(template, 'print');
      }

      setShowHeaderMenu(false);
    } catch (err) {
      console.error('Error preparing print action:', err);
      alert('Unable to load print template. Please verify template settings.');
    } finally {
      setPrintLoading(false);
    }
  };

  const previewQuotation = async (template) => {
    setPreviewTemplate(template);
    setPreviewModalOpen(true);
    setPreviewLoading(true);

    const generatePreviewHTML = async (tmpl) => {
      if (tmpl?.column_settings?.print?.style === 'saas') {
        const container = document.createElement('div');
        container.style.width = '210mm';
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        document.body.appendChild(container);

        const root = createRoot(container);
        flushSync(() => {
          const quotationWithTerms = {
            ...quotation,
            terms_conditions: termsConditionsQuery.data?.custom_content || null
          };
          root.render(
            <SaaSTemplate
              data={quotationWithTerms}
              organisation={organisation}
              templateConfig={tmpl.column_settings}
            />
          );
        });

        await new Promise(resolve => setTimeout(resolve, 500));
        const html = container.innerHTML;
        document.body.removeChild(container);
        return html;
      }

      if (tmpl?.column_settings?.print?.style === 'vertical' || tmpl?.template_code === 'QTN_VERTICAL') {
        const container = document.createElement('div');
        container.style.width = '210mm';
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        document.body.appendChild(container);

        const root = createRoot(container);
        flushSync(() => {
          const quotationWithTerms = {
            ...quotation,
            terms_conditions: termsConditionsQuery.data?.custom_content || null
          };
          root.render(
            <VerticalTemplate
              data={quotationWithTerms}
              organisation={organisation}
              templateConfig={tmpl.column_settings}
            />
          );
        });

        await new Promise(resolve => setTimeout(resolve, 500));
        const html = container.innerHTML;
        document.body.removeChild(container);
        return html;
      }

      if (tmpl?.template_code === 'QTN_ENTERPRISE') {
        const quotationWithTerms = {
          ...quotation,
          terms_conditions: termsConditionsQuery.data?.custom_content || null
        };
        const isInterState = quotation.state && organisation?.state &&
          quotation.state.trim().toLowerCase() !== organisation.state.trim().toLowerCase();
        
        const selectedSignatory = (organisation?.signatures || []).find(s => s.id == quotation.authorized_signatory_id);

        const opts = {
          org: {
            name: organisation?.name || '',
            address: organisation?.address || '',
            city: organisation?.city || '',
            state: organisation?.state || '',
            pincode: organisation?.pincode || '',
            gstin: organisation?.gstin || '',
            phone: organisation?.phone || '',
            email: organisation?.email || '',
            logo_url: organisation?.logo_url || ''
          },
          client: {
            display_name: quotation.client?.client_name || quotation.client?.name || '',
            billing_address: quotation.billing_address || '',
            gstin: quotation.client?.gstin || quotation.gstin || '',
            state: quotation.client?.state || quotation.state || ''
          },
          header: {
            quotation_no: quotation.quotation_no || '',
            revision_no: quotation.revision_no ? parseInt(quotation.revision_no) : undefined,
            date: formatDate(quotation.date),
            valid_till: formatDate(quotation.valid_till),
            payment_terms: quotation.payment_terms || '',
            reference: quotation.reference || '',
            prepared_by: quotation.prepared_by || '',
            remarks: quotation.remarks || '',
            project_name: quotation.project?.project_name || quotation.project?.project_code || ''
          },
          items: (quotation.items || []).map((item: any) => ({
            is_header: item.is_header,
            is_subtotal: item.is_subtotal,
            subtotal_label: item.subtotal_label,
            description: item.description || item.item?.name || item.item?.display_name || '',
            item_code: item.item_code || item.item?.item_code || '',
            hsn_code: item.sac_code || item.item?.hsn_code || '',
            variant_name: item.variant?.variant_name || '',
            qty: item.qty,
            uom: item.uom,
            base_rate_snapshot: item.base_rate_snapshot || item.rate,
            discount_percent: item.discount_percent,
            rate: item.rate,
            tax_percent: item.tax_percent,
            line_total: item.line_total,
            custom1: item.custom1,
            custom2: item.custom2
          })),
          calculations: {
            subtotal: quotation.subtotal || 0,
            totalItemDiscount: quotation.total_item_discount || 0,
            extraDiscountAmount: quotation.extra_discount_amount || 0,
            cgst: isInterState ? 0 : (quotation.total_tax || 0) / 2,
            sgst: isInterState ? 0 : (quotation.total_tax || 0) / 2,
            igst: isInterState ? (quotation.total_tax || 0) : 0,
            isInterState: isInterState,
            totalTax: quotation.total_tax || 0,
            roundOff: quotation.round_off || 0,
            grandTotal: quotation.grand_total || 0,
            amountInWords: quotation.amount_in_words || ''
          },
          columnSettings: tmpl.column_settings,
          signatory: {
            name: selectedSignatory?.name || '',
            designation: organisation?.signatory_designation || 'Authorised Signatory',
            for_company: organisation?.name || ''
          },
          bankDetails: {
            bank_name: organisation?.bank_name,
            branch: organisation?.bank_branch,
            account_name: organisation?.bank_account_name || organisation?.name,
            account_no: organisation?.bank_account_no,
            ifsc: organisation?.bank_ifsc,
            account_type: organisation?.bank_account_type,
            swift: organisation?.bank_swift
          },
          termsAndConditions: (() => {
            const rawTerms = quotationWithTerms.terms_conditions;
            let parsedTerms: string[] = [];
            if (rawTerms) {
              try {
                const parsed = typeof rawTerms === 'string' ? JSON.parse(rawTerms) : rawTerms;
                const extractSections = (obj: any) => {
                  if (!obj) return;
                  if (Array.isArray(obj)) {
                    obj.forEach(extractSections);
                  } else if (obj.sections && Array.isArray(obj.sections)) {
                    obj.sections.forEach((sec: any) => {
                      if (sec.items && Array.isArray(sec.items)) {
                        sec.items.forEach((item: any) => {
                          if (item.content) parsedTerms.push(item.content);
                        });
                      }
                    });
                  }
                };
                extractSections(parsed);
                if (parsedTerms.length === 0) {
                  parsedTerms = typeof rawTerms === 'string' ? rawTerms.split('\n') : [];
                }
              } catch (e) {
                parsedTerms = typeof rawTerms === 'string' ? rawTerms.split('\n') : [];
              }
            }
            const finalTerms = parsedTerms.filter(t => t && t.trim().length > 0);
            return finalTerms.length > 0 ? finalTerms : ['Payment as per terms mentioned above.', 'This is a system-generated document.'];
          })(),
          companyLogoBase64: organisation?.logo_url 
        };

        try {
          const enterpriseDoc = generateQuotationPdf(opts as any);
          const pdfBlob = enterpriseDoc.output('blob');
          const blobUrl = URL.createObjectURL(pdfBlob);
          return `<iframe src="${blobUrl}#view=FitH" width="100%" height="800px" style="border: none; border-radius: 8px;"></iframe>`;
        } catch (e) {
          console.error("Enterprise Preview Error", e);
          return `<div class="p-8 text-center text-red-500">Error generating PDF preview</div>`;
        }
      }

      // Default HTML template
      return generateQuotationHTML(tmpl);
    };

    try {
      const html = await generatePreviewHTML(template);
      setPreviewHTML(html);
    } catch (err) {
      console.error('Preview error:', err);
      setPreviewHTML('<div class="p-8 text-center text-red-500">Error generating preview</div>');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Download from preview modal
  const downloadFromPreview = async () => {
    if (!previewTemplate || !quotation) return;
    
    const safeFileName = String(quotation.quotation_no || 'quotation')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, '_');

    try {
      if (previewTemplate?.column_settings?.print?.style === 'saas') {
        const blob = await htmlToPdf(document.getElementById('preview-modal-content'), `${safeFileName}.pdf`);
        return;
      }
      if (previewTemplate?.column_settings?.print?.style === 'vertical' || previewTemplate?.template_code === 'QTN_VERTICAL') {
        const blob = await htmlToPdf(document.getElementById('preview-modal-content'), `${safeFileName}.pdf`);
        return;
      }
      // Fallback for other templates
      downloadPDF(previewTemplate);
    } catch (err) {
      console.error('Download error:', err);
      downloadPDF(previewTemplate);
    }
  };

  // Print from preview modal
  const printFromPreview = () => {
    const printContent = document.getElementById('preview-modal-content');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Print - ${quotation?.quotation_no || 'Quotation'}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { margin: 0; }
            }
            body { margin: 0; padding: 0; }
            #print-container { width: 210mm; margin: 0 auto; background: white; }
          </style>
        </head>
        <body>
          <div id="print-container">
            ${printContent.innerHTML}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const downloadPDF = async (template, action = 'download') => {
    try {
      if (!quotation) throw new Error('Quotation data is missing');

      const safeFileName = String(quotation.quotation_no || 'quotation')
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .replace(/\s+/g, '_');

      const handleOutput = (blob) => {
        const url = URL.createObjectURL(blob);
        if (action === 'preview') {
          if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
          setPdfPreviewUrl(url);
          setShowPdfPreviewModal(true);
        } else if (action === 'print') {
          const printWindow = window.open(url, '_blank');
          if (printWindow) {
            printWindow.onload = () => {
              printWindow.print();
            };
          }
          setTimeout(() => URL.revokeObjectURL(url), 10000);
        } else {
          const a = document.createElement('a');
          a.href = url;
          a.download = `${safeFileName}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 100);
        }
      };

      // Handle HTML templates
      if (template.template_type === 'html') {
        const htmlData = {
          document_type: 'QUOTATION',
          quotation_no: quotation.quotation_no || '',
          revision_no: quotation.revision_no || '00',
          date: quotation.date || '',
          valid_till: quotation.valid_till || '',
          remarks: quotation.remarks || '',
          payment_terms: quotation.payment_terms || '',

          // Organisation details
          organisation_name: organisation.name || '',
          organisation_address: organisation.address || '',
          organisation_phone: organisation.phone || '',
          organisation_email: organisation.email || '',
          organisation_gstin: organisation.gstin || '',
          organisation_cin: organisation.cin || '',
          organisation_pan: organisation.pan || '',
          organisation_ie_code: organisation.ie_code || '',

          // Client details
          client_name: quotation.client?.client_name || quotation.client?.name || '',
          client_contact_person: quotation.contact_person || '',
          client_address: quotation.billing_address || quotation.client?.address || '',
          client_city: quotation.client?.city || '',
          client_pincode: quotation.client?.pincode || '',
          client_gstin: quotation.client?.gstin || quotation.gstin || '',
          client_phone: quotation.client?.phone || '',

          // Shipping details
          shipping_company_name: quotation.shipping_company_name || quotation.client?.client_name || '',
          shipping_address: quotation.shipping_address || quotation.billing_address || '',
          shipping_city: quotation.shipping_city || quotation.client?.city || '',
          shipping_pincode: quotation.shipping_pincode || quotation.client?.pincode || '',
          shipping_phone: quotation.shipping_phone || quotation.client?.phone || '',

          // Items
          items: (quotation.items || []).map((item: any, idx: number) => {
            const clientId = quotation.client_id || quotation.client?.id;
            const mapping = clientId && item.item?.mappings?.find((m: any) => m.client_id === clientId);
            return {
              index: idx + 1,
              hsn: item.sac_code || item.item?.hsn_code || '',
              item_code: mapping?.client_part_no || item.item?.item_code || '',
              description: mapping?.client_description || item.description || item.item?.display_name || item.item?.name || '',
              qty: String(item.qty || ''),
              uom: item.uom || '',
              rate: formatCurrency(item.rate || 0),
              gst_percent: item.tax_percent ? `${item.tax_percent}%` : '18%',
              amount: formatCurrency(item.line_total || 0)
            };
          }),

          // Totals
          subtotal: formatCurrency(quotation.subtotal || 0),
          cgst_amount: formatCurrency(quotation.cgst_amount || 0),
          sgst_amount: formatCurrency(quotation.sgst_amount || 0),
          round_off: quotation.round_off ? formatCurrency(quotation.round_off) : '0.00',
          grand_total: formatCurrency(quotation.grand_total || 0),
          amount_in_words: quotation.amount_in_words || '',

          // Bank details
          bank_name: organisation.bank_name || '',
          bank_branch: organisation.bank_branch || '',
          bank_account_no: organisation.bank_account_no || '',
          bank_account_type: organisation.bank_account_type || '',
          bank_ifsc: organisation.bank_ifsc || '',
          bank_micr: organisation.bank_micr || '',
          bank_swift: organisation.bank_swift || '',
          bank_upi: organisation.bank_upi || '',

          // Signatory
          signatory_designation: organisation.signatory_designation || 'Director / Manager',

          // Terms & conditions
          terms_conditions: quotation.terms_conditions || organisation.terms_conditions || ''
        };

        const safeFileName = String(quotation.quotation_no || 'quotation')
          .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
          .replace(/\s+/g, '_');

        const blob = await renderTemplateToPdf(template.template_content || '', htmlData, `${safeFileName}.pdf`);
        if (action === 'blob') return blob;
        handleOutput(blob);
        return;
      }

      // Special handling for SaaS Style
      if (template?.column_settings?.print?.style === 'saas') {
        const container = document.createElement('div');
        container.id = 'pdf-capture-container';
        container.style.position = 'fixed';
        container.style.left = '0';
        container.style.top = '0';
        container.style.width = '210mm';
        container.style.background = 'white';
        container.style.zIndex = '-9999';
        container.style.pointerEvents = 'none';

        // Inject fonts for capture
        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap';
        document.head.appendChild(fontLink);

        document.body.appendChild(container);

        const root = createRoot(container);
        try {
          // Include Terms & Conditions data
          const quotationWithTerms = {
            ...quotation,
            terms_conditions: termsConditionsQuery.data?.custom_content || null
          };
          flushSync(() => {
            root.render(<SaaSTemplate data={quotationWithTerms} organisation={organisation} templateConfig={template.column_settings} />);
          });

          // Wait longer for fonts and layout
          await new Promise(resolve => setTimeout(resolve, 2000));
          const blob = await htmlToPdf(container, `${safeFileName}.pdf`);
          if (action === 'blob') return blob;
          handleOutput(blob);
        } catch (captureErr) {
          console.error('SaaS PDF Capture Error:', captureErr);
          throw captureErr;
        } finally {
          root.unmount();
          document.body.removeChild(container);
        }
        return;
      }

      // Special handling for Vertical Style
      if (template?.column_settings?.print?.style === 'vertical' || template?.template_code === 'QTN_VERTICAL') {
        const container = document.createElement('div');
        container.id = 'pdf-capture-container';
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = '210mm';
        container.style.background = 'white';
        container.style.zIndex = '-9999';
        container.style.pointerEvents = 'none';

        // Inject fonts for capture
        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap';
        document.head.appendChild(fontLink);

        document.body.appendChild(container);

        const root = createRoot(container);
        try {
          // Include Terms & Conditions data
          const quotationWithTerms = {
            ...quotation,
            terms_conditions: termsConditionsQuery.data?.custom_content || null
          };
          flushSync(() => {
            root.render(<VerticalTemplate data={quotationWithTerms} organisation={organisation} templateConfig={template.column_settings} />);
          });

          // Wait longer for fonts and layout
          await new Promise(resolve => setTimeout(resolve, 3000));
          const blob = await htmlToPdf(container, `${safeFileName}.pdf`);
          if (action === 'blob') return blob;
          handleOutput(blob);
        } catch (captureErr) {
          console.error('Vertical PDF Capture Error:', captureErr);
          throw captureErr;
        } finally {
          root.unmount();
          document.body.removeChild(container);
        }
        return;
      }

      // Special handling for Zoho Template
      if (template.template_code === 'QTN_ZOHO') {
        try {
          const quotationWithTerms = {
            ...quotation,
            terms_conditions: termsConditionsQuery.data?.custom_content || null
          };
          const zohoDoc = generateZohoTemplate(quotationWithTerms, organisation, template);
          const blob = zohoDoc.output('blob');
          if (action === 'blob') return blob;
          handleOutput(blob);
          return;
        } catch (error) {
          console.error('Error generating Zoho template:', error);
          throw error;
        }
      }

      // Special handling for Classic Template
      if (template.template_code === 'QTN_CLASSIC') {
        console.log('Classic template detected, template:', template);
        try {
          const quotationWithTerms = {
            ...quotation,
            terms_conditions: termsConditionsQuery.data?.custom_content || null
          };
          console.log('Generating Classic PDF with terms:', quotationWithTerms.terms_conditions);
          console.log('Organisation data:', organisation);
          console.log('Template settings:', template);
          const classicDoc = generateClassicQuotationTemplate(quotationWithTerms, organisation, template);
          const safeFileName = String(quotation.quotation_no || 'quotation')
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
            .replace(/\s+/g, '_');
          const blob = classicDoc.output('blob');
          if (action === 'blob') return blob;
          handleOutput(blob);
          return;
        } catch (error) {
          console.error('Error generating Classic template:', error);
          throw error;
        }
      }

      // Special handling for Grid Pro Template
      if (template.template_code === 'QTN_GRID_PRO') {
        // Include Terms & Conditions data in the quotation object
        const quotationWithTerms = {
          ...quotation,
          terms_conditions: termsConditionsQuery.data?.custom_content || null
        };
        console.log('Generating Grid Pro PDF with terms:', quotationWithTerms.terms_conditions);
        console.log('Terms conditions query data:', termsConditionsQuery.data);
        const gridDoc = generateProGridQuotationPdf(quotationWithTerms, organisation, template);
        const safeFileName = String(quotation.quotation_no || 'quotation')
          .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
          .replace(/\s+/g, '_');
        const blob = gridDoc.output('blob');
        if (action === 'blob') return blob;
        handleOutput(blob);
        return;
      }

      // Special handling for Enterprise Quotation Template
      if (template.template_code === 'QTN_ENTERPRISE') {
        const quotationWithTerms = {
          ...quotation,
          terms_conditions: termsConditionsQuery.data?.custom_content || null
        };
        const isInterState = quotation.state && organisation?.state &&
          quotation.state.trim().toLowerCase() !== organisation.state.trim().toLowerCase();
        
        const selectedSignatory = (organisation?.signatures || []).find(s => s.id == quotation.authorized_signatory_id);

        const opts = {
          org: {
            name: organisation?.name || '',
            address: organisation?.address || '',
            city: organisation?.city || '',
            state: organisation?.state || '',
            pincode: organisation?.pincode || '',
            gstin: organisation?.gstin || '',
            phone: organisation?.phone || '',
            email: organisation?.email || '',
            logo_url: organisation?.logo_url || ''
          },
          client: {
            display_name: quotation.client?.client_name || quotation.client?.name || '',
            billing_address: quotation.billing_address || '',
            gstin: quotation.client?.gstin || quotation.gstin || '',
            state: quotation.client?.state || quotation.state || ''
          },
          header: {
            quotation_no: quotation.quotation_no || '',
            revision_no: quotation.revision_no ? parseInt(quotation.revision_no) : undefined,
            date: formatDate(quotation.date),
            valid_till: formatDate(quotation.valid_till),
            payment_terms: quotation.payment_terms || '',
            reference: quotation.reference || '',
            prepared_by: quotation.prepared_by || '',
            remarks: quotation.remarks || '',
            project_name: quotation.project?.project_name || quotation.project?.project_code || ''
          },
          items: (quotation.items || []).map((item: any) => ({
            is_header: item.is_header,
            is_subtotal: item.is_subtotal,
            subtotal_label: item.subtotal_label,
            description: item.description || item.item?.name || item.item?.display_name || '',
            item_code: item.item_code || item.item?.item_code || '',
            hsn_code: item.sac_code || item.item?.hsn_code || '',
            variant_name: item.variant?.variant_name || '',
            qty: item.qty,
            uom: item.uom,
            base_rate_snapshot: item.base_rate_snapshot || item.rate,
            discount_percent: item.discount_percent,
            rate: item.rate,
            tax_percent: item.tax_percent,
            line_total: item.line_total,
            custom1: item.custom1,
            custom2: item.custom2
          })),
          calculations: {
            subtotal: quotation.subtotal || 0,
            totalItemDiscount: quotation.total_item_discount || 0,
            extraDiscountAmount: quotation.extra_discount_amount || 0,
            cgst: isInterState ? 0 : (quotation.total_tax || 0) / 2,
            sgst: isInterState ? 0 : (quotation.total_tax || 0) / 2,
            igst: isInterState ? (quotation.total_tax || 0) : 0,
            isInterState: isInterState,
            totalTax: quotation.total_tax || 0,
            roundOff: quotation.round_off || 0,
            grandTotal: quotation.grand_total || 0,
            amountInWords: quotation.amount_in_words || ''
          },
          columnSettings: template.column_settings,
          signatory: {
            name: selectedSignatory?.name || '',
            designation: organisation?.signatory_designation || 'Authorised Signatory',
            for_company: organisation?.name || ''
          },
          bankDetails: {
            bank_name: organisation?.bank_name,
            branch: organisation?.bank_branch,
            account_name: organisation?.bank_account_name || organisation?.name,
            account_no: organisation?.bank_account_no,
            ifsc: organisation?.bank_ifsc,
            account_type: organisation?.bank_account_type,
            swift: organisation?.bank_swift
          },
          termsAndConditions: quotationWithTerms.terms_conditions 
            ? quotationWithTerms.terms_conditions.split('\n').filter((t: string) => t.trim().length > 0)
            : ['Payment as per terms mentioned above.', 'This is a system-generated document.'],
          companyLogoBase64: organisation?.logo_url 
        };

        const enterpriseDoc = generateQuotationPdf(opts as any);
        const safeFileName = String(quotation.quotation_no || 'quotation')
          .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
          .replace(/\s+/g, '_');
        const blob = enterpriseDoc.output('blob');
        if (action === 'blob') return blob;
        handleOutput(blob);
        return;
      }

      // Special handling for Sakthi Template
      if (template?.column_settings?.print?.style === 'sakthi' || template?.template_code === 'QTN_SAKTHI') {
        const quotationWithTerms = {
          ...quotation,
          terms_conditions: termsConditionsQuery.data?.custom_content || null
        };
        const sakthiDoc = await generateSakthiPdf(quotationWithTerms, organisation, 'Quotation', template);
        const blob = sakthiDoc.output('blob');
        if (action === 'blob') return blob;
        handleOutput(blob);
        return;
      }

      const isLandscape = template.orientation === 'Landscape';
      const doc = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: template.page_size === 'Letter' ? 'letter' : 'a4'
      });

      const colSettings = (template && typeof template.column_settings === 'object' && template.column_settings) || {};
      const optionalCols = colSettings.optional || {};
      const labels = colSettings.labels || {};

      const columnConfig = [];
      if (optionalCols.sno !== false) columnConfig.push({ header: '#', key: 'sno', width: 10 });
      if (optionalCols.hsn_code) columnConfig.push({ header: 'HSN/SAC', key: 'hsn_code', width: 20 });
      if (optionalCols.item !== false) columnConfig.push({ header: 'Item', key: 'item', width: 45 });
      if (optionalCols.item_code) columnConfig.push({ header: 'Part No', key: 'item_code', width: 25 });
      if (optionalCols.make) columnConfig.push({ header: 'Make', key: 'make', width: 25 });
      if (optionalCols.variant) columnConfig.push({ header: 'Variant', key: 'variant', width: 25 });
      if (optionalCols.description) columnConfig.push({ header: 'Description', key: 'description', width: 40 });
      if (optionalCols.qty !== false) columnConfig.push({ header: 'Qty', key: 'qty', width: 12, align: 'right' });
      if (optionalCols.uom !== false) columnConfig.push({ header: 'Unit', key: 'uom', width: 15 });

      // Rate (Before Discount)
      if (optionalCols.rate) {
        columnConfig.push({ header: 'Rate', key: 'base_rate', width: 22, align: 'right' });
      }

      // Discount %
      if (optionalCols.discount_percent) {
        columnConfig.push({ header: 'Disc %', key: 'discount_percent', width: 15, align: 'right' });
      }

      // Rate/Unit (After Discount)
      if (optionalCols.rate_after_discount) {
        columnConfig.push({
          header: labels.rate_after_discount || 'Rate/Unit',
          key: 'rate_after_discount',
          width: 22,
          align: 'right'
        });
      }

      if (optionalCols.tax_percent) columnConfig.push({ header: 'Tax %', key: 'tax_percent', width: 15, align: 'right' });

      // Custom columns
      if (optionalCols.custom1) {
        columnConfig.push({ header: labels.custom1 || 'Custom 1', key: 'custom1', width: 22 });
      }
      if (optionalCols.custom2) {
        columnConfig.push({ header: labels.custom2 || 'Custom 2', key: 'custom2', width: 22 });
      }

      columnConfig.push({ header: 'Amount', key: 'line_total', width: 28, align: 'right' });

      let startY = 40;

      if (template.show_logo !== false) {
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('Quotation', 105, 20, { align: 'center' });
        startY = 35;
      } else {
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('Quotation', 105, 15, { align: 'center' });
        startY = 25;
      }

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`No: ${quotation.quotation_no}`, 14, startY);
      doc.text(`Date: ${formatDate(quotation.date)}`, 14, startY + 6);
      doc.text(`Valid Till: ${formatDate(quotation.valid_till)}`, 14, startY + 12);

      doc.text('To:', 14, startY + 22);
      doc.setFont('helvetica', 'bold');
      doc.text(quotation.client?.client_name || '', 14, startY + 28);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      if (quotation.billing_address) {
        const addressLines = doc.splitTextToSize(quotation.billing_address, 70);
        doc.text(addressLines, 14, startY + 34);
      }
      doc.text(`GSTIN: ${quotation.gstin || '-'}`, 14, startY + 48);
      doc.text(`State: ${quotation.state || '-'}`, 14, startY + 54);

      const rightCol = isLandscape ? 140 : 120;
      if (quotation.project) {
        doc.text(`Project: ${quotation.project.project_name || quotation.project.project_code || '-'}`, rightCol, startY + 22);
      }

      const tableData = (quotation.items || []).map((item, index) => {
        const material = item.item || {};
        const row = {};
        if (optionalCols.sno !== false) row.sno = index + 1;
        const clientId = quotation.client_id || quotation.client?.id;
        const mapping = clientId && material?.mappings?.find((m: any) => m.client_id === clientId);
        if (optionalCols.hsn_code) row.hsn_code = item.sac_code || material.hsn_code || '-';
        if (optionalCols.item !== false) row.item = mapping?.client_description || item.description || material.name || '-';
        if (optionalCols.item_code) row.item_code = mapping?.client_part_no || material.item_code || '-';
        if (optionalCols.make) row.make = item.make || '-';
        if (optionalCols.variant) row.variant = item.variant?.variant_name || '-';
        if (optionalCols.description) row.description = mapping?.client_description || item.description || '-';
        if (optionalCols.qty !== false) row.qty = item.qty;
        if (optionalCols.uom !== false) row.uom = item.uom;

        if (optionalCols.rate) row.base_rate = formatCurrencyNoSymbol(item.base_rate_snapshot || item.rate);
        if (optionalCols.discount_percent) row.discount_percent = `${item.discount_percent}%`;
        if (optionalCols.rate_after_discount) row.rate_after_discount = formatCurrencyNoSymbol(item.rate);
        if (optionalCols.tax_percent) row.tax_percent = `${item.tax_percent}%`;

        if (optionalCols.custom1) row.custom1 = item.custom1 || '-';
        if (optionalCols.custom2) row.custom2 = item.custom2 || '-';

        row.line_total = formatCurrencyNoSymbol(item.line_total);
        return row;
      });

      const tableStartY = startY + 60;

      autoTable(doc, {
        startY: tableStartY,
        head: [columnConfig.map((col) => col.header)],
        body: tableData.map((row) => columnConfig.map((col) => row[col.key])),
        theme: 'grid',
        headStyles: { fillColor: [66, 66, 66], fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: columnConfig.reduce((acc, col, idx) => {
          if (col.align === 'right') acc[idx] = { halign: 'right' };
          return acc;
        }, {})
      });

      const finalY = (doc.lastAutoTable?.finalY || tableStartY + 10) + 10;
      const summaryX = isLandscape ? 200 : 160;

      doc.setFontSize(9);
      doc.text('Subtotal:', summaryX, finalY);
      doc.text(formatCurrency(quotation.subtotal), summaryX + 35, finalY, { align: 'right' });

      doc.text('Item Discount:', summaryX, finalY + 6);
      doc.text(`-${formatCurrency(quotation.total_item_discount)}`, summaryX + 35, finalY + 6, { align: 'right' });

      doc.text('Extra Discount:', summaryX, finalY + 12);
      doc.text(`-${formatCurrency(quotation.extra_discount_amount)}`, summaryX + 35, finalY + 12, { align: 'right' });

      const isInterState = quotation.state && organisation?.state &&
        quotation.state.trim().toLowerCase() !== organisation.state.trim().toLowerCase();
      if (isInterState) {
        doc.text('IGST:', summaryX, finalY + 18);
        doc.text(formatCurrency(quotation.total_tax), summaryX + 35, finalY + 18, { align: 'right' });
      } else {
        doc.text('CGST:', summaryX, finalY + 18);
        doc.text(formatCurrency(quotation.total_tax / 2), summaryX + 35, finalY + 18, { align: 'right' });
        doc.text('SGST:', summaryX, finalY + 24);
        doc.text(formatCurrency(quotation.total_tax / 2), summaryX + 35, finalY + 24, { align: 'right' });
      }

      const offset = isInterState ? 24 : 30;
      doc.text('Round Off:', summaryX, finalY + offset);
      doc.text(formatCurrency(quotation.round_off), summaryX + 35, finalY + offset, { align: 'right' });

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      const grandTotalOffset = isInterState ? 34 : 40;
      doc.text('Grand Total:', summaryX, finalY + grandTotalOffset);
      doc.text(formatCurrency(quotation.grand_total), summaryX + 35, finalY + grandTotalOffset, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Payment Terms: ${quotation.payment_terms || '-'}`, 14, finalY + grandTotalOffset);

      if (quotation.contact_no) {
        doc.text(`Contact No: ${quotation.contact_no}`, 14, finalY + (isInterState ? 42 : 48));
      }

      const remarksText = quotation.remarks || quotation.reference;
      if (remarksText) {
        doc.text(`Remarks: ${remarksText}`, 14, finalY + (isInterState ? 50 : 56));
      }

      if (template.show_terms !== false) {
        doc.setFontSize(8);
        const termsStart = finalY + (isInterState ? 58 : 64);
        doc.text('Terms & Conditions:', 14, termsStart);
        doc.text('1. Payment as per terms mentioned above.', 14, termsStart + 6);
        doc.text('2. This is a system-generated document.', 14, termsStart + 12);
      }

      if (template.show_signature !== false) {
        const signStart = finalY + (isInterState ? 58 : 64);
        doc.text(`For, ${organisation?.name || 'Company Name'}`, 140, signStart);

        // Find selected signature
        const selectedSignatory = (organisation?.signatures || []).find(s => s.id == quotation.authorized_signatory_id);
        if (selectedSignatory?.url) {
          try {
            // Need to convert to base64 or ensure CORS for addImage
            doc.addImage(selectedSignatory.url, 'PNG', 140, signStart + 2, 30, 15);
          } catch (e) {
            console.warn('Sign image error:', e);
          }
        }

        doc.text(selectedSignatory?.name || 'Authorized Signature', 140, signStart + 20);
      }

      const blob = doc.output('blob');
      if (action === 'blob') return blob;
      handleOutput(blob);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('PDF export failed. Please check template settings and try again.');
    } finally {
      setPrintLoading(false);
    }
  };

  const generateQuotationHTML = (template) => {
    const colSettings = template.column_settings || {};
    const optionalCols = colSettings.optional || {};
    const labels = colSettings.labels || {};

    let columnsHTML = '';
    if (optionalCols.sno !== false) columnsHTML += '<th>#</th>';
    if (optionalCols.hsn_code) columnsHTML += '<th>HSN/SAC</th>';
    if (optionalCols.item !== false) columnsHTML += '<th>Item</th>';
    if (optionalCols.variant) columnsHTML += '<th>Variant</th>';
    if (optionalCols.description) columnsHTML += '<th>Description</th>';
    if (optionalCols.qty !== false) columnsHTML += '<th>Qty</th>';
    if (optionalCols.uom !== false) columnsHTML += '<th>Unit</th>';
    if (optionalCols.rate) columnsHTML += '<th>Rate</th>';
    if (optionalCols.discount_percent) columnsHTML += '<th>Disc %</th>';
    if (optionalCols.rate_after_discount) columnsHTML += `<th>${labels.rate_after_discount || 'Rate/Unit'}</th>`;
    if (optionalCols.tax_percent) columnsHTML += '<th>Tax %</th>';
    if (optionalCols.custom1) columnsHTML += `<th>${labels.custom1 || 'Custom 1'}</th>`;
    if (optionalCols.custom2) columnsHTML += `<th>${labels.custom2 || 'Custom 2'}</th>`;
    columnsHTML += '<th>Total</th>';

    let rowsHTML = '';
    quotation.items.forEach((item, index) => {
      if (item.is_header) {
        let colCount = 0;
        if (optionalCols.sno !== false) colCount++;
        if (optionalCols.hsn_code) colCount++;
        if (optionalCols.item !== false) colCount++;
        if (optionalCols.variant) colCount++;
        if (optionalCols.description) colCount++;
        if (optionalCols.qty !== false) colCount++;
        if (optionalCols.uom !== false) colCount++;
        if (optionalCols.rate) colCount++;
        if (optionalCols.discount_percent) colCount++;
        if (optionalCols.rate_after_discount) colCount++;
        if (optionalCols.tax_percent) colCount++;
        if (optionalCols.custom1) colCount++;
        if (optionalCols.custom2) colCount++;
        colCount++;
        rowsHTML += `<tr><td colspan="${colCount}" style="padding:10px 14px;font-weight:bold;font-size:13px;background:#f8fafc">${item.description || 'Section'}</td></tr>`;
        return;
      }
      if (item.is_subtotal) {
        let subtotalAmount = 0;
        for (let i = index - 1; i >= 0; i--) {
          const prev = quotation.items[i];
          if (prev.is_subtotal || prev.is_header) break;
          subtotalAmount += parseFloat(prev.line_total) || 0;
        }
        let colCount = 0;
        if (optionalCols.sno !== false) colCount++;
        if (optionalCols.hsn_code) colCount++;
        if (optionalCols.item !== false) colCount++;
        if (optionalCols.variant) colCount++;
        if (optionalCols.description) colCount++;
        if (optionalCols.qty !== false) colCount++;
        if (optionalCols.uom !== false) colCount++;
        if (optionalCols.rate) colCount++;
        if (optionalCols.discount_percent) colCount++;
        if (optionalCols.rate_after_discount) colCount++;
        if (optionalCols.tax_percent) colCount++;
        if (optionalCols.custom1) colCount++;
        if (optionalCols.custom2) colCount++;
        colCount++;
        rowsHTML += `<tr style="background:#fef9c3;border-top:2px solid #eab308"><td colspan="${colCount}" style="padding:10px 14px"><div style="display:flex;justify-content:flex-end;width:100%;gap:16px"><span style="font-weight:bold;font-size:13px;color:#b45309;text-align:right">${item.subtotal_label || 'Sub-total:'}</span><span style="font-weight:bold;font-size:13px;color:#b45309;min-width:100px;text-align:right">${formatCurrency(subtotalAmount)}</span></div></td></tr>`;
        return;
      }
      const material = item.item || {};
      let rowHTML = '<tr>';
      if (optionalCols.sno !== false) rowHTML += `<td>${index + 1}</td>`;
      if (optionalCols.hsn_code) rowHTML += `<td>${item.sac_code || material.hsn_code || '-'}</td>`;
      if (optionalCols.item !== false) rowHTML += `<td>${item.description || '-'}</td>`;
      if (optionalCols.variant) rowHTML += `<td>${item.variant?.variant_name || '-'}</td>`;
      if (optionalCols.description) rowHTML += `<td>${item.description || '-'}</td>`;
      if (optionalCols.qty !== false) rowHTML += `<td style="text-align:right">${item.qty}</td>`;
      if (optionalCols.uom !== false) rowHTML += `<td>${item.uom}</td>`;
      if (optionalCols.rate) rowHTML += `<td style="text-align:right">${formatCurrency(item.base_rate_snapshot || item.rate)}</td>`;
      if (optionalCols.discount_percent) rowHTML += `<td style="text-align:right">${item.discount_percent}%</td>`;
      if (optionalCols.rate_after_discount) rowHTML += `<td style="text-align:right">${formatCurrency(item.rate)}</td>`;
      if (optionalCols.tax_percent) rowHTML += `<td style="text-align:right">${item.tax_percent}%</td>`;
      if (optionalCols.custom1) rowHTML += `<td>${item.custom1 || '-'}</td>`;
      if (optionalCols.custom2) rowHTML += `<td>${item.custom2 || '-'}</td>`;
      rowHTML += `<td style="text-align:right;font-weight:bold">${formatCurrency(item.line_total)}</td>`;
      rowHTML += '</tr>';
      rowsHTML += rowHTML;
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Quotation - ${quotation.quotation_no}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          h1 { text-align: center; color: #000; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
          .info-box { line-height: 1.6; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 13px; }
          th { background-color: #f3f4f6; color: #374151; font-weight: 600; }
          .summary { float: right; width: 300px; }
          .summary-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f3f4f6; }
          .total { font-weight: bold; font-size: 1.2em; border-top: 2px solid #374151; margin-top: 10px; padding-top: 10px; }
          .footer { margin-top: 50px; clear: both; }
        </style>
      </head>
      <body>
        <h1>QUOTATION</h1>
        <div class="info-grid">
          <div class="info-box">
            <strong>To:</strong><br>
            ${quotation.client?.client_name || '-'}<br>
            ${quotation.billing_address || '-'}<br>
            GSTIN: ${quotation.gstin || '-'}<br>
            State: ${quotation.state || '-'}
          </div>
          <div class="info-box" style="text-align: right;">
            <strong>Quotation No:</strong> ${quotation.quotation_no}<br>
            <strong>Date:</strong> ${formatDate(quotation.date)}<br>
            <strong>Valid Till:</strong> ${formatDate(quotation.valid_till)}<br>
            <strong>Project:</strong> ${quotation.project?.project_name || quotation.project?.project_code || '-'}
          </div>
        </div>
        <table>
          <thead><tr>${columnsHTML}</tr></thead>
          <tbody>${rowsHTML}</tbody>
        </table>
        <div class="summary">
          <div class="summary-row"><span>Subtotal</span><span>${formatCurrency(quotation.subtotal)}</span></div>
          <div class="summary-row"><span>Discount</span><span>-${formatCurrency(quotation.total_item_discount + quotation.extra_discount_amount)}</span></div>
          <div class="summary-row"><span>Tax</span><span>${formatCurrency(quotation.total_tax)}</span></div>
          <div class="summary-row total"><span>Grand Total</span><span>${formatCurrency(quotation.grand_total)}</span></div>
        </div>
        <div class="footer">
          <p><strong>Payment Terms:</strong> ${quotation.payment_terms || '-'}</p>
          <p><strong>Remarks:</strong> ${quotation.remarks || quotation.reference || '-'}</p>
        </div>
      </body>
      </html>
    `;
  };

  const getSelectedTemplateName = () => {
    if (!selectedTemplateId) return 'Default';
    const template = templates.find(t => t.id === selectedTemplateId);
    return template?.template_name || 'Default';
  };

  const isEditable = quotation?.status !== 'Converted' && quotation?.status !== 'Cancelled';
  const isDeletable = quotation?.status === 'Draft';
  const isCancellable = quotation?.status !== 'Cancelled' && quotation?.status !== 'Converted' && quotation?.status !== 'Draft';
  const canApprove = quotation?.status === 'PENDING_APPROVAL';

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  }

  if (!quotationId) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Quotation ID is missing.</div>;
  }

  if (quotationQuery.isError) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontWeight: 600, color: '#b91c1c', marginBottom: '12px' }}>
          {(quotationQuery.error as Error)?.message || 'Unable to load quotation.'}
        </div>
        <Button onClick={() => quotationQuery.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!quotation) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Quotation not found</div>;
  }

  if (isEmbed) {
    if (embedLoading || !embedPdfUrl) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 p-6">
          <Loader2 className="w-8 h-8 animate-spin text-sky-500 mb-4" />
          <p className="text-sm font-semibold text-zinc-600">Generating quotation PDF...</p>
        </div>
      );
    }
    if (embedError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 p-6 text-center">
          <span className="text-3xl mb-3">⚠️</span>
          <p className="text-sm font-semibold text-red-500 mb-2">Failed to generate PDF</p>
          <p className="text-xs text-zinc-500">{embedError}</p>
        </div>
      );
    }
    return (
      <div className="w-full h-screen bg-zinc-800">
        <iframe 
          src={`${embedPdfUrl}#view=FitH`}
          className="w-full h-full border-none" 
          title="Quotation PDF" 
        />
      </div>
    );
  }


  return (
    <>
    <ResizablePanelGroup direction="horizontal" autoSaveId="quotation-split" className="flex h-[calc(100vh-48px)] bg-zinc-100 overflow-hidden">
      {/* Sidebar List (300px) */}
      <ResizablePanel defaultSize={32} minSize={26} maxSize={42} className="flex flex-col bg-white border-r border-[#EEF0F3]">
        <div className="px-4 pt-4 pb-3 border-b border-[#EEF0F3]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-baseline gap-2 min-w-0">
              <h2 className="text-[21px] font-semibold text-zinc-900 leading-none">Quotations</h2>
              <span className="text-xs text-zinc-400 whitespace-nowrap">{quotations.length} {quotations.length === 1 ? 'quotation' : 'quotations'}</span>
            </div>
            <button
              onClick={() => navigate('/quotation/create')}
              className="h-8 px-3 rounded-md bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-[#1D4ED8] transition-colors whitespace-nowrap"
            >
              + New
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search quotations..."
              className="w-full h-9 pl-9 pr-3 text-[13px] text-zinc-900 rounded-lg border border-[#E5E7EB] placeholder:text-zinc-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]"
            />
          </div>
        </div>
        <div className="flex items-center gap-5 px-4 border-b border-[#EEF0F3]">
          {LIST_TABS.map((tab) => {
            const active = listStatusTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setListStatusTab(tab)}
                className={`py-1.5 text-[13px] border-b-2 -mb-px transition-colors ${active ? 'text-[#2563EB] font-medium border-[#2563EB]' : 'text-zinc-500 border-transparent hover:text-zinc-800'}`}
              >
                {tab} <span className={active ? '' : 'text-zinc-400'}>{listStatusCounts[tab] ?? 0}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between px-4" style={{ height: 32 }}>
          <button onClick={() => setListSortAsc((v) => !v)} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
            {listSortAsc ? 'Oldest first' : 'Newest first'}
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {quotationsQuery.isPending ? (
            <div className="p-8 text-center text-zinc-400 text-sm">Loading quotes...</div>
          ) : visibleQuotations.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 text-sm">{quotations.length === 0 ? 'No quotations found' : 'No quotations match'}</div>
          ) : (
            <div>
              {visibleQuotations.map((q) => {
                const selected = quotationId === q.id;
                const st = LIST_STATUS_STYLE[q.status] || LIST_STATUS_STYLE.Draft;
                return (
                  <div
                    key={q.id}
                    onClick={() => navigate(`/quotation/view?id=${q.id}`)}
                    className="px-4 cursor-pointer border-b border-[#EEF0F3] hover:bg-[#F8FAFC]"
                    style={{
                      minHeight: 70,
                      paddingTop: 12,
                      paddingBottom: 12,
                      background: selected ? '#F0F7FF' : undefined,
                      boxShadow: selected ? 'inset 0 0 0 1px #BFDBFE' : undefined,
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-semibold text-zinc-900 truncate">{q.client?.client_name || 'Walk-in Client'}</span>
                      <span className="text-sm font-semibold text-zinc-900 tabular-nums whitespace-nowrap">{formatCurrency(q.grand_total)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 mt-0.5">
                      <div className="flex items-center gap-1.5 min-w-0 text-xs">
                        <span className="font-medium text-zinc-600 whitespace-nowrap">{q.quotation_no}</span>
                        <span className="text-zinc-300">&middot;</span>
                        <span className="text-zinc-400 whitespace-nowrap">{formatDate(q.date)}</span>
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: st.bg, color: st.color }}>
                        {q.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />

      {/* Main Content (70%) */}
      <ResizablePanel defaultSize={78} className="bg-zinc-50">
        <div className="h-full overflow-auto">
          <div className="max-w-5xl mx-auto pt-6 pb-12 px-4 sm:px-6 lg:px-8">
          <div className="bg-white border border-[#E5E7EB] rounded-xl px-5 pt-4 pb-0 mb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-zinc-900 whitespace-nowrap">{quotation.quotation_no}</h1>
                {quotation.revision_no && quotation.revision_no > 1 ? (
                  <span className="text-xs font-semibold text-amber-800 bg-amber-100 border border-amber-200/80 px-2 py-0.5 rounded whitespace-nowrap shrink-0">
                    (Rev {String(quotation.revision_no).padStart(2, '0')})
                  </span>
                ) : null}
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap shrink-0"
                  style={{
                    backgroundColor: (LIST_STATUS_STYLE[quotation.status] || LIST_STATUS_STYLE.Draft).bg,
                    color: (LIST_STATUS_STYLE[quotation.status] || LIST_STATUS_STYLE.Draft).color
                  }}
                >
                  {quotation.status}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
              {['Draft', 'Sent', 'Rejected', 'Under Negotiation'].includes(quotation?.status) && (
                <button
                  onClick={handleSubmitForApproval}
                  className="inline-flex items-center gap-1 h-8 px-2 rounded-md border border-[#E5E7EB] text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  <Send className="w-[14px] h-[14px]" />
                  Submit for Approval
                </button>
              )}
              {canApprove && (
                <button
                  onClick={() => { setReviewComments(''); setShowReviewDialog(true); }}
                  className="inline-flex items-center gap-1 h-8 px-2 rounded-md bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-700 transition-colors"
                >
                  <CheckCircle className="w-[14px] h-[14px]" />
                  Review
                </button>
              )}
              {isEditable && (
                <button
                  onClick={handleEdit}
                  className="inline-flex items-center gap-1 h-8 px-2 rounded-md border border-[#E5E7EB] text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  <Edit className="w-[14px] h-[14px]" />
                  Edit
                </button>
              )}
              <button
                onClick={() => handlePrintAction('download')}
                disabled={printLoading}
                className="inline-flex items-center gap-1 h-8 px-2 rounded-md border border-[#E5E7EB] text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
              >
                {printLoading ? (
                  <Loader2 className="w-[14px] h-[14px] animate-spin" />
                ) : (
                  <Printer className="w-[14px] h-[14px]" />
                )}
                Print
              </button>
              <div className="relative">
                <button
                  onClick={() => { setShowConvertMenu((v) => !v); setShowHeaderMenu(false); setShowTemplateSelect(false); }}
                  className="inline-flex items-center gap-1 h-8 px-2 rounded-md border border-[#E5E7EB] text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  <FileText className="w-[14px] h-[14px]" />
                  Convert
                  <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${showConvertMenu ? 'rotate-180' : ''}`} />
                </button>
                {showConvertMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowConvertMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] bg-white border border-zinc-200 rounded-md shadow-lg p-1">
                      <button onClick={() => { setShowConvertMenu(false); handleConvert('proforma-invoice'); }} className="block w-full text-left px-2.5 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 rounded transition-colors">Proforma Invoice</button>
                      <button onClick={() => { setShowConvertMenu(false); handleConvert('invoice'); }} className="block w-full text-left px-2.5 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 rounded transition-colors">Tax Invoice</button>
                    </div>
                  </>
                )}
              </div>
              <div className="relative">
                <button
                  onClick={() => { setShowHeaderMenu((v) => !v); setShowTemplateSelect(false); setShowConvertMenu(false); }}
                  title="More actions"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-[#E5E7EB] text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {showHeaderMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowHeaderMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 min-w-[210px] bg-white border border-zinc-200 rounded-md shadow-lg p-1">
                      <button
                        onClick={() => { setShowHeaderMenu(false); handlePrintAction('preview'); }}
                        className="flex items-center gap-2.5 w-full text-left px-2.5 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 rounded transition-colors"
                      >
                        <Eye className="w-[14px] h-[14px] text-zinc-400" />
                        Preview
                      </button>
                      <button
                        onClick={() => { setShowHeaderMenu(false); handleDuplicate(); }}
                        className="flex items-center gap-2.5 w-full text-left px-2.5 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 rounded transition-colors"
                      >
                        <Copy className="w-[14px] h-[14px] text-zinc-400" />
                        Duplicate
                      </button>
                      <button
                        onClick={() => { setShowHeaderMenu(false); setRevisionDialogOpen(true); }}
                        className="flex items-center gap-2.5 w-full text-left px-2.5 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 rounded transition-colors"
                      >
                        <RotateCcw className="w-[14px] h-[14px] text-zinc-400" />
                        Revision History {quotation?.revision_history?.length ? `(${quotation.revision_history.length})` : ''}
                      </button>
                      {quotation?.revision_history?.length > 0 && (
                        <button
                          onClick={() => { setShowHeaderMenu(false); setShowCompareModal(true); }}
                          className="flex items-center gap-2.5 w-full text-left px-2.5 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 rounded transition-colors"
                        >
                          <Table2 className="w-[14px] h-[14px] text-blue-600" />
                          Compare Revisions Grid
                        </button>
                      )}
                      <button
                        onClick={() => { setShowHeaderMenu(false); setShowDocumentSettings(true); }}
                        className="flex items-center gap-2.5 w-full text-left px-2.5 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 rounded transition-colors"
                      >
                        <Settings2 className="w-[14px] h-[14px] text-zinc-400" />
                        Document Settings
                      </button>
                      <div className="h-px bg-zinc-100 my-1" />
                      <button
                        onClick={() => { setShowHeaderMenu(false); handleOpenAvailability(); }}
                        className="flex items-center gap-2.5 w-full text-left px-2.5 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 rounded transition-colors"
                      >
                        <PackageSearch className="w-[14px] h-[14px] text-zinc-400 shrink-0" />
                        <span>
                          <span className="block">Check Availability</span>
                          <span className="block text-[10px] font-normal text-zinc-400">View live stock per line (read-only)</span>
                        </span>
                      </button>
                      <button
                        onClick={() => { setShowHeaderMenu(false); setShowStockCheckModal(true); }}
                        disabled={launchingStockCheck}
                        className="flex items-center gap-2.5 w-full text-left px-2.5 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {launchingStockCheck ? (
                          <Loader2 className="w-[14px] h-[14px] text-zinc-400 animate-spin" />
                        ) : (
                          <ClipboardList className="w-[14px] h-[14px] text-zinc-400 shrink-0" />
                        )}
                        <span>
                          <span className="block">Stock Check</span>
                          <span className="block text-[10px] font-normal text-zinc-400">Create procurement tracker</span>
                        </span>
                      </button>
                      <button
                        onClick={async () => {
                          setShowHeaderMenu(false);
                          setLaunchingRevision(true);
                          try {
                            if (organisation?.id && quotationId) {
                              await initiateQuotationRevision(organisation.id, quotationId);
                            }
                          } finally {
                            setLaunchingRevision(false);
                          }
                        }}
                        disabled={launchingRevision}
                        className="flex items-center gap-2.5 w-full text-left px-2.5 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {launchingRevision ? (
                          <Loader2 className="w-[14px] h-[14px] text-zinc-400 animate-spin" />
                        ) : (
                          <FileEdit className="w-[14px] h-[14px] text-zinc-400 shrink-0" />
                        )}
                        <span>
                          <span className="block">Request Revision</span>
                          <span className="block text-[10px] font-normal text-zinc-400">Flag for quotation revision</span>
                        </span>
                      </button>
                      {(isCancellable || isDeletable) && (
                        <div className="h-px bg-zinc-100 my-1" />
                      )}
                      {isCancellable && (
                        <button
                          onClick={() => { setShowHeaderMenu(false); handleCancel(); }}
                          className="flex items-center gap-2.5 w-full text-left px-2.5 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <XCircle className="w-[14px] h-[14px]" />
                          Cancel
                        </button>
                      )}
                      {isDeletable && (
                        <button
                          onClick={() => { setShowHeaderMenu(false); handleDelete(); }}
                          className="flex items-center gap-2.5 w-full text-left px-2.5 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-[14px] h-[14px]" />
                          Delete
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-5">
              {[
                { key: 'Preview', icon: Eye, count: null },
                { key: 'History', icon: History, count: historyEvents.all.length },
                { key: 'Attachments', icon: Paperclip, count: 0 },
              ].map((tab: any) => {
                const active = previewTab === tab.key;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setPreviewTab(tab.key)}
                    className={`flex items-center gap-1.5 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-px transition-colors ${active ? 'text-[#2563EB] border-[#2563EB]' : 'text-zinc-500 border-transparent hover:text-zinc-800'}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.key}
                    {tab.count !== null && tab.count !== undefined ? (
                      <span className={`rounded-full px-1.5 py-px text-[10px] font-bold ${active ? 'bg-[#EFF6FF] text-[#2563EB]' : 'bg-zinc-100 text-zinc-500'}`}>{tab.count}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="relative">
              <button
                onClick={() => { setShowTemplateSelect((v) => !v); setShowHeaderMenu(false); setShowConvertMenu(false); }}
                className="inline-flex items-center gap-1.5 h-8 px-3 mb-1 rounded-md border border-[#E5E7EB] text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                {getSelectedTemplateName()}
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </button>
              {showTemplateSelect && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowTemplateSelect(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-[210px] max-h-[300px] overflow-y-auto bg-white border border-zinc-200 rounded-md shadow-lg p-1">
                    {templates.map((t) => (
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
          </div>

          {previewTab === 'History' && (
            <div className="py-6 max-w-2xl">
              <div className="mb-4 flex items-center gap-2">
                {[
                  { key: 'timeline', label: 'Timeline', count: historyEvents.journey.length },
                  { key: 'feedback', label: 'Changes / Feedback', count: historyEvents.feedback.length },
                ].map((t: any) => {
                  const active = historySubTab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setHistorySubTab(t.key)}
                      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold transition-colors ${active ? 'bg-[#0B1C30] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                    >
                      {t.label}
                      <span className={`rounded-full px-1.5 py-px text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-white text-zinc-500'}`}>{t.count}</span>
                    </button>
                  );
                })}
              </div>
              {(historySubTab === 'feedback' ? historyEvents.feedback : historyEvents.journey).length === 0 ? (
                <div className="py-16 text-center">
                  <div className="text-sm font-medium text-zinc-500">{historySubTab === 'feedback' ? 'No feedback yet' : 'No history yet'}</div>
                  <div className="mt-1 text-[13px] text-zinc-400">{historySubTab === 'feedback' ? 'Suggestions from the project channel and reviewer comments will appear here.' : 'Events for this quotation will appear here.'}</div>
                </div>
              ) : (
                <div className="relative pl-6">
                  <div className="absolute top-2 bottom-2 w-px bg-[#E5E7EB]" style={{ left: 5 }} />
                  <div className="space-y-4">
                    {(historySubTab === 'feedback' ? historyEvents.feedback : historyEvents.journey).map((ev: any) => (
                      <div key={ev.key} className="relative">
                        <span className="absolute rounded-full bg-white" style={{ width: 11, height: 11, left: -24, top: 5, border: `3px solid ${ev.color}` }} />
                        <div className="bg-white border border-[#EEF0F3] rounded-lg px-3.5 py-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[13px] font-semibold text-zinc-900">{ev.title}</span>
                            <span className="text-[11px] text-zinc-400 whitespace-nowrap">{formatDateTime(ev.at)}</span>
                          </div>
                          {ev.by ? <div className="mt-0.5 text-xs text-zinc-500">by {ev.by}</div> : null}
                          {ev.desc ? <div className="mt-0.5 text-xs text-zinc-500">{ev.desc}</div> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {previewTab === 'Attachments' && (
            <div className="py-16 text-center">
              <div className="text-sm font-medium text-zinc-500">No attachments</div>
              <div className="mt-1 text-[13px] text-zinc-400">Files attached to this quotation will appear here.</div>
            </div>
          )}
          <div style={{ display: previewTab === 'Preview' ? undefined : 'none' }}>
          <div className="space-y-4 mb-12">
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="bg-white border border-[#E5E7EB] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-3.5 h-3.5 text-[#2563EB]" />
                  <h3 className="text-[11px] font-bold text-[#2563EB] uppercase tracking-[0.08em]">Client</h3>
                </div>
                <div className="space-y-1">
                  <div className="text-[13px] font-semibold text-zinc-900 truncate" title={quotation.client?.client_name || quotation.client?.name || '-'}>{quotation.client?.client_name || quotation.client?.name || '-'}</div>
                  <div className="text-[12px] text-zinc-500 truncate">{quotation.contact_no || quotation.client?.phone || '-'}</div>
                  <div className="text-[12px] text-zinc-500 truncate" title={quotation.gstin || quotation.client?.gstin || '-'}>GST: {quotation.gstin || quotation.client?.gstin || '-'}</div>
                  <div className="text-[12px] text-zinc-500 truncate">{quotation.state || quotation.client?.state || '-'}</div>
                </div>
              </div>
              <div className="bg-white border border-[#E5E7EB] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-3.5 h-3.5 text-[#2563EB]" />
                  <h3 className="text-[11px] font-bold text-[#2563EB] uppercase tracking-[0.08em]">Document</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-[11px] text-zinc-400 shrink-0">Quotation No</dt>
                    <dd className="text-[12px] font-semibold text-zinc-900 text-right truncate" title={quotation.quotation_no || '-'}>{quotation.quotation_no || '-'}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-[11px] text-zinc-400 shrink-0">Date</dt>
                    <dd className="text-[12px] font-semibold text-zinc-900 text-right truncate">{formatDate(quotation.date)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-[11px] text-zinc-400 shrink-0">Valid Till</dt>
                    <dd className="text-[12px] font-semibold text-zinc-900 text-right truncate">{formatDate(quotation.valid_till)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-[11px] text-zinc-400 shrink-0">Revision No</dt>
                    <dd className="flex items-center justify-end gap-2 min-w-0">
                      <span className="text-[12px] font-semibold text-zinc-900">{quotation.revision_no ? `Rev ${String(quotation.revision_no).padStart(2, '0')}` : '01'}</span>
                    </dd>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-[#E5E7EB] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <ScrollText className="w-3.5 h-3.5 text-[#2563EB]" />
                  <h3 className="text-[11px] font-bold text-[#2563EB] uppercase tracking-[0.08em]">Terms</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-[11px] text-zinc-400 shrink-0">Payment Terms</dt>
                    <dd className="text-[12px] font-semibold text-zinc-900 text-right truncate" title={quotation.payment_terms || '-'}>{quotation.payment_terms || '-'}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-[11px] text-zinc-400 shrink-0">Reference</dt>
                    <dd className="text-[12px] font-semibold text-zinc-900 text-right truncate" title={quotation.reference || '-'}>{quotation.reference || '-'}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-[11px] text-zinc-400 shrink-0">Prepared By</dt>
                    <dd className="text-[12px] font-semibold text-zinc-900 text-right truncate" title={quotation.prepared_by || '-'}>{quotation.prepared_by || '-'}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-[11px] text-zinc-400 shrink-0">Remarks</dt>
                    <dd className="text-[12px] font-semibold text-zinc-900 text-right truncate" title={quotation.remarks || quotation.reference || '-'}>{quotation.remarks || quotation.reference || '-'}</dd>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-[#E5E7EB] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="w-3.5 h-3.5 text-[#2563EB]" />
                  <h3 className="text-[11px] font-bold text-[#2563EB] uppercase tracking-[0.08em]">Project & Shipping</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-[11px] text-zinc-400 shrink-0">Project</dt>
                    <dd className="text-[12px] font-semibold text-zinc-900 text-right truncate" title={quotation.project?.project_name || '-'}>{quotation.project?.project_name || '-'}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-[11px] text-zinc-400 shrink-0">Billing Address</dt>
                    <dd className="text-[12px] font-semibold text-zinc-600 text-right truncate" title={quotation.billing_address || '-'}>{quotation.billing_address || '-'}</dd>
                  </div>
                  {quotation.shipping_address && quotation.shipping_address !== quotation.billing_address && (
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-[11px] text-zinc-400 shrink-0">Shipping Address</dt>
                      <dd className="text-[12px] font-semibold text-zinc-600 text-right truncate" title={quotation.shipping_address}>{quotation.shipping_address}</dd>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-zinc-900">Line Items</h3>
                  <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-bold text-[#2563EB]">{(quotation.items || []).filter((i: any) => !i.is_header && !i.is_subtotal).length} Items</span>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                  <input
                    value={itemFilter}
                    onChange={(e) => setItemFilter(e.target.value)}
                    placeholder="Filter items..."
                    className="h-8 w-44 pl-8 pr-2 text-[12px] text-zinc-900 rounded-md border border-[#E5E7EB] placeholder:text-zinc-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]"
                  />
                </div>
              </div>
              {!quotation.items || quotation.items.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  <div className="text-lg font-medium mb-2">No line items found</div>
                  <div className="text-sm">This quotation may not have any items saved yet.</div>
                </div>
              ) : visibleItems.length === 0 ? (
                <div className="py-10 text-center text-sm text-zinc-400">No items match this filter.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-zinc-200">
                  <thead className="bg-zinc-100">
                    <tr className="border-b border-zinc-200">
                      {templates.find(t => t.id === selectedTemplateId)?.column_settings?.optional?.sno !== false && (
                        <th className="border-r border-zinc-200" style={{ padding: '16px 12px' }}><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">#</span></th>
                      )}
                      {showPrev.hsn && (
                        <th className="border-r border-zinc-200" style={{ padding: '16px 12px' }}><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">HSN/SAC</span></th>
                      )}
                      {showPrev.itemCode && (
                        <th className="border-r border-zinc-200" style={{ padding: '16px 12px' }}><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Part No</span></th>
                      )}
                      {showPrev.make && (
                        <th className="border-r border-zinc-200" style={{ padding: '16px 12px' }}><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Make</span></th>
                      )}
                      <th className="border-r border-zinc-200" style={{ padding: '16px 12px' }}><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Description</span></th>
                      {showPrev.variant && (
                        <th className="border-r border-zinc-200" style={{ padding: '16px 12px' }}><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Variant</span></th>
                      )}
                      {showPrev.qty && (
                        <th className="border-r border-zinc-200" style={{ padding: '16px 12px' }}><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block text-right">Qty</span></th>
                      )}
                      {showPrev.uom && (
                        <th className="border-r border-zinc-200" style={{ padding: '16px 12px' }}><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Unit</span></th>
                      )}
                      {showPrev.rate && (
                        <th className="border-r border-zinc-200" style={{ padding: '16px 12px' }}><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block text-right">Rate</span></th>
                      )}

                      {showPrev.disc && (
                        <th className="border-r border-zinc-200" style={{ padding: '16px 12px' }}><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block text-right">Disc %</span></th>
                      )}
                      {showPrev.netRate && (
                        <th className="border-r border-zinc-200" style={{ padding: '16px 12px' }}><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block text-right">Net Rate</span></th>
                      )}
                      {showPrev.tax && (
                        <th className="border-r border-zinc-200" style={{ padding: '16px 12px' }}><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block text-right">Tax %</span></th>
                      )}
                      {showPrev.custom1 && (
                        <th className="border-r border-zinc-200" style={{ padding: '16px 12px' }}><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">{templates.find(t => t.id === selectedTemplateId)?.column_settings?.labels?.custom1 || 'Custom 1'}</span></th>
                      )}
                      {showPrev.custom2 && (
                        <th className="border-r border-zinc-200" style={{ padding: '16px 12px' }}><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">{templates.find(t => t.id === selectedTemplateId)?.column_settings?.labels?.custom2 || 'Custom 2'}</span></th>
                      )}
                      <th className="border-r border-zinc-200" style={{ padding: '16px 12px' }}><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block text-right">Total</span></th>
                    </tr>
                  </thead>
                   <tbody className="bg-white">
                    {visibleItems.map((item: any, index: number) => {
                      const template = templates.find(t => t.id === selectedTemplateId);
                      const optCols = template?.column_settings?.optional || {};
                      
                      if (item.is_header) {
                        const colCount = previewColCount();
                        return (
                          <tr key={item.id} style={{ background: '#f8fafc' }}>
                            <td colSpan={colCount} style={{ padding: '10px 14px' }}>
                              <span className="text-[13px] font-bold text-zinc-800">{item.description || 'Section'}</span>
                            </td>
                          </tr>
                        );
                      }

                      if (item.is_subtotal) {
                        let subtotalAmount = 0;
                        for (let i = index - 1; i >= 0; i--) {
                          const prev = quotation.items[i];
                          if (prev.is_subtotal || prev.is_header) break;
                          subtotalAmount += parseFloat(prev.line_total) || 0;
                        }
                        let colCount = previewColCount();
                        return (
                          <tr key={item.id} style={{ background: '#fef9c3', borderTop: '2px solid #eab308' }}>
                            <td colSpan={colCount} style={{ padding: '10px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%', gap: '16px' }}>
                                <span className="text-[13px] font-bold text-amber-700" style={{ textAlign: 'right' }}>{item.subtotal_label || 'Sub-total:'}</span>
                                <span className="text-[13px] font-bold text-amber-700" style={{ minWidth: '100px', textAlign: 'right' }}>{formatCurrency(subtotalAmount)}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors align-top">
                          {showPrev.sno && <td className="border-r border-zinc-100" style={{ padding: '14px 7px' }}><span className="text-[11px] text-zinc-400 font-medium block">{String(index + 1).padStart(2, '0')}</span></td>}
                          {showPrev.hsn && <td className="border-r border-zinc-100" style={{ padding: '14px 7px' }}><span className="text-[10px] text-zinc-500 font-mono block">{item.sac_code || item.hsn_code || item.item?.hsn_code || '-'}</span></td>}
                          {showPrev.itemCode && <td className="border-r border-zinc-100" style={{ padding: '14px 7px' }}><span className="inline-block rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600">{item.item?.item_code || '-'}</span></td>}
                          {showPrev.make && <td className="border-r border-zinc-100" style={{ padding: '14px 7px' }}><span className="text-[10px] text-zinc-400 italic block">{item.make || '-'}</span></td>}
                          <td className="border-r border-zinc-100" style={{ padding: '14px 7px' }}>
                            <div className="text-[12px] font-medium text-zinc-900 leading-tight">{item.item?.display_name || item.item?.name || '-'}</div>
                            {item.description && item.description !== (item.item?.display_name || item.item?.name) && (
                              <div className="text-[11px] text-zinc-500 leading-snug mt-1">{item.description}</div>
                            )}
                            {item.override_flag && (
                              <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100">Modified</span>
                            )}
                          </td>
                          {showPrev.variant && (
                            <td className="border-r border-zinc-100" style={{ padding: '14px 7px' }}>
                              <span className="text-[11px] text-zinc-500 block">{allVariants.find(v => v.id === item.variant_id)?.variant_name || '-'}</span>
                            </td>
                          )}
                          {showPrev.qty && <td className="border-r border-zinc-100" style={{ padding: '14px 7px' }}><span className="text-[11px] text-zinc-900 text-right font-medium block">{item.qty}</span></td>}
                          {showPrev.uom && <td style={{ padding: '14px 7px' }}><span className="text-[10px] text-zinc-400 block">{item.uom}</span></td>}
                          {showPrev.rate && <td className="border-l border-zinc-100" style={{ padding: '14px 7px' }}><span className="text-[11px] text-zinc-900 text-right block">{formatCurrency(item.rate)}</span></td>}

                          {showPrev.disc && <td style={{ padding: '14px 7px' }}><span className={`text-[10px] text-right font-medium block rounded px-1.5 py-0.5 ${parseFloat(item.discount_percent) >= 40 ? 'text-red-600 bg-red-50' : parseFloat(item.discount_percent) > 0 ? 'text-amber-600' : 'text-zinc-400'}`}>{item.discount_percent}%</span></td>}
                          {showPrev.netRate && <td className="border-r border-zinc-100" style={{ padding: '14px 7px' }}><span className="text-[11px] text-zinc-900 text-right font-semibold block">{formatCurrency(item.rate)}</span></td>}
                          {showPrev.tax && <td style={{ padding: '14px 7px' }}><span className="text-[10px] text-zinc-500 text-right block">{item.tax_percent}%</span></td>}
                          {showPrev.custom1 && <td style={{ padding: '14px 7px' }}><span className="text-[10px] text-zinc-500 block">{item.custom1 || '-'}</span></td>}
                          {showPrev.custom2 && <td style={{ padding: '14px 7px' }}><span className="text-[10px] text-zinc-500 block">{item.custom2 || '-'}</span></td>}
                          <td className="bg-zinc-50" style={{ padding: '14px 7px' }}><span className="text-[11px] font-bold text-zinc-900 text-right block">{formatCurrency(item.line_total)}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mt-4">
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 xl:order-2 xl:col-start-4 xl:col-span-2">
              <div className="w-full space-y-2">
                <div className="flex justify-between text-[12px] text-zinc-500">
                  <span>Subtotal</span>
                  <span className="font-bold text-zinc-900">{formatCurrency(quotation.subtotal)}</span>
                </div>
                <div className="flex justify-between text-[12px] text-zinc-500">
                  <span>Total Item Discount</span>
                  <span className="text-red-500 font-bold">- {formatCurrency(quotation.total_item_discount)}</span>
                </div>
                <div className="flex justify-between text-[12px] text-zinc-500">
                  <span>Extra Discount ({quotation.extra_discount_percent}%)</span>
                  <span className="text-red-500 font-bold">- {formatCurrency(quotation.extra_discount_amount)}</span>
                </div>
                
                {quotation.state && (organisation?.state || 'Maharashtra') && 
                quotation.state.trim().toLowerCase() !== (organisation?.state || 'Maharashtra').trim().toLowerCase() ? (
                  <div className="flex justify-between text-[12px] text-zinc-500">
                    <span>IGST</span>
                    <span className="font-bold text-zinc-900">{formatCurrency(quotation.total_tax)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-[12px] text-zinc-500">
                      <span>CGST</span>
                      <span className="font-bold text-zinc-900">{formatCurrency(quotation.total_tax / 2)}</span>
                    </div>
                    <div className="flex justify-between text-[12px] text-zinc-500">
                      <span>SGST</span>
                      <span className="font-bold text-zinc-900">{formatCurrency(quotation.total_tax / 2)}</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between text-[12px] text-zinc-500">
                  <span>Round Off</span>
                  <span className="font-bold text-zinc-900">{formatCurrency(quotation.round_off)}</span>
                </div>

                <div className="pt-3 border-t-2 border-zinc-900 flex justify-between items-center">
                  <span className="text-[13px] font-bold text-zinc-900 uppercase">Grand Total</span>
                  <span className="text-xl font-black text-zinc-900">{formatCurrency(quotation.grand_total)}</span>
                </div>
                <div className="pt-1 text-[11px] text-zinc-500 italic leading-relaxed">Amount in Words: {quotation.amount_in_words || numberToInrWords(Number(quotation.grand_total) || 0)}</div>
              </div>
            </div>

          {/* Terms & Conditions Section */}
          {termsConditionsQuery.data?.custom_content && (
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 xl:order-1 xl:col-span-3">
              <h3 className="text-lg font-bold text-zinc-900 mb-4">Terms & Conditions</h3>
              <div className="bg-zinc-50 rounded-lg p-6">
                {(() => {
                  try {
                    const termsData = typeof termsConditionsQuery.data.custom_content === 'string' 
                      ? (termsConditionsQuery.data.custom_content.trim() ? JSON.parse(termsConditionsQuery.data.custom_content) : null) 
                      : termsConditionsQuery.data.custom_content;
                    
                    if (termsData && termsData.sections) {
                      return termsData.sections.map((section: any, sectionIndex: number) => (
                        <div key={sectionIndex} className="mb-4 last:mb-0">
                          <h4 className="text-sm font-semibold text-zinc-900 mb-2">
                            {sectionIndex + 1}. {section.title}
                          </h4>
                          {section.items && section.items.length > 0 && (
                            <div className="space-y-1">
                              {section.items.map((item: any, itemIndex: number) => (
                                <div key={itemIndex} className="text-sm text-zinc-600 flex items-start">
                                  <span className="mr-2 text-zinc-400">
                                    {item.item_type === 'bullet' ? '\u2022' : `${itemIndex + 1}.`}
                                  </span>
                                  <span>{item.content}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ));
                    }
                    return (
                      <div className="space-y-1">
                        {['Payment as per terms mentioned above.', 'This is a system-generated document.'].map((t: string, i: number) => (
                          <div key={i} className="text-sm text-zinc-600 flex items-start">
                            <span className="mr-2 text-zinc-400">{i + 1}.</span>
                            <span>{t}</span>
                          </div>
                        ))}
                      </div>
                    );
                  } catch (error) {
                    // Fallback to plain text if JSON parsing fails
                    return (
                      <div className="text-sm text-zinc-600 whitespace-pre-line">
                        {String(termsConditionsQuery.data.custom_content)}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          )}
          {selectedSignatory && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 xl:col-span-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] text-zinc-400">For, {organisation?.name || 'Company'}</div>
                  <div className="mt-0.5 text-[13px] font-bold text-zinc-900">{selectedSignatory.name || 'Authorised Signatory'}</div>
                  {(selectedSignatory.designation || organisation?.signatory_designation) ? (
                    <div className="text-[11px] text-zinc-500">{selectedSignatory.designation || organisation?.signatory_designation}</div>
                  ) : null}
                </div>
                {selectedSignatory.url ? (
                  <img src={selectedSignatory.url} alt="Authorised signature" className="h-12 object-contain" />
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
    </div>
    </ResizablePanel>
    </ResizablePanelGroup>

    {/* Preview Modal */}
    {previewModalOpen && (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg w-full max-w-4xl max-h-[95vh] flex flex-col shadow-2xl">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-zinc-50 rounded-t-lg">
            <div className="flex items-center gap-4">
              <h3 className="font-semibold text-zinc-800 text-lg">
                Preview - {quotation?.quotation_no || 'Quotation'}
              </h3>
              {previewLoading && (
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading...</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Revision History Button */}
              <button
                onClick={() => setRevisionDialogOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-zinc-100 text-zinc-700 rounded hover:bg-zinc-200 transition-colors"
                title="View revision history"
              >
                <RotateCcw className="w-4 h-4" />
                History {quotation?.revision_history?.length ? `(${quotation.revision_history.length})` : ''}
              </button>

              {/* Edit Button */}
              <button
                onClick={() => {
                  setPreviewModalOpen(false);
                  navigate(`/quotation/edit?id=${quotationId}`);
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
              
              {/* Download Button */}
              <button
                onClick={downloadFromPreview}
                disabled={previewLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
              
              {/* Print Button */}
              <button
                onClick={printFromPreview}
                disabled={previewLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-zinc-600 text-white rounded hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              
              {/* Close Button */}
              <button
                onClick={() => setPreviewModalOpen(false)}
                className="p-2 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Modal Content */}
          <div className="flex-1 overflow-auto bg-zinc-100 p-4">
            {previewLoading ? (
              <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center">
                  <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-3" />
                  <p className="text-zinc-500">Generating preview...</p>
                </div>
              </div>
            ) : (
              <div 
                id="preview-modal-content"
                className="bg-white mx-auto shadow-lg"
                style={{ width: '210mm', minHeight: '297mm' }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHTML) }}
              />
            )}
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
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280' }}>{quotation?.quotation_no || 'Quotation'}</span>
            <div className="flex items-center" style={{ gap: '6px' }}>
                <button
                  onClick={() => { setShowPdfPreviewModal(false); navigate(`/quotation/edit?id=${quotationId}`); }}
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
                        const file = new File([blob], `${quotation?.quotation_no || 'quotation'}.pdf`, { type: 'application/pdf' });
                        await navigator.share({ files: [file], title: quotation?.quotation_no || 'Quotation' });
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

    {/* Stock Check Confirmation Modal */}
    {showStockCheckModal && (
      <div className="fixed inset-0 z-[2000] bg-black/45 flex items-center justify-center p-4" onClick={() => setShowStockCheckModal(false)}>
        <div className="bg-white rounded-xl shadow-2xl w-[440px] max-w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
          <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF]">
              <ClipboardList className="h-5 w-5 text-[#2563EB]" />
            </span>
            <div>
              <h3 className="text-[15px] font-bold text-[#0B1C30]">Launch Stock Check</h3>
              <p className="text-xs text-[#475569] mt-0.5">Create a procurement tracker from this quotation.</p>
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 mb-3">
              <div className="flex items-center gap-3">
                <PackageSearch className="w-6 h-6 text-[#2563EB] shrink-0" />
                <div>
                  <div className="text-[13px] font-bold text-[#0B1C30]">{quotation.quotation_no || 'Quotation'}</div>
                  <div className="text-xs text-[#475569]">{(quotation.items || []).filter((i: any) => !i.is_header).length} line items will be imported</div>
                </div>
              </div>
            </div>
            <div className="text-xs text-[#475569] space-y-1.5">
              <p>- BOQ quantities are copied as required quantities</p>
              <p>- Live warehouse stock is checked: fully covered lines open as In Stock</p>
              <p>- Only the remaining gaps need vendor sourcing in the tracker</p>
            </div>
          </div>
          <div className="px-5 py-4 border-t border-[#E2E8F0] flex gap-2 justify-end">
            <button
              onClick={() => setShowStockCheckModal(false)}
              className="h-9 px-4 text-[13px] font-semibold text-[#0B1C30] bg-white border border-[#CBD5E1] rounded-lg hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLaunchStockCheck}
              disabled={launchingStockCheck || !(quotation.items || []).some((i: any) => !i.is_header)}
              className="h-9 px-4 text-[13px] font-bold text-white bg-[#2563EB] rounded-lg hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {launchingStockCheck ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Launch Stock Check'
              )}
            </button>
          </div>
        </div>
      </div>
    )}

        {/* Stock Availability Modal (informational, read-only) */}
    {showAvailability && (
      <div className="fixed inset-0 z-[2000] bg-black/45 flex items-center justify-center p-4" onClick={() => setShowAvailability(false)}>
        <div className="bg-white rounded-xl shadow-2xl w-[760px] max-w-full max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF]">
                <PackageSearch className="h-5 w-5 text-[#2563EB]" />
              </span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold text-[#0B1C30]">Stock Availability</h3>
                <p className="text-xs text-[#475569] mt-0.5 truncate">{quotation.quotation_no || 'Quotation'} - live stock per line item</p>
              </div>
            </div>
            <button onClick={() => setShowAvailability(false)} aria-label="Close" className="p-1.5 text-[#475569] hover:text-[#0B1C30] hover:bg-zinc-100 rounded-md transition-colors"><X className="w-4 h-4" /></button>
          </div>
          {!availabilityLoading && availabilityRows.length > 0 && (
            <div className="px-5 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] px-2.5 py-1 text-[11px] font-bold text-[#047857]">
                In Stock {availabilitySummary.inStock}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFFBEB] border border-[#FDE68A] px-2.5 py-1 text-[11px] font-bold text-[#B45309]">
                Partial {availabilitySummary.partial}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEF2F2] border border-[#FECACA] px-2.5 py-1 text-[11px] font-bold text-[#DC2626]">
                No Stock {availabilitySummary.out}
              </span>
              {availabilitySummary.unlinked > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F5F9] border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-bold text-[#64748B]">
                  Not linked {availabilitySummary.unlinked}
                </span>
              )}
              <span className="ml-auto text-[11px] text-[#475569]">{availabilitySummary.total} lines</span>
            </div>
          )}
          <div className="px-5 py-4 space-y-3 overflow-y-auto">
            {availabilityLoading ? (
              <div className="flex items-center justify-center py-10 text-[#475569] text-sm">
                <Loader2 className="w-5 h-5 animate-spin mr-2 text-[#2563EB]" />Checking stock...
              </div>
            ) : availabilityRows.length === 0 ? (
              <div className="text-sm text-[#475569] py-10 text-center">No line items to check.</div>
            ) : (
              availabilityRows.map((row: any) => (
                <div key={row.id} className="border border-[#E2E8F0] rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-[#0B1C30] truncate">
                        {row.name}
                        {row.code ? <span className="text-[#475569] font-normal"> - {row.code}</span> : null}
                      </div>
                      <div className="text-xs text-[#475569] mt-1 tabular-nums">
                        Required <b className="text-[#0B1C30]">{row.required}</b>
                        <span className="mx-1.5 text-[#CBD5E1]">|</span>
                        Available <b className="text-[#0B1C30]">{row.available === null ? '-' : row.available}</b>
                      </div>
                    </div>
                    {availabilityBadge(row.status)}
                  </div>
                  {row.warehouses.length > 0 && (
                    <div className="mt-2.5 border-t border-[#F1F5F9] pt-2 space-y-1">
                      {row.warehouses.map((w: any, wi: number) => (
                        <div key={wi} className="flex items-center justify-between text-xs text-[#475569]">
                          <span className="truncate">{w.warehouse_name}</span>
                          <span className="tabular-nums whitespace-nowrap">
                            Stock <b className="text-[#0B1C30]">{w.stock}</b>
                            <span className="mx-1.5 text-[#CBD5E1]">|</span>
                            Reserved <b className="text-[#0B1C30]">{w.reserved}</b>
                            <span className="mx-1.5 text-[#CBD5E1]">|</span>
                            Free <b className="text-[#0B1C30]">{w.available}</b>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
            <div className="text-xs text-[#475569] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
              Informational only - no stock is reserved and nothing is created. Availability is re-checked when this
              quotation converts to a Sales Order, where reservations and MRP apply.
            </div>
          </div>
          <div className="px-5 py-4 border-t border-[#E2E8F0] flex gap-2 justify-end">
            <button
              onClick={() => setShowAvailability(false)}
              className="h-9 px-4 text-[13px] font-semibold text-[#0B1C30] bg-white border border-[#CBD5E1] rounded-lg hover:bg-zinc-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleLaunchStockCheck}
              disabled={launchingStockCheck || availabilityRows.length === 0}
              className="h-9 px-4 text-[13px] font-bold text-white bg-[#2563EB] rounded-lg hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {launchingStockCheck ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Creating...</>
              ) : (
                <><ClipboardList className="w-4 h-4" />Send to Procurement</>
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    <DocumentSettingsDrawer
      isOpen={showDocumentSettings}
      onClose={() => setShowDocumentSettings(false)}
      organisationId={organisation?.id}
      quotationId={quotationId}
      onTemplateChanged={() => {
        quotationQuery.refetch();
        templatesQuery.refetch();
      }}
    />

    {showReviewDialog && (
      <div className="fixed inset-0 z-[100] bg-black/45 flex items-center justify-center p-4" onClick={() => setShowReviewDialog(false)}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
          <div className="text-sm font-bold text-zinc-900">Review {quotation?.quotation_no}</div>
          <div className="mt-1 text-xs text-zinc-500">Your comment is required and will be visible to the quote creator in History.</div>
          <textarea
            value={reviewComments}
            onChange={(e) => setReviewComments(e.target.value)}
            rows={4}
            placeholder="e.g. Approved - ensure dispatch via ABC Transport and confirm the date with the client"
            className="mt-3 w-full rounded-md border border-[#E5E7EB] p-2.5 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]"
          />
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowReviewDialog(false)}>Cancel</Button>
            <Button variant="warning" size="sm" disabled={reviewSubmitting || !reviewComments.trim()} onClick={() => submitReview('RETURNED')}>Request Changes</Button>
            <Button variant="destructive" size="sm" disabled={reviewSubmitting || !reviewComments.trim()} onClick={() => submitReview('REJECTED')}>Reject</Button>
            <Button variant="success" size="sm" disabled={reviewSubmitting || !reviewComments.trim()} onClick={() => submitReview('APPROVED')}>Approve</Button>
          </div>
        </div>
      </div>
    )}

    <RevisionHistoryDialog
      open={revisionDialogOpen}
      onClose={() => setRevisionDialogOpen(false)}
      quotationId={quotationId}
      currentItems={quotation?.items || []}
      currentHeader={quotation}
      revisionHistory={quotation?.revision_history || []}
      currentRevisionNo={quotation?.revision_no || 1}
      currentTotal={quotation?.total_amount || quotation?.grand_total || 0}
      documentNumber={quotation?.quotation_no || 'Quotation'}
      onRestoreRevision={(rev) => {
        setRevisionDialogOpen(false);
        navigate(`/quotation/edit?id=${quotationId}&restoreRev=${rev.revision_no}`);
      }}
    />

    <QuotationRevisionCompareModal
      open={showCompareModal}
      onClose={() => setShowCompareModal(false)}
      quotationId={quotationId}
      documentNumber={quotation?.quotation_no || 'Quotation'}
      revisionHistory={quotation?.revision_history || []}
      currentRevisionNo={quotation?.revision_no || 1}
      currentItems={quotation?.items || []}
      currentHeader={quotation}
      currentTotal={quotation?.total_amount || quotation?.grand_total || 0}
      onRestoreRevision={(rev) => {
        setShowCompareModal(false);
        navigate(`/quotation/edit?id=${quotationId}&restoreRev=${rev.revision_no}`);
      }}
    />

    {quotation?.project_id ? <FloatingQuoteChat projectId={quotation.project_id} /> : null}
    </>
  );
}

