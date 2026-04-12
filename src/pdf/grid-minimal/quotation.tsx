import { pdf } from '@react-pdf/renderer';

import { ensurePdfFontsRegistered } from '../registerFonts';
import { getPrintConfig } from '../print-config';
import { numberToInrWords } from '../numberToWords';
import { GridMinimalDocument } from './GridMinimalDocument';

const safe = (value: unknown, fallback = '') => (typeof value === 'string' && value.trim() ? value.trim() : fallback);
const toNum = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function generateGridMinimalQuotationPdfBlob(
  quotation: any,
  organisation: any,
  template: any,
): Promise<Blob> {
  const printConfig = getPrintConfig(template?.column_settings);

  const title =
    printConfig.style === 'grid_minimal' && printConfig.gridMinimal?.titleOverride
      ? printConfig.gridMinimal.titleOverride
      : 'QUOTATION';

  const items = (quotation.items || [])
    .filter((item: any) => !item.is_header)
    .map((item: any, idx: number) => {
      const qty = toNum(item.qty);
      const rate = toNum(item.rate);
      const discPct = toNum(item.discount_percent);
      const gstPct = toNum(item.tax_percent);
      const discountedRate = rate;
      const amount = qty * discountedRate;

      return {
        id: String(item.id ?? idx),
        sno: idx + 1,
        hsn: safe(item.item?.hsn_code, ''),
        description: safe(item.description || item.item?.display_name || item.item?.name, 'Item'),
        make: safe(item.make, ''),
        qty,
        unit: safe(item.uom, ''),
        rate: toNum(item.base_rate_snapshot ?? item.rate),
        discPct,
        gstPct,
        amount,
      };
    });

  const totalTax = toNum(quotation.total_tax);
  const grandTotal = toNum(quotation.grand_total);
  const subtotal = toNum(quotation.subtotal);

  const companyState = safe(organisation?.state, '');
  const clientState = safe(quotation?.state, '');
  const isInterState = companyState && clientState && companyState.toLowerCase() !== clientState.toLowerCase();

  const sgst = isInterState ? 0 : totalTax / 2;
  const cgst = isInterState ? 0 : totalTax / 2;
  const igst = isInterState ? totalTax : 0;

  const headerLabels = template?.column_settings?.header_labels || {};

  const vm = {
    title,
    org: {
      name: safe(organisation?.name, 'Organisation'),
      gstin: safe(organisation?.gstin, ''),
      address: safe(organisation?.address, ''),
      logoUrl: organisation?.logo_url ?? undefined,
      bank: organisation?.bank_details
        ? {
            bankName: safe(organisation.bank_details.bank_name, ''),
            accountNo: safe(organisation.bank_details.account_no, ''),
            branch: safe(organisation.bank_details.branch, ''),
            ifsc: safe(organisation.bank_details.ifsc, ''),
          }
        : undefined,
    },
    parties: [
      {
        label: 'Bill To',
        name: safe(quotation?.client?.client_name || quotation?.client?.name, 'Client'),
        address: safe(quotation?.billing_address, ''),
        gstin: safe(quotation?.gstin || quotation?.client?.gstin || quotation?.client?.gst_number, ''),
      },
      {
        label: 'Ship To',
        name: safe(quotation?.client?.client_name || quotation?.client?.name, 'Client'),
        address: safe(quotation?.billing_address, ''),
        gstin: safe(quotation?.gstin || quotation?.client?.gstin || quotation?.client?.gst_number, ''),
      },
    ],
    meta: [
      { label: headerLabels.document_no || 'Quotation No.', value: safe(quotation?.quotation_no, '') },
      { label: headerLabels.document_date || 'Quotation Date', value: safe(quotation?.date, '') },
      { label: headerLabels.po_no || 'PO No.', value: safe(quotation?.reference, '—') },
      { label: headerLabels.po_date || 'PO Date', value: safe('', '—') },
      { label: headerLabels.eway_bill || 'E-Way Bill', value: safe('', '—') },
      { label: headerLabels.remarks || 'Remarks', value: safe(quotation?.remarks || quotation?.reference, '—') },
    ],
    items,
    totals: {
      basicAmount: subtotal,
      sgst: totalTax ? sgst : undefined,
      cgst: totalTax ? cgst : undefined,
      igst: totalTax ? igst : undefined,
      netValue: grandTotal,
      amountInWords: numberToInrWords(grandTotal),
    },
    showTax: totalTax > 0,
    authorisedSignLabel: 'Authorised Signatory',
  };

  ensurePdfFontsRegistered();

  return pdf(
    <GridMinimalDocument
      vm={vm as any}
      columns={printConfig.gridMinimal?.columns || { hsn: true, make: true, unit: true, discPct: true, gst: true }}
    />,
  ).toBlob();
}
