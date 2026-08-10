import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import DOMPurify from 'dompurify';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/logger';

import { SettingSection } from '../components/SettingSection';
import { SettingRow } from '../components/SettingRow';
import { SettingInput } from '../components/SettingInput';
import { SettingSelect } from '../components/SettingSelect';
import { SettingToggle } from '../components/SettingToggle';

export interface TemplatesTabProps {
  onDirtyChange: (isDirty: boolean) => void;
  onRegisterSave: (saveFn: () => Promise<void>, discardFn: () => void) => void;
}

const DOCUMENT_TYPES = ['Quotation', 'Sales Order', 'Proforma Invoice', 'Delivery Challan', 'Invoice', 'Tools Delivery Challan', 'Credit Note', 'Debit Note'];
const PAGE_SIZES = ['A4', 'Letter'];
const ORIENTATIONS = ['Portrait', 'Landscape'];

const OPTIONAL_COLUMNS = [
  { key: 'sno', label: 'S.No.', isMandatory: true },
  { key: 'item', label: 'Tool Name' },
  { key: 'qty', label: 'Qty', isMandatory: true },
  { key: 'uom', label: 'Unit (UOM)' },
  { key: 'item_code', label: 'Tool Code' },
  { key: 'variant', label: 'Discount Category' },
  { key: 'description', label: 'Description' },
  { key: 'client_part_no', label: 'Client Part No' },
  { key: 'client_description', label: 'Client Description' },
  { key: 'hsn_code', label: 'HSN Code' },
  { key: 'rate', label: 'Rate(before disc)' },
  { key: 'base_amount', label: 'Amount', isMandatory: true },
  { key: 'discount_percent', label: 'Disc %' },
  { key: 'discount_amount', label: 'Discount Amount' },
  { key: 'rate_after_discount', label: 'Rate(after discount)' },
  { key: 'tax_percent', label: 'GST %', isMandatory: true },
  { key: 'tax_amount', label: 'Tax Amount' },
  { key: 'line_total', label: 'Final Total' },
  { key: 'category', label: 'Category' },
  { key: 'make', label: 'Make (Tool Source)' },
  { key: 'custom1', label: 'Custom 1' },
  { key: 'custom2', label: 'Custom 2' },
  { key: 'subtotal', label: 'Sub-Total' },
  { key: 'total_tax', label: 'Total Tax' },
  { key: 'round_off', label: 'Round Off' },
  { key: 'grand_total', label: 'Grand Total' },
  { key: 'po_no', label: 'PO No' },
  { key: 'po_date', label: 'PO Date' },
  { key: 'vendor_no', label: 'Vendor No.' },
  { key: 'valid_till', label: 'Valid Till' },
  { key: 'payment_terms', label: 'Payment Terms' },
  { key: 'reference', label: 'Reference' },
  { key: 'eway_bill', label: 'E-Way Bill' },
  { key: 'bill_to', label: 'Billing Details' },
  { key: 'ship_to', label: 'Shipping Details' },
  { key: 'project_name', label: 'Project Name' },
  { key: 'prepared_by', label: 'Prepared By' }
];

const BUILT_IN_TEMPLATES = [
  { template_name: 'Standard Template (Quotation)', template_code: 'STD_QTN', document_type: 'Quotation', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'standard' } } },
  { template_name: 'Standard Template (Invoice)', template_code: 'STD_INV', document_type: 'Invoice', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'standard' } } },
  { template_name: 'Standard Template (Delivery Challan)', template_code: 'STD_DC', document_type: 'Delivery Challan', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'standard' } } },
  { template_name: 'Classic Template (Delivery Challan)', template_code: 'DC_CLASSIC', document_type: 'Delivery Challan', is_default: true, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'classic' } } },
  { template_name: 'Zoho Template (Delivery Challan)', template_code: 'DC_ZOHO', document_type: 'Delivery Challan', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'default' } } },
  { template_name: 'Standard Template (Proforma Invoice)', template_code: 'STD_PRO', document_type: 'Proforma Invoice', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'standard' } } },
  { template_name: 'Zoho Template', template_code: 'QTN_ZOHO', document_type: 'Quotation', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'default' } } },
  { template_name: 'Classic Quotation Template', template_code: 'QTN_CLASSIC', document_type: 'Quotation', is_default: true, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: false, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'default' } } },
  { template_name: 'SAAS Template (Quotation)', template_code: 'SAAS_QTN', document_type: 'Quotation', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'saas' } } },
  { template_name: 'SAAS Template (Invoice)', template_code: 'SAAS_INV', document_type: 'Invoice', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'saas' } } },
  { template_name: 'SAAS Template (DC)', template_code: 'SAAS_DC', document_type: 'Delivery Challan', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'saas' } } },
  { template_name: 'SAAS Template (Proforma)', template_code: 'SAAS_PRO', document_type: 'Proforma Invoice', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'saas' } } },
  { template_name: 'Tally Template', template_code: 'QTN_TALLY', document_type: 'Quotation', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: false, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'default' } } },
  { template_name: 'Professional Template', template_code: 'QTN_PROFESSIONAL', document_type: 'Quotation', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'default' } } },
  { template_name: 'Grid Pro Template', template_code: 'QTN_GRID_PRO', document_type: 'Quotation', is_default: false, page_size: 'A4', orientation: 'Landscape', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'pro_grid' } } },
  { template_name: 'Grid Minimal Template', template_code: 'GRID_MINIMAL', document_type: 'Quotation', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'grid_minimal', gridMinimal: { titleOverride: 'QUOTATION', columns: { hsn: true, make: true, unit: true, discPct: true, gst: true } } } } },
  { template_name: 'Grid Minimal Invoice', template_code: 'GRID_MINIMAL_INV', document_type: 'Invoice', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'grid_minimal', gridMinimal: { titleOverride: 'TAX INVOICE', columns: { hsn: true, make: true, unit: true, discPct: true, gst: true } } } } },
  { template_name: 'Pro Grid Invoice', template_code: 'PRO_GRID_INV', document_type: 'Invoice', is_default: false, page_size: 'A4', orientation: 'Landscape', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'pro_grid' } } },
  { template_name: 'Vertical Template (Quotation)', template_code: 'QTN_VERTICAL', document_type: 'Quotation', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'vertical' } } },
  { template_name: 'Vertical Template (Proforma Invoice)', template_code: 'PI_VERTICAL', document_type: 'Proforma Invoice', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'vertical' } } },
  { template_name: 'Vertical Template (Delivery Challan)', template_code: 'DC_VERTICAL', document_type: 'Delivery Challan', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'vertical' } } },
  { template_name: 'Vertical Template (Invoice)', template_code: 'INV_VERTICAL', document_type: 'Invoice', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'vertical' } } },
  { template_name: 'Vertical Template (Tools Delivery Challan)', template_code: 'TDC_VERTICAL', document_type: 'Tools Delivery Challan', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'vertical' } } },
  { template_name: 'Vertical Template (Credit Note)', template_code: 'CN_VERTICAL', document_type: 'Credit Note', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'vertical' } } },
  { template_name: 'Vertical Template (Debit Note)', template_code: 'DN_VERTICAL', document_type: 'Debit Note', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'vertical' } } },
  { template_name: 'Enterprise Template (Premium PDF)', template_code: 'QTN_ENTERPRISE', document_type: 'Quotation', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'enterprise' } } },
  { template_name: 'Sakthi Style (Quotation)', template_code: 'QTN_SAKTHI', document_type: 'Quotation', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: false, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'sakthi' } } },
  { template_name: 'Sakthi Style (Invoice)', template_code: 'INV_SAKTHI', document_type: 'Invoice', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: false, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'sakthi' } } },
  { template_name: 'Sakthi Style (Proforma Invoice)', template_code: 'PI_SAKTHI', document_type: 'Proforma Invoice', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: false, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'sakthi' } } },
  { template_name: 'Sakthi Style (Delivery Challan)', template_code: 'DC_SAKTHI', document_type: 'Delivery Challan', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: false, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'sakthi' } } },
  { template_name: 'Sakthi Style (Credit Note)', template_code: 'CN_SAKTHI', document_type: 'Credit Note', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: false, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'sakthi' } } },
  { template_name: 'Sakthi Style (Debit Note)', template_code: 'DN_SAKTHI', document_type: 'Debit Note', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: false, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'sakthi' } } },
];

const EMPTY_FORM = {
  template_name: '',
  template_code: '',
  document_type: 'Quotation' as const,
  is_default: false,
  page_size: 'A4',
  orientation: 'Portrait',
  show_logo: true,
  show_bank_details: true,
  show_terms: true,
  show_signature: true,
  show_msme: false,
  column_settings: {
    mandatory: [] as string[],
    optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false },
    labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' },
    print: { style: 'default' as const, gridMinimal: { titleOverride: '', columns: { hsn: true, make: true, unit: true, discPct: true, gst: true } } }
  }
};

export const TemplatesTab: React.FC<TemplatesTabProps> = ({
  onDirtyChange,
  onRegisterSave,
}) => {
  const { organisation } = useAuth();
  const orgId = organisation?.id;

  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [styleFilter, setStyleFilter] = useState<'all' | 'default' | 'grid_minimal' | 'saas' | 'pro_grid' | 'vertical' | 'enterprise'>('all');

  const [showForm, setShowForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [originalFormData, setOriginalFormData] = useState<any>(null);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      let dbTemplates: any[] = [];
      if (orgId) {
        const { data, error } = await supabase
          .from('document_templates')
          .select('*')
          .eq('organisation_id', orgId)
          .order('document_type', { ascending: true })
          .order('template_name', { ascending: true });
        if (error) throw error;
        dbTemplates = data || [];
        if (dbTemplates.length === 0) {
          await seedBuiltInTemplates();
          const { data: seededData } = await supabase
            .from('document_templates')
            .select('*')
            .eq('organisation_id', orgId)
            .order('document_type', { ascending: true })
            .order('template_name', { ascending: true });
          dbTemplates = seededData || [];
        }
      }
      setTemplates(dbTemplates);
    } catch (err: any) {
      console.error('Error loading templates:', err);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const seedBuiltInTemplates = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      for (const template of BUILT_IN_TEMPLATES) {
        const { data: existing } = await supabase
          .from('document_templates')
          .select('id')
          .eq('template_code', template.template_code)
          .eq('document_type', template.document_type)
          .eq('organisation_id', orgId)
          .single();
        if (!existing) {
          await supabase.from('document_templates').insert({ ...template, organisation_id: orgId });
        }
      }
      setSuccessMessage('Built-in templates added successfully!');
      await loadTemplates();
    } catch (err: any) {
      console.error('Error seeding templates:', err);
      toast.error('Error seeding templates: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const buildDefaultNewData = (preset?: 'grid_minimal' | 'vertical') => {
    const isGridMinimal = preset === 'grid_minimal';
    const isVertical = preset === 'vertical';
    return {
      ...EMPTY_FORM,
      template_name: isGridMinimal ? 'Grid Minimal Template' : isVertical ? 'Vertical Template' : '',
      template_code: isGridMinimal ? 'GRID_MIN' : isVertical ? 'VERTICAL_NEW' : '',
      column_settings: {
        ...EMPTY_FORM.column_settings,
        print: { style: isGridMinimal ? 'grid_minimal' : isVertical ? 'vertical' : 'default', gridMinimal: { titleOverride: '', columns: { hsn: true, make: true, unit: true, discPct: true, gst: true } } }
      }
    };
  };

  const openForm = (data: any) => {
    setOriginalFormData(data);
    setFormData(data);
    setShowForm(true);
    setShowPreview(false);
  };

  const closeForm = () => {
    setShowForm(false);
    setOriginalFormData(null);
    setShowPreview(false);
  };

  const handleEdit = (template: any) => {
    setSelectedTemplate(template);
    const data = {
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
      show_msme: template.show_msme || false,
      column_settings: {
        mandatory: [],
        optional: template.column_settings?.optional || { ...EMPTY_FORM.column_settings.optional, brand: false },
        labels: template.column_settings?.labels || { ...EMPTY_FORM.column_settings.labels },
        print: template.column_settings?.print || { style: 'default', gridMinimal: { titleOverride: '', columns: { hsn: true, make: true, unit: true, discPct: true, gst: true } } }
      }
    };
    openForm(data);
  };

  const handleNew = (preset?: 'grid_minimal' | 'vertical') => {
    setSelectedTemplate(null);
    openForm(buildDefaultNewData(preset));
  };

  const handleColumnToggle = (columnKey: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      column_settings: {
        ...prev.column_settings,
        optional: { ...prev.column_settings.optional, [columnKey]: checked }
      }
    }));
  };

  const handleLabelChange = (columnKey: string, label: string) => {
    setFormData(prev => ({
      ...prev,
      column_settings: {
        ...prev.column_settings,
        labels: { ...prev.column_settings.labels, [columnKey]: label }
      }
    }));
  };

  const handleHeaderLabelChange = (fieldKey: string, label: string) => {
    setFormData(prev => ({
      ...prev,
      column_settings: {
        ...prev.column_settings,
        header_labels: { ...(prev.column_settings?.header_labels || {}), [fieldKey]: label }
      }
    }));
  };

  const handlePrintStyleChange = (style: string) => {
    setFormData(prev => ({
      ...prev,
      column_settings: {
        ...prev.column_settings,
        print: { ...(prev.column_settings?.print || {}), style }
      }
    }));
  };

  const handleGridMinimalColumnToggle = (key: string, checked: boolean) => {
    setFormData(prev => {
      const prevPrint = prev.column_settings?.print || {};
      const prevGrid = prevPrint.gridMinimal || {};
      const prevCols = prevGrid.columns || {};
      return {
        ...prev,
        column_settings: {
          ...prev.column_settings,
          print: {
            ...prevPrint,
            gridMinimal: {
              ...prevGrid,
              columns: { ...prevCols, [key]: checked }
            }
          }
        }
      };
    });
  };

  const handleGridMinimalTitleOverride = (value: string) => {
    setFormData(prev => {
      const prevPrint = prev.column_settings?.print || {};
      const prevGrid = prevPrint.gridMinimal || {};
      return {
        ...prev,
        column_settings: {
          ...prev.column_settings,
          print: {
            ...prevPrint,
            gridMinimal: { ...prevGrid, titleOverride: value }
          }
        }
      };
    });
  };

  const generatePreviewHTML = () => {
    const colSettings = formData.column_settings || {};
    const optionalCols = colSettings.optional || {};
    const labels = colSettings.labels || {};
    let columnsHTML = '';
    if (optionalCols.sno) columnsHTML += '<th>#</th>';
    if (optionalCols.item_code) columnsHTML += '<th>Item Code / SKU</th>';
    if (optionalCols.hsn_code) columnsHTML += '<th>HSN/SAC</th>';
    if (optionalCols.item) columnsHTML += `<th>${labels.item || 'Item Description'}</th>`;
    if (optionalCols.variant) columnsHTML += '<th>Discount Category</th>';
    if (optionalCols.description) columnsHTML += '<th>Description</th>';
    if (optionalCols.client_part_no) columnsHTML += '<th>Client Part No</th>';
    if (optionalCols.client_description) columnsHTML += '<th>Client Description</th>';
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
      if (optionalCols.item_code) rowHTML += '<td>P-101</td>';
      if (optionalCols.hsn_code) rowHTML += '<td>7306</td>';
      if (optionalCols.item) rowHTML += `<td>${item.item}</td>`;
      if (optionalCols.variant) rowHTML += '<td>Standard</td>';
      if (optionalCols.description) rowHTML += `<td>${item.description}</td>`;
      if (optionalCols.client_part_no) rowHTML += '<td>C-PART-01</td>';
      if (optionalCols.client_description) rowHTML += '<td>Customer Spec Item</td>';
      if (optionalCols.qty) rowHTML += `<td style="text-align:right">${item.qty}</td>`;
      if (optionalCols.uom) rowHTML += `<td>${item.unit}</td>`;
      if (optionalCols.rate) rowHTML += `<td style="text-align:right">₹${item.rate.toFixed(2)}</td>`;
      if (optionalCols.discount_percent) rowHTML += `<td style="text-align:right">${item.discount}%</td>`;
      if (optionalCols.discount_amount) rowHTML += `<td style="text-align:right">₹${(item.rate * item.qty * item.discount / 100).toFixed(2)}</td>`;
      if (optionalCols.rate_after_discount) rowHTML += `<td style="text-align:right">₹${item.rate_after.toFixed(2)}</td>`;
      if (optionalCols.tax_percent) rowHTML += `<td style="text-align:right">${item.tax}%</td>`;
      if (optionalCols.tax_amount) rowHTML += `<td style="text-align:right">₹${(item.total - (item.rate_after * item.qty)).toFixed(2)}</td>`;
      if (optionalCols.category) rowHTML += '<td>Fittings</td>';
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
          <div style="line-height: 1.6;"><strong>To:</strong><br>Sample Client Name<br>123 Business Avenue, Tech Park<br>GSTIN: 27AAAAA0000A1Z5<br>State: Maharashtra</div>
          <div style="line-height: 1.6; text-align: right;"><strong>${formData.document_type} No:</strong> SAMPLE-001<br><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}<br><strong>Valid Till:</strong> ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN')}<br><strong>Project:</strong> Residential MEP Project</div>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead><tr style="background-color: #f3f4f6; color: #374151;">${columnsHTML.replace(/<th>/g, '<th style="border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 13px;">')}</tr></thead>
          <tbody style="font-size: 13px;">${rowsHTML.replace(/<td>/g, '<td style="border: 1px solid #ddd; padding: 10px;">')}</tbody>
        </table>
        <div style="float: right; width: 250px;">
          ${optionalCols.subtotal ? '<div style="display: flex; justify-content: space-between; padding: 5px 0;"><span>Subtotal</span><span>₹6,000.00</span></div>' : ''}
          <div style="display: flex; justify-content: space-between; padding: 5px 0;"><span>Discount</span><span>-₹500.00</span></div>
          ${optionalCols.total_tax ? '<div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee;"><span>Tax (GST)</span><span>₹930.00</span></div>' : ''}
          ${optionalCols.round_off ? '<div style="display: flex; justify-content: space-between; padding: 5px 0;"><span>Round Off</span><span>₹0.00</span></div>' : ''}
          ${optionalCols.grand_total ? `<div style="display: flex; justify-content: space-between; padding: 10px 0; font-weight: bold; font-size: 1.1em; border-top: 2px solid #374151;"><span>Grand Total</span><span>₹6,430.00</span></div>` : ''}
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
      toast.error('Template name is required');
      return;
    }
    if (formData.template_code && !/^[A-Z0-9_]+$/.test(formData.template_code)) {
      toast.error('Template code must contain only uppercase letters, numbers, and underscores');
      return;
    }
    setSaving(true);
    try {
      if (selectedTemplate && selectedTemplate.id) {
        const duplicateTemplate = templates.find(t => t.template_code === formData.template_code && t.id !== selectedTemplate.id);
        if (duplicateTemplate) {
          toast.error('Template code already exists. Please use a different code.');
          setSaving(false);
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
          .eq('organisation_id', orgId);
        if (error) throw error;
      } else {
        if (formData.template_code) {
          const duplicateTemplate = templates.find(t => t.template_code === formData.template_code);
          if (duplicateTemplate) {
            toast.error('Template code already exists. Please use a different code.');
            setSaving(false);
            return;
          }
        }
        if (formData.is_default) {
          await supabase
            .from('document_templates')
            .update({ is_default: false })
            .eq('document_type', formData.document_type)
            .eq('organisation_id', orgId);
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
            organisation_id: orgId
          });
        if (error) throw error;
      }
      setSuccessMessage('Template saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      setOriginalFormData(formData);
      await loadTemplates();
    } catch (err: any) {
      console.error('Error saving template:', err);
      toast.error('Error: ' + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = useCallback(() => {
    if (originalFormData) {
      setFormData(originalFormData);
    }
  }, [originalFormData]);

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await supabase.from('document_templates').delete().eq('id', templateId).eq('organisation_id', orgId);
      await loadTemplates();
    } catch (err: any) {
      console.error('Error deleting template:', err);
      toast.error('Error: ' + (err?.message || err));
    }
  };

  const handleClone = (template: any) => {
    const clonedData = {
      template_name: `${template.template_name} (Copy)`,
      template_code: '',
      document_type: template.document_type,
      is_default: false,
      page_size: template.page_size || 'A4',
      orientation: template.orientation || 'Portrait',
      show_logo: template.show_logo !== false,
      show_bank_details: template.show_bank_details !== false,
      show_terms: template.show_terms !== false,
      show_signature: template.show_signature !== false,
      column_settings: {
        ...template.column_settings,
        optional: { ...template.column_settings?.optional },
        labels: { ...template.column_settings?.labels },
        print: template.column_settings?.print ? { ...template.column_settings.print, gridMinimal: template.column_settings.print.gridMinimal ? { ...template.column_settings.print.gridMinimal } : undefined } : undefined
      }
    };
    setSelectedTemplate(null);
    openForm(clonedData);
  };

  const handleSetDefault = async (template: any) => {
    if (!orgId) {
      toast.error('Please select an organisation first');
      return;
    }
    try {
      let templateId = template.id;
      if (!templateId && template.template_code) {
        const { data: existing } = await supabase
          .from('document_templates')
          .select('id')
          .eq('template_code', template.template_code)
          .eq('document_type', template.document_type)
          .eq('organisation_id', orgId)
          .maybeSingle();
        if (existing) {
          templateId = existing.id;
        } else {
          const { data: inserted, error: insertError } = await supabase
            .from('document_templates')
            .insert({ ...template, organisation_id: orgId })
            .select('id')
            .single();
          if (insertError) {
            console.error('Error inserting template:', insertError);
            if (insertError.message?.includes('duplicate key') || insertError.code === '23505') {
              const { data: existingAfterError } = await supabase
                .from('document_templates')
                .select('id')
                .eq('template_code', template.template_code)
                .eq('document_type', template.document_type)
                .eq('organisation_id', orgId)
                .maybeSingle();
              if (existingAfterError) {
                templateId = existingAfterError.id;
              } else {
                toast.error('Error: Could not find template in database after duplicate key error');
                return;
              }
            } else {
              toast.error('Error: Could not seed template to database - ' + (insertError?.message || 'Unknown error'));
              return;
            }
          } else if (!inserted) {
            toast.error('Error: Could not seed template to database - No data returned');
            return;
          } else {
            templateId = inserted.id;
          }
        }
      }
      if (!templateId) {
        toast.error('Error: Template does not have a valid ID');
        return;
      }
      const { data: existingDefaults } = await supabase
        .from('document_templates')
        .select('id')
        .eq('document_type', template.document_type)
        .eq('is_default', true)
        .eq('organisation_id', orgId);
      for (const def of existingDefaults || []) {
        await supabase
          .from('document_templates')
          .update({ is_default: false })
          .eq('id', def.id)
          .eq('organisation_id', orgId);
      }
      await supabase
        .from('document_templates')
        .update({ is_default: true })
        .eq('id', templateId)
        .eq('organisation_id', orgId);
      await loadTemplates();
      setSuccessMessage('Default template updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error('Error setting default:', err);
      toast.error('Error: ' + (err?.message || err));
    }
  };

  const getDocumentTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      'Quotation': '📄', 'Sales Order': '📋', 'Proforma Invoice': '📑', 'Delivery Challan': '🚚',
      'Invoice': '💰', 'Tools Delivery Challan': '🔧', 'Credit Note': '📗', 'Debit Note': '📘'
    };
    return icons[type] || '📄';
  };

  const hasFormChanges = useMemo(() => {
    if (!showForm || !originalFormData) return false;
    return JSON.stringify(formData) !== JSON.stringify(originalFormData);
  }, [formData, originalFormData, showForm]);

  useEffect(() => {
    onDirtyChange(showForm ? hasFormChanges : false);
  }, [hasFormChanges, showForm, onDirtyChange]);

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  const handleDiscardRef = useRef(handleDiscard);
  handleDiscardRef.current = handleDiscard;

  useEffect(() => {
    onRegisterSave(
      async () => handleSaveRef.current(),
      () => handleDiscardRef.current()
    );
  }, [onRegisterSave]);

  useEffect(() => {
    loadTemplates();
  }, [orgId]);

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-sm text-zinc-500">Loading...</div>;
  }

  if (showForm) {
    return (
      <SettingSection title={selectedTemplate ? 'Edit Template' : 'Create Template'} description="">
        {successMessage && (
          <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">{successMessage}</div>
        )}
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SettingRow label="Template Name" description="">
              <SettingInput value={formData.template_name} onChange={(val) => setFormData(prev => ({ ...prev, template_name: val }))} placeholder="e.g., My Company Quotation" />
            </SettingRow>
            <SettingRow label="Template Code" description="">
              <SettingInput value={formData.template_code} onChange={(val) => setFormData(prev => ({ ...prev, template_code: val.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))} placeholder="e.g., INV_DEFAULT" />
            </SettingRow>
            <SettingRow label="Document Type" description="">
              <SettingSelect options={DOCUMENT_TYPES} value={formData.document_type} onChange={(val) => setFormData(prev => ({ ...prev, document_type: val }))} disabled={!!selectedTemplate} />
            </SettingRow>
            <SettingRow label="Page Size" description="">
              <SettingSelect options={PAGE_SIZES} value={formData.page_size} onChange={(val) => setFormData(prev => ({ ...prev, page_size: val }))} />
            </SettingRow>
            <SettingRow label="Orientation" description="">
              <SettingSelect options={ORIENTATIONS} value={formData.orientation} onChange={(val) => setFormData(prev => ({ ...prev, orientation: val }))} />
            </SettingRow>
            <SettingRow label="Set as Default" description={`Default for ${formData.document_type}`}>
              <SettingToggle checked={formData.is_default} onChange={(checked) => setFormData(prev => ({ ...prev, is_default: checked }))} />
            </SettingRow>
          </div>

          <SettingSection title="Print Settings" description="">
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-xs text-zinc-700">
                <input type="checkbox" checked={formData.show_logo} onChange={(e) => setFormData(prev => ({ ...prev, show_logo: e.target.checked }))} /> Show Company Logo
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-700">
                <input type="checkbox" checked={formData.show_bank_details} onChange={(e) => setFormData(prev => ({ ...prev, show_bank_details: e.target.checked }))} /> Show Bank Details
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-700">
                <input type="checkbox" checked={formData.show_terms} onChange={(e) => setFormData(prev => ({ ...prev, show_terms: e.target.checked }))} /> Show Terms & Conditions
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-700">
                <input type="checkbox" checked={formData.show_signature} onChange={(e) => setFormData(prev => ({ ...prev, show_signature: e.target.checked }))} /> Show Signature
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-700">
                <input type="checkbox" checked={formData.show_msme} onChange={(e) => setFormData(prev => ({ ...prev, show_msme: e.target.checked }))} /> Show MSME Details
              </label>
            </div>
          </SettingSection>

          <SettingSection title="Column & Field Settings" description="">
            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold text-zinc-600 mb-2">Edit Document Header Labels</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-md border border-zinc-200 bg-zinc-50/50 p-4">
                  {[
                    { key: 'document_no', label: 'Document No Label' },
                    { key: 'document_date', label: 'Date Label' },
                    { key: 'po_no', label: 'PO No / Ref No Label' },
                    { key: 'po_date', label: 'PO Date / Ref Date Label' },
                    { key: 'remarks', label: 'Remarks Label' },
                    { key: 'eway_bill', label: 'E-Way Bill Label' }
                  ].map(field => (
                    <SettingRow key={field.key} label={field.label} description="">
                      <SettingInput value={formData.column_settings?.header_labels?.[field.key] || ''} onChange={(val) => handleHeaderLabelChange(field.key, val)} placeholder="Leave blank for default" />
                    </SettingRow>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-zinc-600 mb-2">PDF Template Style</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-md border border-zinc-200 bg-zinc-50/50 p-4">
                  <SettingRow label="Style" description="">
                    <SettingSelect
                      options={['default', 'grid_minimal', 'saas', 'vertical', 'sakthi']}
                      value={formData.column_settings?.print?.style || 'default'}
                      onChange={(val) => handlePrintStyleChange(val)}
                    />
                  </SettingRow>
                  {formData.column_settings?.print?.style === 'grid_minimal' && (
                    <>
                      <SettingRow label="Title Override" description="">
                        <SettingInput value={formData.column_settings?.print?.gridMinimal?.titleOverride || ''} onChange={(val) => handleGridMinimalTitleOverride(val)} placeholder="e.g. TAX INVOICE" />
                      </SettingRow>
                      <SettingRow label="Grid Columns" description="">
                        <div className="flex flex-wrap gap-3 text-xs">
                          {['hsn', 'make', 'unit', 'discPct', 'gst'].map((col) => (
                            <label key={col} className="flex items-center gap-1">
                              <input type="checkbox" checked={formData.column_settings?.print?.gridMinimal?.columns?.[col] !== false} onChange={(e) => handleGridMinimalColumnToggle(col, e.target.checked)} /> {col.toUpperCase()}
                            </label>
                          ))}
                        </div>
                      </SettingRow>
                    </>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-zinc-600 mb-2">Select fields to show on document</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {OPTIONAL_COLUMNS.map(col => {
                    const checked = col.isMandatory || formData.column_settings?.optional?.[col.key] || false;
                    return (
                      <div key={col.key} className={`flex flex-col gap-2 rounded-md border p-2 ${checked ? 'border-[#185FA5] bg-blue-50' : 'border-zinc-200 bg-white'}`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs ${col.isMandatory ? 'font-bold text-zinc-900' : 'font-medium text-zinc-700'}`}>
                            {col.label} {col.isMandatory && <span className="text-red-500 text-[10px]">*</span>}
                          </span>
                          <SettingToggle
                            checked={checked}
                            onChange={(newChecked) => !col.isMandatory && handleColumnToggle(col.key, newChecked)}
                            disabled={col.isMandatory}
                          />
                        </div>
                        {(col.key === 'item' || col.key === 'custom1' || col.key === 'custom2' || col.key === 'rate_after_discount') && (
                          <SettingInput value={formData.column_settings?.labels?.[col.key] || ''} onChange={(val) => handleLabelChange(col.key, val)} placeholder="Rename column..." />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </SettingSection>

          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={closeForm}>Cancel</Button>
            <Button variant="secondary" onClick={() => setShowPreview(true)}>Preview Format</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Template'}</Button>
          </div>

          {showPreview && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowPreview(false)}>
              <div className="w-[95%] max-w-[900px] max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
                  <h3 className="text-sm font-semibold text-zinc-900">Template Preview</h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowPreview(false)}>✕</Button>
                </div>
                <div className="p-6" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(generatePreviewHTML()) }} />
                <div className="border-t border-zinc-200 px-4 py-3 flex justify-end">
                  <Button onClick={() => setShowPreview(false)}>Close Preview</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </SettingSection>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-zinc-900">Document Templates</h2>
          <p className="text-xs text-zinc-500 mt-1">Manage PDF templates, layout columns, and labels for every document type.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={seedBuiltInTemplates} disabled={loading}>Restore Defaults</Button>
          <Button variant="secondary" onClick={() => handleNew('vertical')}>+ Vertical</Button>
          <Button variant="secondary" onClick={() => handleNew('grid_minimal')}>+ Grid Minimal</Button>
          <Button onClick={() => handleNew()}>+ Create Template</Button>
        </div>
      </div>

      {successMessage && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">{successMessage}</div>
      )}

      <div className="flex items-center gap-2 overflow-x-auto">
        <span className="text-xs text-zinc-500">Filter by Style:</span>
        {[
          { value: 'all', label: 'All' },
          { value: 'default', label: 'Default' },
          { value: 'grid_minimal', label: 'Grid Minimal' },
          { value: 'saas', label: 'SAAS' },
          { value: 'pro_grid', label: 'Pro Grid' },
          { value: 'vertical', label: 'Vertical' },
          { value: 'enterprise', label: 'Enterprise' },
        ].map(filter => (
          <button
            key={filter.value}
            onClick={() => setStyleFilter(filter.value as any)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${styleFilter === filter.value ? 'border-[#185FA5] bg-[#185FA5] text-white' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'}`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <SettingSection title="Template Library" description={`${templates.length} template(s) configured`}>
        {templates.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500">
            <p className="font-semibold text-zinc-900 mb-1">No Templates</p>
            <p>Create your first template to get started</p>
          </div>
        ) : (
          <div className="space-y-6">
            {DOCUMENT_TYPES.map(docType => {
              const typeTemplates = templates.filter(t => {
                if (t.document_type !== docType) return false;
                if (styleFilter === 'all') return true;
                return (t.column_settings?.print?.style || 'default') === styleFilter;
              });
              if (typeTemplates.length === 0) return null;
              return (
                <div key={docType}>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-zinc-900">
                    <span>{getDocumentTypeIcon(docType)}</span>
                    <span>{docType}</span>
                  </h3>
                  <div className="space-y-2">
                    {typeTemplates.map(template => (
                      <div key={template.id || template.template_code} className={`flex items-center justify-between rounded-lg border p-4 ${template.is_default ? 'border-emerald-200 bg-emerald-50' : 'border-zinc-200 bg-zinc-50/50'}`}>
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                            {template.template_name}
                            {template.is_default && <span className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-white">DEFAULT</span>}
                            {template.column_settings?.print?.style === 'grid_minimal' && <span className="rounded bg-purple-600 px-2 py-0.5 text-[10px] font-medium text-white">GRID MINIMAL</span>}
                            {template.column_settings?.print?.style === 'pro_grid' && <span className="rounded bg-orange-600 px-2 py-0.5 text-[10px] font-medium text-white">PRO GRID</span>}
                            {template.column_settings?.print?.style === 'saas' && <span className="rounded bg-blue-700 px-2 py-0.5 text-[10px] font-medium text-white">SAAS</span>}
                            {template.column_settings?.print?.style === 'vertical' && <span className="rounded bg-blue-900 px-2 py-0.5 text-[10px] font-medium text-white">VERTICAL</span>}
                            {template.column_settings?.print?.style === 'enterprise' && <span className="rounded bg-[#2C3E50] px-2 py-0.5 text-[10px] font-medium text-white">ENTERPRISE</span>}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
                            {template.template_code && <span className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 font-mono">{template.template_code}</span>}
                            {template.page_size} | {template.orientation} |
                            {template.show_logo && ' Logo'}{template.show_bank_details && ' | Bank'}{template.show_terms && ' | Terms'}{template.show_signature && ' | Signature'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!template.is_default && (
                            <Button variant="secondary" size="sm" onClick={() => handleSetDefault(template)}>Set Default</Button>
                          )}
                          <Button variant="secondary" size="sm" onClick={() => handleClone(template)} title="Create a copy of this template">Clone</Button>
                          <Button variant="secondary" size="sm" onClick={() => handleEdit(template)}>Edit</Button>
                          <Button variant="secondary" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(template.id)}>Delete</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SettingSection>
    </div>
  );
};
