import { supabase } from '../supabase';
import { generateInvoiceA4 } from '../pages/InvoiceA4Template';
import { generateInvoiceClassicGstV2 } from '../pages/InvoiceClassicGstV2Template';

const TEMPLATE_GENERATORS = {
  'INV_DEFAULT': generateInvoiceA4,
  'INV_CLASSIC_V2': generateInvoiceClassicGstV2
};

export async function getInvoiceTemplate(templateCode) {
  if (!templateCode) {
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('document_type', 'Invoice')
      .eq('is_default', true)
      .single();
    
    if (error) {
      console.warn('No default invoice template found, using fallback');
      return null;
    }
    return data;
  }

  // Try finding by template_code field first
  const { data, error } = await supabase
    .from('document_templates')
    .select('*')
    .eq('template_code', templateCode)
    .single();

  if (error) {
    // Fallback: try finding by ID
    const { data: byId, error: idError } = await supabase
      .from('document_templates')
      .select('*')
      .eq('id', templateCode)
      .single();
    
    if (idError) {
      console.warn('Template not found by code or ID, falling back to default:', templateCode);
      return null;
    }
    return byId;
  }

  return data;
}

export async function getAllInvoiceTemplates() {
  const { data, error } = await supabase
    .from('document_templates')
    .select('*')
    .eq('document_type', 'Invoice')
    .eq('active', true)
    .order('template_name', { ascending: true });

  if (error) {
    console.error('Error fetching invoice templates:', error);
    return [];
  }

  return data || [];
}

export async function generateInvoicePDF(invoiceData, organisation, templateCode = null) {
  let template = null;

  if (templateCode) {
    template = await getInvoiceTemplate(templateCode);
  }

  if (!template) {
    template = await getInvoiceTemplate(null);
  }

  // Determine which generator to use based on template_code
  const templateKey = template?.template_code || template?.id;
  const generator = TEMPLATE_GENERATORS[templateKey] || generateInvoiceClassicGstV2;
  
  const templateSettings = {
    show_logo: template?.show_logo ?? true,
    show_bank_details: template?.show_bank_details ?? true,
    show_signature: template?.show_signature ?? true,
    show_remarks: true,
    show_po_no: template?.column_settings?.optional?.po_no ?? true,
    show_eway_bill: template?.column_settings?.optional?.eway_bill ?? true,
    column_settings: template?.column_settings
  };
  
  return generator(invoiceData, organisation, templateSettings);
}

export function numberToWords(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const scales = ['', 'Thousand', 'Lakh', 'Crore'];

  if (num === 0) return 'Zero';

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  let words = '';
  let scaleIndex = 0;

  let n = integerPart;
  while (n > 0) {
    let part = n % 1000;
    if (part > 0) {
      let partWords = '';
      
      if (part >= 100) {
        partWords += ones[Math.floor(part / 100)] + ' Hundred ';
        part = part % 100;
      }
      
      if (part >= 20) {
        partWords += tens[Math.floor(part / 10)] + ' ';
        if (part % 10 > 0) {
          partWords += ones[part % 10] + ' ';
        }
      } else if (part > 0) {
        partWords += ones[part] + ' ';
      }
      
      words = partWords + scales[scaleIndex] + ' ' + words;
    }
    
    n = Math.floor(n / 1000);
    scaleIndex++;
  }

  words = words.trim();

  if (decimalPart > 0) {
    words += ` and ${decimalPart}/100`;
  }

  return words || 'Zero';
}
