import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { fetchDeliveryChallans, deleteDeliveryChallan, fetchProjects } from '../api';
import { supabase } from '../supabase';
import { format } from 'date-fns';
import { generateZohoTemplate } from './ZohoTemplate';
import { generateAurumGridTemplate } from './AurumGridTemplate';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table';

export default function DCList() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertDC, setConvertDC] = useState(null);
  const [openPrintMenuId, setOpenPrintMenuId] = useState(null);
  const [previewDC, setPreviewDC] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);
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

  useEffect(() => {
    if (organisation?.id) {
      setFilters(prev => ({ ...prev, organisation_id: organisation.id }));
      setAppliedFilters(prev => ({ ...prev, organisation_id: organisation.id }));
    }
  }, [organisation]);

  const challansQuery = useQuery({
    queryKey: ['deliveryChallans', appliedFilters],
    queryFn: () => fetchDeliveryChallans(appliedFilters),
    placeholderData: keepPreviousData
  });

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    staleTime: 10 * 60 * 1000
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
    staleTime: 10 * 60 * 1000
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
  const loading = challansQuery.isLoading || projectsQuery.isLoading;

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    setAppliedFilters(filters);
  };

  const loadDCWithItems = async (dcId) => {
    const { data } = await supabase
      .from('delivery_challans')
      .select('*, items:delivery_challan_items(*)')
      .eq('id', dcId)
      .single();
    return data;
  };

  const handlePrintDC = async (challan, templateId = null) => {
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

      // Special handling for Zoho Template
      if (template.template_code === 'DC_ZOHO') {
        const zohoDoc = generateZohoTemplate(dcWithItems, organisation, template);
        const safeFileName = String(dcWithItems.dc_number || 'dc')
          .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
          .replace(/\s+/g, '_');
        zohoDoc.save(`${safeFileName}.pdf`);
        setOpenPrintMenuId(null);
        return;
      }

      // Special handling for AURUM GRID Template
      if (template.template_code === 'DOC_AURUM_DC_V1') {
        const aurumDoc = generateAurumGridTemplate(dcWithItems, organisation, template);
        const safeFileName = String(dcWithItems.dc_number || 'dc')
          .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
          .replace(/\s+/g, '_');
        aurumDoc.save(`${safeFileName}.pdf`);
        setOpenPrintMenuId(null);
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

      const colSettings = (template && typeof template.column_settings === 'object' && template.column_settings) || {};
      const optionalCols = colSettings.optional || {};
      const labels = colSettings.labels || {};

      const columnConfig = [];
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

      const tableData = (dcWithItems.items || []).map((item, index) => {
        const row = { sno: index + 1 };
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
        head: [columnConfig.map(col => col.header)],
        body: tableData.map(row => columnConfig.map(col => {
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
        columnStyles: columnConfig.reduce((acc, col, idx) => {
          acc[idx] = { cellWidth: col.width };
          return acc;
        }, {})
      });

      const finalY = doc.lastAutoTable.finalY + 10;
      const totalAmount = (dcWithItems.items || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

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
      setOpenPrintMenuId(null);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF: ' + error.message);
    }
  };

  const handlePreview = async (challan) => {
    try {
      const dcWithItems = await loadDCWithItems(challan.id);
      
      const totalAmount = (dcWithItems.items || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      
      const itemsHtml = (dcWithItems.items || []).map((item, index) => `
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

      setPreviewDC(challan);
      setPreviewHtml(html);
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      alert('Error generating preview: ' + error.message);
    }
  };

  const handleDelete = async (id, dcNumber) => {
    if (confirm(`Are you sure you want to delete DC ${dcNumber}?`)) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        console.error('Error deleting DC:', error);
        alert('Error deleting Delivery Challan');
      }
    }
  };

  const handleConvertClick = (challan) => {
    setConvertDC(challan);
    setShowConvertModal(true);
  };

  const handleConvertToQuotation = async () => {
    if (!convertDC) return;
    
    try {
      const { data: existing } = await supabase
        .from('quotation_header')
        .select('quotation_no')
        .order('created_at', { ascending: false })
        .limit(1);
      
      let quotationNo = 'QT-0001';
      if (existing && existing.length > 0) {
        const lastNum = parseInt(existing[0].quotation_no.replace(/[^0-9]/g, ''));
        quotationNo = `QT-${String(lastNum + 1).padStart(4, '0')}`;
      }

      const dcWithItems = await loadDCWithItems(convertDC.id);

      const quotationData = {
        quotation_no: quotationNo,
        client_id: dcWithItems.client_id,
        project_id: dcWithItems.project_id,
        billing_address: dcWithItems.site_address || dcWithItems.client_address,
        gstin: dcWithItems.client_gstin,
        state: dcWithItems.client_state,
        date: new Date().toISOString().split('T')[0],
        valid_till: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        payment_terms: 'Net 30 Days',
        reference: `From DC: ${dcWithItems.dc_number}`,
        remarks: dcWithItems.remarks,
        status: 'Draft',
        negotiation_mode: false
      };

      const { data: quotation, error } = await supabase
        .from('quotation_header')
        .insert(quotationData)
        .select()
        .single();

      if (error) throw error;

      if (dcWithItems.items && dcWithItems.items.length > 0) {
        const itemsToInsert = dcWithItems.items.map(item => ({
          quotation_id: quotation.id,
          item_id: item.material_id,
          variant_id: item.variant_id,
          description: item.material_name,
          qty: item.quantity,
          uom: item.unit,
          rate: item.rate,
          discount_percent: 0,
          discount_amount: 0,
          tax_percent: 0,
          tax_amount: 0,
          line_total: item.amount,
          override_flag: false
        }));

        await supabase.from('quotation_items').insert(itemsToInsert);
      }

      alert('DC converted to Quotation successfully!');
      navigate(`/quotation/edit?id=${quotation.id}`);
    } catch (error) {
      console.error('Error converting to quotation:', error);
      alert('Error converting to quotation: ' + error.message);
    }
    setShowConvertModal(false);
    setConvertDC(null);
  };

  const handleConvertToProforma = () => {
    alert('Proforma Invoice feature coming soon!');
    setShowConvertModal(false);
    setConvertDC(null);
  };

  const calculateTotal = (items) => {
    if (!items || items.length === 0) return 0;
    return items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  };

  const columns = useMemo(() => [
    {
      header: 'DC No',
      accessorKey: 'dc_number',
      cell: (info) => <span className="table-number">{info.getValue()}</span>
    },
    {
      header: 'Date',
      accessorKey: 'dc_date',
      cell: (info) => info.getValue() ? format(new Date(info.getValue()), 'dd/MM/yyyy') : '-'
    },
    {
      header: 'Project',
      accessorKey: 'project',
      cell: (info) => info.getValue()?.project_name || info.getValue()?.name || '-'
    },
    {
      header: 'Client',
      accessorKey: 'client_name',
      cell: (info) => info.getValue() || '-'
    },
    {
      header: 'Items',
      accessorKey: 'items',
      cell: (info) => <span className="table-number">{info.getValue()?.length || 0}</span>
    },
    {
      header: 'Total Amount',
      accessorKey: 'items_total',
      cell: ({ row }) => (
        <span className="table-number">
          ₹{calculateTotal(row.original.items).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (info) => (
        <span className={`badge ${
          info.getValue() === 'active' ? 'badge-success' : 
          info.getValue() === 'Quoted' ? 'badge-success' :
          info.getValue() === 'Not sent' ? 'badge-warning' :
          'badge-neutral'
        }`}>
          {info.getValue() === 'active' ? 'Active' : info.getValue()}
        </span>
      )
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const challan = row.original;
        return (
          <div className="actions">
            <button 
              className="action-btn" 
              title="View"
              onClick={() => handlePreview(challan)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <button 
                className="action-btn" 
                title="Download PDF"
                onClick={() => setOpenPrintMenuId(challan.id)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </button>
              {openPrintMenuId === challan.id && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  zIndex: 100,
                  minWidth: '180px',
                  marginTop: '4px'
                }}>
                  <div style={{ padding: '8px 12px', fontSize: '11px', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
                    Select Template
                  </div>
                  {templates.length > 0 ? (
                    templates.map(t => (
                      <button 
                        key={t.id}
                        style={{ display: 'block', width: '100%', padding: '10px 14px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px' }}
                        onClick={() => handlePrintDC(challan, t.id)}
                      >
                        {t.template_name} {t.is_default && '(Default)'}
                      </button>
                    ))
                  ) : (
                    <button 
                      style={{ display: 'block', width: '100%', padding: '10px 14px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: '#6b7280' }}
                      onClick={() => handlePrintDC(challan)}
                    >
                      Default Template
                    </button>
                  )}
                </div>
              )}
            </div>
            <button 
              className="action-btn" 
              title="Convert"
              onClick={() => handleConvertClick(challan)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <polyline points="17 1 21 5 17 9"/>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                <polyline points="7 23 3 19 7 15"/>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
            </button>
            <button 
              className="action-btn" 
              title="Edit"
              onClick={() => navigate(`/dc/edit/${challan.id}`)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button 
              className="action-btn danger" 
              title="Delete"
              onClick={() => handleDelete(challan.id, challan.dc_number)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        );
      }
    }
  ], [templates, openPrintMenuId, navigate, handlePreview, handlePrintDC, handleConvertClick, handleDelete]);

  const table = useReactTable({
    data: challans,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Delivery Challan List</h1>
          <p className="page-subtitle">View and manage all delivery challans</p>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          <label className="filter-label">Project</label>
          <select 
            name="projectId" 
            className="filter-input"
            value={filters.projectId}
            onChange={handleFilterChange}
          >
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label className="filter-label">From Date</label>
          <input 
            type="date" 
            name="startDate"
            className="filter-input"
            value={filters.startDate}
            onChange={handleFilterChange}
          />
        </div>
        
        <div className="filter-group">
          <label className="filter-label">To Date</label>
          <input 
            type="date" 
            name="endDate"
            className="filter-input"
            value={filters.endDate}
            onChange={handleFilterChange}
          />
        </div>
        
        <div className="filter-group">
          <label className="filter-label">Status</label>
          <select 
            name="status"
            className="filter-input"
            value={filters.status}
            onChange={handleFilterChange}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="Not sent">Not sent</option>
            <option value="Quoted">Quoted</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        
        <div className="filter-group" style={{ alignSelf: 'flex-end' }}>
          <button className="btn btn-primary btn-sm" onClick={applyFilters}>
            Apply Filters
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : challans.length === 0 ? (
          <div className="empty-state">
            <h3>No Delivery Challans Found</h3>
            <p>Create your first delivery challan to get started.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 4px', borderTop: '1px solid #e5e7eb', fontSize: '12px', color: '#6b7280' }}>
              <span>
                Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
                {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, challans.length)} of{' '}
                {challans.length} results
              </span>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  Prev
                </button>
                {Array.from({ length: table.getPageCount() }, (_, i) => i).map(pageNum => (
                  <button
                    key={pageNum}
                    className={`btn btn-sm ${table.getState().pagination.pageIndex === pageNum ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => table.setPageIndex(pageNum)}
                    style={{ padding: '4px 10px', fontSize: '12px', minWidth: '36px' }}
                  >
                    {pageNum + 1}
                  </button>
                ))}
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Convert Modal */}
      {showConvertModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowConvertModal(false)}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            width: '400px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#1e293b' }}>
              Convert DC: {convertDC?.dc_number}
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#6b7280' }}>
              Select an option to convert this Delivery Challan
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                className="btn btn-primary"
                onClick={handleConvertToQuotation}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Convert to Quotation
              </button>
              <button 
                className="btn btn-secondary"
                onClick={handleConvertToProforma}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Convert to Proforma Invoice
              </button>
            </div>
            <button 
              onClick={() => setShowConvertModal(false)}
              style={{
                marginTop: '16px',
                width: '100%',
                padding: '10px',
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowPreview(false)}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            width: '95%',
            maxWidth: '900px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>
                Preview: {previewDC?.dc_number}
              </h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    printWindow.document.write(previewHtml);
                    printWindow.document.close();
                    printWindow.print();
                  }}
                >
                  Print
                </button>
                <button 
                  onClick={() => setShowPreview(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#666',
                    lineHeight: 1
                  }}
                >
                  &times;
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', background: '#f3f4f6', padding: '20px' }}>
              <iframe 
                srcDoc={previewHtml}
                title="Delivery Challan Preview"
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '600px',
                  border: 'none',
                  background: 'white',
                  borderRadius: '8px'
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
