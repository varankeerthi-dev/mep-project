import React, { useState, useEffect, useMemo } from 'react';
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
  Plus as AddIcon,
  Eye as VisibilityIcon,
  FileText as PictureAsPdfIcon,
  Trash2 as DeleteIcon,
  Filter as FilterListIcon,
  Edit as EditIcon,
  ArrowRightLeft as SwapHorizIcon,
  X as CloseIcon,
  FileText,
} from 'lucide-react';
import { cn } from '../lib/utils';

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
  
  const [filters, setFilters] = useState(() => ({
    projectId: '',
    startDate: '',
    endDate: '',
    status: 'all',
    organisation_id: organisation?.id
  }));
  const [appliedFilters, setAppliedFilters] = useState(() => ({
    projectId: '',
    startDate: '',
    endDate: '',
    status: 'all',
    organisation_id: organisation?.id
  }));
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (organisation?.id) {
      setFilters(prev => ({ ...prev, organisation_id: organisation.id }));
      setAppliedFilters(prev => ({ ...prev, organisation_id: organisation.id }));
    }
  }, [organisation]);

  const challansQuery = useQuery({
    queryKey: ['deliveryChallans', appliedFilters.projectId, appliedFilters.startDate, appliedFilters.endDate, appliedFilters.status, appliedFilters.organisation_id],
    queryFn: () => fetchDeliveryChallans(appliedFilters),
    placeholderData: keepPreviousData
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
      queryClient.invalidateQueries({ queryKey: ['deliveryChallans'] });
    }
  });

  const challans = challansQuery.data || [];
  const projects = projectsQuery.data || [];
  const templates = templatesQuery.data || [];
  const loading = 
    (challansQuery.isPending && !challansQuery.data) ||
    (projectsQuery.isPending && !projectsQuery.data);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name) {
      setFilters(prev => ({ ...prev, [name]: value }));
    }
  };

  const applyFilters = () => {
    setAppliedFilters(filters);
  };

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

  const filteredChallans = useMemo(() => {
    return challans.filter((challan: any) =>
      challan.dc_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      challan.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      challan.project?.project_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [challans, searchTerm]);

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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
              <LocalShippingIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Delivery Challans</h1>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{filteredChallans.length} records found</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "h-12 px-6 rounded-xl border-2 transition-all flex items-center gap-2 font-black text-[13px] uppercase tracking-widest",
                showFilters ? "bg-slate-900 border-slate-900 text-white" : "border-slate-100 text-slate-600 hover:border-slate-300 bg-slate-50"
              )}
            >
              <FilterListIcon className="w-4 h-4" /> Filters
            </button>
            <div className="relative group">
              <input
                type="text"
                placeholder="Search challans..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-12 pl-12 pr-6 rounded-xl border-2 border-slate-100 group-focus-within:border-slate-900 focus:outline-none bg-slate-50 transition-all font-bold text-sm w-64"
              />
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button
              onClick={() => navigate('/dc/new')}
              className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[13px] uppercase tracking-widest shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
            >
              <AddIcon className="w-5 h-5" /> Add New DC
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-6 pt-6 border-t border-slate-100 animate-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Project</label>
                <select
                  name="projectId"
                  value={filters.projectId}
                  onChange={handleFilterChange}
                  className="w-full h-12 px-4 rounded-xl border-2 border-slate-100 bg-slate-50 focus:border-slate-900 outline-none font-bold text-sm"
                >
                  <option value="">All Projects</option>
                  {projects.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">From Date</label>
                <input
                  type="date"
                  name="startDate"
                  value={filters.startDate}
                  onChange={handleFilterChange}
                  className="w-full h-12 px-4 rounded-xl border-2 border-slate-100 bg-slate-50 focus:border-slate-900 outline-none font-bold text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">To Date</label>
                <input
                  type="date"
                  name="endDate"
                  value={filters.endDate}
                  onChange={handleFilterChange}
                  className="w-full h-12 px-4 rounded-xl border-2 border-slate-100 bg-slate-50 focus:border-slate-900 outline-none font-bold text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                <select
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                  className="w-full h-12 px-4 rounded-xl border-2 border-slate-100 bg-slate-50 focus:border-slate-900 outline-none font-bold text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="Not sent">Not sent</option>
                  <option value="Quoted">Quoted</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={applyFilters}
                className="btn bg-slate-900 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-xs"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 font-black text-slate-500 uppercase tracking-widest text-[10px] text-center">DC No</th>
                <th className="px-6 py-4 font-black text-slate-500 uppercase tracking-widest text-[10px]">Date</th>
                <th className="px-6 py-4 font-black text-slate-500 uppercase tracking-widest text-[10px]">Project</th>
                <th className="px-6 py-4 font-black text-slate-500 uppercase tracking-widest text-[10px]">Client</th>
                <th className="px-6 py-4 font-black text-slate-500 uppercase tracking-widest text-[10px] text-center">Items</th>
                <th className="px-6 py-4 font-black text-slate-500 uppercase tracking-widest text-[10px] text-right">Total Amount</th>
                <th className="px-6 py-4 font-black text-slate-500 uppercase tracking-widest text-[10px] text-center">Status</th>
                <th className="px-6 py-4 font-black text-slate-500 uppercase tracking-widest text-[10px] text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                   <td colSpan={8} className="p-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                         <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                         <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Hydrating Records...</p>
                      </div>
                   </td>
                </tr>
              ) : filteredChallans.length === 0 ? (
                <tr>
                   <td colSpan={8} className="p-20 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-30">
                         <LocalShippingIcon className="w-16 h-16 text-slate-300" />
                         <p className="text-xl font-black text-slate-900">No records found</p>
                         <p className="text-sm font-bold text-slate-500">Try adjusting your filters or search term</p>
                      </div>
                   </td>
                </tr>
              ) : (
                filteredChallans.map((challan: any) => (
                  <tr key={challan.id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="px-6 py-4 text-center">
                      <span className="font-mono text-xs font-black p-1.5 px-3 bg-slate-900 text-white rounded-lg shadow-sm">
                        {challan.dc_number}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-600 text-[13px]">
                      {challan.dc_date ? format(new Date(challan.dc_date), 'dd/MM/yyyy') : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[13px] font-black text-slate-800">{challan.project?.project_name || challan.project?.name || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[13px] font-bold text-slate-600">{challan.client_name || '-'}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-xs font-black">
                        {challan.items?.length || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-[13px] font-black text-slate-900">
                        ₹{calculateTotal(challan.items).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn("px-3 py-1 rounded-full text-[10px] uppercase tracking-wider", getStatusClass(challan.status))}>
                        {challan.status || 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => handlePreview(challan)} title="View Preview" className="p-2 hover:bg-white rounded-lg text-indigo-600 shadow-sm border border-transparent hover:border-indigo-100">
                          <VisibilityIcon size={18} />
                        </button>
                        <button 
                          onClick={(e) => {
                            setPrintMenuDC(challan);
                            setShowPrintMenu(true);
                          }} 
                          title="Print/Download" 
                          className="p-2 hover:bg-white rounded-lg text-emerald-600 shadow-sm border border-transparent hover:border-emerald-100"
                        >
                          <PictureAsPdfIcon size={18} />
                        </button>
                        <button onClick={() => {setConvertDC(challan); setShowConvertModal(true);}} title="Convert DC" className="p-2 hover:bg-white rounded-lg text-blue-600 shadow-sm border border-transparent hover:border-blue-100">
                          <SwapHorizIcon size={18} />
                        </button>
                        <button onClick={() => navigate(`/dc/edit/${challan.id}`)} title="Edit DC" className="p-2 hover:bg-white rounded-lg text-amber-600 shadow-sm border border-transparent hover:border-amber-100">
                          <EditIcon size={18} />
                        </button>
                        <button onClick={() => handleDelete(challan.id, challan.dc_number)} title="Delete DC" className="p-2 hover:bg-white rounded-lg text-rose-600 shadow-sm border border-transparent hover:border-rose-100">
                          <DeleteIcon size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
