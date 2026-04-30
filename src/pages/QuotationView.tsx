import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate, formatCurrency } from '../utils/formatters';
import { useAuth } from '../App';
import { generateQuotationTally } from './QuotationTallyTemplate';
import { generateProfessionalTemplate } from './ProfessionalTemplate';
import { renderTemplateToPdf } from '../utils/htmlTemplateRenderer';
import { generateClassicQuotationTemplate } from './ClassicQuotationTemplate';
import { generateProGridQuotationPdf } from '../pdf/proGridQuotationPdf';
import { generateGridMinimalQuotationPdfBlob } from '../pdf/grid-minimal/quotation';
import { timedSupabaseQuery } from '../utils/queryTimeout';
import SaaSTemplate from '../templates/SaaSTemplate';
import VerticalTemplate from '../templates/VerticalTemplate';
import { htmlToPdf } from '../utils/htmlTemplateRenderer';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Printer, Edit, Copy, MoreHorizontal, Trash2, XCircle, ArrowLeft, ChevronDown, Mail, Download, Eye, FileText, Plus } from 'lucide-react';
import { useVariants } from '../hooks/useVariants';



export default function QuotationView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quotationId = searchParams.get('id');
  const { organisation } = useAuth();

  const [showConvertMenu, setShowConvertMenu] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);

  const quotationQuery = useQuery({
    queryKey: ['quotation', quotationId],
    queryFn: async () => {
      const data = await timedSupabaseQuery(
        supabase
          .from('quotation_header')
          .select(`
            *,
            client:clients(*),
            project:projects(id, project_name, project_code),
            items:quotation_items(
              *,
              item:materials(
                id, 
                item_code, 
                display_name, 
                name, 
                hsn_code,
                mappings:material_client_mappings(*)
              )
            )
          `)
          .eq('id', quotationId)
          .single(),
        'Quotation view',
      );
      return data;
    },
    enabled: !!quotationId
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

  const quotation = quotationQuery.data || null;
  const templates = templatesQuery.data || [];
  const loading = quotationQuery.isPending && !quotationQuery.data;

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

  const handleEdit = () => {
    navigate(`/quotation/edit?id=${quotationId}`);
  };

  const handleDuplicate = async () => {
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

      const newQuotation = {
        quotation_no: quotationNo,
        client_id: quotation.client_id,
        project_id: quotation.project_id,
        billing_address: quotation.billing_address,
        gstin: quotation.gstin,
        state: quotation.state,
        date: new Date().toISOString().split('T')[0],
        valid_till: quotation.valid_till,
        payment_terms: quotation.payment_terms,
        contact_no: quotation.contact_no || null,
        remarks: quotation.remarks || quotation.reference || null,
        reference: quotation.reference,
        subtotal: quotation.subtotal,
        total_item_discount: quotation.total_item_discount,
        extra_discount_percent: quotation.extra_discount_percent,
        extra_discount_amount: quotation.extra_discount_amount,
        total_tax: quotation.total_tax,
        round_off: quotation.round_off,
        grand_total: quotation.grand_total,
        status: 'Draft',
        negotiation_mode: false,
        revised_from_id: quotationId
      };

      const { data, error } = await supabase
        .from('quotation_header')
        .insert(newQuotation)
        .select()
        .single();

      if (error) throw error;

      if (quotation.items && quotation.items.length > 0) {
        const itemsToInsert = quotation.items.map(item => ({
          quotation_id: data.id,
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

        await supabase.from('quotation_items').insert(itemsToInsert);
      }

      alert('Quotation duplicated!');
      navigate(`/quotation/edit?id=${data.id}`);
    } catch (err) {
      console.error('Error duplicating quotation:', err);
      alert('Error: ' + err.message);
    }
  };

  const handleConvert = (type) => {
    if (type === 'proforma-invoice') {
      navigate(`/proforma-invoices/create?convertFrom=quotation-to-proforma&sourceId=${quotationId}`);
    } else if (type === 'invoice') {
      navigate(`/invoices/create?convertFrom=quotation-to-invoice&sourceId=${quotationId}`);
    } else if (type === 'delivery-challan') {
      alert('Delivery Challan conversion not implemented yet.');
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
    if (quotation.status !== 'Draft') {
      alert('Only Draft quotations can be deleted.');
      return;
    }
    if (!confirm('Are you sure you want to delete this quotation? This cannot be undone.')) return;

    try {
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
      setShowTemplateMenu(false);
      quotationQuery.refetch();
    } catch (err) {
      console.error('Error selecting template:', err);
      alert('Error: ' + err.message);
    }
  };

  const handlePrintAction = async (action, templateId = null) => {
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
      } else if (quotation.template_id) {
        const { data, error } = await supabase
          .from('document_templates')
          .select('*')
          .eq('id', quotation.template_id)
          .single();
        if (error) throw error;
        template = data;
      } else {
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

      if (action === 'preview') {
        previewQuotation(template);
      } else if (action === 'download') {
        downloadPDF(template);
      } else if (action === 'email') {
        alert('Email feature coming soon!');
      } else if (action === 'print') {
        downloadPDF(template); // Fallback to download for default print
      }

      setShowPrintMenu(false);
    } catch (err) {
      console.error('Error preparing print action:', err);
      alert('Unable to load print template. Please verify template settings.');
    }
  };

  const previewQuotation = (template) => {
    if (template?.column_settings?.print?.style === 'grid_minimal') {
      generateGridMinimalQuotationPdfBlob(quotation, organisation, template).then((blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
      }).catch((err) => {
        console.error('Unable to generate grid minimal quotation PDF:', err);
        alert('Unable to generate PDF. Please check template settings.');
      });
      return;
    }

    if (template?.column_settings?.print?.style === 'saas') {
      const container = document.createElement('div');
      container.style.width = '210mm';
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      document.body.appendChild(container);

      const root = createRoot(container);
      flushSync(() => {
        root.render(
          <SaaSTemplate
            data={quotation}
            organisation={organisation}
            templateConfig={template.column_settings}
          />
        );
      });

      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Quotation Preview - ${quotation.quotation_no}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              body { background-color: #f3f4f6; margin: 0; padding: 20px; display: flex; justify-content: center; }
              #preview-container { width: 210mm; background: white; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); }
            </style>
          </head>
          <body>
            <div id="preview-container">
              ${container.innerHTML}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();

      document.body.removeChild(container);
      return;
    }

    if (template?.column_settings?.print?.style === 'vertical' || template?.template_code === 'QTN_VERTICAL') {
      const container = document.createElement('div');
      container.style.width = '210mm';
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      document.body.appendChild(container);

      const root = createRoot(container);
      flushSync(() => {
        root.render(
          <VerticalTemplate
            data={quotation}
            organisation={organisation}
            templateConfig={template.column_settings}
          />
        );
      });

      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Quotation Preview - ${quotation.quotation_no}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              body { background-color: #f3f4f6; margin: 0; padding: 20px; display: flex; justify-content: center; }
              #preview-container { width: 210mm; background: white; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); }
            </style>
          </head>
          <body>
            <div id="preview-container">
              ${container.innerHTML}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();

      document.body.removeChild(container);
      return;
    }
    /*
    if (template.template_code === 'QTN_TALLY') {
      const doc = generateQuotationTally(quotation, organisation, template);
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank');
      return;
    }
    if (template.template_code === 'QTN_PROFESSIONAL') {
      const doc = generateProfessionalTemplate(quotation, organisation, template);
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank');
      return;
    }
    */
    if (template.template_code === 'QTN_ZOHO') {
      const doc = generateZohoTemplate(quotation, organisation, template);
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank');
      return;
    }
    if (template.template_code === 'QTN_CLASSIC') {
      const doc = generateClassicQuotationTemplate(quotation, organisation, template);
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank');
      return;
    }
    const printWindow = window.open('', '_blank');
    const html = generateQuotationHTML(template);
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const downloadPDF = async (template) => {
    try {
      if (!quotation) throw new Error('Quotation data is missing');

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
              hsn: item.item?.hsn_code || '',
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

        renderTemplateToPdf(template.template_content || '', htmlData, `${safeFileName}.pdf`);
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
          flushSync(() => {
            root.render(<SaaSTemplate data={quotation} organisation={organisation} templateConfig={template.column_settings} />);
          });

          // Wait longer for fonts and layout
          await new Promise(resolve => setTimeout(resolve, 2000));
          await htmlToPdf(container, `${safeFileName}.pdf`);
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
          flushSync(() => {
            root.render(<VerticalTemplate data={quotation} organisation={organisation} templateConfig={template.column_settings} />);
          });

          // Wait longer for fonts and layout
          await new Promise(resolve => setTimeout(resolve, 2000));
          await htmlToPdf(container, `${safeFileName}.pdf`);
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
        const zohoDoc = generateZohoTemplate(quotation, organisation, template);
        const safeFileName = String(quotation.quotation_no || 'quotation')
          .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
          .replace(/\s+/g, '_');
        zohoDoc.save(`${safeFileName}.pdf`);
        return;
      }

      // Special handling for Classic Template
      if (template.template_code === 'QTN_CLASSIC') {
        const classicDoc = generateClassicQuotationTemplate(quotation, organisation, template);
        const safeFileName = String(quotation.quotation_no || 'quotation')
          .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
          .replace(/\s+/g, '_');
        classicDoc.save(`${safeFileName}.pdf`);
        return;
      }

      /*
      // Special handling for Grid Pro Template
      if (template.template_code === 'QTN_GRID_PRO') {
        const gridDoc = generateProGridQuotationPdf(quotation, organisation, template);
        const safeFileName = String(quotation.quotation_no || 'quotation')
          .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
          .replace(/\s+/g, '_');
        gridDoc.save(`${safeFileName}.pdf`);
        return;
      }
      */

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
        if (optionalCols.hsn_code) row.hsn_code = material.hsn_code || '-';
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

      doc.save(`${safeFileName}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('PDF export failed. Please check template settings and try again.');
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
      const material = item.item || {};
      let rowHTML = '<tr>';
      if (optionalCols.sno !== false) rowHTML += `<td>${index + 1}</td>`;
      if (optionalCols.hsn_code) rowHTML += `<td>${material.hsn_code || '-'}</td>`;
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

  const getStatusBadge = (status) => {
    const colors = {
      'Draft': { bg: '#f3f4f6', color: '#6b7280' },
      'Sent': { bg: '#dbeafe', color: '#1d4ed8' },
      'Under Negotiation': { bg: '#fef3c7', color: '#b45309' },
      'Approved': { bg: '#d1fae5', color: '#047857' },
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

  const getSelectedTemplateName = () => {
    if (!selectedTemplateId) return 'Default';
    const template = templates.find(t => t.id === selectedTemplateId);
    return template?.template_name || 'Default';
  };

  const isEditable = quotation?.status !== 'Converted' && quotation?.status !== 'Cancelled';
  const isDeletable = quotation?.status === 'Draft';
  const isCancellable = quotation?.status !== 'Cancelled' && quotation?.status !== 'Converted' && quotation?.status !== 'Draft';

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
        <button type="button" className="btn btn-primary" onClick={() => quotationQuery.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  if (!quotation) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Quotation not found</div>;
  }


  return (
    <div className="flex h-[calc(100vh-48px)] bg-white overflow-hidden">
      {/* Sidebar List (30%) */}
      <div className="w-[30%] border-r border-gray-200 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h2 className="text-sm font-bold text-gray-700">All Quotes</h2>
          <button 
            onClick={() => navigate('/quotation/create')}
            className="p-1.5 bg-sky-500 text-white rounded hover:bg-sky-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {quotationsQuery.isPending ? (
            <div className="p-8 text-center text-gray-400 text-sm italic">Loading quotes...</div>
          ) : quotations.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm italic">No quotations found</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {quotations.map((q) => (
                <div 
                  key={q.id}
                  onClick={() => navigate(`/ quotation / view ? id = ${ q.id } `)}
                  className={`p - 4 cursor - pointer transition - colors hover: bg - sky - 50 / 30 ${ quotationId === q.id ? 'bg-sky-50 border-l-4 border-sky-500' : 'bg-white' } `}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[13px] font-bold text-gray-900 truncate pr-2">
                      {q.client?.client_name || 'Walk-in Client'}
                    </span>
                    <span className="text-[12px] font-bold text-gray-900">
                      {formatCurrency(q.grand_total)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-[11px] text-gray-500 font-mono">
                      {q.quotation_no} <span className="mx-1 text-gray-300">•</span> {formatDate(q.date)}
                    </div>
                    <span 
                      className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ 
                        backgroundColor: q.status === 'Approved' ? '#d1fae5' : q.status === 'Draft' ? '#f3f4f6' : '#fff7ed',
                        color: q.status === 'Approved' ? '#047857' : q.status === 'Draft' ? '#6b7280' : '#c2410c'
                      }}
                    >
                      {q.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content (70%) */}
      <div className="flex-1 bg-gray-50 overflow-y-auto">
        <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">{quotation.quotation_no}</h1>
              <span 
                className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border"
                style={{ 
                  backgroundColor: quotation.status === 'Approved' ? '#d1fae5' : '#f3f4f6',
                  color: quotation.status === 'Approved' ? '#047857' : '#6b7280',
                  borderColor: quotation.status === 'Approved' ? '#10b981' : '#e5e7eb'
                }}
              >
                {quotation.status}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button 
                className="inline-flex items-center gap-2 px-3 h-[30px] bg-sky-50 border border-sky-200 text-sky-600 rounded-none hover:bg-sky-100 transition-colors text-[13px] font-bold"
                onClick={() => handlePrintAction('download')}
              >
                <Printer className="w-[16px] h-[16px]" />
                Print
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-6">
            {isEditable && (
              <button className="inline-flex items-center gap-1 px-3 h-[30px] bg-white border border-sky-200 text-sky-600 rounded-none hover:bg-sky-50 transition-colors text-[13px] font-bold" onClick={handleEdit}>
                <Edit className="w-[16px] h-[16px]" />
                Edit
              </button>
            )}
            <button className="inline-flex items-center gap-1 px-3 h-[30px] bg-white border border-sky-200 text-sky-600 rounded-none hover:bg-sky-50 transition-colors text-[13px] font-bold" onClick={handleDuplicate}>
              <Copy className="w-[16px] h-[16px]" />
              Duplicate
            </button>

            <div className="relative">
              <button 
                className="inline-flex items-center gap-1 px-3 h-[30px] bg-white border border-sky-200 text-sky-600 rounded-none hover:bg-sky-50 transition-colors text-[13px] font-bold" 
                onClick={() => { setShowConvertMenu(!showConvertMenu); setShowPrintMenu(false); setShowTemplateMenu(false); }}
              >
                <FileText className="w-[16px] h-[16px]" />
                Convert
                <ChevronDown className={`w - [14px] h - [14px] transition - transform ${ showConvertMenu ? 'rotate-180' : '' } `} />
              </button>

              {showConvertMenu && (
                <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] bg-white border border-gray-200 shadow-xl p-1">
                  <button onClick={() => handleConvert('proforma-invoice')} className="block w-full text-left px-3 py-2 text-xs font-bold text-gray-700 hover:bg-sky-50">Proforma Invoice</button>
                  <button onClick={() => handleConvert('invoice')} className="block w-full text-left px-3 py-2 text-xs font-bold text-gray-700 hover:bg-sky-50">Tax Invoice</button>
                </div>
              )}
            </div>

            <div className="relative">
              <button 
                className="inline-flex items-center gap-1 px-3 h-[30px] bg-white border border-sky-200 text-sky-600 rounded-none hover:bg-sky-50 transition-colors text-[13px] font-bold" 
                onClick={() => { setShowPrintMenu(!showPrintMenu); setShowConvertMenu(false); setShowTemplateMenu(false); }}
              >
                <Printer className="w-[16px] h-[16px]" />
                Print ({getSelectedTemplateName()})
                <ChevronDown className={`w - [14px] h - [14px] transition - transform ${ showPrintMenu ? 'rotate-180' : '' } `} />
              </button>

              {showPrintMenu && (
                <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] bg-white border border-gray-200 shadow-xl p-1">
                  {templates.map(t => (
                    <button 
                      key={t.id} 
                      onClick={() => handlePrintAction('download', t.id)} 
                      className="block w-full text-left px-3 py-2 text-xs font-bold text-gray-700 hover:bg-sky-50"
                    >
                      {t.template_name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isCancellable && (
              <button className="inline-flex items-center gap-1 px-3 h-[30px] bg-white border border-red-200 text-red-600 rounded-none hover:bg-red-50 transition-colors text-[13px] font-bold" onClick={handleCancel}>
                <XCircle className="w-[16px] h-[16px]" />
                Cancel
              </button>
            )}
            
            {isDeletable && (
              <button className="inline-flex items-center gap-1 px-3 h-[30px] bg-white border border-red-200 text-red-600 rounded-none hover:bg-red-50 transition-colors text-[13px] font-bold" onClick={handleDelete}>
                <Trash2 className="w-[16px] h-[16px]" />
                Delete
              </button>
            )}
          </div>

          <div className="space-y-6 bg-white p-12 border border-gray-200 shadow-2xl min-h-[1120px] mb-12">
            <div className="grid grid-cols-2 gap-12 border-b border-gray-100 pb-12">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-6">General Information</h3>
                <dl className="space-y-4">
                  <div className="flex justify-between border-b border-gray-50 pb-2">
                    <dt className="text-[13px] text-gray-500">Date</dt>
                    <dd className="text-[13px] font-bold text-gray-900">{formatDate(quotation.date)}</dd>
                  </div>
                  <div className="flex justify-between border-b border-gray-50 pb-2">
                    <dt className="text-[13px] text-gray-500">Valid Till</dt>
                    <dd className="text-[13px] font-bold text-gray-900">{formatDate(quotation.valid_till)}</dd>
                  </div>
                  <div className="flex justify-between border-b border-gray-50 pb-2">
                    <dt className="text-[13px] text-gray-500">Payment Terms</dt>
                    <dd className="text-[13px] font-bold text-gray-900">{quotation.payment_terms || '-'}</dd>
                  </div>
                  <div className="flex justify-between border-b border-gray-50 pb-2">
                    <dt className="text-[13px] text-gray-500">Contact No</dt>
                    <dd className="text-[13px] font-bold text-gray-900">{quotation.contact_no || '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[13px] text-gray-500">Remarks</dt>
                    <dd className="text-[13px] font-bold text-gray-900 text-right">{quotation.remarks || quotation.reference || '-'}</dd>
                  </div>
                </dl>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-6">Client & Project</h3>
                <div className="space-y-4">
                  <div>
                    <dt className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Client</dt>
                    <dd className="text-[15px] font-bold text-gray-900">{quotation.client?.client_name || quotation.client?.name}</dd>
                  </div>
                  {quotation.project && (
                    <div>
                      <dt className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Project</dt>
                      <dd className="text-[13px] font-medium text-gray-700">{quotation.project.project_name}</dd>
                    </div>
                  )}
                  {quotation.billing_address && (
                    <div>
                      <dt className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Billing Address</dt>
                      <dd className="text-[13px] text-gray-500 leading-relaxed whitespace-pre-line">{quotation.billing_address}</dd>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-6">Line Items</h3>
              <div className="overflow-x-auto -mx-12">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {templates.find(t => t.id === selectedTemplateId)?.column_settings?.optional?.sno !== false && (
                        <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">#</th>
                      )}
                      {quotation.items?.some(i => i.item?.hsn_code) && (
                        <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">HSN/SAC</th>
                      )}
                      {quotation.items?.some(i => i.item?.item_code) && (
                        <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Part No</th>
                      )}
                      {quotation.items?.some(i => i.make) && (
                        <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Make</th>
                      )}
                      <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Description</th>
                      {quotation.items?.some(i => i.variant_id) && (
                        <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Variant</th>
                      )}
                      <th className="px-6 pr-12 py-4 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider min-w-[80px]">Qty</th>
                      <th className="px-6 pl-12 py-4 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider min-w-[60px]">Unit</th>
                      <th className="px-6 py-4 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Rate</th>

                      {quotation.items?.some(i => i.discount_percent > 0) && (
                        <th className="px-6 py-4 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Disc %</th>
                      )}
                      {quotation.items?.some(i => i.tax_percent > 0) && (
                        <th className="px-6 py-4 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tax %</th>
                      )}
                      {quotation.items?.some(i => i.custom1) && (
                        <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">{templates.find(t => t.id === selectedTemplateId)?.column_settings?.labels?.custom1 || 'Custom 1'}</th>
                      )}
                      {quotation.items?.some(i => i.custom2) && (
                        <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">{templates.find(t => t.id === selectedTemplateId)?.column_settings?.labels?.custom2 || 'Custom 2'}</th>
                      )}
                      <th className="px-6 py-4 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {quotation.items?.map((item, index) => {
                      const template = templates.find(t => t.id === selectedTemplateId);
                      const optCols = template?.column_settings?.optional || {};
                      
                      const hasHSN = quotation.items?.some(i => i.item?.hsn_code);
                      const hasItemCode = quotation.items?.some(i => i.item?.item_code);
                      const hasMake = quotation.items?.some(i => i.make);
                      const hasVariant = quotation.items?.some(i => i.variant_id);
                      const hasDiscount = quotation.items?.some(i => i.discount_percent > 0);
                      const hasTax = quotation.items?.some(i => i.tax_percent > 0);
                      const hasCustom1 = quotation.items?.some(i => i.custom1);
                      const hasCustom2 = quotation.items?.some(i => i.custom2);

                      return (
                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors align-top">
                          {optCols.sno !== false && <td className="px-6 py-8 whitespace-nowrap text-[13px] text-gray-400 font-medium">{String(index + 1).padStart(2, '0')}</td>}
                          {hasHSN && <td className="px-6 py-8 whitespace-nowrap text-[12px] text-gray-500 font-mono">{item.item?.hsn_code || '-'}</td>}
                          {hasItemCode && <td className="px-6 py-8 whitespace-nowrap text-[12px] text-gray-500">{item.item?.item_code || '-'}</td>}
                          {hasMake && <td className="px-6 py-8 whitespace-nowrap text-[12px] text-gray-400 italic">{item.make || '-'}</td>}
                          <td className="px-6 py-8">
                            <div className="text-[14px] font-semibold text-gray-900 leading-relaxed mb-1">{item.description || item.item?.name}</div>
                            {item.override_flag && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100">Modified</span>
                            )}
                          </td>
                          {hasVariant && (
                            <td className="px-6 py-8 whitespace-nowrap text-[13px] text-gray-500">
                              {allVariants.find(v => v.id === item.variant_id)?.variant_name || '-'}
                            </td>
                          )}
                          <td className="px-6 pr-12 py-8 whitespace-nowrap text-[14px] text-gray-900 text-right font-bold min-w-[80px]">{item.qty}</td>
                          <td className="px-6 pl-12 py-8 whitespace-nowrap text-[13px] text-gray-400 min-w-[60px]">{item.uom}</td>
                          <td className="px-6 py-8 whitespace-nowrap text-[14px] text-gray-900 text-right">{formatCurrency(item.rate)}</td>

                          {hasDiscount && <td className="px-6 py-8 whitespace-nowrap text-[13px] text-red-500 text-right font-medium">{item.discount_percent}%</td>}
                          {hasTax && <td className="px-6 py-8 whitespace-nowrap text-[13px] text-gray-500 text-right">{item.tax_percent}%</td>}
                          {hasCustom1 && <td className="px-6 py-8 whitespace-nowrap text-[13px] text-gray-500">{item.custom1 || '-'}</td>}
                          {hasCustom2 && <td className="px-6 py-8 whitespace-nowrap text-[13px] text-gray-500">{item.custom2 || '-'}</td>}
                          <td className="px-6 py-8 whitespace-nowrap text-[14px] font-extrabold text-gray-900 text-right bg-gray-50/30">{formatCurrency(item.line_total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-12 border-t border-gray-100">
              <div className="w-full max-w-sm space-y-4">
                <div className="flex justify-between text-[13px] text-gray-500">
                  <span>Subtotal</span>
                  <span className="font-bold text-gray-900">{formatCurrency(quotation.subtotal)}</span>
                </div>
                <div className="flex justify-between text-[13px] text-gray-500">
                  <span>Total Item Discount</span>
                  <span className="text-red-500 font-bold">- {formatCurrency(quotation.total_item_discount)}</span>
                </div>
                <div className="flex justify-between text-[13px] text-gray-500">
                  <span>Extra Discount ({quotation.extra_discount_percent}%)</span>
                  <span className="text-red-500 font-bold">- {formatCurrency(quotation.extra_discount_amount)}</span>
                </div>
                
                {quotation.state && (organisation?.state || 'Maharashtra') && 
                quotation.state.trim().toLowerCase() !== (organisation?.state || 'Maharashtra').trim().toLowerCase() ? (
                  <div className="flex justify-between text-[13px] text-gray-500">
                    <span>IGST</span>
                    <span className="font-bold text-gray-900">{formatCurrency(quotation.total_tax)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-[13px] text-gray-500">
                      <span>CGST</span>
                      <span className="font-bold text-gray-900">{formatCurrency(quotation.total_tax / 2)}</span>
                    </div>
                    <div className="flex justify-between text-[13px] text-gray-500">
                      <span>SGST</span>
                      <span className="font-bold text-gray-900">{formatCurrency(quotation.total_tax / 2)}</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between text-[13px] text-gray-500">
                  <span>Round Off</span>
                  <span className="font-bold text-gray-900">{formatCurrency(quotation.round_off)}</span>
                </div>

                <div className="pt-4 border-t-2 border-gray-900 flex justify-between items-center">
                  <span className="text-[15px] font-bold text-gray-900 uppercase">Grand Total</span>
                  <span className="text-2xl font-black text-gray-900">{formatCurrency(quotation.grand_total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
