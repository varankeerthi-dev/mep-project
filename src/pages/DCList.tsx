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
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Chip,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
} from '@mui/x-data-grid';
import {
  LocalShipping as LocalShippingIcon,
  Add as AddIcon,
  Visibility as VisibilityIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Delete as DeleteIcon,
  FilterList as FilterListIcon,
  Edit as EditIcon,
  SwapHoriz as SwapHorizIcon,
} from '@mui/icons-material';

export default function DCList() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertDC, setConvertDC] = useState<any | null>(null);
  const [openPrintMenuId, setOpenPrintMenuId] = useState<string | null>(null);
  const [previewDC, setPreviewDC] = useState<any | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [printAnchorEl, setPrintAnchorEl] = useState<null | HTMLElement>(null);
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
  const loading = challansQuery.isLoading || projectsQuery.isLoading;

  const handleFilterChange = (e: React.ChangeEvent<{ name?: string; value: unknown }>) => {
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

      // Special handling for Zoho Template
      if (template.template_code === 'DC_ZOHO') {
        const zohoDoc = generateZohoTemplate(dcWithItems, organisation, template);
        const safeFileName = String(dcWithItems.dc_number || 'dc')
          .replace(/[<>:"\/\\|?*\x00-\x1F]/g, '_')
          .replace(/\s+/g, '_');
        zohoDoc.save(`${safeFileName}.pdf`);
        setOpenPrintMenuId(null);
        setPrintAnchorEl(null);
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
        setOpenPrintMenuId(null);
        setPrintAnchorEl(null);
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
      setOpenPrintMenuId(null);
      setPrintAnchorEl(null);
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

      setPreviewDC(challan);
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

  const handleConvertClick = (challan: any) => {
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
        const itemsToInsert = dcWithItems.items.map((item: any) => ({
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
    } catch (error: any) {
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

  const calculateTotal = (items: any[]) => {
    if (!items || items.length === 0) return 0;
    return items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  };

  const handlePrintMenuOpen = (event: React.MouseEvent<HTMLElement>, challan: any) => {
    setPrintAnchorEl(event.currentTarget);
    setPrintMenuDC(challan);
  };

  const handlePrintMenuClose = () => {
    setPrintAnchorEl(null);
    setPrintMenuDC(null);
  };

  const filteredChallans = useMemo(() => {
    return challans.filter((challan: any) =>
      challan.dc_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      challan.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      challan.project?.project_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [challans, searchTerm]);

  const columns: GridColDef[] = [
    {
      field: 'dc_number',
      headerName: 'DC No',
      width: 120,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight="500" fontFamily="Inter" sx={{ fontSize: '12px' }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'dc_date',
      headerName: 'Date',
      width: 110,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontFamily="Inter" sx={{ fontSize: '12px' }}>
          {params.value ? format(new Date(params.value), 'dd/MM/yyyy') : '-'}
        </Typography>
      ),
    },
    {
      field: 'project',
      headerName: 'Project',
      width: 180,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontFamily="Inter" sx={{ fontSize: '12px' }}>
          {params.row.project?.project_name || params.row.project?.name || '-'}
        </Typography>
      ),
    },
    {
      field: 'client_name',
      headerName: 'Client',
      width: 180,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontFamily="Inter" sx={{ fontSize: '12px' }}>
          {params.value || '-'}
        </Typography>
      ),
    },
    {
      field: 'items',
      headerName: 'Items',
      width: 80,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value?.length || 0}
          size="small"
          sx={{ fontSize: '11px', fontFamily: 'Inter', minWidth: '30px' }}
        />
      ),
    },
    {
      field: 'items_total',
      headerName: 'Total Amount',
      width: 130,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontFamily="Inter" sx={{ fontSize: '12px', fontWeight: 500 }} align="right" width="100%">
          ₹{calculateTotal(params.row.items).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 100,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params: GridRenderCellParams) => {
        const status = params.value;
        let color: 'success' | 'warning' | 'default' | 'error' = 'default';
        let label = status;
        
        if (status === 'active' || status === 'Active' || status === 'Quoted') {
          color = 'success';
          label = status === 'active' ? 'Active' : status;
        } else if (status === 'Not sent') {
          color = 'warning';
        } else if (status === 'cancelled') {
          color = 'error';
        }
        
        return (
          <Chip
            label={label}
            size="small"
            color={color}
            sx={{ fontSize: '11px', fontFamily: 'Inter' }}
          />
        );
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 200,
      sortable: false,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Tooltip title="View">
            <IconButton
              size="small"
              onClick={() => handlePreview(params.row)}
              sx={{ color: 'primary.main' }}
            >
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download PDF">
            <IconButton
              size="small"
              onClick={(e) => handlePrintMenuOpen(e, params.row)}
              sx={{ color: 'primary.main' }}
            >
              <PictureAsPdfIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Convert">
            <IconButton
              size="small"
              onClick={() => handleConvertClick(params.row)}
              sx={{ color: 'primary.main' }}
            >
              <SwapHorizIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton
              size="small"
              onClick={() => navigate(`/dc/edit/${params.row.id}`)}
              sx={{ color: 'primary.main' }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={() => handleDelete(params.row.id, params.row.dc_number)}
              sx={{ color: 'error.main' }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalShippingIcon color="primary" />
            <Typography variant="h6" fontFamily="Inter" fontWeight={600} sx={{ fontSize: '18px' }}>
              Delivery Challans
            </Typography>
            <Chip
              label={`${filteredChallans.length} challans`}
              size="small"
              sx={{ ml: 1, fontFamily: 'Inter', fontSize: '12px' }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant={showFilters ? 'contained' : 'outlined'}
              size="small"
              startIcon={<FilterListIcon />}
              onClick={() => setShowFilters(!showFilters)}
              sx={{ fontSize: '12px', textTransform: 'none' }}
            >
              Filters
            </Button>
            <TextField
              size="small"
              placeholder="Search challans..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ width: 250, '& .MuiInputBase-input': { fontSize: '12px' } }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/dc/new')}
              sx={{ fontFamily: 'Inter', textTransform: 'none', fontSize: '12px' }}
            >
              Add DC
            </Button>
          </Box>
        </Box>

        {/* Filter Section */}
        {showFilters && (
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel sx={{ fontSize: '12px' }}>Project</InputLabel>
                <Select
                  name="projectId"
                  value={filters.projectId}
                  onChange={handleFilterChange}
                  label="Project"
                  sx={{ fontSize: '12px' }}
                >
                  <MenuItem value="" sx={{ fontSize: '12px' }}>All Projects</MenuItem>
                  {projects.map((p: any) => (
                    <MenuItem key={p.id} value={p.id} sx={{ fontSize: '12px' }}>{p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                size="small"
                type="date"
                name="startDate"
                label="From Date"
                value={filters.startDate}
                onChange={handleFilterChange}
                InputLabelProps={{ shrink: true }}
                sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' }, width: 150 }}
              />

              <TextField
                size="small"
                type="date"
                name="endDate"
                label="To Date"
                value={filters.endDate}
                onChange={handleFilterChange}
                InputLabelProps={{ shrink: true }}
                sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' }, width: 150 }}
              />

              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel sx={{ fontSize: '12px' }}>Status</InputLabel>
                <Select
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                  label="Status"
                  sx={{ fontSize: '12px' }}
                >
                  <MenuItem value="all" sx={{ fontSize: '12px' }}>All</MenuItem>
                  <MenuItem value="active" sx={{ fontSize: '12px' }}>Active</MenuItem>
                  <MenuItem value="Not sent" sx={{ fontSize: '12px' }}>Not sent</MenuItem>
                  <MenuItem value="Quoted" sx={{ fontSize: '12px' }}>Quoted</MenuItem>
                  <MenuItem value="cancelled" sx={{ fontSize: '12px' }}>Cancelled</MenuItem>
                </Select>
              </FormControl>

              <Button
                variant="contained"
                size="small"
                onClick={applyFilters}
                sx={{ fontSize: '12px', textTransform: 'none', alignSelf: 'flex-end' }}
              >
                Apply Filters
              </Button>
            </Box>
          </Box>
        )}
      </Paper>

      {/* DataGrid */}
      <Paper
        elevation={0}
        sx={{
          flex: 1,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
        }}
      >
        <DataGrid
          rows={filteredChallans}
          columns={columns}
          loading={loading}
          density="compact"
          disableRowSelectionOnClick
          hideFooterSelectedRowCount
          sx={{
            fontFamily: 'Inter, sans-serif',
            '& .MuiDataGrid-cell': {
              fontSize: '12px',
              fontFamily: 'Inter, sans-serif',
            },
            '& .MuiDataGrid-columnHeader': {
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              backgroundColor: 'grey.50',
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: 'action.hover',
            },
          }}
          pageSizeOptions={[25, 50, 100]}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 25 },
            },
          }}
        />
      </Paper>

      {/* Print Menu */}
      <Menu
        anchorEl={printAnchorEl}
        open={Boolean(printAnchorEl)}
        onClose={handlePrintMenuClose}
        PaperProps={{
          sx: { minWidth: 200 }
        }}
      >
        <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>
            Select Template
          </Typography>
        </Box>
        {templates.length > 0 ? (
          templates.map((t: any) => (
            <MenuItem
              key={t.id}
              onClick={() => {
                handlePrintDC(printMenuDC, t.id);
                handlePrintMenuClose();
              }}
              sx={{ fontSize: '12px' }}
            >
              {t.template_name} {t.is_default && '(Default)'}
            </MenuItem>
          ))
        ) : (
          <MenuItem
            onClick={() => {
              handlePrintDC(printMenuDC, null);
              handlePrintMenuClose();
            }}
            sx={{ fontSize: '12px' }}
          >
            Default Template
          </MenuItem>
        )}
      </Menu>

      {/* Convert Modal */}
      <Dialog
        open={showConvertModal}
        onClose={() => setShowConvertModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontFamily: 'Inter', fontWeight: 600, fontSize: '16px' }}>
          Convert DC: {convertDC?.dc_number}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px', mb: 2 }}>
            Select an option to convert this Delivery Challan
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Button
              variant="contained"
              onClick={handleConvertToQuotation}
              sx={{ fontSize: '12px', textTransform: 'none' }}
            >
              Convert to Quotation
            </Button>
            <Button
              variant="outlined"
              onClick={handleConvertToProforma}
              sx={{ fontSize: '12px', textTransform: 'none' }}
            >
              Convert to Proforma Invoice
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowConvertModal(false)}
            sx={{ fontSize: '12px', textTransform: 'none' }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Modal */}
      <Dialog
        open={showPreview}
        onClose={() => setShowPreview(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { height: '90vh' }
        }}
      >
        <DialogTitle sx={{ fontFamily: 'Inter', fontWeight: 600, fontSize: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Preview: {previewDC?.dc_number}</span>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              onClick={() => {
                const printWindow = window.open('', '_blank');
                printWindow?.document.write(previewHtml);
                printWindow?.document.close();
                printWindow?.print();
              }}
              sx={{ fontSize: '12px', textTransform: 'none' }}
            >
              Print
            </Button>
            <IconButton onClick={() => setShowPreview(false)} size="small">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: 'grey.100' }}>
          <iframe
            srcDoc={previewHtml}
            title="Delivery Challan Preview"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: 'white',
            }}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
