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

const DOCUMENT_TYPES = ['Quotation', 'Sales Order', 'Proforma Invoice', 'Delivery Challan', 'Invoice', 'Tools Delivery Challan', 'Credit Note', 'Debit Note', 'Purchase Order'];
const PAGE_SIZES = ['A4', 'Letter'];
const ORIENTATIONS = ['Portrait', 'Landscape'];

const OPTIONAL_COLUMNS: Array<{ key: string; label: string; isMandatory?: boolean; align?: 'left' | 'right' | 'center'; }> = [
  { key: 'sno', label: 'S.No.', isMandatory: true, align: 'center' },
  { key: 'item', label: 'Tool Name' },
  { key: 'qty', label: 'Qty', isMandatory: true, align: 'right' },
  { key: 'uom', label: 'Unit (UOM)', align: 'center' },
  { key: 'item_code', label: 'Tool Code' },
  { key: 'variant', label: 'Variant' },
  { key: 'description', label: 'Description' },
  { key: 'client_part_no', label: 'Client Part No' },
  { key: 'client_description', label: 'Client Description' },
  { key: 'hsn_code', label: 'HSN Code', align: 'center' },
  { key: 'rate', label: 'Rate(before disc)', align: 'right' },
  { key: 'base_amount', label: 'Amount', isMandatory: true, align: 'right' },
  { key: 'discount_percent', label: 'Disc %', align: 'right' },
  { key: 'discount_amount', label: 'Discount Amount', align: 'right' },
  { key: 'rate_after_discount', label: 'Rate(after discount)', align: 'right' },
  { key: 'tax_percent', label: 'GST %', isMandatory: true, align: 'center' },
  { key: 'tax_amount', label: 'Tax Amount', align: 'right' },
  { key: 'line_total', label: 'Final Total', align: 'right' },
  { key: 'category', label: 'Category' },
  { key: 'make', label: 'Make (Tool Source)' },
  { key: 'custom1', label: 'Custom 1' },
  { key: 'custom2', label: 'Custom 2' },
  { key: 'subtotal', label: 'Sub-Total', align: 'right' },
  { key: 'total_tax', label: 'Total Tax', align: 'right' },
  { key: 'round_off', label: 'Round Off', align: 'right' },
  { key: 'grand_total', label: 'Grand Total', align: 'right' },
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
  { template_name: 'Compact Style (Quotation)', template_code: 'QTN_COMPACT', document_type: 'Quotation', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: false, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'sakthi' } } },
  { template_name: 'Compact Style (Invoice)', template_code: 'INV_COMPACT', document_type: 'Invoice', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: false, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'sakthi' } } },
  { template_name: 'Compact Style (Proforma Invoice)', template_code: 'PI_COMPACT', document_type: 'Proforma Invoice', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: false, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'sakthi' } } },
  { template_name: 'Compact Style (Delivery Challan)', template_code: 'DC_COMPACT', document_type: 'Delivery Challan', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: false, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'sakthi' } } },
  { template_name: 'Compact Style (Credit Note)', template_code: 'CN_COMPACT', document_type: 'Credit Note', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: false, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'sakthi' } } },
  { template_name: 'Compact Style (Debit Note)', template_code: 'DN_COMPACT', document_type: 'Debit Note', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: false, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'sakthi' } } },
  { template_name: 'Enterprise Style (Purchase Order)', template_code: 'PO_ENTERPRISE', document_type: 'Purchase Order', is_default: true, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: true, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'enterprise' } } },
  { template_name: 'Sakthi Style (Purchase Order)', template_code: 'PO_SAKTHI', document_type: 'Purchase Order', is_default: false, page_size: 'A4', orientation: 'Portrait', show_logo: true, show_bank_details: true, show_terms: true, show_signature: false, column_settings: { mandatory: [], optional: { sno: true, item: true, qty: true, uom: true, item_code: true, variant: false, description: true, client_part_no: false, client_description: false, hsn_code: true, rate: true, discount_percent: true, discount_amount: false, rate_after_discount: true, tax_percent: true, tax_amount: false, line_total: true, category: false, make: true, custom1: false, custom2: false, subtotal: true, total_tax: true, round_off: true, grand_total: true, po_no: false, eway_bill: false }, labels: { custom1: 'Custom 1', custom2: 'Custom 2', rate_after_discount: 'Rate/Unit' }, print: { style: 'sakthi' } } },
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

const DOC_TYPE_GROUPS: { value: string; label: string; types: string[] }[] = [
  { value: 'all', label: 'All', types: DOCUMENT_TYPES },
  { value: 'quotations', label: 'Quotations', types: ['Quotation', 'Sales Order'] },
  { value: 'invoices', label: 'Invoices', types: ['Proforma Invoice', 'Invoice', 'Credit Note', 'Debit Note'] },
  { value: 'purchases', label: 'Purchases', types: ['Purchase Order', 'Delivery Challan', 'Tools Delivery Challan'] },
];

// Demo organisation + client used for the in-tab preview only. These match the
// sample dataset the PDF renderers fall back to when no real organisation is
// present (see apps/web/src/templates/quotation-data-example.ts and
// apps/web/src/pdf/sakthiTemplatePdf.ts).
const DEMO_ORG = {
  name: 'Your Company Name Pvt. Ltd.',
  address: '123, Industrial Area, Phase-II, Chandigarh – 160002',
  phone: '+91 98765 43210',
  email: 'info@yourcompany.com',
  gstin: '04XXXXXX1234XXXX',
  pan: 'AAAAA1234A',
  cin: 'U52100CH2020PTC123456',
  bankName: 'State Bank of India',
  bankBranch: 'Industrial Area Branch',
  bankAccountNo: 'XXXXXXXXXXXX',
  bankIfsc: 'SBIN0001234',
};

const DEMO_CLIENT = {
  name: 'Client Company Name',
  contact: 'Mr. Rajesh Kumar',
  address: '456, Trade Centre, Sector 17, Chandigarh – 160017',
  city: 'Chandigarh',
  pincode: '160017',
  gstin: '04YYYYYY1234YYYY',
  phone: '+91 98765 11111',
  shippingCompany: 'Client Company Name – Warehouse',
  shippingAddress: 'Plot No. 78, Industrial Focal Point, Derabassi, Punjab – 140507',
  shippingPhone: '+91 98765 22222',
};

const DEMO_PROJECT = {
  name: 'Residential MEP Project',
  poNo: 'PO-2026-0042',
};

// Items shown in the line-item tables. Matches the shape used by the real
// PDF renderers (HSN code, qty, rate, GST %, amount).
const DEMO_ITEMS = [
  { sno: 1, code: 'P-101', hsn: '8471', description: 'Desktop Computer — Intel Core i5, 8GB RAM, 512GB SSD, 22" LED Monitor', qty: 5, uom: 'Nos', rate: 42500, gst: 18, amount: 250750 },
  { sno: 2, code: 'P-102', hsn: '8471', description: 'Online UPS 1KVA with 30 min Battery Backup', qty: 5, uom: 'Nos', rate: 14200, gst: 18, amount: 83780 },
  { sno: 3, code: 'P-103', hsn: '8528', description: 'Network Switch — 24 Port Gigabit Managed (Cisco Compatible)', qty: 2, uom: 'Nos', rate: 18500, gst: 18, amount: 43660 },
  { sno: 4, code: 'P-104', hsn: '8473', description: 'HP LaserJet Pro MFP — Monochrome, Duplex, Network', qty: 2, uom: 'Nos', rate: 22000, gst: 18, amount: 51920 },
];

const inr = (n: number) => `\u20b9${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TERMS_TEXT = '50% advance, balance within 30 days. Goods once sold will not be taken back. Subject to Chandigarh jurisdiction. E. & O.E.';

const styleBadgeClass = (style?: string) => {
  switch ((style || '').toLowerCase()) {
    case 'grid_minimal': return 'bg-purple-600';
    case 'pro_grid': return 'bg-orange-600';
    case 'saas': return 'bg-blue-700';
    case 'vertical': return 'bg-blue-900';
    case 'enterprise': return 'bg-[#2C3E50]';
    case 'sakthi': return 'bg-teal-700';
    case 'classic': return 'bg-amber-700';
    case 'standard': return 'bg-blue-600';
    default: return 'bg-zinc-600';
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
  const [previewTemplate, setPreviewTemplate] = useState<any | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [originalFormData, setOriginalFormData] = useState<any>(null);
  const [docTypeFilter, setDocTypeFilter] = useState<string>('all');

  const filteredByGroup = useMemo(() => {
    if (docTypeFilter === 'all') return templates;
    const group = DOC_TYPE_GROUPS.find((g) => g.value === docTypeFilter);
    if (!group) return templates;
    return templates.filter((t) => group.types.includes(t.document_type));
  }, [templates, docTypeFilter]);

  const filteredByStyle = useMemo(() => {
    if (styleFilter === 'all') return filteredByGroup;
    return filteredByGroup.filter((t) => (t.column_settings?.print?.style || 'default') === styleFilter);
  }, [filteredByGroup, styleFilter]);

  const groupedTemplates = useMemo(() => {
    if (docTypeFilter === 'all') {
      return DOCUMENT_TYPES
        .map((docType) => ({
          docType,
          templates: filteredByStyle.filter((t) => t.document_type === docType),
        }))
        .filter((g) => g.templates.length > 0);
    }
    return [{ docType: 'Templates', templates: filteredByStyle }];
  }, [filteredByStyle, docTypeFilter]);

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
        } else {
          // Check if Purchase Order templates are present for this org
          const hasPOTemplates = dbTemplates.some(t => t.document_type === 'Purchase Order');
          if (!hasPOTemplates) {
            const poTemplates = BUILT_IN_TEMPLATES.filter(t => t.document_type === 'Purchase Order');
            for (const tpl of poTemplates) {
              const { data: existing } = await supabase
                .from('document_templates')
                .select('id')
                .eq('template_code', tpl.template_code)
                .eq('document_type', tpl.document_type)
                .eq('organisation_id', orgId)
                .maybeSingle();
              if (!existing) {
                await supabase.from('document_templates').insert({ ...tpl, organisation_id: orgId });
              }
            }
            const { data: refreshed } = await supabase
              .from('document_templates')
              .select('*')
              .eq('organisation_id', orgId)
              .order('document_type', { ascending: true })
              .order('template_name', { ascending: true });
            if (refreshed) dbTemplates = refreshed;
          }
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
          .maybeSingle();
        if (!existing) {
          await supabase.from('document_templates').insert({ ...template, organisation_id: orgId });
        }
      }
      setSuccessMessage('Built-in templates added successfully!');
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
    if (optionalCols.variant) columnsHTML += '<th>Variant</th>';
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
      <div style="font-family: 'Inter', sans-serif; padding: 20px; color: #333; max-width: 800px; margin: auto; border: 1px solid #eee; background: white;">
        <h2 style="text-align: center; color: #000; border-bottom: 2px solid #eee; padding-bottom: 10px;">${formData.document_type.toUpperCase()} PREVIEW</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; margin-top: 20px;">
          <div style="line-height: 1.6;"><strong>To:</strong><br>${DEMO_CLIENT.name}<br>${DEMO_CLIENT.contact}<br>${DEMO_CLIENT.address}<br>GSTIN: ${DEMO_CLIENT.gstin}<br>Ph: ${DEMO_CLIENT.phone}</div>
          <div style="line-height: 1.6; text-align: right;"><strong>${formData.document_type} No:</strong> QT-2026-0042<br><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}<br><strong>Valid Till:</strong> ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN')}<br><strong>Project:</strong> ${DEMO_PROJECT.name}</div>
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
          ${formData.show_signature ? `<div style="margin-top: 40px; text-align: right;"><strong>For ${DEMO_ORG.name}</strong><br><br><br>Authorized Signatory</div>` : ''}
        </div>
      </div>
    `;
  };

  const renderCardPreviewHTML = (template: any) => {
    const cs = template.column_settings || {};
    const opt = cs.optional || {};
    const labels = cs.labels || {};
    const style = (cs.print?.style || 'default').toLowerCase();
    const titleRaw = (cs.print?.gridMinimal?.titleOverride || template.document_type || '').toString();
    const docTitle = (titleRaw || 'Document').toUpperCase();
    const baseFont = "font-family: 'Inter', sans-serif;";
    const today = new Date().toLocaleDateString('en-IN');

    // Build the columns and rows once, then theme them per style.
    // Build the column list from OPTIONAL_COLUMNS so EVERY column the user has
    // configured (visible OR hidden) appears in the preview. Hidden columns are
    // rendered struck-through with a red "Hidden" badge so the user can audit
    // their toggle choices at a glance.
    type ColDef = {
      key: string;
      th: string;
      align: 'left' | 'right' | 'center';
      enabled: boolean;
      isMandatory: boolean;
      td: (item: typeof DEMO_ITEMS[number]) => string;
    };

    const colDefs: ColDef[] = OPTIONAL_COLUMNS.map((c) => {
      const isOn = c.isMandatory || (opt as Record<string, boolean | undefined>)[c.key] === true;
      let td: (item: typeof DEMO_ITEMS[number]) => string = () => '';
      switch (c.key) {
        case 'sno':              td = (i) => String(i.sno); break;
        case 'item':             td = (i) => i.description.split(' — ')[0]; break;
        case 'qty':              td = (i) => String(i.qty); break;
        case 'uom':              td = (i) => i.uom; break;
        case 'item_code':        td = (i) => i.code; break;
        case 'variant':          td = () => 'Standard'; break;
        case 'description':      td = (i) => i.description; break;
        case 'client_part_no':   td = (i) => `CP-${100 + i.sno}`; break;
        case 'client_description': td = (i) => i.description.split(' — ')[0] || '—'; break;
        case 'hsn_code':         td = (i) => i.hsn; break;
        case 'rate':             td = (i) => i.rate.toLocaleString('en-IN'); break;
        case 'base_amount':      td = (i) => (i.qty * i.rate).toLocaleString('en-IN'); break;
        case 'discount_percent': td = () => '0%'; break;
        case 'discount_amount':  td = () => '0'; break;
        case 'rate_after_discount': td = (i) => i.rate.toLocaleString('en-IN'); break;
        case 'tax_percent':      td = (i) => `${i.gst}%`; break;
        case 'tax_amount':       td = (i) => ((i.qty * i.rate * i.gst) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 }); break;
        case 'line_total':       td = (i) => i.amount.toLocaleString('en-IN'); break;
        case 'category':         td = () => 'Electronics'; break;
        case 'make':             td = () => 'HP / Cisco'; break;
        case 'custom1':          td = () => 'Warranty 1Y'; break;
        case 'custom2':          td = () => 'In Stock'; break;
        case 'subtotal':         td = () => ''; break; // totals — rendered separately
        case 'total_tax':        td = () => '';
        case 'round_off':        td = () => '';
        case 'grand_total':      td = () => '';
        case 'po_no':            td = () => DEMO_PROJECT.poNo; break;
        case 'po_date':          td = () => new Date().toLocaleDateString('en-IN'); break;
        case 'vendor_no':        td = () => 'VEN-042'; break;
        case 'valid_till':       td = () => new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-IN'); break;
        case 'payment_terms':    td = () => '50% Adv.'; break;
        case 'reference':        td = () => 'Ref-001'; break;
        case 'eway_bill':        td = () => '—'; break;
        case 'bill_to':          td = () => DEMO_CLIENT.name; break;
        case 'ship_to':          td = () => DEMO_CLIENT.shippingCompany; break;
        case 'project_name':     td = () => DEMO_PROJECT.name; break;
        case 'prepared_by':      td = () => 'Admin'; break;
      }
      return {
        key: c.key,
        th: c.label,
        align: c.align || 'left',
        enabled: isOn,
        isMandatory: !!c.isMandatory,
        td,
      };
    });

    const thCell = (c: ColDef) => {
      const hidden = !c.enabled;
      const base = `padding:6px 8px;text-align:${c.align};font-weight:600;`;
      const hiddenStyle = hidden
        ? `color:#DC2626;text-decoration:line-through;background:#FEF2F2;`
        : '';
      const tag = hidden ? ' <span style="font-size:7px;font-weight:700;color:#fff;background:#DC2626;padding:1px 3px;border-radius:2px;margin-left:2px;text-decoration:none;">Hidden</span>' : '';
      const mandatoryTag = c.isMandatory && !hidden ? ' <span style="color:#DC2626;font-size:8px;">*</span>' : '';
      return `<th style="${base}${hiddenStyle}">${c.th}${mandatoryTag}${tag}</th>`;
    };
    const tdCell = (c: ColDef, item: typeof DEMO_ITEMS[number]) => {
      if (['subtotal', 'total_tax', 'round_off', 'grand_total'].includes(c.key)) {
        // totals block handles these — leave cells empty so layout still reflects width
        return `<td style="padding:6px 8px;text-align:${c.align};background:${c.enabled ? 'transparent' : '#FEF2F2'};${c.enabled ? '' : 'color:#DC2626;text-decoration:line-through;'}"></td>`;
      }
      const hidden = !c.enabled;
      const hiddenStyle = hidden ? `color:#DC2626;text-decoration:line-through;background:#FEF2F2;` : '';
      return `<td style="padding:6px 8px;text-align:${c.align};${hiddenStyle}">${c.td(item)}</td>`;
    };
    const thead = `<tr>${colDefs.map(thCell).join('')}</tr>`;
    const rows = DEMO_ITEMS.map((item) => `<tr>${colDefs.map((c) => tdCell(c, item)).join('')}</tr>`).join('');

    const totalsBlock = (theme: 'standard' | 'card' | 'dark' | 'minimal' | 'bordered') => {
      if (!opt.subtotal && !opt.grand_total && !opt.total_tax) return '';
      // Compute real totals from DEMO_ITEMS so the preview reflects actual amounts.
      const subtotal = DEMO_ITEMS.reduce((sum, i) => sum + i.qty * i.rate, 0);
      const taxAmount = DEMO_ITEMS.reduce((sum, i) => sum + (i.qty * i.rate * i.gst) / 100, 0);
      const grandTotal = subtotal + taxAmount;
      const styles = {
        standard: { wrap: 'background:#F8FAFC;padding:8px;border-radius:6px;', line: 'padding:2px 0;color:#475569;', total: 'padding-top:6px;border-top:2px solid #185FA5;font-weight:700;color:#0F172A;' },
        card: { wrap: 'background:#fff;padding:8px;border:1px solid #E5E7EB;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.04);', line: 'padding:2px 0;color:#475569;', total: 'padding-top:6px;border-top:2px solid #185FA5;font-weight:700;color:#185FA5;' },
        dark: { wrap: 'background:#0F172A;color:#fff;padding:8px;border-radius:4px;', line: 'padding:2px 0;color:#CBD5E1;', total: 'padding-top:6px;border-top:1px solid #475569;font-weight:700;color:#fff;' },
        minimal: { wrap: 'padding:4px 0;', line: 'padding:2px 0;color:#6B7280;', total: 'padding-top:6px;font-weight:600;color:#0F172A;' },
        bordered: { wrap: 'border:1px solid #000;padding:6px;', line: 'padding:2px 0;border-bottom:1px dotted #999;', total: 'padding-top:4px;border-top:1px solid #000;font-weight:700;background:#f0f0f0;' },
      }[theme];
      return `
        <div style="display:flex;justify-content:flex-end;margin-top:8px;">
          <div style="width:170px;font-size:9px;${styles.wrap}">
            ${opt.subtotal ? `<div style="display:flex;justify-content:space-between;${styles.line}"><span>Subtotal</span><span>${inr(subtotal)}</span></div>` : ''}
            ${opt.total_tax ? `<div style="display:flex;justify-content:space-between;${styles.line}"><span>Tax (GST 18%)</span><span>${inr(taxAmount)}</span></div>` : ''}
            ${opt.round_off ? `<div style="display:flex;justify-content:space-between;${styles.line}"><span>Round Off</span><span>${inr(0)}</span></div>` : ''}
            ${opt.grand_total ? `<div style="display:flex;justify-content:space-between;${styles.total}"><span>Grand Total</span><span>${inr(grandTotal)}</span></div>` : ''}
          </div>
        </div>`;
    };

    switch (style) {
      case 'standard':
        return `
          <div style="${baseFont}color:#1f2937;padding:14px;background:#fff;min-height:380px;">
            <div style="border-bottom:3px solid #185FA5;padding-bottom:8px;display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
              <div>
                <div style="font-size:16px;font-weight:800;color:#0F172A;letter-spacing:-0.3px;">${DEMO_ORG.name}</div>
                <div style="font-size:8px;color:#64748B;margin-top:2px;line-height:1.3;">${DEMO_ORG.address}<br>Ph: ${DEMO_ORG.phone} · GSTIN: ${DEMO_ORG.gstin}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:14px;font-weight:700;color:#185FA5;letter-spacing:1.5px;">${docTitle}</div>
                <div style="font-size:8px;color:#64748B;margin-top:2px;">No: QT-2026-0042 · ${today}</div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;font-size:8px;">
              <div style="background:#F8FAFC;padding:8px;border-radius:6px;"><div style="font-size:7px;color:#185FA5;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:3px;">Bill To</div><div style="font-weight:600;">${DEMO_CLIENT.name}</div><div style="color:#475569;">${DEMO_CLIENT.contact}</div><div style="color:#475569;">${DEMO_CLIENT.address}</div><div style="color:#475569;">GSTIN: ${DEMO_CLIENT.gstin} · Ph: ${DEMO_CLIENT.phone}</div></div>
              <div style="background:#F8FAFC;padding:8px;border-radius:6px;text-align:right;"><div style="font-size:7px;color:#185FA5;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:3px;">Ship To</div><div style="font-weight:600;">${DEMO_CLIENT.shippingCompany}</div><div style="color:#475569;">${DEMO_CLIENT.shippingAddress}</div><div style="color:#475569;">Ph: ${DEMO_CLIENT.shippingPhone}</div></div>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:9px;">
              <thead style="background:#185FA5;color:#fff;">${thead}</thead>
              <tbody>${rows.replace(/<td/g, '<td style="padding:6px 8px;border-bottom:1px solid #E5E7EB;"')}</tbody>
            </table>
            ${totalsBlock('standard')}
            ${template.show_terms ? `<div style="margin-top:8px;padding-top:6px;border-top:1px dashed #E5E7EB;font-size:7px;color:#64748B;line-height:1.3;"><strong>Terms &amp; Conditions:</strong> 50% advance, balance within 30 days. Goods once sold will not be taken back. Subject to Chandigarh jurisdiction.</div>` : ''}
            ${template.show_signature ? `<div style="margin-top:10px;text-align:right;font-size:8px;color:#475569;">For <strong>${DEMO_ORG.name}</strong><br><br>Authorised Signatory</div>` : ''}
          </div>`;

      case 'classic':
        return `
          <div style="${baseFont}color:#000;padding:0;background:#fff;border:2px solid #000;min-height:380px;">
            <div style="background:#000;color:#fff;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-size:16px;font-weight:700;letter-spacing:1px;">${DEMO_ORG.name}</div>
                <div style="font-size:8px;opacity:0.85;">${DEMO_ORG.address}<br>Ph: ${DEMO_ORG.phone}</div>
              </div>
              <div style="font-size:18px;font-weight:800;letter-spacing:2px;">${docTitle}</div>
            </div>
            <div style="padding:10px 12px;display:grid;grid-template-columns:1fr 1fr;gap:8px;border-bottom:1px solid #000;font-size:9px;">
              <div><strong>BILL TO</strong><br>${DEMO_CLIENT.name}<br>${DEMO_CLIENT.contact}<br>${DEMO_CLIENT.address}</div>
              <div style="text-align:right;"><strong>DOC No:</strong> SAMPLE-001<br><strong>Date:</strong> ${today}</div>
            </div>
            <div style="padding:0 12px 10px;">
              <table style="width:100%;border-collapse:collapse;font-size:9px;">
                <thead><tr style="background:#000;color:#fff;">${thead}</tr></thead>
                <tbody>${rows.replace(/<td/g, '<td style="padding:5px 8px;border:1px solid #000;"').replace(/<tr>/g, '<tr style="border:1px solid #000;">')}</tbody>
              </table>
            </div>
            <div style="padding:0 12px 10px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <div style="border:1px solid #000;padding:6px;font-size:8px;"><strong>Amount in Words:</strong><br><em>Nine Thousand Four Hundred Forty only</em></div>
              <div>${totalsBlock('bordered')}</div>
            </div>
            <div style="border-top:1px solid #000;padding:6px 12px;display:flex;justify-content:space-between;font-size:8px;">
              <div>For ${DEMO_ORG.name}</div>
              <div>Authorised Signatory</div>
            </div>
          </div>`;

      case 'saas':
        return `
          <div style="${baseFont}color:#1E293B;padding:0;background:#fff;min-height:380px;">
            <div style="background:linear-gradient(135deg,#185FA5 0%,#2563EB 100%);color:#fff;padding:14px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                  <div style="font-size:9px;opacity:0.8;letter-spacing:1px;text-transform:uppercase;">From</div>
                  <div style="font-size:18px;font-weight:700;margin-top:2px;">${DEMO_ORG.name}</div>
                  <div style="font-size:9px;opacity:0.85;margin-top:1px;">hello@yourcompany.com</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:22px;font-weight:800;letter-spacing:1px;">${docTitle}</div>
                  <div style="font-size:9px;opacity:0.85;margin-top:2px;">#SAMPLE-001 · ${today}</div>
                </div>
              </div>
            </div>
            <div style="padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:9px;">
              <div style="border:1px solid #E2E8F0;border-radius:8px;padding:8px;"><div style="font-size:8px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;">Billed To</div><div style="font-weight:600;margin-top:2px;">${DEMO_CLIENT.name}</div><div style="color:#475569;">${DEMO_CLIENT.address}</div></div>
              <div style="border:1px solid #E2E8F0;border-radius:8px;padding:8px;text-align:right;"><div style="font-size:8px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;">Status</div><div style="font-weight:600;color:#16A34A;margin-top:2px;">● Active</div><div style="color:#475569;">Valid 7 days</div></div>
            </div>
            <div style="padding:0 12px 12px;">
              <table style="width:100%;border-collapse:collapse;font-size:9px;">
                <thead><tr style="background:#F1F5F9;color:#334155;">${thead}</tr></thead>
                <tbody>${rows.replace(/<tr>/g, '<tr style="border-bottom:1px solid #F1F5F9;">').replace(/<td/g, '<td style="padding:7px 8px;"')}</tbody>
              </table>
            </div>
            <div style="padding:0 12px 12px;">${totalsBlock('card')}</div>
          </div>`;

      case 'grid_minimal':
        return `
          <div style="${baseFont}color:#1F2937;padding:18px;background:#fff;min-height:380px;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px;">
              <div style="font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:#6B7280;">${docTitle}</div>
              <div style="font-size:9px;color:#9CA3AF;">SAMPLE-001 · ${today}</div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;font-size:9px;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #F3F4F6;">
              <div><div style="color:#9CA3AF;text-transform:uppercase;font-size:8px;letter-spacing:0.5px;margin-bottom:3px;">From</div><div style="font-weight:500;">${DEMO_ORG.name}</div><div style="color:#6B7280;">Chandigarh</div></div>
              <div><div style="color:#9CA3AF;text-transform:uppercase;font-size:8px;letter-spacing:0.5px;margin-bottom:3px;">To</div><div style="font-weight:500;">${DEMO_CLIENT.name}</div><div style="color:#6B7280;">${DEMO_CLIENT.address}</div></div>
              <div style="text-align:right;"><div style="color:#9CA3AF;text-transform:uppercase;font-size:8px;letter-spacing:0.5px;margin-bottom:3px;">Project</div><div style="font-weight:500;">Residential MEP</div></div>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:9px;">
              <thead><tr style="border-bottom:1px solid #1F2937;">${thead}</tr></thead>
              <tbody>${rows.replace(/<tr>/g, '<tr style="border-bottom:1px solid #F3F4F6;">').replace(/<td/g, '<td style="padding:8px 4px;"')}</tbody>
            </table>
            ${totalsBlock('minimal')}
          </div>`;

      case 'pro_grid':
        return `
          <div style="${baseFont}color:#0F172A;padding:12px;background:#fff;min-height:380px;">
            <div style="background:#1E293B;color:#fff;padding:10px 12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
              <div><div style="font-size:16px;font-weight:800;letter-spacing:0.5px;">${DEMO_ORG.name}</div><div style="font-size:8px;opacity:0.7;">Chandigarh · GSTIN ${DEMO_ORG.gstin}</div></div>
              <div style="text-align:center;"><div style="font-size:8px;opacity:0.7;text-transform:uppercase;letter-spacing:1px;">${docTitle}</div><div style="font-size:11px;font-weight:700;margin-top:2px;">SAMPLE-001</div></div>
              <div style="text-align:right;"><div style="font-size:8px;opacity:0.7;">Date</div><div style="font-size:11px;font-weight:600;">${today}</div></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin:10px 0;font-size:8px;">
              <div style="background:#F8FAFC;padding:5px;border-radius:3px;"><div style="color:#9CA3AF;font-size:7px;text-transform:uppercase;">Client</div>${DEMO_CLIENT.name}</div>
              <div style="background:#F8FAFC;padding:5px;border-radius:3px;"><div style="color:#9CA3AF;font-size:7px;text-transform:uppercase;">PO</div>${DEMO_PROJECT.poNo}</div>
              <div style="background:#F8FAFC;padding:5px;border-radius:3px;"><div style="color:#9CA3AF;font-size:7px;text-transform:uppercase;">Project</div>${DEMO_PROJECT.name}</div>
              <div style="background:#F8FAFC;padding:5px;border-radius:3px;"><div style="color:#9CA3AF;font-size:7px;text-transform:uppercase;">Valid</div>7 Days</div>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:9px;">
              <thead><tr style="background:#D97706;color:#fff;">${thead}</tr></thead>
              <tbody>${rows.replace(/<tr>/g, '<tr style="border-bottom:1px solid #FED7AA;">').replace(/<td/g, '<td style="padding:6px 8px;"')}</tbody>
            </table>
            ${totalsBlock('card')}
          </div>`;

      case 'vertical':
        return `
          <div style="${baseFont}color:#0F172A;padding:0;background:#fff;min-height:380px;">
            <div style="background:#1E3A8A;color:#fff;padding:12px 14px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div style="font-size:16px;font-weight:800;letter-spacing:0.5px;">${DEMO_ORG.name}</div>
                <div style="font-size:11px;font-weight:700;background:#fff;color:#1E3A8A;padding:3px 8px;border-radius:3px;">${docTitle}</div>
              </div>
              <div style="font-size:8px;opacity:0.85;margin-top:2px;">SAMPLE-001 · ${today}</div>
            </div>
            <div style="padding:10px 12px;font-size:8px;display:grid;grid-template-columns:1fr 1fr;gap:10px;border-bottom:2px solid #1E3A8A;">
              <div><div style="color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Billed To</div><div style="font-weight:600;">${DEMO_CLIENT.name}</div><div style="color:#475569;">${DEMO_CLIENT.address}</div></div>
              <div style="text-align:right;"><div style="color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Ship To</div><div style="font-weight:600;">${DEMO_CLIENT.shippingCompany}</div><div style="color:#475569;">${DEMO_CLIENT.shippingAddress}</div></div>
            </div>
            <div style="padding:10px 12px;">
              ${[1, 2, 3, 4].map((i) => `
                <div style="border:1px solid #E5E7EB;border-radius:6px;padding:8px;margin-bottom:6px;background:#FAFAFA;">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div>
                      <div style="font-size:9px;font-weight:700;">${DEMO_ITEMS[i - 1]?.description.split(' — ')[0] || 'Item ' + i} <span style="color:#9CA3AF;font-weight:400;">· ${DEMO_ITEMS[i - 1]?.code || ''}</span></div>
                      <div style="font-size:8px;color:#6B7280;">HSN ${DEMO_ITEMS[i - 1]?.hsn || ''} · ${DEMO_ITEMS[i - 1]?.qty} ${DEMO_ITEMS[i - 1]?.uom} @ ₹${(DEMO_ITEMS[i - 1]?.rate || 0).toLocaleString('en-IN')}</div>
                    </div>
                    <div style="font-size:10px;font-weight:700;color:#1E3A8A;">${inr(DEMO_ITEMS[i - 1]?.amount || 0)}</div>
                  </div>
                </div>`).join('')}
            </div>
            ${totalsBlock('standard')}
          </div>`;

      case 'enterprise':
        return `
          <div style="${baseFont}color:#0F172A;padding:0;background:#fff;min-height:380px;">
            <div style="background:#0B2545;color:#fff;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-size:18px;font-weight:700;letter-spacing:1px;">${DEMO_ORG.name}</div>
                <div style="font-size:8px;opacity:0.75;letter-spacing:0.5px;">ENTERPRISE SOLUTIONS PVT LTD</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:20px;font-weight:800;letter-spacing:2px;">${docTitle}</div>
                <div style="font-size:9px;opacity:0.75;">Ref: SAMPLE-001 / ${today}</div>
              </div>
            </div>
            <div style="padding:12px 16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;border-bottom:1px solid #E5E7EB;font-size:9px;">
              <div><div style="color:#94A3B8;font-size:8px;text-transform:uppercase;letter-spacing:0.5px;">Client</div><div style="font-weight:600;margin-top:2px;">${DEMO_CLIENT.name}</div><div style="color:#475569;">Chandigarh</div></div>
              <div><div style="color:#94A3B8;font-size:8px;text-transform:uppercase;letter-spacing:0.5px;">Project</div><div style="font-weight:600;margin-top:2px;">${DEMO_PROJECT.name}</div><div style="color:#475569;">Phase II</div></div>
              <div><div style="color:#94A3B8;font-size:8px;text-transform:uppercase;letter-spacing:0.5px;">PO Reference</div><div style="font-weight:600;margin-top:2px;">${DEMO_PROJECT.poNo}</div><div style="color:#475569;">${today}</div></div>
            </div>
            <div style="padding:10px 16px;">
              <table style="width:100%;border-collapse:collapse;font-size:9px;">
                <thead><tr style="background:#F1F5F9;color:#0B2545;">${thead}</tr></thead>
                <tbody>${rows.replace(/<tr>/g, '<tr style="border-bottom:1px solid #E5E7EB;">').replace(/<td/g, '<td style="padding:7px 8px;"')}</tbody>
              </table>
            </div>
            ${totalsBlock('dark')}
            <div style="padding:8px 16px;border-top:1px solid #E5E7EB;font-size:8px;color:#64748B;display:flex;justify-content:space-between;">
              <div>Standard Terms Apply</div>
              <div>For ${DEMO_ORG.name}</div>
            </div>
          </div>`;

      case 'sakthi':
        return `
          <div style="${baseFont}color:#0F172A;padding:10px;background:#fff;min-height:380px;font-size:8px;line-height:1.3;">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0F766E;padding-bottom:6px;margin-bottom:8px;">
              <div style="font-size:13px;font-weight:700;">${DEMO_ORG.name}</div>
              <div style="font-size:11px;font-weight:700;color:#0F766E;">${docTitle}</div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;font-size:8px;">
              <div><strong>To:</strong> ${DEMO_CLIENT.name}, Chandigarh</div>
              <div style="text-align:right;"><strong>No:</strong> SAMPLE-001 · ${today}</div>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:8px;">
              <thead><tr style="background:#0F766E;color:#fff;">${thead.replace(/padding:6px 8px/g, 'padding:4px 6px')}</tr></thead>
              <tbody>${rows.replace(/<tr>/g, '<tr style="border-bottom:1px solid #E5E7EB;">').replace(/<td/g, '<td style="padding:4px 6px;"')}</tbody>
            </table>
            <div style="margin-top:8px;${totalsBlock('card').replace(/font-size:9px/g, 'font-size:8px')}</div>
          </div>`;

      default:
        return `
          <div style="${baseFont}color:#1f2937;padding:14px;background:#fff;min-height:380px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #1F2937;padding-bottom:8px;margin-bottom:10px;">
              <div>
                <div style="font-size:15px;font-weight:700;letter-spacing:0.5px;">${DEMO_ORG.name}</div>
                <div style="font-size:9px;color:#6B7280;">${DEMO_ORG.address}</div>
              </div>
              <div style="font-size:13px;font-weight:700;letter-spacing:1px;">${docTitle}</div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;font-size:9px;">
              <div><strong>To:</strong> ${DEMO_CLIENT.name}<br>${DEMO_CLIENT.address}</div>
              <div style="text-align:right;"><strong>No:</strong> SAMPLE-001<br><strong>Date:</strong> ${today}</div>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:9px;">
              <thead><tr style="background:#1F2937;color:#fff;">${thead}</tr></thead>
              <tbody>${rows.replace(/<td/g, '<td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;"')}</tbody>
            </table>
            ${totalsBlock('standard')}
          </div>`;
    }
  };

  const openTemplatePreview = (template: any) => {
    setPreviewTemplate(template);
    setShowPreview(true);
  };

  const closeTemplatePreview = () => {
    setShowPreview(false);
    setPreviewTemplate(null);
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
      'Invoice': '💰', 'Tools Delivery Challan': '🔧', 'Credit Note': '📗', 'Debit Note': '📘',
      'Purchase Order': '🛒'
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
        <div className="space-y-3">
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-zinc-900">Document Templates · <span className="text-zinc-500">Awesome Templates, Awesome Impressions.</span></h2>
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

      <div className="flex items-center gap-1 border-b border-zinc-200">
        {DOC_TYPE_GROUPS.map((group) => {
          const count = group.value === 'all'
            ? templates.length
            : templates.filter((t) => group.types.includes(t.document_type)).length;
          return (
            <button
              key={group.value}
              onClick={() => setDocTypeFilter(group.value)}
              className={`relative px-4 py-2 text-sm font-medium transition-colors ${docTypeFilter === group.value ? 'text-[#185FA5]' : 'text-zinc-600 hover:text-zinc-900'}`}
            >
              {group.label}
              <span className="ml-1.5 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600">{count}</span>
              {docTypeFilter === group.value && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[#185FA5]" />}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto">
        <span className="text-xs text-zinc-500">Style:</span>
        {[
          { value: 'all', label: 'All' },
          { value: 'default', label: 'Default' },
          { value: 'grid_minimal', label: 'Grid Minimal' },
          { value: 'saas', label: 'SAAS' },
          { value: 'pro_grid', label: 'Pro Grid' },
          { value: 'vertical', label: 'Vertical' },
          { value: 'enterprise', label: 'Enterprise' },
          { value: 'sakthi', label: 'Compact' },
        ].map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStyleFilter(filter.value as any)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${styleFilter === filter.value ? 'border-[#185FA5] bg-[#185FA5] text-white' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'}`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <SettingSection title="Template Library" description={`${filteredByStyle.length} template(s) visible`}>
        {filteredByStyle.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-500">
            <p className="font-semibold text-zinc-900 mb-1">No Templates</p>
            <p>Create your first template to get started</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedTemplates.map((group) => (
              <div key={group.docType}>
                {docTypeFilter === 'all' && (
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-900">
                    <span>{getDocumentTypeIcon(group.docType)}</span>
                    <span>{group.docType}</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">{group.templates.length}</span>
                  </h3>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {group.templates.map((template) => {
                    const style = (template.column_settings?.print?.style || 'default').toLowerCase();
                    const isLandscape = (template.orientation || 'Portrait').toLowerCase() === 'landscape';
                    const optFlags = (template.column_settings?.optional || {}) as Record<string, boolean | undefined>;
                    const cardHiddenCount = OPTIONAL_COLUMNS.filter((c) => !c.isMandatory && !optFlags[c.key]).length;
                    return (
                      <div
                        key={template.id || template.template_code}
                        className="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#185FA5]/40 hover:shadow-md"
                      >
                        <button
                          type="button"
                          onClick={() => openTemplatePreview(template)}
                          className="relative w-full overflow-hidden border-b border-zinc-100 bg-zinc-50 text-left"
                          style={{ aspectRatio: isLandscape ? '1.414 / 1' : '1 / 1.414' }}
                          aria-label={`Preview ${template.template_name}`}
                        >
                          {/* Scaled-down rendered preview of the template's actual layout */}
                          <div
                            className="pointer-events-none absolute left-0 top-0 origin-top-left"
                            style={{ width: '320%', transform: 'scale(0.3125)' }}
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderCardPreviewHTML(template)) }}
                          />
                          {template.is_default && (
                            <span className="absolute right-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                              ✓ Default
                            </span>
                          )}
                          <span className={`absolute left-2 top-2 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm ${styleBadgeClass(style)}`}>
                            {style.replace('_', ' ')}
                          </span>
                          {cardHiddenCount > 0 && (
                            <span className="absolute bottom-2 left-2 rounded bg-red-600/95 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
                              {cardHiddenCount} hidden
                            </span>
                          )}
                          <span className="absolute bottom-2 right-2 rounded bg-zinc-900/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white shadow-sm">
                            A4 {isLandscape ? 'Landscape' : 'Portrait'}
                          </span>
                        </button>

                        <div className="flex flex-1 flex-col gap-1 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-zinc-900">{template.template_name}</div>
                              {template.template_code && (
                                <div className="truncate text-[11px] text-zinc-500" style={{ fontFamily: "'Inter', sans-serif" }}>
                                  {template.template_code} · {template.document_type}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="mt-1 text-[10px] text-zinc-400">
                            {template.page_size} · {template.orientation}
                          </div>
                        </div>

                        {/* Hover actions appear below the card on hover */}
                        <div className="grid grid-cols-2 gap-px border-t border-zinc-100 bg-zinc-100 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleEdit(template); }}
                            className="bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-blue-50 hover:text-[#185FA5]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleClone(template); }}
                            className="bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                          >
                            Clone
                          </button>
                        </div>

                        {/* Secondary actions menu: Set Default / Delete, on hover too */}
                        <div className="flex items-center justify-between border-t border-zinc-100 bg-white px-2 py-1.5 text-[10px] text-zinc-500">
                          {!template.is_default ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleSetDefault(template); }}
                              className="rounded px-2 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-100"
                            >
                              Set as Default
                            </button>
                          ) : (
                            <span className="text-[10px] font-semibold text-emerald-700">Current Default</span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDelete(template.id); }}
                            className="rounded px-2 py-1 text-[10px] font-medium text-zinc-500 hover:bg-red-50 hover:text-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingSection>

      {/* Card-click preview modal (in-tab, not new browser) */}
      {showPreview && previewTemplate && (() => {
        const optFlags = (previewTemplate.column_settings?.optional || {}) as Record<string, boolean | undefined>;
        const hiddenKeys = OPTIONAL_COLUMNS.filter((c) => !c.isMandatory && !optFlags[c.key]).map((c) => c.label);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeTemplatePreview}>
            <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">{previewTemplate.template_name}</h3>
                  <p className="text-[11px] text-zinc-500">
                    {previewTemplate.template_code && <span style={{ fontFamily: "'Inter', sans-serif" }} className="mr-2 rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5">{previewTemplate.template_code}</span>}
                    {previewTemplate.document_type} · {previewTemplate.page_size || 'A4'} {previewTemplate.orientation || 'Portrait'} · Preview with dummy data
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeTemplatePreview}
                  className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                  aria-label="Close preview"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto bg-zinc-50 p-6">
                {hiddenKeys.length > 0 && (
                  <div className="mx-auto mb-4 max-w-3xl rounded-md border border-red-200 bg-red-50 px-4 py-2 text-[11px] text-red-700">
                    <strong>{hiddenKeys.length} column{hiddenKeys.length > 1 ? 's' : ''} hidden</strong> in this template:
                    <span className="ml-1 text-red-600/90">{hiddenKeys.join(', ')}</span>
                    <span className="ml-2 text-red-500">(shown struck-through in the table below)</span>
                  </div>
                )}
                <div className="mx-auto max-w-3xl rounded-lg border border-zinc-200 bg-white shadow-sm">
                  <div className="p-6" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderCardPreviewHTML(previewTemplate)) }} />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-zinc-200 bg-white px-5 py-3">
                <Button variant="secondary" onClick={() => { closeTemplatePreview(); handleClone(previewTemplate); }}>Clone</Button>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={closeTemplatePreview}>Close</Button>
                  <Button onClick={() => { closeTemplatePreview(); handleEdit(previewTemplate); }}>Open in Editor</Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
