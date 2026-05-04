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
          .single();
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
                <th className="h-[36px] px-5 text-left align-middle text-[13px] font-semibold text-slate-700 tracking-tight w-[120px] border-r border-slate-200">
                  Date
                </th>
                <th className="h-[36px] px-5 text-left align-middle text-[13px] font-semibold text-slate-700 tracking-tight w-[160px] border-r border-slate-200">
                  Quote No
                </th>
                <th className="h-[36px] px-5 text-left align-middle text-[13px] font-semibold text-slate-700 tracking-tight w-[500px]">
                  Client
                </th>
                <th className="h-[36px] px-5 text-left align-middle text-[13px] font-semibold text-slate-700 tracking-tight w-[180px] border-r border-slate-200">
                  Amount
                </th>
                <th className="h-[36px] px-5 text-left align-middle text-[13px] font-semibold text-slate-700 tracking-tight w-[120px] border-r border-slate-200">
                  Status
                </th>
                <th className="h-[36px] px-5 text-center align-middle text-[13px] font-semibold text-slate-700 tracking-tight w-[70px]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-sm text-slate-500">
                    Loading quotations...
                  </td>
                </tr>
              ) : paginationData.currentItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-sm text-slate-500">
                    No quotations found
                  </td>
                </tr>
              ) : (
                paginationData.currentItems.map((q: any, index) => (
                  <tr
                    key={q.id}
                    className={`hover:bg-slate-50 cursor-pointer transition-all duration-150 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                    }`}
                    onClick={() => navigate(`/quotation/view?id=${q.id}`)}
                  >
                    <td className="px-5 py-6 align-middle text-sm text-slate-900 whitespace-nowrap border-r border-slate-100 border-t border-slate-200/70">
                      {formatDate(q.date)}
                    </td>
                    <td className="px-5 py-6 align-middle text-sm font-semibold text-slate-900 whitespace-nowrap border-r border-slate-100 border-t border-slate-200/70">
                      {q.quotation_no}
                    </td>
                    <td className="px-5 py-6 align-middle text-sm text-slate-800 border-t border-slate-200/70">
                      <div className="max-w-[350px] truncate" title={q.client?.client_name || '-'}>
                        {q.client?.client_name || '-'}
                      </div>
                    </td>
                    <td className="px-8 py-6 align-middle text-sm font-semibold text-slate-900 whitespace-nowrap tabular-nums border-r border-slate-100 border-t border-slate-200/70">
                      {formatCurrency(q.grand_total)}
                    </td>
                    <td className="px-8 py-6 align-middle whitespace-nowrap border-r border-slate-100 border-t border-slate-200/70">
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
                    <td className="px-5 py-6 align-middle text-center border-t border-slate-200/70">
                      <div className="relative inline-block" ref={openMenuId === q.id ? menuRef : null}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === q.id ? null : q.id);
                          }}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-slate-100 transition-colors"
                        >
                          <MoreHorizontalIcon className="w-4 h-4 text-slate-500" />
                        </button>
                      {openMenuId === q.id && (
                        <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-slate-200/60 bg-white p-1.5 shadow-lg shadow-black/5">
                          {/* Section 1: Read actions */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/quotation/view?id=${q.id}`);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-600 transition-all hover:bg-slate-100/60 hover:text-slate-900"
                          >
                            <EyeIcon className="w-4 h-4" />
                            View Details
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadQuotationPDF(q.id);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-600 transition-all hover:bg-slate-100/60 hover:text-slate-900"
                          >
                            <DownloadIcon className="w-4 h-4" />
                            Download PDF
                          </button>

                          <div className="my-1 border-t border-slate-100" />

                          {/* Section 2: Modify actions */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              navigate(`/quotation/edit?id=${q.id}`);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-600 transition-all hover:bg-slate-100/60 hover:text-slate-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              navigate(`/quotation/create?duplicateId=${q.id}`);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-600 transition-all hover:bg-slate-100/60 hover:text-slate-900"
                          >
                            Duplicate
                          </button>

                          <div className="my-1 border-t border-slate-100" />

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
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-600 transition-all hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2Icon className="w-4 h-4" />
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
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/50">
          <div className="text-base text-slate-600">
            Showing {paginationData.startIndex + 1} to {Math.min(paginationData.endIndex, paginationData.totalItems)} of {paginationData.totalItems} quotes
          </div>
          <div className="flex items-center gap-2">
            {/* Previous Button */}
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={!paginationData.hasPrevPage}
              className={`px-4 py-2 text-base font-medium rounded-md transition-colors h-[36px] min-w-[80px] ${
                paginationData.hasPrevPage
                  ? 'text-slate-700 hover:bg-slate-100'
                  : 'text-slate-300 cursor-not-allowed'
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
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
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
                  ? 'text-slate-700 hover:bg-slate-100'
                  : 'text-slate-300 cursor-not-allowed'
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
