/**
 * Example data structure for the HTML quotation template
 * This shows how to structure your data when calling renderTemplateToPdf
 */

export const quotationTemplateData = {
  // Document metadata
  document_type: 'QUOTATION',
  quotation_no: 'QT-2026-0042',
  revision_no: '00',
  date: '14-04-2026',
  valid_till: '14-05-2026',
  remarks: 'Against your enquiry dated 10-04-2026',
  payment_terms: '50% Advance, Balance within 30 days',
  
  // Organisation details
  organisation_name: 'Your Company Name Pvt. Ltd.',
  organisation_address: '123, Industrial Area, Phase-II, Chandigarh – 160002',
  organisation_phone: '+91 98765 43210',
  organisation_email: 'info@yourcompany.com',
  organisation_gstin: '04XXXXXX1234XXXX',
  organisation_cin: 'U52100CH2020PTC123456',
  organisation_pan: 'AAAAA1234A',
  organisation_ie_code: 'XXXXXXX',
  
  // Client details
  client_name: 'Client Company Name',
  client_contact_person: 'Mr. Rajesh Kumar',
  client_address: '456, Trade Centre, Sector 17, Chandigarh – 160017',
  client_city: 'Chandigarh',
  client_pincode: '160017',
  client_gstin: '04YYYYYY1234YYYY',
  client_phone: '+91 98765 11111',
  
  // Shipping details
  shipping_company_name: 'Client Company Name – Warehouse',
  shipping_address: 'Plot No. 78, Industrial Focal Point, Derabassi, Punjab – 140507',
  shipping_city: 'Derabassi',
  shipping_pincode: '140507',
  shipping_phone: '+91 98765 22222',
  
  // Items array (will be looped in template)
  items: [
    {
      index: 1,
      hsn: '8471',
      description: 'Desktop Computer – Intel Core i5, 8GB RAM, 512GB SSD, 22" LED Monitor, KB & Mouse',
      qty: '5',
      uom: 'Nos',
      rate: '42,500.00',
      gst_percent: '18%',
      amount: '2,12,500.00'
    },
    {
      index: 2,
      hsn: '8471',
      description: 'UPS – 1KVA Online UPS with 30 min Battery Backup',
      qty: '5',
      uom: 'Nos',
      rate: '14,200.00',
      gst_percent: '18%',
      amount: '71,000.00'
    },
    {
      index: 3,
      hsn: '8528',
      description: 'Network Switch – 24 Port Gigabit Managed Switch (Cisco Compatible)',
      qty: '2',
      uom: 'Nos',
      rate: '18,500.00',
      gst_percent: '18%',
      amount: '37,000.00'
    },
    {
      index: 4,
      hsn: '8473',
      description: 'Laser Printer – HP LaserJet Pro MFP (Monochrome, Duplex, Network)',
      qty: '2',
      uom: 'Nos',
      rate: '22,000.00',
      gst_percent: '18%',
      amount: '44,000.00'
    },
    {
      index: 5,
      hsn: '8471',
      description: 'Software License – Windows 11 Pro OEM (FPP) + MS Office 2021 ProPlus',
      qty: '5',
      uom: 'Lic',
      rate: '8,500.00',
      gst_percent: '18%',
      amount: '42,500.00'
    },
    {
      index: 6,
      hsn: '7323',
      description: 'Installation, Configuration & AMC Support Charges (Year 1)',
      qty: '1',
      uom: 'Lot',
      rate: '25,000.00',
      gst_percent: '18%',
      amount: '25,000.00'
    }
  ],
  
  // Totals
  subtotal: '4,32,000.00',
  cgst_amount: '38,880.00',
  sgst_amount: '38,880.00',
  round_off: '–40.00',
  grand_total: '5,09,720.00',
  amount_in_words: 'Rupees Five Lakh Nine Thousand Seven Hundred Twenty Only.',
  
  // Bank details
  bank_name: 'HDFC Bank Ltd.',
  bank_branch: 'Sector 17, Chandigarh',
  bank_account_no: '50100012345678',
  bank_account_type: 'Current A/c',
  bank_ifsc: 'HDFC0001234',
  bank_micr: '160240013',
  bank_swift: 'HDFCINBB',
  bank_upi: 'yourcompany@hdfc',
  
  // Signatory
  signatory_designation: 'Director / Manager',
  
  // Terms & conditions
  terms_conditions: `1. Prices are EXW Chandigarh.<br>
    2. Delivery: Within 15 days of PO.<br>
    3. Insurance: Buyer to arrange.<br>
    4. Warranty: 1 year on-site.<br>
    5. Tax deducted at source as applicable.`
};

/**
 * Usage example:
 * 
 * import { renderTemplateToPdf } from '../utils/htmlTemplateRenderer';
 * import template from './templates/quotation-template.html?raw';
 * import { quotationTemplateData } from './templates/quotation-data-example';
 * 
 * // Render and download PDF
 * await renderTemplateToPdf(template, quotationTemplateData, 'quotation.pdf');
 */
