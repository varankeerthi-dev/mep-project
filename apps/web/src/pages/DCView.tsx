import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { format } from 'date-fns';
import { 
  Printer, 
  Edit, 
  ArrowLeft, 
  Download, 
  Eye, 
  FileText, 
  Settings, 
  CheckCircle,
  Clock,
  Briefcase,
  User,
  Truck,
  FileSpreadsheet
} from 'lucide-react';
import { generateClassicDeliveryChallanTemplate } from './ClassicDeliveryChallanTemplate';
import { generateZohoTemplate } from './ZohoTemplate';
import { generateProGridDeliveryChallanPdf } from '../pdf/proGridDeliveryChallanPdf';
import { generateSakthiPdf } from '../pdf/sakthiTemplatePdf';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function DCView() {
  const navigate = useNavigate();
  const { id: dcId } = useParams<{ id: string }>();
  const { organisation } = useAuth();
  
  const [dc, setDc] = useState<any | null>(null);
  const [project, setProject] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTemplateDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clean up blob URL on unmount or selection change
  useEffect(() => {
    return () => {
      if (previewPdfUrl) {
        URL.revokeObjectURL(previewPdfUrl);
      }
    };
  }, [previewPdfUrl]);

  // Load DC details and templates
  useEffect(() => {
    if (dcId && organisation?.id) {
      loadData();
    }
  }, [dcId, organisation?.id]);

  // Re-generate PDF when selected template or DC changes
  useEffect(() => {
    if (dc && selectedTemplate) {
      generatePreviewPDF();
    }
  }, [dc, selectedTemplate]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch DC Details
      const { data: dcData, error: dcErr } = await supabase
        .from('delivery_challans')
        .select('*')
        .eq('id', dcId)
        .single();
      
      if (dcErr) throw dcErr;

      // 2. Fetch DC Items
      const { data: itemsData, error: itemsErr } = await supabase
        .from('delivery_challan_items')
        .select('*')
        .eq('delivery_challan_id', dcId);
      
      if (itemsErr) throw itemsErr;

      const dcWithItems = { ...dcData, items: itemsData };

      // 3. Fetch Project Details if present
      if (dcData.project_id) {
        const { data: projData } = await supabase
          .from('projects')
          .select('id, project_name, project_code')
          .eq('id', dcData.project_id)
          .single();
        setProject(projData);
      }

      setDc(dcWithItems);

      // 4. Fetch Active Templates for Delivery Challan
      const { data: templatesData, error: templatesErr } = await supabase
        .from('document_templates')
        .select('*')
        .eq('document_type', 'Delivery Challan')
        .eq('active', true)
        .order('is_default', { ascending: false });

      if (templatesErr) throw templatesErr;

      setTemplates(templatesData || []);

      // 5. Select Template (saved template_id, default template, or standard fallback)
      let initialTemplate = null;
      if (dcData.template_id) {
        initialTemplate = templatesData.find(t => t.id === dcData.template_id);
      }
      if (!initialTemplate) {
        initialTemplate = templatesData.find(t => t.is_default === true) || templatesData[0] || null;
      }
      setSelectedTemplate(initialTemplate);

    } catch (err) {
      console.error('Error loading DC details:', err);
      alert('Unable to load Delivery Challan details.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = async (template: any) => {
    setSelectedTemplate(template);
    setShowTemplateDropdown(false);
    
    // Save template selection to database for this DC
    try {
      await supabase
        .from('delivery_challans')
        .update({ template_id: template.id })
        .eq('id', dcId);
    } catch (err) {
      console.error('Error saving template choice:', err);
    }
  };

  const generatePDFBlob = async (targetTemplate: any): Promise<Blob> => {
    if (!dc) throw new Error('No DC data loaded');

    // Sakthi PDF Template
    if (targetTemplate?.column_settings?.print?.style === 'sakthi' || targetTemplate?.template_code === 'DC_SAKTHI') {
      const sakthiDoc = await generateSakthiPdf(dc, organisation, 'Delivery Challan', targetTemplate);
      return sakthiDoc.output('blob');
    }

    // 1. Classic PDF Template
    if (targetTemplate.template_code === 'DC_CLASSIC') {
      const doc = generateClassicDeliveryChallanTemplate(dc, organisation, targetTemplate);
      return doc.output('blob');
    }

    // 2. Zoho PDF Template
    if (targetTemplate.template_code === 'DC_ZOHO') {
      const doc = generateZohoTemplate(dc, organisation, targetTemplate);
      return doc.output('blob');
    }

    // 3. Pro Grid PDF Template
    if (targetTemplate.template_code === 'DC_GRID_PRO') {
      const colSettings = targetTemplate.column_settings?.optional || {};
      const labels = targetTemplate.column_settings?.labels || {};
      
      const columnConfig: any[] = [];
      if (colSettings.sno !== false) columnConfig.push({ header: '#', key: 'sno', width: 10 });
      if (colSettings.hsn_code) columnConfig.push({ header: labels.hsn_code || 'HSN/SAC', key: 'hsn_code', width: 20 });
      columnConfig.push({ header: labels.item || 'Item', key: 'item', width: colSettings.description ? 50 : 70 });
      if (colSettings.description) columnConfig.push({ header: labels.description || 'Description', key: 'description', width: 40 });
      if (colSettings.variant) columnConfig.push({ header: labels.variant || 'Discount Category', key: 'variant', width: 25 });
      if (colSettings.size) columnConfig.push({ header: labels.size || 'Size', key: 'size', width: 20 });
      columnConfig.push({ header: labels.qty || 'Qty', key: 'qty', width: 20 });
      columnConfig.push({ header: labels.unit || 'Unit', key: 'unit', width: 15 });
      if (colSettings.rate !== false) columnConfig.push({ header: labels.rate || 'Rate', key: 'rate', width: 25 });
      if (colSettings.discount) columnConfig.push({ header: labels.discount || 'Disc %', key: 'discount', width: 15 });
      if (colSettings.tax) columnConfig.push({ header: labels.tax || 'Tax %', key: 'tax', width: 15 });
      if (colSettings.amount !== false) columnConfig.push({ header: labels.amount || 'Amount', key: 'amount', width: 30 });

      const tableData = (dc.items || []).map((item: any, index: number) => {
        const row: any = { sno: index + 1 };
        if (colSettings.sno !== false) row.sno = index + 1;
        if (colSettings.hsn_code) row.hsn_code = item.hsn_code || '-';
        row.item = item.material_name || '-';
        if (colSettings.description) row.description = item.description || '-';
        if (colSettings.variant) row.variant = item.variant_name || '-';
        if (colSettings.size) row.size = item.size || '-';
        row.qty = parseFloat(item.quantity) || 0;
        row.unit = item.unit || '-';
        if (colSettings.rate !== false) row.rate = parseFloat(item.rate) || 0;
        if (colSettings.discount) row.discount = item.discount_percent || 0;
        if (colSettings.tax) row.tax = item.tax_percent || 0;
        if (colSettings.amount !== false) row.amount = parseFloat(item.amount) || 0;
        return row;
      });

      const gridDoc = generateProGridDeliveryChallanPdf({
        challan: dc,
        dcWithItems: dc,
        organisation,
        columnConfig,
        tableData,
        formatChallanDate: (d) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—'),
        orientation: targetTemplate.orientation === 'Landscape' ? 'landscape' : 'portrait',
        pageFormat: targetTemplate.page_size === 'Letter' ? 'letter' : 'a4',
      });
      return gridDoc.output('blob');
    }

    // 4. Default / Standard Fallback Template
    const doc = new jsPDF({
      orientation: targetTemplate.orientation === 'Landscape' ? 'landscape' : 'portrait',
      unit: 'mm',
      format: targetTemplate.page_size === 'Letter' ? 'letter' : 'a4'
    });

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('DELIVERY CHALLAN', 105, 20, { align: 'center' });
    
    doc.setFontSize(11);
    doc.text(`DC No: ${dc.dc_number}`, 14, 32);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${dc.dc_date ? format(new Date(dc.dc_date), 'dd/MM/yyyy') : '-'}`, 14, 38);

    let yPos = 48;
    doc.setFont('helvetica', 'bold');
    doc.text('Client Details:', 14, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 6;
    doc.text(`Client: ${dc.client_name || '-'}`, 14, yPos);
    yPos += 6;
    doc.text(`Site Address: ${dc.site_address || '-'}`, 14, yPos);
    yPos += 6;
    doc.text(`Vehicle No: ${dc.vehicle_number || '-'}`, 14, yPos);
    yPos += 6;
    doc.text(`Driver: ${dc.driver_name || '-'}`, 14, yPos);
    yPos += 10;

    const colSettings = targetTemplate.column_settings?.optional || {};
    const labels = targetTemplate.column_settings?.labels || {};

    const tableHeaders = ['#', 'Item', 'Qty', 'Unit'];
    if (colSettings.rate !== false) tableHeaders.push('Rate');
    if (colSettings.amount !== false) tableHeaders.push('Amount');

    const tableRows = (dc.items || []).map((item: any, idx: number) => {
      const row = [
        String(idx + 1),
        item.material_name || '-',
        String(item.quantity),
        item.unit || '-'
      ];
      if (colSettings.rate !== false) row.push(`₹${parseFloat(item.rate || 0).toFixed(2)}`);
      if (colSettings.amount !== false) row.push(`₹${parseFloat(item.amount || 0).toFixed(2)}`);
      return row;
    });

    autoTable(doc, {
      startY: yPos,
      head: [tableHeaders],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26], fontSize: 9 },
      styles: { fontSize: 9 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const totalAmount = (dc.items || []).reduce((sum: number, item: any) => sum + (parseFloat(item.amount) || 0), 0);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Total Amount:', 140, finalY);
    doc.text(`₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 175, finalY, { align: 'right' });

    if (dc.remarks) {
      doc.setFont('helvetica', 'normal');
      doc.text(`Remarks: ${dc.remarks}`, 14, finalY + 15);
    }
    
    return doc.output('blob');
  };

  const generatePreviewPDF = async () => {
    if (!dc || !selectedTemplate) return;
    setPdfGenerating(true);
    try {
      const blob = await generatePDFBlob(selectedTemplate);
      const url = URL.createObjectURL(blob);
      if (previewPdfUrl) {
        URL.revokeObjectURL(previewPdfUrl);
      }
      setPreviewPdfUrl(url);
    } catch (err) {
      console.error('Error generating PDF blob:', err);
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!dc || !selectedTemplate) return;
    try {
      const blob = await generatePDFBlob(selectedTemplate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dc.dc_number || 'Delivery_Challan'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
    }
  };

  const handlePrint = async () => {
    if (!dc || !selectedTemplate) return;
    try {
      const blob = await generatePDFBlob(selectedTemplate);
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    } catch (err) {
      console.error('Error printing PDF:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Clock className="w-10 h-10 animate-spin text-indigo-600" />
        <span className="text-sm font-semibold text-zinc-500">Loading Delivery Challan...</span>
      </div>
    );
  }

  if (!dc) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <FileSpreadsheet className="w-12 h-12 text-zinc-400" />
        <span className="text-lg font-bold text-zinc-700">Delivery Challan not found</span>
        <button 
          onClick={() => navigate('/dc/list')}
          className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition-all"
        >
          Back to List
        </button>
      </div>
    );
  }

  const itemsTotal = (dc.items || []).reduce((sum: number, item: any) => sum + (parseFloat(item.amount) || 0), 0);

  return (
    <div className="min-h-screen bg-zinc-50/50 p-6 md:p-8">
      {/* Header Breadcrumbs & Controls */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dc/list')}
            className="p-2.5 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 hover:border-zinc-300 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-600" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-zinc-900">{dc.dc_number}</h1>
              <span className="inline-flex items-center px-3 py-1 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {dc.status || 'Active'}
              </span>
            </div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">
              DC DATE: {dc.dc_date ? format(new Date(dc.dc_date), 'dd MMMM yyyy') : '-'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Template Selection Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 font-bold text-xs uppercase tracking-widest text-zinc-600 shadow-sm transition-all"
            >
              <Settings className="w-4 h-4 text-zinc-400" />
              Template: {selectedTemplate?.template_name || 'Select'}
            </button>
            {showTemplateDropdown && (
              <div className="absolute right-0 mt-2 z-50 w-64 bg-white border border-zinc-200/80 rounded-2xl p-1.5 shadow-xl shadow-zinc-200/50">
                <div className="px-3 py-2 border-b border-zinc-100 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Available Templates</span>
                </div>
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTemplate(t)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                      selectedTemplate?.id === t.id 
                        ? 'bg-indigo-50 text-indigo-600' 
                        : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                    }`}
                  >
                    {t.template_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => navigate(`/dc/edit/${dc.id}`)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 font-bold text-xs uppercase tracking-widest text-zinc-600 shadow-sm transition-all"
          >
            <Edit className="w-4 h-4 text-zinc-400" />
            Edit DC
          </button>
          
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 font-bold text-xs uppercase tracking-widest text-zinc-600 shadow-sm transition-all"
          >
            <Download className="w-4 h-4 text-zinc-400" />
            Download PDF
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-200/50 transition-all"
          >
            <Printer className="w-4 h-4" />
            Print DC
          </button>
        </div>
      </div>

      {/* Main Content Layout Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column - DC details & Item list */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* DC Info Details Card */}
          <div className="bg-white rounded-3xl border border-zinc-200/60 p-6 shadow-sm">
            <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest border-b border-zinc-100 pb-4 mb-4">
              General Information
            </h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <Briefcase className="w-5 h-5 text-zinc-400 shrink-0" />
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Project</span>
                  <span className="text-sm font-semibold text-zinc-800">{project?.project_name || '-'}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <User className="w-5 h-5 text-zinc-400 shrink-0" />
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Client</span>
                  <span className="text-sm font-semibold text-zinc-800">{dc.client_name || '-'}</span>
                </div>
              </div>

              {dc.site_address && (
                <div className="flex gap-3">
                  <FileText className="w-5 h-5 text-zinc-400 shrink-0" />
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Site/Delivery Address</span>
                    <span className="text-xs font-medium text-zinc-600 leading-relaxed block whitespace-pre-line mt-0.5">{dc.site_address}</span>
                  </div>
                </div>
              )}

              {(dc.vehicle_number || dc.driver_name) && (
                <div className="flex gap-3">
                  <Truck className="w-5 h-5 text-zinc-400 shrink-0" />
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Logistics/Vehicle Details</span>
                    <div className="flex flex-col gap-1 mt-0.5">
                      {dc.vehicle_number && (
                        <span className="text-xs font-semibold text-zinc-700">Vehicle No: <span className="font-normal text-zinc-600">{dc.vehicle_number}</span></span>
                      )}
                      {dc.driver_name && (
                        <span className="text-xs font-semibold text-zinc-700">Driver Name: <span className="font-normal text-zinc-600">{dc.driver_name}</span></span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {dc.remarks && (
                <div className="flex gap-3 border-t border-zinc-50 pt-4 mt-2">
                  <FileText className="w-5 h-5 text-zinc-400 shrink-0" />
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Remarks</span>
                    <p className="text-xs text-zinc-600 mt-0.5 whitespace-pre-line">{dc.remarks}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* DC Items Details Card */}
          <div className="bg-white rounded-3xl border border-zinc-200/60 p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-4">
              <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest">
                Challan Materials
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 text-xs font-bold">
                {(dc.items || []).length} Items
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="py-2 text-[10px] font-black uppercase tracking-wider text-zinc-400">Material</th>
                    <th className="py-2 text-[10px] font-black uppercase tracking-wider text-zinc-400 text-center">Qty</th>
                    <th className="py-2 text-[10px] font-black uppercase tracking-wider text-zinc-400 text-right">Rate</th>
                    <th className="py-2 text-[10px] font-black uppercase tracking-wider text-zinc-400 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {(dc.items || []).map((item: any) => (
                    <tr key={item.id}>
                      <td className="py-3 pr-2">
                        <div className="text-xs font-semibold text-zinc-800">{item.material_name || '-'}</div>
                        {item.size && <div className="text-[10px] text-zinc-400 mt-0.5">Size: {item.size}</div>}
                      </td>
                      <td className="py-3 text-center text-xs font-medium text-zinc-600">
                        {item.quantity} {item.unit || 'Nos'}
                      </td>
                      <td className="py-3 text-right text-xs font-medium text-zinc-600">
                        ₹{parseFloat(item.rate || 0).toFixed(2)}
                      </td>
                      <td className="py-3 text-right text-xs font-bold text-zinc-800">
                        ₹{parseFloat(item.amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Total Valuation</span>
              <span className="text-lg font-black text-zinc-900">
                ₹{itemsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column - Live PDF Preview */}
        <div className="lg:col-span-7 flex flex-col h-[82vh] max-h-[820px]">
          <div className="bg-white rounded-3xl border border-zinc-200/60 flex-1 flex flex-col overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-zinc-50/20">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Live Template PDF Preview</span>
              </div>
              {pdfGenerating && (
                <div className="flex items-center gap-2 text-zinc-400 text-xs">
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  Generating...
                </div>
              )}
            </div>
            
            <div className="flex-1 bg-zinc-100/50 p-4 flex items-center justify-center min-h-0 overflow-hidden">
              {previewPdfUrl ? (
                <iframe 
                  src={`${previewPdfUrl}#view=FitH`} 
                  className="w-full h-full rounded-2xl border-0 shadow-sm bg-white"
                  title="PDF Live Preview"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-zinc-400">
                  <FileText className="w-10 h-10 stroke-1" />
                  <span className="text-xs font-medium">Preparing print layout preview...</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
