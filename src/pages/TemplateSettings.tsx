import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';

import { PortraitTemplate } from '../templates/PortraitTemplate';

const DOCUMENT_TYPES = ['Quotation', 'Sales Order', 'Proforma Invoice', 'Delivery Challan', 'Invoice'];
const PAGE_SIZES = ['A4', 'Letter'];
const ORIENTATIONS = ['Portrait', 'Landscape'];

const OPTIONAL_COLUMNS = [
  { key: 'sno', label: 'S.No' },
  { key: 'item', label: 'Item Name' },
  { key: 'qty', label: 'Quantity' },
  { key: 'uom', label: 'Unit (UOM)' },
  { key: 'item_code', label: 'Item Code' },
  { key: 'variant', label: 'Variant' },
  { key: 'description', label: 'Description' },
  { key: 'hsn_code', label: 'HSN Code' },
  { key: 'rate', label: 'Rate (Before Discount)' },
  { key: 'discount_percent', label: 'Discount %' },
  { key: 'discount_amount', label: 'Discount Amount' },
  { key: 'rate_after_discount', label: 'Rate/Unit (After Discount)' },
  { key: 'tax_percent', label: 'Tax %' },
  { key: 'tax_amount', label: 'Tax Amount' },
  { key: 'line_total', label: 'Line Total' },
  { key: 'category', label: 'Category' },
  { key: 'make', label: 'Make' },
  { key: 'custom1', label: 'Custom 1' },
  { key: 'custom2', label: 'Custom 2' },
  { key: 'subtotal', label: 'Sub-Total' },
  { key: 'total_tax', label: 'Total Tax' },
  { key: 'round_off', label: 'Round Off' },
  { key: 'grand_total', label: 'Grand Total' },
  { key: 'po_no', label: 'PO No' },
  { key: 'eway_bill', label: 'E-Way Bill' }
];

export default function TemplateSettings() {
  const { organisation } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [styleFilter, setStyleFilter] = useState<'all' | 'default' | 'grid_minimal'>('all');

  const [formData, setFormData] = useState<any>({
    template_name: '',
    template_code: '',
    document_type: 'Quotation',
    is_default: false,
    page_size: 'A4',
    orientation: 'Portrait',
    show_logo: true,
    show_bank_details: true,
    show_terms: true,
    show_signature: true,
    column_settings: {
      mandatory: [],
      optional: {
        sno: true,
        item: true,
        qty: true,
        uom: true,
        item_code: true,
        variant: false,
        description: true,
        hsn_code: false,
        rate: true,
        discount_percent: true,
        discount_amount: false,
        rate_after_discount: true,
        tax_percent: true,
        tax_amount: false,
        line_total: true,
        category: false,
        make: true,
        custom1: false,
        custom2: false,
        subtotal: true,
        total_tax: true,
        round_off: true,
        grand_total: true,
        po_no: false,
        eway_bill: false
      },
      labels: {
        custom1: 'Custom 1',
        custom2: 'Custom 2',
        rate_after_discount: 'Rate/Unit'
      },
      print: {
        style: 'default',
        gridMinimal: {
          titleOverride: '',
          columns: { hsn: true, make: true, unit: true, discPct: true, gst: true }
        }
      }
    }
  });

  useEffect(() => {
    loadTemplates();
  }, [organisation?.id]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      let dbTemplates = [];
      
      // Only load database templates if organisation exists
      if (organisation?.id) {
        const { data, error } = await supabase
          .from('document_templates')
          .select('*')
          .eq('organisation_id', organisation.id)
          .order('document_type', { ascending: true })
          .order('template_name', { ascending: true });

        if (error) throw error;
        dbTemplates = data || [];
      }
      
      // Merge database templates with built-in templates
      // We put dbTemplates FIRST so that unique filter keeps the DB version (which contains customizations like is_default: true)
      const allTemplates = [...dbTemplates, ...BUILT_IN_TEMPLATES];
      
      // Remove duplicates (keep database version if it exists)
      const uniqueTemplates = allTemplates.filter((template, index, self) => 
        index === self.findIndex(t => (t.template_code && template.template_code && t.template_code === template.template_code) || (t.id && template.id && t.id === template.id))
      );
      
      setTemplates(uniqueTemplates);
    } catch (err: any) {
      console.error('Error loading templates:', err);
      // If database fails, still show built-in templates
      setTemplates(BUILT_IN_TEMPLATES);
    } finally {
      setLoading(false);
    }
  };

  const BUILT_IN_TEMPLATES = [
    {
      template_name: 'Standard Template (Quotation)',
      template_code: 'STD_QTN',
      document_type: 'Quotation',
      is_default: false,
      page_size: 'A4',
      orientation: 'Portrait',
      show_logo: true,
      show_bank_details: true,
      show_terms: true,
      show_signature: true,
      column_settings: {
        mandatory: [],
        optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false },
        labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' },
        print: { style: 'standard' }
      }
    },
    {
      template_name: 'Standard Template (Invoice)',
      template_code: 'STD_INV',
      document_type: 'Invoice',
      is_default: false,
      page_size: 'A4',
      orientation: 'Portrait',
      show_logo: true,
      show_bank_details: true,
      show_terms: true,
      show_signature: true,
      column_settings: {
        mandatory: [],
        optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false },
        labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' },
        print: { style: 'standard' }
      }
    },
    {
      template_name: 'Standard Template (Delivery Challan)',
      template_code: 'STD_DC',
      document_type: 'Delivery Challan',
      is_default: false,
      page_size: 'A4',
      orientation: 'Portrait',
      show_logo: true,
      show_bank_details: true,
      show_terms: true,
      show_signature: true,
      column_settings: {
        mandatory: [],
        optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false },
        labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' },
        print: { style: 'standard' }
      }
    },
    {
      template_name: 'Standard Template (Proforma Invoice)',
      template_code: 'STD_PRO',
      document_type: 'Proforma Invoice',
      is_default: false,
      page_size: 'A4',
      orientation: 'Portrait',
      show_logo: true,
      show_bank_details: true,
      show_terms: true,
      show_signature: true,
      column_settings: {
        mandatory: [],
        optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false },
        labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' },
        print: { style: 'standard' }
      }
    },
    {
      template_name: 'Zoho Template',
      template_code: 'QTN_ZOHO',
      document_type: 'Quotation',
      is_default: false,
      page_size: 'A4',
      orientation: 'Portrait',
      show_logo: true,
      show_bank_details: true,
      show_terms: true,
      show_signature: true,
      column_settings: {
        mandatory: [],
        optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false },
        labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' },
        print: { style: 'default' }
      }
    },
    {
      template_name: 'Classic Quotation Template',
      template_code: 'QTN_CLASSIC',
      document_type: 'Quotation',
      is_default: true,
      page_size: 'A4',
      orientation: 'Portrait',
      show_logo: true,
      show_bank_details: true,
      show_terms: true,
      show_signature: true,
      column_settings: {
        mandatory: [],
        optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: false, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false },
        labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' },
        print: { style: 'default' }
      }
    },
    {
      template_name: 'SAAS Template (Quotation)',
      template_code: 'SAAS_QTN',
      document_type: 'Quotation',
      is_default: false,
      page_size: 'A4',
      orientation: 'Portrait',
      show_logo: true,
      show_bank_details: true,
      show_terms: true,
      show_signature: true,
      column_settings: {
        mandatory: [],
        optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false },
        labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' },
        print: { style: 'saas' }
      }
    },
    {
      template_name: 'SAAS Template (Invoice)',
      template_code: 'SAAS_INV',
      document_type: 'Invoice',
      is_default: false,
      page_size: 'A4',
      orientation: 'Portrait',
      show_logo: true,
      show_bank_details: true,
      show_terms: true,
      show_signature: true,
      column_settings: {
        mandatory: [],
        optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false },
        labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' },
        print: { style: 'saas' }
      }
    },
    {
      template_name: 'SAAS Template (DC)',
      template_code: 'SAAS_DC',
      document_type: 'Delivery Challan',
      is_default: false,
      page_size: 'A4',
      orientation: 'Portrait',
      show_logo: true,
      show_bank_details: true,
      show_terms: true,
      show_signature: true,
      column_settings: {
        mandatory: [],
        optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false },
        labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' },
        print: { style: 'saas' }
      }
    },
    {
      template_name: 'SAAS Template (Proforma)',
      template_code: 'SAAS_PRO',
      document_type: 'Proforma Invoice',
      is_default: false,
      page_size: 'A4',
      orientation: 'Portrait',
      show_logo: true,
      show_bank_details: true,
      show_terms: true,
      show_signature: true,
      column_settings: {
        mandatory: [],
        optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false },
        labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' },
        print: { style: 'saas' }
      }
    },
    {
      template_name: 'Tally Template',
      template_code: 'QTN_TALLY',
      document_type: 'Quotation',
      is_default: false,
      page_size: 'A4',
      orientation: 'Portrait',
      show_logo: true,
      show_bank_details: true,
      show_terms: true,
      show_signature: true,
      column_settings: {
        mandatory: [],
        optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: false, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false },
        labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' },
        print: { style: 'default' }
      }
    },
    {
      template_name: 'Professional Template',
      template_code: 'QTN_PROFESSIONAL',
      document_type: 'Quotation',
      is_default: false,
      page_size: 'A4',
      orientation: 'Portrait',
      show_logo: true,
      show_bank_details: true,
      show_terms: true,
      show_signature: true,
      column_settings: {
        mandatory: [],
        optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false },
        labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' },
        print: { style: 'default' }
      }
    },
    {
      template_name: 'Grid Pro Template',
      template_code: 'QTN_GRID_PRO',
      document_type: 'Quotation',
      is_default: false,
      page_size: 'A4',
      orientation: 'Landscape',
      show_logo: true,
      show_bank_details: true,
      show_terms: true,
      show_signature: true,
      column_settings: {
        mandatory: [],
        optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false },
        labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' },
        print: { style: 'pro_grid' }
      }
    },
    {
      template_name: 'Grid Minimal Template',
      template_code: 'GRID_MINIMAL',
      document_type: 'Quotation',
      is_default: false,
      page_size: 'A4',
      orientation: 'Portrait',
      show_logo: true,
      show_bank_details: true,
      show_terms: true,
      show_signature: true,
      column_settings: {
        mandatory: [],
        optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false },
        labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' },
        print: { style: 'grid_minimal', gridMinimal: { titleOverride: 'QUOTATION', columns: { hsn: true, make: true, unit: true, discPct: true, gst: true } } }
      }
    },
    {
      template_name: 'Grid Minimal Invoice',
      template_code: 'GRID_MINIMAL_INV',
      document_type: 'Invoice',
      is_default: false,
      page_size: 'A4',
      orientation: 'Portrait',
      show_logo: true,
      show_bank_details: true,
      show_terms: true,
      show_signature: true,
      column_settings: {
        mandatory: [],
        optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false },
        labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' },
        print: { style: 'grid_minimal', gridMinimal: { titleOverride: 'TAX INVOICE', columns: { hsn: true, make: true, unit: true, discPct: true, gst: true } } }
      }
    },
    {
      template_name: 'Pro Grid Invoice',
      template_code: 'PRO_GRID_INV',
      document_type: 'Invoice',
      is_default: false,
      page_size: 'A4',
      orientation: 'Landscape',
      show_logo: true,
      show_bank_details: true,
      show_terms: true,
      show_signature: true,
      column_settings: {
        mandatory: [],
        optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false },
        labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' },
        print: { style: 'pro_grid' }
      }
    },
    {
      template_name: 'Vertical Template (Quotation)',
      template_code: 'QTN_VERTICAL',
      document_type: 'Quotation',
      is_default: false,
      page_size: 'A4',
      orientation: 'Portrait',
      show_logo: true,
      show_bank_details: true,
      show_terms: true,
      show_signature: true,
      column_settings: {
        mandatory: [],
        optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false },
        labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' },
        print: { style: 'vertical' }
      }
    }
  ];

  const seedBuiltInTemplates = async () => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      for (const template of BUILT_IN_TEMPLATES) {
        const { data: existing } = await supabase
          .from('document_templates')
          .select('id')
          .eq('template_code', template.template_code)
          .eq('document_type', template.document_type)
          .eq('organisation_id', organisation.id)
          .single();
        
        if (!existing) {
          await supabase.from('document_templates').insert({ ...template, organisation_id: organisation.id });
        }
      }
      setSuccessMessage('Built-in templates added successfully!');
      await loadTemplates();
    } catch (err: any) {
      console.error('Error seeding templates:', err);
      alert('Error seeding templates: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template: any) => {
    setSelectedTemplate(template);
    setFormData({
      template_name: template.template_name,
      template_code: template.template_code || '',
      document_type: template.document_type,
      is_default: template.is_default,
      page_size: template.page_size || 'A4',
      orientation: template.orientation || 'Portrait',
      show_logo: template.show_logo !== false,
      show_bank_details: template.show_bank_details !== false,
      show_terms: template.show_terms !== false,
      show_signature: template.show_signature !== false,
      column_settings: {
        mandatory: [],
        optional: template.column_settings?.optional || {
          sno: true,
          item: true,
          qty: true,
          uom: true,
          item_code: true,
          variant: false,
          description: true,
          hsn_code: false,
          rate: true,
          discount_percent: true,
          discount_amount: false,
          rate_after_discount: true,
          tax_percent: true,
          tax_amount: false,
          line_total: true,
          category: false,
          brand: false,
          custom1: false,
          custom2: false,
          subtotal: true,
          total_tax: true,
          round_off: true,
          grand_total: true,
          po_no: false,
          eway_bill: false
        },
        labels: template.column_settings?.labels || {
          custom1: 'Custom 1',
          custom2: 'Custom 2',
          rate_after_discount: 'Rate/Unit'
        },
        print: template.column_settings?.print || {
          style: 'default',
          gridMinimal: {
            titleOverride: '',
            columns: { hsn: true, make: true, unit: true, discPct: true, gst: true }
          }
        }
      }
    });
    setShowForm(true);
  };

  const handleNew = (preset: any = null) => {
    const normalizedPreset = typeof preset === 'string' ? preset : null
    setSelectedTemplate(null);
    
    const isGridMinimal = normalizedPreset === 'grid_minimal';
    
    const defaultData = {
      template_name: isGridMinimal ? 'Grid Minimal Template' : normalizedPreset === 'Portrait' ? 'Professional Portrait' : '',
      template_code: isGridMinimal ? 'GRID_MIN' : '',
      document_type: 'Quotation',
      is_default: false,
      page_size: 'A4',
      orientation: 'Portrait',
      show_logo: true,
      show_bank_details: true,
      show_terms: true,
      show_signature: true,
      column_settings: {
        mandatory: [],
        optional: {
          sno: true,
          item: true,
          qty: true,
          uom: true,
          item_code: true,
          variant: false,
          description: true,
          hsn_code: true,
          rate: true,
          discount_percent: true,
          discount_amount: false,
          rate_after_discount: true,
          tax_percent: true,
          tax_amount: false,
          line_total: true,
          category: false,
          brand: false,
          custom1: false,
          custom2: false,
          subtotal: true,
          total_tax: true,
          round_off: true,
          grand_total: true
        },
        labels: {
          custom1: 'Custom 1',
          custom2: 'Custom 2',
          rate_after_discount: 'Rate/Unit'
        },
        print: {
          style: isGridMinimal ? 'grid_minimal' : 'default',
          gridMinimal: {
            titleOverride: isGridMinimal ? 'QUOTATION' : '',
            columns: { hsn: true, make: true, unit: true, discPct: true, gst: true }
          }
        }
      }
    };
    setFormData(defaultData);
    setShowForm(true);
  };

  const handleColumnToggle = (columnKey: string, checked: boolean) => {
    setFormData({
      ...formData,
      column_settings: {
        ...formData.column_settings,
        optional: {
          ...formData.column_settings.optional,
          [columnKey]: checked
        }
      }
    });
  };

  const handleLabelChange = (columnKey: string, label: string) => {
    setFormData({
      ...formData,
      column_settings: {
        ...formData.column_settings,
        labels: {
          ...formData.column_settings.labels,
          [columnKey]: label
        }
      }
    });
  };

  const handleHeaderLabelChange = (fieldKey: string, label: string) => {
    setFormData({
      ...formData,
      column_settings: {
        ...formData.column_settings,
        header_labels: {
          ...(formData.column_settings?.header_labels || {}),
          [fieldKey]: label
        }
      }
    });
  };

  const handlePrintStyleChange = (style: string) => {
    setFormData({
      ...formData,
      column_settings: {
        ...formData.column_settings,
        print: {
          ...(formData.column_settings?.print || {}),
          style
        }
      }
    });
  };

  const handleGridMinimalColumnToggle = (key: string, checked: boolean) => {
    const prevPrint = formData.column_settings?.print || {};
    const prevGrid = prevPrint.gridMinimal || {};
    const prevCols = prevGrid.columns || {};
    setFormData({
      ...formData,
      column_settings: {
        ...formData.column_settings,
        print: {
          ...prevPrint,
          gridMinimal: {
            ...prevGrid,
            columns: {
              ...prevCols,
              [key]: checked,
            },
          },
        },
      },
    });
  };

  const handleGridMinimalTitleOverride = (value: string) => {
    const prevPrint = formData.column_settings?.print || {};
    const prevGrid = prevPrint.gridMinimal || {};

    setFormData({
      ...formData,
      column_settings: {
        ...formData.column_settings,
        print: {
          ...prevPrint,
          gridMinimal: {
            ...prevGrid,
            titleOverride: value,
          },
        },
      },
    });
  };

  const [showPreview, setShowPreview] = useState(false);

  const generatePreviewHTML = () => {
    const colSettings = formData.column_settings || {};
    const optionalCols = colSettings.optional || {};
    const labels = colSettings.labels || {};

    let columnsHTML = '';
    if (optionalCols.sno) columnsHTML += '<th>#</th>';
    if (optionalCols.item_code) columnsHTML += '<th>Item Code</th>';
    if (optionalCols.hsn_code) columnsHTML += '<th>HSN/SAC</th>';
    if (optionalCols.item) columnsHTML += '<th>Item Description</th>';
    if (optionalCols.variant) columnsHTML += '<th>Variant</th>';
    if (optionalCols.description) columnsHTML += '<th>Description</th>';
    if (optionalCols.qty) columnsHTML += '<th>Qty</th>';
    if (optionalCols.uom) columnsHTML += '<th>Unit</th>';
    if (optionalCols.rate) columnsHTML += '<th>Rate</th>';
    if (optionalCols.discount_percent) columnsHTML += '<th>Disc %</th>';
    if (optionalCols.discount_amount) columnsHTML += '<th>Disc Amt</th>';
    if (optionalCols.rate_after_discount) columnsHTML += `<th>${labels.rate_after_discount || 'Rate/Unit'}</th>`;
    if (optionalCols.tax_percent) columnsHTML += '<th>Tax %</th>';
    if (optionalCols.tax_amount) columnsHTML += '<th>Tax Amt</th>';
    if (optionalCols.category) columnsHTML += '<th>Category</th>';
    if (optionalCols.make) columnsHTML += '<th>Make</th>';
    if (optionalCols.custom1) columnsHTML += `<th>${labels.custom1 || 'Custom 1'}</th>`;
    if (optionalCols.custom2) columnsHTML += `<th>${labels.custom2 || 'Custom 2'}</th>`;
    if (optionalCols.line_total) columnsHTML += '<th>Total</th>';

    const dummyItems = [
      { sno: 1, item: 'Steel Pipe 2 Inch', variant: 'Standard', description: 'Galvanized steel pipe', qty: 10, unit: 'Mtrs', rate: 500, discount: 10, rate_after: 450, tax: 18, c1: 'MAKE-A', c2: 'IN-STOCK', total: 5310 },
      { sno: 2, item: 'PVC Connector', variant: 'Premium', description: 'High pressure connector', qty: 5, unit: 'Nos', rate: 200, discount: 0, rate_after: 200, tax: 12, c1: 'MAKE-B', c2: '7 DAYS', total: 1120 }
    ];

    let rowsHTML = '';
    dummyItems.forEach((item) => {
      let rowHTML = '<tr>';
      if (optionalCols.sno) rowHTML += `<td>${item.sno}</td>`;
      if (optionalCols.item_code) rowHTML += `<td>P-101</td>`;
      if (optionalCols.hsn_code) rowHTML += `<td>7306</td>`;
      if (optionalCols.item) rowHTML += `<td>${item.item}</td>`;
      if (optionalCols.variant) rowHTML += `<td>${item.variant}</td>`;
      if (optionalCols.description) rowHTML += `<td>${item.description}</td>`;
      if (optionalCols.qty) rowHTML += `<td style="text-align:right">${item.qty}</td>`;
      if (optionalCols.uom) rowHTML += `<td>${item.unit}</td>`;
      if (optionalCols.rate) rowHTML += `<td style="text-align:right">₹${item.rate.toFixed(2)}</td>`;
      if (optionalCols.discount_percent) rowHTML += `<td style="text-align:right">${item.discount}%</td>`;
      if (optionalCols.discount_amount) rowHTML += `<td style="text-align:right">₹${(item.rate * item.qty * item.discount / 100).toFixed(2)}</td>`;
      if (optionalCols.rate_after_discount) rowHTML += `<td style="text-align:right">₹${item.rate_after.toFixed(2)}</td>`;
      if (optionalCols.tax_percent) rowHTML += `<td style="text-align:right">${item.tax}%</td>`;
      if (optionalCols.tax_amount) rowHTML += `<td style="text-align:right">₹${(item.total - (item.rate_after * item.qty)).toFixed(2)}</td>`;
      if (optionalCols.category) rowHTML += `<td>Fittings</td>`;
      if (optionalCols.make) rowHTML += `<td>${item.c1}</td>`;
      if (optionalCols.custom1) rowHTML += `<td>${item.c1}</td>`;
      if (optionalCols.custom2) rowHTML += `<td>${item.c2}</td>`;
      if (optionalCols.line_total) rowHTML += `<td style="text-align:right;font-weight:bold">₹${item.total.toFixed(2)}</td>`;
      rowHTML += '</tr>';
      rowsHTML += rowHTML;
    });

    return `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 800px; margin: auto; border: 1px solid #eee; background: white;">
        <h2 style="text-align: center; color: #000; border-bottom: 2px solid #eee; padding-bottom: 10px;">${formData.document_type.toUpperCase()} PREVIEW</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; margin-top: 20px;">
          <div style="line-height: 1.6;">
            <strong>To:</strong><br>
            Sample Client Name<br>
            123 Business Avenue, Tech Park<br>
            GSTIN: 27AAAAA0000A1Z5<br>
            State: Maharashtra
          </div>
          <div style="line-height: 1.6; text-align: right;">
            <strong>${formData.document_type} No:</strong> SAMPLE-001<br>
            <strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}<br>
            <strong>Valid Till:</strong> ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN')}<br>
            <strong>Project:</strong> Residential MEP Project
          </div>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #f3f4f6; color: #374151;">
              ${columnsHTML.replace(/<th>/g, '<th style="border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 13px;">')}
            </tr>
          </thead>
          <tbody style="font-size: 13px;">
            ${rowsHTML.replace(/<td>/g, '<td style="border: 1px solid #ddd; padding: 10px;">')}
          </tbody>
        </table>
        <div style="float: right; width: 250px;">
          ${optionalCols.subtotal ? '<div style="display: flex; justify-content: space-between; padding: 5px 0;"><span>Subtotal</span><span>₹6,000.00</span></div>' : ''}
          <div style="display: flex; justify-content: space-between; padding: 5px 0;"><span>Discount</span><span>-₹500.00</span></div>
          ${optionalCols.total_tax ? '<div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee;"><span>Tax (GST)</span><span>₹930.00</span></div>' : ''}
          ${optionalCols.round_off ? '<div style="display: flex; justify-content: space-between; padding: 5px 0;"><span>Round Off</span><span>₹0.00</span></div>' : ''}
          ${optionalCols.grand_total ? `
          <div style="display: flex; justify-content: space-between; padding: 10px 0; font-weight: bold; font-size: 1.1em; border-top: 2px solid #374151;">
            <span>Grand Total</span><span>₹6,430.00</span>
          </div>` : ''}
        </div>
        <div style="clear: both; margin-top: 40px; font-size: 12px; color: #666;">
          ${formData.show_terms ? '<p><strong>Terms:</strong> Standard payment terms apply. This is a computer generated document.</p>' : ''}
          ${formData.show_signature ? '<div style="margin-top: 40px; text-align: right;"><strong>For Sample Organization</strong><br><br><br>Authorized Signatory</div>' : ''}
        </div>
      </div>
    `;
  };

  const handleSave = async () => {
    if (!formData.template_name.trim()) {
      alert('Template name is required');
      return;
    }

    if (formData.template_code && !/^[A-Z0-9_]+$/.test(formData.template_code)) {
      alert('Template code must contain only uppercase letters, numbers, and underscores');
      return;
    }

    
    setSaving(true);
    try {
      if (selectedTemplate && selectedTemplate.id) {
        // Check for duplicate template code (excluding current template)
        const duplicateTemplate = templates.find(t => 
          t.template_code === formData.template_code && t.id !== selectedTemplate.id
        );
        
        if (duplicateTemplate) {
          alert('Template code already exists. Please use a different code.');
          return;
        }
        const { error } = await supabase
          .from('document_templates')
          .update({
            template_name: formData.template_name,
            template_code: formData.template_code || null,
            document_type: formData.document_type,
            is_default: formData.is_default,
            page_size: formData.page_size,
            orientation: formData.orientation,
            show_logo: formData.show_logo,
            show_bank_details: formData.show_bank_details,
            show_terms: formData.show_terms,
            show_signature: formData.show_signature,
            column_settings: formData.column_settings,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedTemplate.id)
          .eq('organisation_id', organisation.id);

        if (error) throw error;
      } else {
        // Check for duplicate template code for new templates
        if (formData.template_code) {
          const duplicateTemplate = templates.find(t => 
            t.template_code === formData.template_code
          );
          
          if (duplicateTemplate) {
            alert('Template code already exists. Please use a different code.');
            setSaving(false);
            return;
          }
        }

        // Handle setting default flag for new template
        if (formData.is_default) {
          // Unset existing default for this document type
          await supabase
            .from('document_templates')
            .update({ is_default: false })
            .eq('document_type', formData.document_type)
            .eq('organisation_id', organisation.id);
        }

        const { error } = await supabase
          .from('document_templates')
          .insert({
            template_name: formData.template_name,
            template_code: formData.template_code || null,
            document_type: formData.document_type,
            is_default: formData.is_default,
            page_size: formData.page_size,
            orientation: formData.orientation,
            show_logo: formData.show_logo,
            show_bank_details: formData.show_bank_details,
            show_terms: formData.show_terms,
            show_signature: formData.show_signature,
            column_settings: formData.column_settings,
            organisation_id: organisation.id
          });

        if (error) throw error;
      }

      setSuccessMessage('Template saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      setShowForm(false);
      loadTemplates();
    } catch (err: any) {
      console.error('Error saving template:', err);
      alert('Error: ' + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    
    try {
      await supabase.from('document_templates').delete().eq('id', templateId).eq('organisation_id', organisation.id);
      loadTemplates();
    } catch (err: any) {
      console.error('Error deleting template:', err);
      alert('Error: ' + (err?.message || err));
    }
  };

  const handleClone = (template: any) => {
    const clonedData = {
      template_name: `${template.template_name} (Copy)`,
      template_code: '', // Clear template code to avoid conflicts
      document_type: template.document_type,
      is_default: false, // Never clone as default
      page_size: template.page_size || 'A4',
      orientation: template.orientation || 'Portrait',
      show_logo: template.show_logo !== false,
      show_bank_details: template.show_bank_details !== false,
      show_terms: template.show_terms !== false,
      show_signature: template.show_signature !== false,
      column_settings: {
        ...template.column_settings,
        // Deep copy nested objects
        optional: { ...template.column_settings?.optional },
        labels: { ...template.column_settings?.labels },
        print: template.column_settings?.print ? {
          ...template.column_settings.print,
          gridMinimal: template.column_settings.print.gridMinimal ? {
            ...template.column_settings.print.gridMinimal
          } : undefined
        } : undefined
      }
    };
    
    setSelectedTemplate(null);
    setFormData(clonedData);
    setShowForm(true);
  };

  const handleSetDefault = async (template: any) => {
    if (!organisation?.id) {
      alert('Please select an organisation first');
      return;
    }

    try {
      let templateId = template.id;

      // Check if template is built-in (no database id)
      if (!templateId && template.template_code) {
        // First check if it already exists
        const { data: existing } = await supabase
          .from('document_templates')
          .select('id')
          .eq('template_code', template.template_code)
          .eq('document_type', template.document_type)
          .eq('organisation_id', organisation.id)
          .maybeSingle();

        if (existing) {
          templateId = existing.id;
        } else {
          // Seed only this specific built-in template
          const { data: inserted, error: insertError } = await supabase
            .from('document_templates')
            .insert({ ...template, organisation_id: organisation.id })
            .select('id')
            .single();

          // Handle duplicate key error - template might already exist
          if (insertError) {
            console.error('Error inserting template:', insertError);
            // If it's a duplicate key error, try to fetch the existing template
            if (insertError.message?.includes('duplicate key') || insertError.code === '23505') {
              const { data: existingAfterError } = await supabase
                .from('document_templates')
                .select('id')
                .eq('template_code', template.template_code)
                .eq('document_type', template.document_type)
                .eq('organisation_id', organisation.id)
                .maybeSingle();

              if (existingAfterError) {
                templateId = existingAfterError.id;
              } else {
                alert('Error: Could not find template in database after duplicate key error');
                return;
              }
            } else {
              alert('Error: Could not seed template to database - ' + (insertError?.message || 'Unknown error'));
              return;
            }
          } else if (!inserted) {
            alert('Error: Could not seed template to database - No data returned');
            return;
          } else {
            templateId = inserted.id;
          }
        }
      }

      if (!templateId) {
        alert('Error: Template does not have a valid ID');
        return;
      }

      const { data: existingDefaults } = await supabase
        .from('document_templates')
        .select('id')
        .eq('document_type', template.document_type)
        .eq('is_default', true)
        .eq('organisation_id', organisation.id);

      for (const def of existingDefaults || []) {
        await supabase
          .from('document_templates')
          .update({ is_default: false })
          .eq('id', def.id)
          .eq('organisation_id', organisation.id);
      }

      await supabase
        .from('document_templates')
        .update({ is_default: true })
        .eq('id', templateId)
        .eq('organisation_id', organisation.id);

      loadTemplates();
      setSuccessMessage('Default template updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error('Error setting default:', err);
      alert('Error: ' + (err?.message || err));
    }
  };

  const getDocumentTypeIcon = (type: string) => {
    const icons = {
      'Quotation': '📄',
      'Sales Order': '📋',
      'Proforma Invoice': '📑',
      'Delivery Challan': '🚚',
      'Invoice': '💰'
    };
    return icons[type] || '📄';
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  }

  if (showForm) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">{selectedTemplate ? 'Edit Template' : 'Create Template'}</h1>
        </div>

        {successMessage && (
          <div style={{ background: '#d1fae5', color: '#065f46', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
            {successMessage}
          </div>
        )}

        <div className="card" style={{ marginBottom: '16px' }}>
          <h3 style={{ marginTop: 0 }}>Basic Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px' }}>Template Name *</label>
              <input
                type="text"
                className="form-input"
                value={formData.template_name}
                onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                placeholder="e.g., My Company Quotation"
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px' }}>Template Code</label>
              <input
                type="text"
                className="form-input"
                value={formData.template_code}
                onChange={(e) => setFormData({ ...formData, template_code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
                placeholder="e.g., INV_DEFAULT"
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px' }}>Document Type</label>
              <select
                className="form-select"
                value={formData.document_type}
                onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
                disabled={!!selectedTemplate}
              >
                {DOCUMENT_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px' }}>Page Size</label>
              <select
                className="form-select"
                value={formData.page_size}
                onChange={(e) => setFormData({ ...formData, page_size: e.target.value })}
              >
                {PAGE_SIZES.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px' }}>Orientation</label>
              <select
                className="form-select"
                value={formData.orientation}
                onChange={(e) => setFormData({ ...formData, orientation: e.target.value })}
              >
                {ORIENTATIONS.map(orient => (
                  <option key={orient} value={orient}>{orient}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                />
                <span style={{ fontWeight: 600, fontSize: '13px' }}>Set as Default for {formData.document_type}</span>
              </label>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '16px' }}>
          <h3 style={{ marginTop: 0 }}>Print Settings</h3>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.show_logo}
                onChange={(e) => setFormData({ ...formData, show_logo: e.target.checked })}
              />
              <span>Show Company Logo</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.show_bank_details}
                onChange={(e) => setFormData({ ...formData, show_bank_details: e.target.checked })}
              />
              <span>Show Bank Details</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.show_terms}
                onChange={(e) => setFormData({ ...formData, show_terms: e.target.checked })}
              />
              <span>Show Terms & Conditions</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.show_signature}
                onChange={(e) => setFormData({ ...formData, show_signature: e.target.checked })}
              />
              <span>Show Signature</span>
            </label>
          </div>

          <h4 style={{ marginBottom: '12px' }}>Column & Field Settings</h4>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontWeight: 600, color: '#6b7280', marginBottom: '12px' }}>Edit Document Header Labels (e.g., rename "PO No" to "Order No")</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              {[
                { key: 'document_no', label: 'Document No Label' },
                { key: 'document_date', label: 'Date Label' },
                { key: 'po_no', label: 'PO No / Ref No Label' },
                { key: 'po_date', label: 'PO Date / Ref Date Label' },
                { key: 'remarks', label: 'Remarks Label' },
                { key: 'eway_bill', label: 'E-Way Bill Label' }
              ].map(field => (
                <div key={field.key} className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '11px' }}>{field.label}</label>
                  <input 
                    type="text"
                    className="form-input"
                    style={{ padding: '6px 10px', fontSize: '12px' }}
                    value={formData.column_settings?.header_labels?.[field.key] || ''}
                    onChange={(e) => handleHeaderLabelChange(field.key, e.target.value)}
                    placeholder="Leave blank for default"
                  />
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontWeight: 600, color: '#6b7280', marginBottom: '12px' }}>PDF Template Style</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '11px' }}>Style</label>
                <select
                  className="form-select"
                  value={formData.column_settings?.print?.style || 'default'}
                  onChange={(e) => handlePrintStyleChange(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                >
                  <option value="default">Default</option>
                  <option value="grid_minimal">Grid Minimal (Manrope)</option>
                  <option value="saas">SAAS Style (Blue Header)</option>
                  <option value="vertical">Vertical High Fidelity (Premium)</option>
                </select>
              </div>

              {formData.column_settings?.print?.style === 'grid_minimal' && (
                <>
                  <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>Title Override</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ padding: '6px 10px', fontSize: '12px' }}
                      value={formData.column_settings?.print?.gridMinimal?.titleOverride || ''}
                      onChange={(e) => handleGridMinimalTitleOverride(e.target.value)}
                      placeholder='e.g. TAX INVOICE'
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0, gridColumn: 'span 3' }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>Grid Columns</label>
                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '12px' }}>
                      {[
                        { key: 'hsn', label: 'HSN' },
                        { key: 'make', label: 'Make' },
                        { key: 'unit', label: 'Unit' },
                        { key: 'discPct', label: 'Disc%' },
                        { key: 'gst', label: 'GST%' },
                      ].map((col) => (
                        <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={formData.column_settings?.print?.gridMinimal?.columns?.[col.key] !== false}
                            onChange={(e) => handleGridMinimalColumnToggle(col.key, e.target.checked)}
                          />
                          {col.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 600, color: '#6b7280', marginBottom: '8px' }}>Select fields to show on document</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {OPTIONAL_COLUMNS.map(col => (                <div key={col.key} style={{ 
                padding: '8px 12px', 
                  background: formData.column_settings?.optional?.[col.key] ? '#dbeafe' : '#f9fafb',
                  border: `1px solid ${formData.column_settings?.optional?.[col.key] ? '#93c5fd' : '#e5e7eb'}`,
                  borderRadius: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => handleColumnToggle(col.key, !formData.column_settings?.optional?.[col.key])}>
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>{col.label}</span>
                    <div style={{ position: 'relative', width: '36px', height: '20px' }}>
                      <input 
                        type="checkbox" 
                        checked={formData.column_settings?.optional?.[col.key] || false}
                        onChange={(e) => handleColumnToggle(col.key, e.target.checked)}
                        style={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer', position: 'absolute' }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div style={{
                        width: '36px',
                        height: '20px',
                        background: formData.column_settings?.optional?.[col.key] ? '#2563eb' : '#d1d5db',
                        borderRadius: '10px',
                        position: 'relative',
                        transition: 'background 0.2s'
                      }}>
                        <div style={{
                          width: '16px',
                          height: '16px',
                          background: '#fff',
                          borderRadius: '50%',
                          position: 'absolute',
                          top: '2px',
                          left: formData.column_settings?.optional?.[col.key] ? '18px' : '2px',
                          transition: 'left 0.2s'
                        }} />
                      </div>
                    </div>
                  </div>
                  {(col.key === 'custom1' || col.key === 'custom2' || col.key === 'rate_after_discount') && (
                    <input 
                      type="text"
                      className="form-input"
                      style={{ padding: '4px 8px', fontSize: '11px', height: '24px' }}
                      placeholder="Rename column..."
                      value={formData.column_settings?.labels?.[col.key] || ''}
                      onChange={(e) => handleLabelChange(col.key, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={() => setShowForm(false)}>
            Cancel
          </button>
          <button className="btn btn-secondary" onClick={() => setShowPreview(true)}>
            Preview Format
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>

        {showPreview && (
          <div className="modal-overlay open" onClick={() => setShowPreview(false)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
              <div className="modal-header">
                <h2 className="modal-title">Template Preview</h2>
                <button onClick={() => setShowPreview(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>&times;</button>
              </div>
              <div className="modal-body" style={{ overflowY: 'auto', background: '#f3f4f6', padding: '40px 20px' }}>
                <div dangerouslySetInnerHTML={{ __html: generatePreviewHTML() }} />
              </div>
              <div className="modal-footer">
                <button className="btn btn-primary" onClick={() => setShowPreview(false)}>Close Preview</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Template Settings</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={seedBuiltInTemplates}
            style={{ borderColor: '#059669', color: '#059669' }}
          >
            Seed Built-in Templates
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => handleNew('grid_minimal')}
            style={{ borderColor: '#7c3aed', color: '#7c3aed' }}
          >
            + Grid Minimal
          </button>
          <button className="btn btn-primary" onClick={() => handleNew()}>
            + Create Template
          </button>
        </div>
      </div>

      {successMessage && (
        <div style={{ background: '#d1fae5', color: '#065f46', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
          {successMessage}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', color: '#6b7280' }}>Filter by Style:</span>
        {[
          { value: 'all', label: 'All' },
          { value: 'default', label: 'Default' },
          { value: 'grid_minimal', label: 'Grid Minimal' },
          { value: 'saas', label: 'SAAS Style' },
          { value: 'vertical', label: 'Vertical' },
        ].map(filter => (
          <button
            key={filter.value}
            onClick={() => setStyleFilter(filter.value as any)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: styleFilter === filter.value ? '#7c3aed' : '#e5e7eb',
              background: styleFilter === filter.value ? '#7c3aed' : '#fff',
              color: styleFilter === filter.value ? '#fff' : '#374151',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="card">
        {templates.length === 0 ? (
          <div className="empty-state">
            <h3>No Templates</h3>
            <p>Create your first template to get started</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {DOCUMENT_TYPES.map(docType => {
              const typeTemplates = templates.filter(t => {
                if (t.document_type !== docType) return false;
                if (styleFilter === 'all') return true;
                const templateStyle = t.column_settings?.print?.style || 'default';
                return templateStyle === styleFilter;
              });
              if (typeTemplates.length === 0) return null;

              return (
                <div key={docType}>
                  <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{getDocumentTypeIcon(docType)}</span>
                    <span>{docType}</span>
                  </h3>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {typeTemplates.map(template => (
                      <div
                        key={template.id || template.template_code}
                        style={{
                          padding: '16px',
                          background: template.is_default ? '#f0fdf4' : '#f9fafb',
                          border: `1px solid ${template.is_default ? '#bbf7d0' : '#e5e7eb'}`,
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {template.template_name}
                            {template.is_default && (
                              <span style={{ background: '#16a34a', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>
                                DEFAULT
                              </span>
                            )}
                            {template.column_settings?.print?.style === 'grid_minimal' && (
                              <span style={{ background: '#7c3aed', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>
                                GRID MINIMAL
                              </span>
                            )}
                            {template.column_settings?.print?.style === 'pro_grid' && (
                              <span style={{ background: '#ea580c', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>
                                PRO GRID
                              </span>
                            )}
                            {template.column_settings?.print?.style === 'saas' && (
                              <span style={{ background: '#1d4ed8', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>
                                SAAS
                              </span>
                            )}
                            {template.column_settings?.print?.style === 'vertical' && (
                              <span style={{ background: '#1e3a8a', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>
                                VERTICAL
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                            {template.template_code && <span style={{ marginRight: '8px', fontFamily: 'monospace', background: '#e5e7eb', padding: '1px 4px', borderRadius: '2px' }}>{template.template_code}</span>}
                            {template.page_size} | {template.orientation} | 
                            {template.show_logo && ' Logo'}{template.show_bank_details && ' | Bank'}{template.show_terms && ' | Terms'}{template.show_signature && ' | Signature'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {!template.is_default && (
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => handleSetDefault(template)}
                            >
                              Set Default
                            </button>
                          )}
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleClone(template)}
                            title="Create a copy of this template"
                          >
                            Clone
                          </button>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleEdit(template)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-sm btn-secondary"
                            style={{ color: '#dc2626' }}
                            onClick={() => handleDelete(template.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}



