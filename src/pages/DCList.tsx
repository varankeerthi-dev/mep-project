import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { fetchDeliveryChallans, deleteDeliveryChallan } from '../api';
import { supabase } from '../supabase';
import { format } from 'date-fns';
import { generateZohoTemplate } from './ZohoTemplate';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useProjects } from '../hooks/useProjects';
import {
  Truck as LocalShippingIcon,
  Plus as PlusIcon,
  Eye as EyeIcon,
  FileText as PictureAsPdfIcon,
  Trash2 as Trash2Icon,
  Filter as FilterListIcon,
  Edit as EditIcon,
  ArrowRightLeft as SwapHorizIcon,
  X as CloseIcon,
  FileText,
  Search as SearchIcon,
  MoreHorizontal as MoreHorizontalIcon,
  ChevronDown as ChevronDownIcon,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { formatDate, formatCurrency } from '../utils/formatters';

const DC_STATUSES = ['All', 'Active', 'Not Sent', 'Quoted', 'Cancelled'];

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Active: { bg: '#d1fae5', color: '#047857' },
  'Not Sent': { bg: '#fef3c7', color: '#b45309' },
  Quoted: { bg: '#dbeafe', color: '#1d4ed8' },
  Cancelled: { bg: '#fee2e2', color: '#dc2626' },
};

const getStatusColor = (status?: string) =>
  STATUS_COLORS[status ?? 'Active'] ?? STATUS_COLORS['Active'];

export default function DCList() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertDC, setConvertDC] = useState<any | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [printMenuDC, setPrintMenuDC] = useState<any | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

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

  // Reset to first page when search or status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const challansQuery = useQuery({
    queryKey: ['deliveryChallans', statusFilter, organisation?.id],
    queryFn: async () => {
      let query = supabase
        .from('delivery_challans')
        .select(`*, project:projects(id, project_name)`)
        .eq('organisation_id', organisation?.id)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'All') query = query.eq('status', statusFilter);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const projectsQuery = useProjects();

  const templatesQuery = useQuery({
    queryKey: ['documentTemplates', 'Delivery Challan'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .eq('document_type', 'Delivery Challan')
        .order('template_name');
      if (error) throw error;
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDeliveryChallan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryChallans', statusFilter, organisation?.id] });
    }
  });

  const challans = challansQuery.data || [];
  const loading = challansQuery.isPending && !challansQuery.data;

  const filteredChallans = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return challans.filter((dc: any) =>
      dc.dc_number?.toLowerCase().includes(q) ||
      dc.client_name?.toLowerCase().includes(q) ||
      dc.project?.project_name?.toLowerCase().includes(q)
    );
  }, [challans, searchTerm]);

  // Pagination calculations
  const paginationData = useMemo(() => {
    const totalItems = filteredChallans.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentItems = filteredChallans.slice(startIndex, endIndex);
    
    return {
      totalItems,
      totalPages,
      startIndex,
      endIndex,
      currentItems,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1
    };
  }, [filteredChallans, currentPage, itemsPerPage]);

  const projects = projectsQuery.data || [];
  const templates = templatesQuery.data || [];

  const loadDCWithItems = async (dcId: string) => {
    const { data } = await supabase
      .from('delivery_challans')
      .select('*, items:delivery_challan_items(*)')
      .eq('id', dcId)
      .single();
    return data;
  };

  const handlePrintDC = async (challan: any, templateId: string | null = null) => {
    try {
      let template = null;
      if (templateId) {
        const { data, error } = await supabase
          .from('document_templates')
          .select('*')
          .eq('id', templateId)
          .single();
        if (error) throw error;
        template = data;
      } else {
        const { data, error } = await supabase
          .from('document_templates')
          .select('*')
          .eq('document_type', 'Delivery Challan')
          .eq('is_default', true)
          .maybeSingle();
        template = data;
      }

      if (!template) {
        alert('No template found. Please select a template from Template Settings.');
        return;
      }

      const dcWithItems = await loadDCWithItems(challan.id);

      if (template.template_code === 'DC_ZOHO') {
        const zohoDoc = generateZohoTemplate(dcWithItems, organisation, template);
        const safeFileName = String(dcWithItems.dc_number || 'dc')
          .replace(/[<>:"\/\\|?*\x00-\x1F]/g, '_')
          .replace(/\s+/g, '_');
        zohoDoc.save(`${safeFileName}.pdf`);
        setShowPrintMenu(false);
        return;
      }

      const colSettings = (template && typeof template.column_settings === 'object' && template.column_settings) || {};
      const optionalCols = colSettings.optional || {};
      const labels = colSettings.labels || {};

      const columnConfig: any[] = [];
      if (optionalCols.sno !== false) columnConfig.push({ header: '#', key: 'sno', width: 10 });
      if (optionalCols.hsn_code) columnConfig.push({ header: labels.hsn_code || 'HSN/SAC', key: 'hsn_code', width: 20 });
      columnConfig.push({ header: labels.item || 'Item', key: 'item', width: optionalCols.description ? 50 : 70 });
      if (optionalCols.description) columnConfig.push({ header: labels.description || 'Description', key: 'description', width: 40 });
      if (optionalCols.variant) columnConfig.push({ header: labels.variant || 'Variant', key: 'variant', width: 25 });
      if (optionalCols.size) columnConfig.push({ header: labels.size || 'Size', key: 'size', width: 20 });
      columnConfig.push({ header: labels.qty || 'Qty', key: 'qty', width: 20 });
      columnConfig.push({ header: labels.unit || 'Unit', key: 'unit', width: 15 });
      if (optionalCols.rate !== false) columnConfig.push({ header: labels.rate || 'Rate', key: 'rate', width: 25 });
      if (optionalCols.discount) columnConfig.push({ header: labels.discount || 'Disc %', key: 'discount', width: 15 });
      if (optionalCols.tax) columnConfig.push({ header: labels.tax || 'Tax %', key: 'tax', width: 15 });
      if (optionalCols.amount !== false) columnConfig.push({ header: labels.amount || 'Amount', key: 'amount', width: 30 });

      const tableData = (dcWithItems.items || []).map((item: any, index: number) => {
        const row: any = { sno: index + 1 };
        if (optionalCols.sno !== false) row.sno = index + 1;
        if (optionalCols.hsn_code) row.hsn_code = item.hsn_code || '-';
        row.item = item.material_name || '-';
        if (optionalCols.description) row.description = item.description || '-';
        if (optionalCols.variant) row.variant = item.variant_name || '-';
        if (optionalCols.size) row.size = item.size || '-';
        row.qty = parseFloat(item.quantity) || 0;
        row.unit = item.unit || '-';
        if (optionalCols.rate !== false) row.rate = parseFloat(item.rate) || 0;
        if (optionalCols.discount) row.discount = item.discount_percent || 0;
        if (optionalCols.tax) row.tax = item.tax_percent || 0;
        if (optionalCols.amount !== false) row.amount = parseFloat(item.amount) || 0;
        return row;
      });

      if (template.template_code === 'DC_GRID_PRO') {
        const { generateProGridDeliveryChallanPdf } = await import('../pdf/proGridDeliveryChallanPdf');
        const gridDoc = generateProGridDeliveryChallanPdf({
          challan,
          dcWithItems,
          organisation,
          columnConfig,
          tableData,
          formatChallanDate: (d) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—'),
          orientation: template.orientation === 'Landscape' ? 'landscape' : 'portrait',
          pageFormat: template.page_size === 'Letter' ? 'letter' : 'a4',
        });
        gridDoc.save(`${challan.dc_number}.pdf`);
        setShowPrintMenu(false);
        return;
      }

      const isLandscape = template.orientation === 'Landscape';
      const { default: jsPDF } = await import('jspdf');
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default;
      const doc = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: template.page_size === 'Letter' ? 'letter' : 'a4'
      });

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('DELIVERY CHALLAN', 105, 20, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`DC No: ${challan.dc_number}`, 14, 32);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${challan.dc_date ? format(new Date(challan.dc_date), 'dd/MM/yyyy') : '-'}`, 14, 38);

      let yPos = 48;
      doc.setFont('helvetica', 'bold');
      doc.text('Client Details:', 14, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 6;
      doc.text(`Client: ${challan.client_name || '-'}`, 14, yPos);
      yPos += 6;
      doc.text(`Site Address: ${challan.site_address || '-'}`, 14, yPos);
      yPos += 6;
      doc.text(`Vehicle No: ${challan.vehicle_number || '-'}`, 14, yPos);
      yPos += 6;
      doc.text(`Driver: ${challan.driver_name || '-'}`, 14, yPos);
      yPos += 10;

      autoTable(doc, {
        startY: yPos,
        head: [columnConfig.map((col: any) => col.header)],
        body: tableData.map((row: any) => columnConfig.map((col: any) => {
          const val = row[col.key];
          if (col.key === 'rate' || col.key === 'amount') {
            return typeof val === 'number' ? `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : val;
          }
          if (col.key === 'qty' || col.key === 'discount' || col.key === 'tax') {
            return typeof val === 'number' ? val.toString() : val;
          }
          return val;
        })),
        theme: 'grid',
        headStyles: { fillColor: [26, 26, 26], fontSize: 9 },
        styles: { fontSize: 9 },
        columnStyles: columnConfig.reduce((acc: any, col: any, idx: number) => {
          acc[idx] = { cellWidth: col.width };
          return acc;
        }, {})
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      const totalAmount = (dcWithItems.items || []).reduce((sum: number, item: any) => sum + (parseFloat(item.amount) || 0), 0);
      doc.setFont('helvetica', 'bold');
      doc.text('Total Amount:', 140, finalY);
      doc.text(`₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 175, finalY, { align: 'right' });

      if (challan.remarks) {
        doc.setFont('helvetica', 'normal');
        doc.text(`Remarks: ${challan.remarks}`, 14, finalY + 15);
      }
      doc.setFontSize(10);
      doc.text('Authorized Signature', 140, finalY + 35);
      doc.line(130, finalY + 33, 190, finalY + 33);
      doc.save(`${challan.dc_number}.pdf`);
      setShowPrintMenu(false);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF: ' + error.message);
    }
  };

  const handlePreview = async (challan: any) => {
    try {
      const dcWithItems = await loadDCWithItems(challan.id);
      const totalAmount = (dcWithItems.items || []).reduce((sum: number, item: any) => sum + (parseFloat(item.amount) || 0), 0);
      const itemsHtml = (dcWithItems.items || []).map((item: any, index: number) => `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${index + 1}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${item.material_name || '-'}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.unit || '-'}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.quantity || '-'}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">₹${parseFloat(item.rate || 0).toFixed(2)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">₹${parseFloat(item.amount || 0).toFixed(2)}</td>
        </tr>
      `).join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Delivery Challan - ${challan.dc_number}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
            .preview-container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .header h1 { font-size: 24px; margin-bottom: 10px; }
            .header .dc-no { font-size: 14px; color: #666; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
            .info-box { background: #f9f9f9; padding: 15px; border-radius: 4px; }
            .info-box h3 { font-size: 14px; margin-bottom: 10px; color: #333; }
            .info-box p { font-size: 12px; margin-bottom: 5px; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: #333; color: white; padding: 10px; text-align: center; font-size: 12px; }
            td { font-size: 12px; }
            .totals { text-align: right; margin-bottom: 30px; }
            .totals .total-row { font-size: 16px; font-weight: bold; }
            .footer { display: flex; justify-content: space-between; margin-top: 40px; }
            .footer .sign-box { text-align: right; }
            .footer .sign-line { border-top: 1px solid #333; margin-top: 40px; width: 200px; }
            @media print { body { background: white; } .preview-container { box-shadow: none; } }
          </style>
        </head>
        <body>
          <div class="preview-container">
            <div class="header">
              <h1>DELIVERY CHALLAN</h1>
              <div class="dc-no">DC No: ${challan.dc_number} | Date: ${challan.dc_date ? format(new Date(challan.dc_date), 'dd/MM/yyyy') : '-'}</div>
            </div>
            
            <div class="info-grid">
              <div class="info-box">
                <h3>Client Details</h3>
                <p><strong>Client:</strong> ${challan.client_name || '-'}</p>
                <p><strong>Site Address:</strong> ${challan.site_address || '-'}</p>
              </div>
              <div class="info-box">
                <h3>Vehicle Details</h3>
                <p><strong>Vehicle No:</strong> ${challan.vehicle_number || '-'}</p>
                <p><strong>Driver:</strong> ${challan.driver_name || '-'}</p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 50px;">#</th>
                  <th>Item</th>
                  <th style="width: 60px;">Unit</th>
                  <th style="width: 60px;">Qty</th>
                  <th style="width: 80px;">Rate</th>
                  <th style="width: 90px;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div class="totals">
              <div class="total-row">Total: ₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>

            ${challan.remarks ? `<div style="margin-bottom: 30px;"><strong>Remarks:</strong> ${challan.remarks}</div>` : ''}

            <div class="footer">
              <div></div>
              <div class="sign-box">
                <div class="sign-line"></div>
                <p>Authorized Signature</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
      setPreviewHtml(html);
      setShowPreview(true);
    } catch (error: any) {
      console.error('Error generating preview:', error);
      alert('Error generating preview: ' + error.message);
    }
  };

  const handleDelete = async (id: string, dcNumber: string) => {
    if (confirm(`Are you sure you want to delete DC ${dcNumber}?`)) {
      try {
        await deleteMutation.mutateAsync(id);
        setOpenMenuId(null);
      } catch (error) {
        console.error('Error deleting DC:', error);
        alert('Error deleting Delivery Challan');
      }
    }
  };

  const handleConvertToQuotation = () => {
    if (!convertDC) return;
    navigate(`/quotation/create?convertFrom=dc-to-quotation&sourceId=${convertDC.id}`);
    setShowConvertModal(false);
    setConvertDC(null);
  };

  const handleConvertToProforma = () => {
    if (!convertDC) return;
    navigate(`/proforma-invoices/create?convertFrom=dc-to-proforma&sourceId=${convertDC.id}`);
    setShowConvertModal(false);
    setConvertDC(null);
  };

  const calculateTotal = (items: any[]) => {
    if (!items || items.length === 0) return 0;
    return items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  };

  const getStatusClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-emerald-100 text-emerald-700 font-bold';
      case 'quoted': return 'bg-blue-100 text-blue-700 font-bold';
      case 'not sent': return 'bg-amber-100 text-amber-700 font-bold';
      case 'cancelled': return 'bg-rose-100 text-rose-700 font-bold';
      default: return 'bg-slate-100 text-slate-700 font-bold';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-zinc-900">Delivery Challans</h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
            {paginationData.totalItems}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search challans..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 h-[30px] w-64 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => navigate('/dc/new')}
            className="inline-flex items-center justify-center gap-2 px-4 h-[30px] text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Create DC
          </button>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-zinc-100 bg-zinc-50/50">
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
              {DC_STATUSES.map((status) => (
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
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-full">
          <table className="w-full border-separate border-spacing-0 table-fixed">
            <thead className="sticky top-0 z-10">
              <tr className="bg-blue-100/80 border-b border-blue-200">
                <th className="h-[36px] px-5 pl-1 text-left align-middle text-[13px] font-semibold text-slate-700 tracking-tight w-[120px] border-r border-slate-200">
                  Date
                </th>
                <th className="h-[36px] px-5 pl-1 text-left align-middle text-[13px] font-semibold text-slate-700 tracking-tight w-[160px] border-r border-slate-200">
                  DC No
                </th>
                <th className="h-[36px] px-5 pl-1 text-left align-middle text-[13px] font-semibold text-slate-700 tracking-tight w-[300px]">
                  Client
                </th>
                <th className="h-[36px] px-5 pl-1 text-left align-middle text-[13px] font-semibold text-slate-700 tracking-tight w-[180px] border-r border-slate-200">
                  Amount
                </th>
                <th className="h-[36px] px-5 pl-1 text-left align-middle text-[13px] font-semibold text-slate-700 tracking-tight w-[120px] border-r border-slate-200">
                  Status
                </th>
                <th className="h-[36px] px-5 pl-1 text-center align-middle text-[13px] font-semibold text-slate-700 tracking-tight w-[70px]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-sm text-slate-500">
                    Loading delivery challans...
                  </td>
                </tr>
              ) : paginationData.currentItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-sm text-slate-500">
                    No delivery challans found
                  </td>
                </tr>
              ) : (
                paginationData.currentItems.map((dc: any, index) => (
                  <tr
                    key={dc.id}
                    className={`hover:bg-slate-50 cursor-pointer transition-all duration-150 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                    }`}
                    onClick={() => navigate(`/dc/view/${dc.id}`)}
                  >
                    <td className="px-4 py-6 align-middle text-sm font-semibold text-slate-900 whitespace-nowrap border-r border-slate-100 border-t border-slate-200/70">
                      {formatDate(dc.dc_date)}
                    </td>
                    <td className="px-4 py-6 align-middle text-sm font-semibold text-slate-900 whitespace-nowrap border-r border-slate-100 border-t border-slate-200/70">
                      {dc.dc_number}
                    </td>
                    <td className="px-4 py-6 align-middle text-sm text-slate-800 border-t border-slate-200/70">
                      <div className="max-w-[250px] truncate" title={dc.client_name || '-'}>
                        {dc.client_name || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-6 align-middle text-sm font-semibold text-slate-900 whitespace-nowrap tabular-nums border-r border-slate-100 border-t border-slate-200/70">
                      {formatCurrency(calculateTotal(dc.items))}
                    </td>
                    <td className="px-4 py-6 align-middle whitespace-nowrap border-r border-slate-100 border-t border-slate-200/70">
                      <span
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-full border"
                        style={{
                          backgroundColor: getStatusColor(dc.status).bg,
                          color: getStatusColor(dc.status).color,
                          borderColor: getStatusColor(dc.status).color + '20',
                        }}
                      >
                        {dc.status || 'Active'}
                      </span>
                    </td>
                    <td className="px-5 pl-1 py-6 align-middle text-center border-t border-slate-200/70">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreview(dc);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:text-slate-900 transition-colors"
                        >
                          View
                        </button>
                        <div className="relative inline-block" ref={openMenuId === dc.id ? menuRef : null}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === dc.id ? null : dc.id);
                            }}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-slate-100 transition-colors"
                          >
                            <MoreHorizontalIcon className="w-4 h-4 text-slate-500" />
                          </button>
                        {openMenuId === dc.id && (
                          <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-slate-200/60 bg-white p-1.5 shadow-lg shadow-black/5">
                            {/* Section 1: Read actions */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePreview(dc);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 text-sm text-slate-600 transition-all hover:bg-slate-100/60 hover:text-slate-900"
                              style={{ padding: '8px' }}
                            >
                              View Details
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPrintMenuDC(dc);
                                setShowPrintMenu(true);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 text-sm text-slate-600 transition-all hover:bg-slate-100/60 hover:text-slate-900"
                              style={{ padding: '8px' }}
                            >
                              Download PDF
                            </button>

                            <div className="my-1 border-t border-slate-100" />

                            {/* Section 2: Convert actions */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConvertDC(dc);
                                setShowConvertModal(true);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 text-sm text-slate-600 transition-all hover:bg-slate-100/60 hover:text-slate-900"
                              style={{ padding: '8px' }}
                            >
                              Convert to Quotation
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/proforma-invoices/create?convertFrom=dc-to-proforma&sourceId=${dc.id}`);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 text-sm text-slate-600 transition-all hover:bg-slate-100/60 hover:text-slate-900"
                              style={{ padding: '8px' }}
                            >
                              Convert to Proforma
                            </button>

                            <div className="my-1 border-t border-slate-100" />

                            {/* Section 3: Modify actions */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/dc/edit/${dc.id}`);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 text-sm text-slate-600 transition-all hover:bg-slate-100/60 hover:text-slate-900"
                              style={{ padding: '8px' }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(dc.id, dc.dc_number);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 text-sm text-slate-600 transition-all hover:bg-red-50 hover:text-red-600"
                              style={{ padding: '8px' }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                        </div>
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
            Showing {paginationData.startIndex + 1} to {Math.min(paginationData.endIndex, paginationData.totalItems)} of {paginationData.totalItems} delivery challans
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

      {/* Convert Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-black text-slate-900">Convert DC</h3>
              <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">DC No: {convertDC?.dc_number}</p>
            </div>
            <div className="p-8 space-y-4">
              <button 
                onClick={handleConvertToQuotation}
                className="w-full p-6 h-auto flex flex-col items-center justify-center gap-3 border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50/50 transition-all rounded-[24px]"
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <p className="font-black text-slate-900 uppercase text-xs tracking-widest">Convert to Quotation</p>
                  <p className="text-xs font-bold text-slate-500 mt-1">Generate a new quotation from this DC</p>
                </div>
              </button>
              
              <button
                onClick={handleConvertToProforma}
                className="w-full p-6 h-auto flex flex-col items-center justify-center gap-3 border-2 border-slate-100 hover:border-emerald-600 hover:bg-emerald-50/50 transition-all rounded-[24px]"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <LocalShippingIcon className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <p className="font-black text-slate-900 uppercase text-xs tracking-widest">Convert to Proforma</p>
                  <p className="text-xs font-bold text-slate-500 mt-1">Generate proforma invoice from this DC</p>
                </div>
              </button>
            </div>
            <div className="px-8 py-6 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => { setShowConvertModal(false); setConvertDC(null); }}
                className="px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
              >
                Cancel Conversion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-5xl h-full flex flex-col overflow-hidden">
            <div className="px-10 py-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-2xl font-black text-slate-900">Document Preview</h3>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => window.print()}
                  className="px-6 py-2 bg-slate-900 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-800 transition-all"
                >
                  Print Document
                </button>
                <button 
                  onClick={() => setShowPreview(false)}
                  className="p-3 hover:bg-rose-50 rounded-full text-slate-400 hover:text-rose-600 transition-all"
                >
                  <CloseIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-50 p-10">
              <div 
                className="preview-content shadow-2xl"
                dangerouslySetInnerHTML={{ __html: previewHtml }} 
              />
            </div>
          </div>
        </div>
      )}

      {/* Print Options Modal */}
      {showPrintMenu && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-8 border-b border-slate-50">
                <h3 className="text-xl font-black text-slate-900 mb-1">Print Options</h3>
                <p className="text-sm font-bold text-slate-400 tracking-widest uppercase">Select DC Template</p>
             </div>
             <div className="p-8 space-y-3">
                {templates.map((t: any) => (
                   <button
                      key={t.id}
                      onClick={() => handlePrintDC(printMenuDC, t.id)}
                      className="w-full p-5 text-left rounded-2xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group"
                   >
                      <div className="flex flex-col">
                         <span className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase text-xs tracking-widest">{t.template_name}</span>
                         <span className="text-[10px] font-bold text-slate-400 mt-1">{t.template_code} • {t.orientation}</span>
                      </div>
                   </button>
                ))}
                <button
                   onClick={() => handlePrintDC(printMenuDC)}
                   className="w-full p-5 text-left rounded-2xl border-2 border-indigo-100 bg-indigo-50/50 hover:bg-indigo-50 transition-all group"
                >
                   <div className="flex flex-col">
                      <span className="font-black text-indigo-600 uppercase text-xs tracking-widest">Default Template</span>
                      <span className="text-[10px] font-bold text-indigo-400 mt-1">System default configuration</span>
                   </div>
                </button>
             </div>
             <div className="px-8 py-6 bg-slate-50 flex justify-end">
                <button onClick={() => {setShowPrintMenu(false); setPrintMenuDC(null);}} className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Close</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
