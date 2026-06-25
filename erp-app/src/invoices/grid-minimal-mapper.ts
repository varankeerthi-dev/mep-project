import type { InvoicePdfData } from './pdf-types';
import type { GridMinimalVM } from '../pdf/grid-minimal/GridMinimalDocument';
import { numberToInrWords } from '../pdf/numberToWords';

const safe = (value: unknown, fallback = '') => (typeof value === 'string' && value.trim() ? value.trim() : fallback);

const toNum = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

export function mapInvoicePdfToGridMinimalVM(
  data: InvoicePdfData,
  docTitle: string,
  headerLabels: Record<string, string> = {},
): GridMinimalVM {
  const invoice = data.invoice;
  const company = data.company;
  const client = invoice.client;

  const items = (invoice.items ?? []).map((item, idx) => {
    const meta = (item.meta_json ?? {}) as Record<string, unknown>;
    const qty = toNum(item.qty);
    const rate = toNum(item.rate);
    const discPct = toNum(meta.discount_percent ?? meta.discPct);
    const gstPct = toNum(meta.tax_percent ?? meta.gst_percent ?? meta.gstPct);

    const discountedRate = rate * (1 - discPct / 100);
    const amount = toNum(item.amount) || discountedRate * qty;

    return {
      id: String(item.id ?? idx),
      sno: idx + 1,
      hsn: safe(item.hsn_code, ''),
      description: safe(item.description, 'Item'),
      make: safe(meta.make, ''),
      qty: qty || 0,
      unit: safe(meta.unit, ''),
      rate,
      discPct: discPct || 0,
      gstPct: gstPct || 18,
      amount,
    };
  });

  const metaRows = [
    { label: headerLabels.document_no || 'Invoice No.', value: safe((invoice as any).invoice_number ?? invoice.id) },
    { label: headerLabels.document_date || 'Invoice Date', value: safe((invoice as any).invoice_date ?? invoice.created_at ?? todayIso()) },
    { label: headerLabels.po_no || 'Source Ref.', value: safe(invoice.source_type) + (invoice.source_id ? ` / ${String(invoice.source_id).slice(0, 8)}` : '') },
    { label: 'Status', value: safe(invoice.status) },
    { label: 'Template', value: safe(invoice.template_type) },
    { label: 'Mode', value: safe(invoice.mode) },
  ];

  const subtotal = toNum(invoice.subtotal);
  const cgst = toNum(invoice.cgst);
  const sgst = toNum(invoice.sgst);
  const igst = toNum(invoice.igst);
  const total = toNum(invoice.total);

  const showTax = cgst + sgst + igst > 0;

  const vm: GridMinimalVM = {
    title: docTitle,
    org: {
      name: safe(company?.name, 'Organisation'),
      gstin: safe(company?.gstin, ''),
      address: safe(company?.address, ''),
      logoUrl: company?.logo_url ?? undefined,
      bank: company?.bank_details
        ? {
            bankName: safe(company.bank_details.bank_name, ''),
            accountNo: safe(company.bank_details.account_no, ''),
            branch: safe(company.bank_details.branch, ''),
            ifsc: safe(company.bank_details.ifsc, ''),
          }
        : undefined,
    },
    parties: [
      {
        label: 'Bill To',
        name: safe(client?.name, 'Client'),
        address: '',
        gstin: safe(client?.gst_number, ''),
      },
      {
        label: 'Ship To',
        name: safe(client?.name, 'Client'),
        address: '',
        gstin: safe(client?.gst_number, ''),
      },
    ],
    meta: metaRows,
    items,
    totals: {
      basicAmount: subtotal,
      sgst: showTax ? sgst : undefined,
      cgst: showTax ? cgst : undefined,
      igst: showTax ? igst : undefined,
      netValue: total,
      roundOff: undefined,
      amountInWords: numberToInrWords(total),
    },
    showTax,
    authorisedSignLabel: 'Authorised Signatory',
  };

  return vm;
}
