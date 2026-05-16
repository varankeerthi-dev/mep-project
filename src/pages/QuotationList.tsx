import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatCurrency } from '../utils/formatters';
import { useAuth } from '../App';
import { timedSupabaseQuery } from '../utils/queryTimeout';
import { jsPDF } from 'jspdf';
import { generateQuotationTally } from './QuotationTallyTemplate';
import { generateProfessionalTemplate } from './ProfessionalTemplate';
import { renderTemplateToPdf } from '../utils/htmlTemplateRenderer';
import { generateClassicQuotationTemplate } from './ClassicQuotationTemplate';
import { generateProGridQuotationPdf } from '../pdf/proGridQuotationPdf';
import { generateGridMinimalQuotationPdfBlobWithTerms } from '../pdf/grid-minimal/quotation-with-terms';
import {
  Search as SearchIcon,
  Plus as PlusIcon,
  Download as DownloadIcon,
  Eye as EyeIcon,
  MoreHorizontal as MoreHorizontalIcon,
  ChevronDown as ChevronDownIcon,
  Trash2 as Trash2Icon,
} from 'lucide-react';

const QUOTATION_STATUSES = ['All', 'Draft', 'Sent', 'Under Negotiation', 'Approved', 'Rejected', 'Converted', 'Cancelled', 'Expired'];

const SUB_TABS = ['All Quotes', 'Drafts'];

const STATUS_FILTER_OPTIONS = ['All', 'Sent', 'Under Negotiation', 'Approved', 'Rejected', 'Converted', 'Cancelled', 'Expired'];

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Draft:              { bg: '#f3f4f6', color: '#6b7280' },
  Sent:               { bg: '#dbeafe', color: '#1d4ed8' },
  'Under Negotiation':{ bg: '#fef3c7', color: '#b45309' },
  Approved:           { bg: '#d1fae5', color: '#047857' },
  Rejected:           { bg: '#fee2e2', color: '#dc2626' },
  Converted:          { bg: '#d1fae5', color: '#065f46' },
  Cancelled:          { bg: '#fee2e2', color: '#991b1b' },
  Expired:            { bg: '#f3f4f6', color: '#9ca3af' },
  INVOICED:           { bg: '#d1fae5', color: '#065f46' },
};

const getStatusColor = (status?: string) =>
  STATUS_COLORS[status ?? ''] ?? STATUS_COLORS['Draft'];

export default function QuotationList() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [subTab, setSubTab] = useState('All Quotes');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openMenuId]);

  useEffect(() => {
    if (!showStatusDropdown) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowStatusDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showStatusDropdown]);

  // Reset status filter when switching sub-tabs
  useEffect(() => {
    if (subTab === 'Drafts') {
      setStatusFilter('Draft');
    } else {
      setStatusFilter('All');
    }
    setCurrentPage(1); // Reset to first page when switching tabs
  }, [subTab]);

  // Reset to first page when search or status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const downloadQuotationPDF = async (quotationId: string) => {
    setOpenMenuId(null);
    if (!organisation) {
      alert('Organisation data not available');
      return;
    }
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

      // Fetch Terms & Conditions separately
      let termsConditions = null;
      if (quotation) {
        const { data: termsData } = await supabase
          .from('quotation_terms_conditions')
          .select('*')
          .eq('quotation_id', quotationId)
          .maybeSingle();
        termsConditions = termsData;
      }
      
      if (quoteError) throw quoteError;
      if (!quotation) {
        alert('Quotation not found');
        return;
      }

      let template = null;
      if (quotation.template_id) {
        const { data, error } = await supabase
          .from('document_templates')
          .select('*')
          .eq('id', quotation.template_id)
          .single();
        if (!error) template = data;
      }
      
      if (!template) {
        const { data, error } = await supabase
          .from('document_templates')
          .select('*')
          .eq('document_type', 'Quotation')
          .eq('is_default', true)
          .single();
        if (error) throw error;
        template = data;
      }

      if (!template) {
        alert('No template found. Please select a template from Template Settings.');
        return;
      }

      const safeFileName = String(quotation.quotation_no || 'quotation')
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .replace(/\s+/g, '_');

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
          organisation_name: org.name || '',
          organisation_address: org.address || '',
          organisation_phone: org.phone || '',
          organisation_email: org.email || '',
          organisation_gstin: org.gstin || '',
          organisation_cin: org.cin || '',
          organisation_pan: org.pan || '',
          organisation_ie_code: org.ie_code || '',
          
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
          items: (quotation.items || []).map((item: any, idx: number) => ({
            index: idx + 1,
            hsn: item.item?.hsn_code || '',
            description: item.description || item.item?.display_name || item.item?.name || '',
            qty: String(item.qty || ''),
            uom: item.uom || '',
            rate: formatCurrency(item.rate || 0),
            gst_percent: item.tax_percent ? `${item.tax_percent}%` : '18%',
            amount: formatCurrency(item.line_total || 0)
          })),
          
          // Totals
          subtotal: formatCurrency(quotation.subtotal || 0),
          cgst_amount: formatCurrency(quotation.cgst_amount || 0),
          sgst_amount: formatCurrency(quotation.sgst_amount || 0),
          round_off: quotation.round_off ? formatCurrency(quotation.round_off) : '0.00',
          grand_total: formatCurrency(quotation.grand_total || 0),
          amount_in_words: quotation.amount_in_words || '',
          
          // Bank details
          bank_name: org.bank_name || '',
          bank_branch: org.bank_branch || '',
          bank_account_no: org.bank_account_no || '',
          bank_account_type: org.bank_account_type || '',
          bank_ifsc: org.bank_ifsc || '',
          bank_micr: org.bank_micr || '',
          bank_swift: org.bank_swift || '',
          bank_upi: org.bank_upi || '',
          
          // Signatory
          signatory_designation: org.signatory_designation || 'Director / Manager',
          
          // Terms & conditions
          terms_conditions: quotation.terms_conditions || org.terms_conditions || ''
        };
        
        await renderTemplateToPdf(template.template_content || '', htmlData, `${safeFileName}.pdf`);
        return;
      }

      // Grid Minimal template commented out
      /*
      if (template?.column_settings?.print?.style === 'grid_minimal') {
        const blob = await generateGridMinimalQuotationPdfBlobWithTerms(quotation, org, template);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${safeFileName}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }
      */

      /*
      if (template.template_code === 'QTN_TALLY') {
        const doc = generateQuotationTally(quotation, org, template);
        doc.save(`${safeFileName}.pdf`);
        return;
      }

      if (template.template_code === 'QTN_PROFESSIONAL') {
        const doc = generateProfessionalTemplate(quotation, org, template);
        doc.save(`${safeFileName}.pdf`);
        return;
      }
      */

      // Zoho template function not available
      /*
      if (template.template_code === 'QTN_ZOHO') {
        const doc = generateZohoTemplate(quotation, org, template);
        doc.save(`${safeFileName}.pdf`);
        return;
      }
      */
      if (template.template_code === 'QTN_CLASSIC') {
        const quotationWithTerms = {
          ...quotation,
          terms_conditions: termsConditions?.custom_content || null
        };
        const doc = generateClassicQuotationTemplate(quotationWithTerms, org, template);
        doc.save(`${safeFileName}.pdf`);
        return;
      }

      if (template.template_code === 'QTN_GRID_PRO') {
        // Include Terms & Conditions data in the quotation object
        const quotationWithTerms = {
          ...quotation,
          terms_conditions: termsConditions?.custom_content || null
        };
        const doc = generateProGridQuotationPdf(quotationWithTerms, org, template);
        doc.save(`${safeFileName}.pdf`);
        return;
      }

      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Quotation', 10, 10);
      doc.setFontSize(12);
      doc.text(`Quote No: ${quotation.quotation_no}`, 10, 25);
      doc.text(`Date: ${formatDate(quotation.date)}`, 10, 35);
      if (quotation.client?.client_name) {
        doc.text(`Client: ${quotation.client.client_name}`, 10, 45);
      }
      doc.save(`${safeFileName}.pdf`);
    } catch (err: any) {
      console.error('Error downloading PDF:', err);
      alert('Error downloading PDF: ' + (err?.message || 'Unknown error'));
    }
  };

  const quotationsQuery = useQuery({
    queryKey: ['quotations', statusFilter, organisation?.id],
    queryFn: async () => {
      let query = supabase
        .from('quotation_header')
        .select(`*, client:clients(id, client_name, gstin, state), project:projects(id, project_name)`)
        .eq('organisation_id', organisation?.id)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'All') query = query.eq('status', statusFilter);

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

  const filteredQuotations = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return quotations.filter((qt: any) =>
      qt.quotation_no?.toLowerCase().includes(q) ||
      qt.client?.client_name?.toLowerCase().includes(q)
    );
  }, [quotations, searchTerm]);

  // Pagination calculations
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

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-zinc-900">Quotations</h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
            {paginationData.totalItems}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search quotations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 h-[30px] w-64 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => navigate('/quotation/create')}
            className="inline-flex items-center justify-center gap-2 px-4 h-[30px] text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Create Quotation
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-zinc-100 bg-zinc-50/50">
        {SUB_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`w-[150px] h-[26px] px-4 text-sm font-medium transition-colors ${
              subTab === tab
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            {tab}
          </button>
        ))}
        
        {/* Status Dropdown - Only show in All Quotes tab */}
        {subTab === 'All Quotes' && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="w-[150px] h-[26px] flex items-center justify-center gap-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors"
            >
              {statusFilter === 'All' ? 'All Statuses' : statusFilter}
              <ChevronDownIcon className="w-4 h-4" />
            </button>
            {showStatusDropdown && (
              <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] bg-white border border-zinc-200 rounded-lg shadow-lg py-1">
                {STATUS_FILTER_OPTIONS.map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setStatusFilter(status);
                      setShowStatusDropdown(false);
                    }}
                    className={`block w-full text-left px-3 py-2 text-sm transition-colors ${
                      statusFilter === status
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    {status === 'All' ? 'All Statuses' : status}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-full">
          <table className="w-full border-separate border-spacing-0 table-fixed">
            <thead className="sticky top-0 z-10">
              <tr className="bg-blue-100/80 border-b border-blue-200">
                <th className="h-[36px] px-5 pl-1 text-left align-middle text-[13px] font-semibold text-zinc-700 tracking-tight w-[120px] border-r border-zinc-200">
                  Date
                </th>
                <th className="h-[36px] px-5 pl-1 text-left align-middle text-[13px] font-semibold text-zinc-700 tracking-tight w-[160px] border-r border-zinc-200">
                  Quote No
                </th>
                <th className="h-[36px] px-5 pl-1 text-left align-middle text-[13px] font-semibold text-zinc-700 tracking-tight w-[500px]">
                  Client
                </th>
                <th className="h-[36px] px-5 pl-1 text-left align-middle text-[13px] font-semibold text-zinc-700 tracking-tight w-[180px] border-r border-zinc-200">
                  Amount
                </th>
                <th className="h-[36px] px-5 pl-1 text-left align-middle text-[13px] font-semibold text-zinc-700 tracking-tight w-[120px] border-r border-zinc-200">
                  Status
                </th>
                <th className="h-[36px] px-5 pl-1 text-center align-middle text-[13px] font-semibold text-zinc-700 tracking-tight w-[70px]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-sm text-zinc-500">
                    Loading quotations...
                  </td>
                </tr>
              ) : paginationData.currentItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-sm text-zinc-500">
                    No quotations found
                  </td>
                </tr>
              ) : (
                paginationData.currentItems.map((q: any, index) => (
                  <tr
                    key={q.id}
                    className={`hover:bg-zinc-50 cursor-pointer transition-all duration-150 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-zinc-50/30'
                    }`}
onClick={() => navigate(`/quotation/view?id=${q.id}`)}
                  >
                    <td className="px-4 py-6 align-middle text-sm font-semibold text-zinc-900 whitespace-nowrap border-r border-zinc-100 border-t border-zinc-200/70">
                      {formatDate(q.date)}
                    </td>
                    <td className="px-4 py-6 align-middle text-sm font-semibold text-zinc-900 whitespace-nowrap border-r border-zinc-100 border-t border-zinc-200/70">
                      {q.quotation_no}
                    </td>
                    <td className="px-4 py-6 align-middle text-sm text-zinc-800 border-t border-zinc-200/70">
                      <div className="max-w-[350px] truncate" title={q.client?.client_name || '-'}>
                        {q.client?.client_name || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-6 align-middle text-sm font-semibold text-zinc-900 whitespace-nowrap tabular-nums border-r border-zinc-100 border-t border-zinc-200/70">
                      {formatCurrency(q.grand_total)}
                    </td>
                    <td className="px-4 py-6 align-middle whitespace-nowrap border-r border-zinc-100 border-t border-zinc-200/70">
                      <span
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-full border"
                        style={{
                          backgroundColor: getStatusColor(q.status).bg,
                          color: getStatusColor(q.status).color,
                          borderColor: getStatusColor(q.status).color + '20',
                        }}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td className="px-5 pl-1 py-6 align-middle text-center border-t border-zinc-200/70">
                      <div className="relative inline-block" ref={openMenuId === q.id ? menuRef : null}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === q.id ? null : q.id);
                          }}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-amber-100 hover:bg-amber-200 transition-colors"
                        >
                          <MoreHorizontalIcon className="w-4 h-4 text-zinc-500" />
                        </button>
                      {openMenuId === q.id && (
                        <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-zinc-200/60 bg-zinc-200 p-1.5 shadow-lg shadow-black/5">
                          {/* Section 1: Read actions */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/quotation/view?id=${q.id}`);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 text-sm text-zinc-600 transition-all hover:bg-amber-100 hover:text-zinc-900"
                            style={{ padding: '8px' }}
                          >
                            View Details
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadQuotationPDF(q.id);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 text-sm text-zinc-600 transition-all hover:bg-amber-100 hover:text-zinc-900"
                            style={{ padding: '8px' }}
                          >
                            Download PDF
                          </button>

                          <div className="my-1 border-t border-zinc-100" />

                          {/* Section 2: Convert actions */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              navigate(`/invoice/create?convertFrom=quotation-to-invoice&sourceId=${q.id}`);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 text-sm text-zinc-600 transition-all hover:bg-amber-100 hover:text-zinc-900"
                            style={{ padding: '8px' }}
                          >
                            Convert to Invoice
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              navigate(`/proforma/create?convertFrom=quotation-to-proforma&sourceId=${q.id}`);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 text-sm text-zinc-600 transition-all hover:bg-amber-100 hover:text-zinc-900"
                            style={{ padding: '8px' }}
                          >
                            Convert to Proforma
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              navigate(`/dc/create?convertFrom=quotation-to-dc&sourceId=${q.id}`);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 text-sm text-zinc-600 transition-all hover:bg-amber-100 hover:text-zinc-900"
                            style={{ padding: '8px' }}
                          >
                            Convert to Delivery
                          </button>

                          <div className="my-1 border-t border-zinc-100" />

                          {/* Section 3: Modify actions */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              navigate(`/quotation/edit?id=${q.id}`);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 text-sm text-zinc-600 transition-all hover:bg-amber-100 hover:text-zinc-900"
                            style={{ padding: '8px' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              
                              try {
                                // Get default series from document_series table
                                const { data: seriesRow } = await supabase
                                  .from('document_series')
                                  .select('id, configs, current_number')
                                  .eq('is_default', true)
                                  .eq('organisation_id', organisation?.id)
                                  .limit(1)
                                  .maybeSingle();

                                let quotationNo = 'QT-0001';
                                let newSeriesNumber = 1;
                                
                                if (seriesRow) {
                                  const cfg = seriesRow?.configs?.quote || {};
                                  const prefix = cfg.prefix || 'QT-';
                                  const suffix = cfg.suffix || '';
                                  newSeriesNumber = (seriesRow.current_number || 0) + 1;
                                  const padded = String(newSeriesNumber).padStart(4, '0');
                                  quotationNo = `${prefix}${padded}${suffix}`;
                                  
                                  // Update series number
                                  await supabase
                                    .from('document_series')
                                    .update({ current_number: newSeriesNumber })
                                    .eq('id', seriesRow.id);
                                } else {
                                  // Fallback: get existing quotations to generate new number
                                  const { data: existing } = await supabase
                                    .from('quotation_header')
                                    .select('quotation_no')
                                    .eq('organisation_id', organisation?.id)
                                    .order('created_at', { ascending: false })
                                    .limit(1);

                                  if (existing && existing.length > 0) {
                                    const lastNum = parseInt(existing[0].quotation_no.replace(/[^0-9]/g, ''));
                                    quotationNo = `QT-${String(lastNum + 1).padStart(4, '0')}`;
                                  }
                                }

                                // Duplicate quotation
                                const { data: newQuote, error } = await supabase
                                  .from('quotation_header')
                                  .insert({
                                    organisation_id: organisation?.id,
                                    quotation_no: quotationNo,
                                    client_id: q.client_id,
                                    project_id: q.project_id,
                                    billing_address: q.billing_address,
                                    gstin: q.gstin,
                                    state: q.state,
                                    date: new Date().toISOString().split('T')[0],
                                    valid_till: q.valid_till,
                                    payment_terms: q.payment_terms,
                                    contact_no: q.contact_no,
                                    remarks: q.remarks || q.reference,
                                    reference: q.reference,
                                    subtotal: q.subtotal,
                                    total_item_discount: q.total_item_discount,
                                    extra_discount_percent: q.extra_discount_percent,
                                    extra_discount_amount: q.extra_discount_amount,
                                    total_tax: q.total_tax,
                                    round_off: q.round_off,
                                    grand_total: q.grand_total,
                                    status: 'Draft',
                                    negotiation_mode: false,
                                    revised_from_id: q.id
                                  })
                                  .select()
                                  .single();

                                if (error) {
                                  console.error('Duplicate error:', error);
                                  alert('Failed to duplicate: ' + error.message);
                                  return;
                                }

                                console.log('Duplicated quote:', newQuote);

                                // Duplicate items if any
                                if (q.items && q.items.length > 0) {
                                  const itemsToInsert = q.items.map(item => ({
                                    quotation_id: newQuote.id,
                                    item_id: item.item_id,
                                    variant_id: item.variant_id,
                                    description: item.description,
                                    qty: item.qty,
                                    uom: item.uom,
                                    rate: item.rate,
                                    original_discount_percent: item.original_discount_percent,
                                    discount_percent: item.discount_percent,
                                    discount_amount: item.discount_amount,
                                    tax_percent: item.tax_percent,
                                    tax_amount: item.tax_amount,
                                    line_total: item.line_total,
                                    override_flag: false
                                  }));

                                  const { error: itemsError } = await supabase.from('quotation_items').insert(itemsToInsert);
                                  if (itemsError) {
                                    console.error('Items error:', itemsError);
                                  }
                                }

// Refresh list with exact query key
                                await queryClient.invalidateQueries({ 
                                  queryKey: ['quotations', statusFilter, organisation?.id] 
                                });
                              } catch (err) {
                                console.error('Duplicate exception:', err);
                                alert('Error: ' + err.message);
                              }
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 text-sm text-zinc-600 transition-all hover:bg-amber-100 hover:text-zinc-900"
                            style={{ padding: '8px' }}
                          >
                            Duplicate
                          </button>

                          <div className="my-1 border-t border-zinc-100" />

                          {/* Section 3: Destructive */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              if (confirm('Are you sure you want to delete this quotation?')) {
                                supabase.from('quotation_header').delete().eq('id', q.id).then(() => {
                                  queryClient.invalidateQueries({ queryKey: ['quotations'] });
                                });
                              }
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 text-sm text-zinc-600 transition-all hover:bg-red-50 hover:text-red-600"
                            style={{ padding: '8px' }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
      
      {/* Pagination Controls */}
      {paginationData.totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 bg-zinc-50/50">
          <div className="text-base text-zinc-600">
            Showing {paginationData.startIndex + 1} to {Math.min(paginationData.endIndex, paginationData.totalItems)} of {paginationData.totalItems} quotes
          </div>
          <div className="flex items-center gap-2">
            {/* Previous Button */}
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={!paginationData.hasPrevPage}
              className={`px-4 py-2 text-base font-medium rounded-md transition-colors h-[36px] min-w-[80px] ${
                paginationData.hasPrevPage
                  ? 'text-zinc-700 hover:bg-zinc-100'
                  : 'text-zinc-300 cursor-not-allowed'
              }`}
            >
              Previous
            </button>
            
            {/* Page Numbers */}
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, paginationData.totalPages) }, (_, i) => {
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
                    className={`px-4 py-2 text-base font-medium rounded-md transition-colors h-[36px] min-w-[36px] ${
                      currentPage === pageNum
                        ? 'bg-zinc-900 text-white'
                        : 'text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            {/* Next Button */}
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={!paginationData.hasNextPage}
              className={`px-4 py-2 text-base font-medium rounded-md transition-colors h-[36px] min-w-[80px] ${
                paginationData.hasNextPage
                  ? 'text-zinc-700 hover:bg-zinc-100'
                  : 'text-zinc-300 cursor-not-allowed'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
