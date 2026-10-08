import React, { useState, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import { useOrganisationSettings } from '../hooks/useOrganisationSettings';
import { DocumentListShell, type ShellColumn, type ShellMenuItem } from '../components/document/DocumentListShell';
import { fetchDeliveryChallans, deleteDeliveryChallan, cancelDeliveryChallan } from '../api';
import { supabase } from '../supabase';
import { format } from 'date-fns';
import { generateZohoTemplate } from './ZohoTemplate';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MultiDCQuotationMode } from '../conversions/types';
import {
  Truck as LocalShippingIcon,
  Plus as PlusIcon,
  Eye as EyeIcon,
  FileText as PictureAsPdfIcon,
  Trash2 as Trash2Icon,
  Edit as EditIcon,
  ArrowRightLeft as SwapHorizIcon,
  X as CloseIcon,
  FileText,
  CheckSquare as CheckSquareIcon,
} from 'lucide-react';
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

const ALL_COLUMNS = [
  { id: 'date', label: 'Date', width: '120px' },
  { id: 'dc_number', label: 'DC No', width: '160px' },
  { id: 'type', label: 'Type', width: '110px' },
  { id: 'project', label: 'Project', width: '200px' },
  { id: 'client', label: 'Client', width: '300px' },
  { id: 'amount', label: 'Amount', width: '180px' },
  { id: 'status', label: 'Status', width: '120px' },
];

const MANDATORY_COLUMNS = ['date', 'dc_number', 'type', 'client', 'amount', 'status'];

const DC_TYPES = ['All', 'Billable', 'Non-Billable'] as const;

// PRD docs/prd/dc-merge-billable-nonbillable.md §5-F9: non-billable discriminator.
// Legacy rows pre-dating dc_type rely on the DB default ('billable'); treat
// NULL/missing as billable so they never vanish from the Billable filter.
const isNonBillableDc = (dc: any) => String(dc?.dc_type || '').toLowerCase() === 'non-billable';

export default function DCList() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const queryClient = useQueryClient();

  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertDC, setConvertDC] = useState<any | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [printMenuDC, setPrintMenuDC] = useState<any | null>(null);

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('dc_list_columns');
    return saved ? JSON.parse(saved) : ['date', 'dc_number', 'client', 'amount', 'status'];
  });
  // PRD merge §6.1: Type badge is mandatory-visible even for saved prefs predating it.
  const effectiveVisibleColumns = useMemo(
    () => Array.from(new Set([...MANDATORY_COLUMNS, ...visibleColumns])),
    [visibleColumns]
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  // PRD merge §6.1: unified Type filter. Accepts ?type=billable|non-billable (legacy /nb-dc redirects).
  const [searchParams, setSearchParams] = useSearchParams();
  const [typeFilter, setTypeFilter] = useState<string>(() => {
    const t = (searchParams.get('type') || '').toLowerCase().replace(/[\s_]/g, '-');
    if (t === 'billable') return 'Billable';
    if (t === 'non-billable' || t === 'nonbillable' || t === 'nb') return 'Non-Billable';
    return 'All';
  });
  // PRD §6.4: NB→Quotation convertibility toggle (default ON). Tenant-scoped via hook.
  const { settings: orgSettings } = useOrganisationSettings();
  const allowNbConvert = (orgSettings as any)?.allow_nbdc_to_quotation !== false;
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>('desc');
  const toggleSort = () => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');

  // Multi-DC selection state
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedDCIds, setSelectedDCIds] = useState<Set<string>>(new Set());
  const [showModeModal, setShowModeModal] = useState(false);
  const [multiDCError, setMultiDCError] = useState('');



  // Reset to first page when search or status/type filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter]);

  const challansQuery = useQuery({
    queryKey: ['deliveryChallans', statusFilter, typeFilter, organisation?.id],
    queryFn: async () => {
      let query = supabase
        .from('delivery_challans')
        .select(`*, project:projects(id, project_name), items:delivery_challan_items(*)`)
        .eq('organisation_id', organisation?.id)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'All') query = query.eq('status', statusFilter);
      // PRD merge §6.1: billable = everything that is not non-billable (NULL-safe for legacy rows).
      if (typeFilter === 'Non-Billable') query = query.eq('dc_type', 'non-billable');
      else if (typeFilter === 'Billable') query = query.neq('dc_type', 'non-billable');

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

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
      queryClient.invalidateQueries({ queryKey: ['deliveryChallans', statusFilter, typeFilter, organisation?.id] });
    }
  });

  const challans = challansQuery.data || [];
  const loading = challansQuery.isPending && !challansQuery.data;

  // PRD §6.4: whether the current multi-selection contains NB rows (for convert gating).
  const selectedHasNonBillable = useMemo(
    () => challans.some((dc: any) => selectedDCIds.has(dc.id) && isNonBillableDc(dc)),
    [challans, selectedDCIds]
  );

  const filteredChallans = useMemo(() => {
    const q = searchTerm.toLowerCase();
    let result = challans.filter((dc: any) =>
      dc.dc_number?.toLowerCase().includes(q) ||
      dc.client_name?.toLowerCase().includes(q) ||
      dc.project?.project_name?.toLowerCase().includes(q)
    );

    if (sortOrder) {
      result = [...result].sort((a, b) => {
        const dateA = a.dc_date ? new Date(a.dc_date).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
        const dateB = b.dc_date ? new Date(b.dc_date).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      });
    }
    return result;
  }, [challans, searchTerm, sortOrder]);

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

  const stats = useMemo(() => {
    return {
      active: challans.filter((c: any) => !c.status || c.status.toLowerCase() === 'active').length,
      quoted: challans.filter((c: any) => c.status?.toLowerCase() === 'quoted' || c.conversion_status === 'quoted').length,
      cancelled: challans.filter((c: any) => c.status?.toLowerCase() === 'cancelled').length,
    };
  }, [challans]);

  const totalValue = useMemo(() => {
    return filteredChallans.reduce((sum, dc) => {
      if (!dc.items || dc.items.length === 0) return sum;
      return sum + dc.items.reduce((itemSum: number, item: any) => itemSum + (parseFloat(item.amount) || 0), 0);
    }, 0);
  }, [filteredChallans]);

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

      if (template.template_code === 'DC_CLASSIC') {
        const { generateClassicDeliveryChallanTemplate } = await import('./ClassicDeliveryChallanTemplate');
        const classicDoc = generateClassicDeliveryChallanTemplate(dcWithItems, organisation, template);
        const safeFileName = String(dcWithItems.dc_number || 'dc')
          .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
          .replace(/\s+/g, '_');
        classicDoc.save(`${safeFileName}.pdf`);
        setShowPrintMenu(false);
        return;
      }

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

      if (template?.column_settings?.print?.style === 'sakthi' || template?.template_code === 'DC_SAKTHI') {
        const { generateSakthiPdf } = await import('../pdf/sakthiTemplatePdf');
        const sakthiDoc = await generateSakthiPdf(dcWithItems, organisation, 'Delivery Challan', template);
        const safeFileName = String(dcWithItems.dc_number || 'dc')
          .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
          .replace(/\s+/g, '_');
        sakthiDoc.save(`${safeFileName}.pdf`);
        setShowPrintMenu(false);
        return;
      }

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

      // Vertical Template
      if (template.column_settings?.print?.style === 'vertical') {
        const VerticalTemplate = (await import('../templates/VerticalTemplate')).default;
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

        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap';
        document.head.appendChild(fontLink);

        const root = createRoot(container);
        try {
          const dcData = {
            ...dcWithItems,
            document_type: 'Delivery Challan',
            items: (dcWithItems.items || []).map((item: any, idx: number) => ({
              sno: idx + 1,
              item: item.material_name || item.description,
              description: item.description || '',
              qty: item.quantity,
              uom: item.unit || 'Nos',
              rate: item.rate,
              discount_percent: item.discount_percent || 0,
              rate_after_discount: item.rate,
              base_amount: item.amount,
              tax_percent: item.tax_percent || 0,
              tax_amount: 0,
              line_total: item.amount,
              hsn_code: item.hsn_code || '',
              make: item.brand || '',
              item_code: item.material_code || '',
            })),
            client: { name: challan.client_name, address: challan.site_address, gstin: challan.gstin },
            billing_address: challan.billing_address || challan.site_address,
            shipping_address: challan.shipping_address || challan.site_address,
            grand_total: (dcWithItems.items || []).reduce((sum: number, item: any) => sum + (parseFloat(item.amount) || 0), 0),
            vehicle_number: challan.vehicle_number,
            driver_name: challan.driver_name,
          };
          flushSync(() => {
            root.render(<VerticalTemplate data={dcData} organisation={organisation} templateConfig={template.column_settings} />);
          });
          await new Promise(resolve => setTimeout(resolve, 2000));
          const blob = await htmlToPdf(container, `${challan.dc_number}.pdf`);
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${challan.dc_number}.pdf`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
        } finally {
          root.unmount();
          document.body.removeChild(container);
        }
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

  const handleDelete = async (id: string, dcNumber: string, status?: string) => {
    const isCancelled = String(status || '').toUpperCase() === 'CANCELLED';
    const confirmMsg = isCancelled
      ? `Delete cancelled DC ${dcNumber}? It will be permanently removed.`
      : `Are you sure you want to delete DC ${dcNumber}?`;
    if (confirm(confirmMsg)) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error: any) {
        console.error('Error deleting DC:', error);
        alert('Error deleting Delivery Challan: ' + (error?.message || error));
      }
    }
  };

  const handleCancelDC = async (id: string, dcNumber: string) => {
    const reason = prompt(`Cancel DC ${dcNumber}?\n\nReason (optional):`, '');
    if (reason === null) return; // user dismissed the prompt
    try {
      await cancelDeliveryChallan(id, reason || undefined);
      queryClient.invalidateQueries({ queryKey: ['deliveryChallans'] });
    } catch (error: any) {
      console.error('Error cancelling DC:', error);
      alert('Error cancelling Delivery Challan: ' + (error?.message || error));
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

  // Multi-DC handlers
  const toggleMultiSelectMode = () => {
    setMultiSelectMode(prev => !prev);
    setSelectedDCIds(new Set());
    setMultiDCError('');
  };

  const toggleDCSelection = (dcId: string) => {
    setSelectedDCIds(prev => {
      const next = new Set(prev);
      if (next.has(dcId)) {
        next.delete(dcId);
      } else {
        next.add(dcId);
      }
      return next;
    });
    setMultiDCError('');
  };

  const selectAllVisible = () => {
    const visibleIds = new Set(paginationData.currentItems.map((dc: any) => dc.id));
    setSelectedDCIds(prev => {
      const allSelected = visibleIds.size === prev.size && [...visibleIds].every(id => prev.has(id));
      return allSelected ? new Set() : visibleIds;
    });
  };

  const handleMultiDCConvert = async () => {
    if (selectedDCIds.size < 2) {
      setMultiDCError('Select at least 2 DCs to convert');
      return;
    }
    // PRD §6.4: NB rows convert only when the settings toggle is ON.
    if (selectedHasNonBillable && !allowNbConvert) {
      setMultiDCError('Selection includes Non-Billable DC(s) — enable conversion in Settings → General & Config → Delivery Challan, or deselect them.');
      return;
    }
    setMultiDCError('');
    setShowModeModal(true);
  };

  const handleBulkDelete = async () => {
    if (selectedDCIds.size === 0) return;

    // Re-fetch statuses fresh so rows outside the current page are included
    // and pagination drift cannot let a non-cancelled row slip through.
    const ids = Array.from(selectedDCIds);
    const { data: freshRows, error: freshError } = await supabase
      .from('delivery_challans')
      .select('id, dc_number, status')
      .in('id', ids);
    if (freshError) {
      alert('Error loading selected DCs: ' + (freshError.message || freshError));
      return;
    }
    const byId: Record<string, any> = {};
    (freshRows || []).forEach((dc: any) => { byId[dc.id] = dc; });
    const selected = ids.map(id => byId[id] || { id, dc_number: id, status: '' });
    const isCancelledRow = (dc: any) => {
      const s = String(dc.status || '').trim().toUpperCase();
      return s === 'CANCELLED' || s === 'CANCELED';
    };
    const blocked = selected.filter(dc => !isCancelledRow(dc));

    const confirmMsg = blocked.length > 0
      ? `Delete ${selected.length} selected DC(s)?\n\nNote: ${blocked.length} of them are NOT cancelled (${blocked.slice(0, 5).map((dc: any) => dc.dc_number).join(', ')}${blocked.length > 5 ? ', …' : ''}) and the database will refuse to delete them. Only cancelled DCs will actually be removed.`
      : `Delete ${selected.length} cancelled DC(s)? They will be permanently removed.`;
    if (!confirm(confirmMsg)) return;

    const results = await Promise.allSettled(ids.map(id => deleteDeliveryChallan(id)));
    const failures = results.filter(r => r.status === 'rejected');

    queryClient.invalidateQueries({ queryKey: ['deliveryChallans'] });
    setSelectedDCIds(new Set());

    if (failures.length > 0) {
      const messages = failures
        .map(f => (f as PromiseRejectedResult).reason?.message || 'Unknown error')
        .filter((msg, i, arr) => arr.indexOf(msg) === i);
      alert(`Deleted ${ids.length - failures.length} of ${ids.length} DC(s). ${failures.length} failed:\n${messages.slice(0, 3).join('\n')}`);
    }
  };

  const handleModeSelect = async (mode: MultiDCQuotationMode) => {
    setShowModeModal(false);
    // Client validation happens in the conversion hook
    const dcIdArray = Array.from(selectedDCIds);
    const modeParam = mode === 'single-total' ? '' : `&multiDCMode=${mode}`;
    navigate(`/quotation/create?convertFrom=multi-dc-to-quotation&sourceId=${dcIdArray[0]}&dcIds=${dcIdArray.join(',')}${modeParam}`);
    setMultiSelectMode(false);
    setSelectedDCIds(new Set());
  };

  const calculateTotal = (items: any[]) => {
    if (!items || items.length === 0) return 0;
    return items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  };

  // ── Shared-shell adapters (single list standard) ──
  const dcShellColumns: ShellColumn[] = ALL_COLUMNS.map(col => ({
    id: col.id,
    label: col.label,
    width: col.width,
    mandatory: MANDATORY_COLUMNS.includes(col.id),
    // Project table rule: monetary columns stay left-aligned.
    align: 'left' as const,
  }));

  const renderDCCell = (col: ShellColumn, dc: any) => {
    if (col.id === 'date') return (
      <span className="font-medium text-zinc-900 whitespace-nowrap">{formatDate(dc.dc_date)}</span>
    );
    if (col.id === 'dc_number') return (
      <span className="font-medium text-zinc-900 whitespace-nowrap">{dc.dc_number}</span>
    );
    if (col.id === 'type') {
      const nb = isNonBillableDc(dc);
      return (
        <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full border ${
          nb ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-indigo-100 text-indigo-700 border-indigo-200'
        }`}>
          {nb ? 'NB-DC' : 'DC'}
        </span>
      );
    }
    if (col.id === 'project') return (
      <div className="max-w-[180px] truncate" title={dc.project?.project_name || '-'}>
        {dc.project?.project_name || '-'}
      </div>
    );
    if (col.id === 'client') return (
      <div className="max-w-[350px] truncate" title={dc.client_name || '-'}>
        {dc.client_name || '-'}
      </div>
    );
    if (col.id === 'amount') return (
      <span className="font-semibold tabular-nums whitespace-nowrap">
        {formatCurrency(calculateTotal(dc.items))}
      </span>
    );
    if (col.id === 'status') return (
      <span className="flex items-center gap-2">
        <span className="text-sm font-medium" style={{ color: getStatusColor(dc.status).color }}>
          {dc.status || 'Active'}
        </span>
        {dc.conversion_status === 'quoted' && (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 border border-blue-200">
            Quoted
          </span>
        )}
      </span>
    );
    return null;
  };

  const dcRowMenuItems = (dc: any): ShellMenuItem[] => {
    const nbConvertBlocked = isNonBillableDc(dc) && !allowNbConvert;
    const items: ShellMenuItem[] = [
      { label: 'View Details', icon: EyeIcon, onClick: () => navigate(`/dc/view/${dc.id}`) },
      { label: 'Download PDF', icon: PictureAsPdfIcon, onClick: () => { setPrintMenuDC(dc); setShowPrintMenu(true); } },
    ];
    items.push({
      label: nbConvertBlocked ? 'Convert to Quotation (off in Settings)' : 'Convert to Quotation',
      icon: SwapHorizIcon,
      onClick: () => {
        if (nbConvertBlocked) return;
        setConvertDC(dc);
        setShowConvertModal(true);
      },
    });
    items.push(
      { label: 'Convert to Proforma', icon: SwapHorizIcon, onClick: () => navigate(`/proforma-invoices/create?convertFrom=dc-to-proforma&sourceId=${dc.id}`) },
      { label: 'Convert to Invoice', icon: SwapHorizIcon, onClick: () => navigate(`/invoices/create?convertFrom=dc-to-invoice&sourceId=${dc.id}`) },
    );
    if (String(dc.status || '').toUpperCase() !== 'CANCELLED') {
      items.push({ label: 'Cancel DC', icon: CloseIcon, tone: 'amber', onClick: () => handleCancelDC(dc.id, dc.dc_number) });
    }
    items.push(
      { label: 'Edit', icon: EditIcon, onClick: () => navigate(`/dc/edit/${dc.id}`) },
      { label: 'Delete', icon: Trash2Icon, danger: true, onClick: () => handleDelete(dc.id, dc.dc_number, dc.status) },
    );
    return items;
  };

  const renderDCBulkBar = (ids: Set<string>, clear: () => void) => (
    <>
      <button
        onClick={selectAllVisible}
        className="text-xs font-bold uppercase tracking-wider text-zinc-300 hover:text-white transition-colors px-3 py-2"
      >
        {ids.size === paginationData.currentItems.length ? 'Deselect All' : 'Select All Visible'}
      </button>
      {multiDCError && <span className="text-xs text-red-400 mr-2">{multiDCError}</span>}
      <button
        onClick={handleMultiDCConvert}
        disabled={ids.size < 2 || (selectedHasNonBillable && !allowNbConvert)}
        title={selectedHasNonBillable && !allowNbConvert ? 'Selection includes Non-Billable DC(s) — enable conversion in Settings → General & Config → Delivery Challan' : undefined}
        className={`text-xs font-bold uppercase tracking-wider rounded-lg px-4 py-2 transition-all active:scale-[0.98] ${
          ids.size >= 2 && !(selectedHasNonBillable && !allowNbConvert)
            ? 'bg-white text-zinc-900 hover:bg-zinc-100'
            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
        }`}
      >
        Convert to Quotation
      </button>
      <button
        onClick={async () => { await handleBulkDelete(); clear(); }}
        className="text-xs font-bold uppercase tracking-wider rounded-lg px-4 py-2 transition-all active:scale-[0.98] bg-red-600 text-white hover:bg-red-500"
      >
        Delete Selected
      </button>
    </>
  );

  const dcTypeFilterNode = (
    <div className="flex items-center gap-1 bg-zinc-100 rounded-md p-0.5">
      {DC_TYPES.map((t) => (
        <button
          key={t}
          onClick={() => {
            setTypeFilter(t);
            setSearchParams(t === 'All' ? {} : { type: t === 'Billable' ? 'billable' : 'non-billable' }, { replace: true });
          }}
          className={`h-[24px] px-3 text-xs font-medium rounded transition-colors ${
            typeFilter === t ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          {t === 'Non-Billable' ? 'Non-Billable' : t}
        </button>
      ))}
    </div>
  );

  const dcCreateButton = (
    <button
      onClick={() => navigate('/dc/create')}
      className="inline-flex items-center justify-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors active:scale-[0.98]"
      style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '10px', paddingRight: '10px' }}
    >
      <PlusIcon className="w-4 h-4 mr-2" />
      Create DC
    </button>
  );

  const dcMultiToggle = (
    <button
      onClick={toggleMultiSelectMode}
      className={`inline-flex items-center justify-center text-sm font-medium rounded-lg border transition-colors active:scale-[0.98] ${
        multiSelectMode
          ? 'text-white bg-indigo-600 hover:bg-indigo-700 border-indigo-600 animate-fade-in'
          : 'text-zinc-700 bg-white border-zinc-200 hover:bg-zinc-100'
      }`}
      style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '10px', paddingRight: '10px' }}
    >
      <CheckSquareIcon className="w-4 h-4 mr-2" />
      {multiSelectMode ? 'Cancel Selection' : 'Multi-Select'}
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-white animate-fade-in">
      <DocumentListShell
        title="Delivery Challans"
        count={paginationData.totalItems}
        stats={[
          { label: 'Active', value: stats.active, labelClass: 'text-emerald-600', valueClass: 'text-emerald-700' },
          { label: 'Quoted', value: stats.quoted, labelClass: 'text-blue-600', valueClass: 'text-blue-700' },
          { label: 'Cancelled', value: stats.cancelled, labelClass: 'text-rose-600', valueClass: 'text-rose-700' },
        ]}
        totalValue={{ label: 'Total Value', value: formatCurrency(totalValue) }}
        search={searchTerm}
        onSearch={setSearchTerm}
        searchPlaceholder="Search challans..."
        statusOptions={DC_STATUSES}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        sort={{ value: sortOrder, onToggle: toggleSort, columnId: 'date' }}
        columns={dcShellColumns}
        visibleIds={effectiveVisibleColumns}
        onVisibleChange={(ids) => {
          const merged = Array.from(new Set([...MANDATORY_COLUMNS, ...ids]));
          setVisibleColumns(merged);
          try { localStorage.setItem('dc_list_columns', JSON.stringify(merged)); } catch { /* ignore */ }
        }}
        columnStorageKey="dc_list_columns"
        filterExtra={
          <div className="flex items-center gap-2">
            {dcTypeFilterNode}
            {dcMultiToggle}
          </div>
        }
        createButton={dcCreateButton}
        hideSelection={!multiSelectMode}
        rowDensity="compact"
        rows={paginationData.currentItems}
        getRowId={(dc) => dc.id}
        selectedIds={selectedDCIds}
        onToggleSelect={toggleDCSelection}
        onToggleSelectAll={selectAllVisible}
        onClearSelection={() => setSelectedDCIds(new Set())}
        onRowClick={(dc) => {
          if (multiSelectMode) toggleDCSelection(dc.id);
          else navigate(`/dc/view/${dc.id}`);
        }}
        renderCell={renderDCCell}
        eyeButton={(dc) => ({ onPreview: () => handlePreview(dc), loading: false })}
        rowMenuItems={dcRowMenuItems}
        bulkBar={{ threshold: 1, render: renderDCBulkBar }}
        pagination={{
          page: currentPage,
          totalPages: paginationData.totalPages,
          onPage: setCurrentPage,
          totalItems: paginationData.totalItems,
        }}
        loading={loading}
        loadingText="Loading delivery challans..."
        emptyTitle="No delivery challans found"
      />
      {/* Convert Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-8 py-6 border-b border-zinc-100 bg-zinc-50/50">
              <h3 className="text-xl font-black text-zinc-900">Convert DC</h3>
              <p className="text-sm font-bold text-zinc-400 mt-1 uppercase tracking-widest">DC No: {convertDC?.dc_number}</p>
            </div>
            <div className="p-8 space-y-4">
              <button 
                onClick={handleConvertToQuotation}
                className="w-full p-6 h-auto flex flex-col items-center justify-center gap-3 border-2 border-zinc-100 hover:border-indigo-600 hover:bg-indigo-50/50 transition-all rounded-[24px]"
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <p className="font-black text-zinc-900 uppercase text-xs tracking-widest">Convert to Quotation</p>
                  <p className="text-xs font-bold text-zinc-500 mt-1">Generate a new quotation from this DC</p>
                </div>
              </button>
              
              <button
                onClick={handleConvertToProforma}
                className="w-full p-6 h-auto flex flex-col items-center justify-center gap-3 border-2 border-zinc-100 hover:border-emerald-600 hover:bg-emerald-50/50 transition-all rounded-[24px]"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <LocalShippingIcon className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <p className="font-black text-zinc-900 uppercase text-xs tracking-widest">Convert to Proforma</p>
                  <p className="text-xs font-bold text-zinc-500 mt-1">Generate proforma invoice from this DC</p>
                </div>
              </button>
              
              <button
                onClick={() => {
                  if (!convertDC) return;
                  navigate(`/invoices/create?convertFrom=dc-to-invoice&sourceId=${convertDC.id}`);
                  setShowConvertModal(false);
                  setConvertDC(null);
                }}
                className="w-full p-6 h-auto flex flex-col items-center justify-center gap-3 border-2 border-zinc-100 hover:border-amber-600 hover:bg-amber-50/50 transition-all rounded-[24px]"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <p className="font-black text-zinc-900 uppercase text-xs tracking-widest">Convert to Invoice</p>
                  <p className="text-xs font-bold text-zinc-500 mt-1">Generate invoice from this DC</p>
                </div>
              </button>
            </div>
            <div className="px-8 py-6 border-t border-zinc-100 flex justify-end">
              <button 
                onClick={() => { setShowConvertModal(false); setConvertDC(null); }}
                className="px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-zinc-500 hover:bg-zinc-50 transition-all"
              >
                Cancel Conversion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-zinc-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-5xl h-full flex flex-col overflow-hidden">
            <div className="px-10 py-6 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-2xl font-black text-zinc-900">Document Preview</h3>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => window.print()}
                  className="px-6 py-2 bg-zinc-900 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-zinc-800 transition-all"
                >
                  Print Document
                </button>
                <button 
                  onClick={() => setShowPreview(false)}
                  className="p-3 hover:bg-rose-50 rounded-full text-zinc-400 hover:text-rose-600 transition-all"
                >
                  <CloseIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-zinc-50 p-10">
              <div 
                className="preview-content shadow-2xl"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }} 
              />
            </div>
          </div>
        </div>
      )}

      {/* Print Options Modal */}
      {showPrintMenu && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-8 border-b border-zinc-50">
                <h3 className="text-xl font-black text-zinc-900 mb-1">Print Options</h3>
                <p className="text-sm font-bold text-zinc-400 tracking-widest uppercase">Select DC Template</p>
             </div>
             <div className="p-8 space-y-3">
                {templates.map((t: any) => (
                   <button
                      key={t.id}
                      onClick={() => handlePrintDC(printMenuDC, t.id)}
                      className="w-full p-5 text-left rounded-2xl border-2 border-zinc-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group"
                   >
                      <div className="flex flex-col">
                         <span className="font-black text-zinc-900 group-hover:text-indigo-600 transition-colors uppercase text-xs tracking-widest">{t.template_name}</span>
                         <span className="text-[10px] font-bold text-zinc-400 mt-1">{t.template_code} • {t.orientation}</span>
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
             <div className="px-8 py-6 bg-zinc-50 flex justify-end">
                <button onClick={() => {setShowPrintMenu(false); setPrintMenuDC(null);}} className="text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-600 transition-colors">Close</button>
             </div>
          </div>
        </div>
      )}

      {/* Multi-DC Mode Selection Modal */}
      {showModeModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-8 py-6 border-b border-zinc-100 bg-zinc-50/50">
              <h3 className="text-xl font-black text-zinc-900">Quotation Layout</h3>
              <p className="text-sm font-bold text-zinc-400 mt-1 uppercase tracking-widest">
                {selectedDCIds.size} DCs selected
              </p>
            </div>
            <div className="p-8 space-y-3">
              <button
                onClick={() => handleModeSelect('single-total')}
                className="w-full p-6 text-left rounded-2xl border-2 border-zinc-100 hover:border-indigo-600 hover:bg-indigo-50/50 transition-all"
              >
                <p className="font-black text-zinc-900 uppercase text-xs tracking-widest">Single Total</p>
                <p className="text-xs font-bold text-zinc-500 mt-1">All items merged into one flat list with a single grand total</p>
              </button>
              <button
                onClick={() => handleModeSelect('grouped-by-dc')}
                className="w-full p-6 text-left rounded-2xl border-2 border-zinc-100 hover:border-indigo-600 hover:bg-indigo-50/50 transition-all"
              >
                <p className="font-black text-zinc-900 uppercase text-xs tracking-widest">Grouped by DC</p>
                <p className="text-xs font-bold text-zinc-500 mt-1">Each DC has a header row with its items listed below</p>
              </button>
              <button
                onClick={() => handleModeSelect('one-row-per-dc')}
                className="w-full p-6 text-left rounded-2xl border-2 border-zinc-100 hover:border-indigo-600 hover:bg-indigo-50/50 transition-all"
              >
                <p className="font-black text-zinc-900 uppercase text-xs tracking-widest">One Row per DC</p>
                <p className="text-xs font-bold text-zinc-500 mt-1">Each DC appears as a single summary row with total qty and amount</p>
              </button>
            </div>
            <div className="px-8 py-6 border-t border-zinc-100 flex justify-end">
              <button
                onClick={() => setShowModeModal(false)}
                className="px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-zinc-500 hover:bg-zinc-50 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
