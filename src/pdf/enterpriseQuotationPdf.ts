import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OrgDetails {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  phone?: string;
  email?: string;
  logo_url?: string; // base64 data-url or https URL
}

export interface ClientDetails {
  display_name?: string;
  name?: string;
  billing_address?: string;
  gstin?: string;
  state?: string;
}

export interface QuotationHeader {
  quotation_no: string;
  revision_no?: number;
  date: string;
  valid_till?: string;
  payment_terms?: string;
  reference?: string;
  prepared_by?: string;
  remarks?: string;
  project_name?: string;
}

export interface QuotationItem {
  is_header?: boolean;
  is_subtotal?: boolean;
  subtotal_label?: string;
  description?: string;
  item_code?: string;
  hsn_code?: string;
  sac_code?: string;
  variant_name?: string;
  qty?: number | string;
  uom?: string;
  base_rate_snapshot?: number | string;
  discount_percent?: number | string;
  rate?: number | string;           // rate after discount
  tax_percent?: number | string;
  line_total?: number | string;
  custom1?: string;
  custom2?: string;
}

export interface Calculations {
  subtotal: number;
  totalItemDiscount: number;
  extraDiscountAmount?: number;
  cgst: number;
  sgst: number;
  igst: number;
  isInterState: boolean;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
  taxGroups?: Record<string, { baseAmount: number; taxAmount: number; sgst: number; cgst: number }>;
  subTotalGroups?: Record<string, number>;
  hsnTaxGroups?: HsnTaxRow[];
}

export interface HsnTaxRow {
  hsn: string;          // HSN or SAC code
  description?: string; // optional short description of the code
  taxableValue: number;
  taxRate: number;      // total GST % (e.g. 18)
  cgstRate: number;     // taxRate / 2  (0 for inter-state)
  cgstAmt: number;
  sgstRate: number;     // taxRate / 2  (0 for inter-state)
  sgstAmt: number;
  igstRate: number;     // taxRate for inter-state, else 0
  igstAmt: number;
  totalTax: number;
}

export interface ColumnSettings {
  mandatory?: string[];
  optional?: Record<string, boolean>;
  labels?: Record<string, string>;
}

export interface AuthorisedSignatory {
  name?: string;
  designation?: string;
  for_company?: string;
}

export interface BankDetails {
  bank_name?: string;
  branch?: string;
  account_name?: string;
  account_no?: string;
  ifsc?: string;
  account_type?: string;
  swift?: string;
}

export interface QuotationPdfOptions {
  org: OrgDetails;
  client: ClientDetails;
  header: QuotationHeader;
  items: QuotationItem[];
  calculations: Calculations;
  columnSettings?: ColumnSettings;
  signatory?: AuthorisedSignatory;
  bankDetails?: BankDetails;
  termsAndConditions?: string[];
  companyLogoBase64?: string;
}

// ─── HSN/SAC Tax Summary ──────────────────────────────────────────────────────

function buildHsnTaxSummary(items: QuotationItem[], isInterState: boolean): HsnTaxRow[] {
  const map = new Map<string, HsnTaxRow>();

  items.forEach(item => {
    if (item.is_header || item.is_subtotal) return;

    const qty        = parseFloat(String(item.qty ?? 0)) || 0;
    const rate       = parseFloat(String(item.rate ?? 0)) || 0;
    const taxPct     = parseFloat(String(item.tax_percent ?? 0)) || 0;
    const taxable    = qty * rate;
    if (taxable === 0 && taxPct === 0) return;

    const taxAmt     = (taxable * taxPct) / 100;
    const hsn        = (item.hsn_code ?? item.sac_code ?? '').trim() || 'N/A';
    const key        = `${hsn}||${taxPct}`;

    if (!map.has(key)) {
      map.set(key, { 
        hsn, 
        taxableValue: 0, 
        taxRate: taxPct, 
        cgstRate: isInterState ? 0 : taxPct / 2,
        cgstAmt: 0, 
        sgstRate: isInterState ? 0 : taxPct / 2,
        sgstAmt: 0, 
        igstRate: isInterState ? taxPct : 0,
        igstAmt: 0, 
        totalTax: 0 
      });
    }
    const row = map.get(key)!;
    row.taxableValue += taxable;
    row.totalTax     += taxAmt;
    if (isInterState) {
      row.igstAmt += taxAmt;
    } else {
      row.cgstAmt += taxAmt / 2;
      row.sgstAmt += taxAmt / 2;
    }
  });

  return Array.from(map.values()).sort((a, b) =>
    a.hsn.localeCompare(b.hsn) || a.taxRate - b.taxRate
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 10;
const CONTENT_W = PAGE_W - MARGIN * 2;

const C = {
  primary:     [13, 71, 161]   as [number, number, number],
  primaryLight:[227, 232, 250] as [number, number, number],
  accent:      [25, 118, 210]  as [number, number, number],
  headerBg:    [30, 64, 175]   as [number, number, number],
  altRow:      [245, 247, 255] as [number, number, number],
  border:      [200, 210, 230] as [number, number, number],
  text:        [30, 30, 40]    as [number, number, number],
  muted:       [100, 110, 130] as [number, number, number],
  white:       [255, 255, 255] as [number, number, number],
  sectionHdr:  [237, 242, 255] as [number, number, number],
  subtotalRow: [255, 251, 230] as [number, number, number],
  footerBg:    [243, 246, 255] as [number, number, number],
  grandTotal:  [13, 71, 161]   as [number, number, number],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | string | undefined, decimals = 2): string {
  const v = parseFloat(String(n ?? 0)) || 0;
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v);
}

function fmtCur(n: number | string | undefined): string {
  return 'Rs. ' + fmt(n, 2);
}

function fmtPct(n: number | string | undefined): string {
  const v = parseFloat(String(n ?? 0)) || 0;
  return v === 0 ? '-' : v + '%';
}

interface ColDef {
  key: string;
  header: string;
  width: number;
  align: 'left' | 'center' | 'right';
  mandatory?: boolean;
}

function buildColumns(cs?: ColumnSettings): ColDef[] {
  const opt = cs?.optional ?? {};
  const lbl = cs?.labels ?? {};

  const defs: (ColDef & { include: boolean })[] = [
    { key: 'sno',              header: 'S.No',           width: 8,   align: 'center', mandatory: true,  include: true },
    { key: 'client_part_no',   header: 'Client Part No', width: 18,  align: 'left',   mandatory: false, include: !!opt.client_part_no },
    { key: 'item_code',        header: 'Code',           width: 18,  align: 'left',   mandatory: false, include: opt.item_code !== false },
    { key: 'make',             header: 'Make',           width: 16,  align: 'left',   mandatory: false, include: !!opt.make },
    { key: 'category',         header: 'Category',       width: 16,  align: 'left',   mandatory: false, include: !!opt.category },
    { key: 'item',             header: 'Item / Description', width: 0, align: 'left', mandatory: true,  include: true },
    { key: 'description',      header: 'Spec / Notes',   width: 24,  align: 'left',   mandatory: false, include: !!opt.description },
    { key: 'client_description', header: 'Client Desc',  width: 24,  align: 'left',   mandatory: false, include: !!opt.client_description },
    { key: 'hsn_code',         header: 'HSN/SAC',        width: 14,  align: 'center', mandatory: false, include: !!opt.hsn_code },
    { key: 'variant',          header: 'Variant',        width: 16,  align: 'left',   mandatory: false, include: !!opt.variant },
    { key: 'qty',              header: 'Qty',            width: 10,  align: 'right',  mandatory: true,  include: true },
    { key: 'uom',              header: 'UOM',            width: 10,  align: 'center', mandatory: true,  include: true },
    { key: 'rate',             header: 'Rate',           width: 18,  align: 'right',  mandatory: false, include: !!opt.rate },
    { key: 'discount_percent', header: 'Disc%',          width: 10,  align: 'right',  mandatory: false, include: !!opt.discount_percent },
    { key: 'discount_amount',  header: 'Disc. Amt',      width: 14,  align: 'right',  mandatory: false, include: !!opt.discount_amount },
    { key: 'rate_after_discount', header: lbl.rate_after_discount ?? 'Rate/Unit', width: 20, align: 'right', mandatory: false, include: !!opt.rate_after_discount },
    { key: 'tax_percent',      header: 'GST%',           width: 10,  align: 'right',  mandatory: false, include: !!opt.tax_percent },
    { key: 'tax_amount',       header: 'Tax Amt',        width: 14,  align: 'right',  mandatory: false, include: !!opt.tax_amount },
    { key: 'line_total',       header: 'Amount (Rs.)',     width: 24,  align: 'right',  mandatory: true,  include: true },
    { key: 'custom1',          header: lbl.custom1 ?? 'Custom 1', width: 18, align: 'left', mandatory: false, include: !!opt.custom1 },
    { key: 'custom2',          header: lbl.custom2 ?? 'Custom 2', width: 18, align: 'left', mandatory: false, include: !!opt.custom2 },
  ];

  const active = defs.filter(d => d.include);
  const fixedTotal = active.reduce((s, c) => s + (c.key === 'item' ? 0 : c.width), 0);
  const itemCol = active.find(d => d.key === 'item')!;
  if (itemCol) {
    itemCol.width = Math.max(20, CONTENT_W - fixedTotal);
  }

  return active;
}

function numberToWords(num: number): string {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
             'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
             'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const inWords = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return a[n] + ' ';
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '') + ' ';
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred ' + inWords(n % 100);
    if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + inWords(n % 1000);
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + inWords(n % 100000);
    return inWords(Math.floor(n / 10000000)) + 'Crore ' + inWords(n % 10000000);
  };
  const rounded = Math.round(num);
  const paise = Math.round((num - rounded) * 100);
  let words = 'Rupees ' + inWords(rounded).trim();
  if (paise > 0) words += ' and ' + inWords(paise).trim() + ' Paise';
  return words + ' Only';
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateQuotationPdf(opts: QuotationPdfOptions): jsPDF {
  const { org, client, header, items, calculations, columnSettings, signatory, bankDetails, termsAndConditions, companyLogoBase64 } = opts;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const cols = buildColumns(columnSettings);

  doc.setFont('Helvetica');
  let curY = MARGIN;

  const drawPageHeader = (doc: jsPDF, pageNumber: number) => {
    const y0 = MARGIN;

    doc.setFillColor(...C.primary);
    doc.rect(MARGIN, y0, CONTENT_W, 1.5, 'F');

    const logoW = 28, logoH = 14;
    let textStartX = MARGIN;

    if (companyLogoBase64) {
      try {
        const ext = companyLogoBase64.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(companyLogoBase64, ext, MARGIN, y0 + 3, logoW, logoH);
        textStartX = MARGIN + logoW + 4;
      } catch (_) {}
    }

    doc.setFont('Helvetica', 'Bold');
    doc.setFontSize(14);
    doc.setTextColor(...C.primary);
    doc.text(org.name ?? 'Company Name', textStartX, y0 + 9);

    doc.setFont('Helvetica', 'Normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.muted);
    const orgMeta = [
      [org.address, org.city, org.state, org.pincode].filter(Boolean).join(', '),
      org.gstin ? `GSTIN: ${org.gstin}` : '',
      [org.phone ? `Ph: ${org.phone}` : '', org.email ?? ''].filter(Boolean).join('  |  '),
    ].filter(Boolean);
    orgMeta.forEach((line, i) => doc.text(line, textStartX, y0 + 13 + i * 3.8));

    const stampX = PAGE_W - MARGIN - 38;
    doc.setFillColor(...C.primaryLight);
    doc.roundedRect(stampX, y0 + 2, 38, 10, 2, 2, 'F');
    doc.setFont('Helvetica', 'Bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.primary);
    doc.text('QUOTATION', stampX + 19, y0 + 8.5, { align: 'center' });

    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y0 + 20, PAGE_W - MARGIN, y0 + 20);

    return y0 + 22;
  };

  curY = drawPageHeader(doc, 1);

  const metaY = curY;
  const halfW = CONTENT_W / 2 - 2;

  doc.setFillColor(...C.footerBg);
  doc.rect(MARGIN, metaY, halfW, 36, 'F');
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(MARGIN, metaY, halfW, 36);

  doc.setFont('Helvetica', 'Bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.primary);
  doc.text('DOCUMENT DETAILS', MARGIN + 3, metaY + 4.5);

  doc.setLineWidth(0.5);
  doc.setDrawColor(...C.accent);
  doc.line(MARGIN, metaY + 6, MARGIN + halfW, metaY + 6);

  const metaLeft: [string, string][] = [
    ['Quotation No.',  header.quotation_no],
    ['Revision',       header.revision_no ? `Rev ${header.revision_no}` : '1'],
    ['Date',           header.date],
    ['Valid Till',     header.valid_till ?? '—'],
    ['Reference',      header.reference ?? '—'],
    ['Payment Terms',  header.payment_terms ?? '—'],
    ['Prepared By',    header.prepared_by ?? '—'],
  ];

  doc.setFont('Helvetica', 'Normal');
  doc.setFontSize(7.5);
  let mY = metaY + 10;
  metaLeft.forEach(([label, val]) => {
    doc.setTextColor(...C.muted);
    doc.text(label + ':', MARGIN + 3, mY);
    doc.setTextColor(...C.text);
    doc.setFont('Helvetica', 'Bold');
    doc.text(val, MARGIN + 38, mY);
    doc.setFont('Helvetica', 'Normal');
    mY += 3.8;
  });

  const rightX = MARGIN + halfW + 4;
  doc.setFillColor(...C.white);
  doc.rect(rightX, metaY, halfW, 36, 'F');
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(rightX, metaY, halfW, 36);

  doc.setFont('Helvetica', 'Bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.primary);
  doc.text('BILL TO', rightX + 3, metaY + 4.5);

  doc.setLineWidth(0.5);
  doc.setDrawColor(...C.accent);
  doc.line(rightX, metaY + 6, rightX + halfW, metaY + 6);

  doc.setFont('Helvetica', 'Bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.text);
  doc.text(client.display_name ?? client.name ?? 'Client Name', rightX + 3, metaY + 10);

  doc.setFont('Helvetica', 'Normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.muted);

  let addrY = metaY + 14;
  if (client.billing_address) {
    const addrLines = doc.splitTextToSize(client.billing_address, halfW - 6);
    addrLines.forEach((l: string) => { doc.text(l, rightX + 3, addrY); addrY += 3.6; });
  }
  if (client.gstin) {
    doc.setTextColor(...C.text);
    doc.text(`GSTIN: ${client.gstin}`, rightX + 3, addrY); addrY += 3.6;
  }
  if (client.state) {
    doc.setTextColor(...C.muted);
    doc.text(`State: ${client.state}`, rightX + 3, addrY);
  }

  if (header.project_name) {
    const pY = metaY + 36 + 2;
    doc.setFillColor(...C.sectionHdr);
    doc.rect(MARGIN, pY, CONTENT_W, 6, 'F');
    doc.setFont('Helvetica', 'Bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.primary);
    doc.text(`Project: ${header.project_name}`, MARGIN + 3, pY + 4);
    curY = pY + 8;
  } else {
    curY = metaY + 38;
  }

  const tableHead = [cols.map(c => c.header)];
  const tableBody: Record<string, any>[] = [];
  let sno = 0;

  const sectionSubtotals: { label: string; value: number }[] = [];

  items.forEach(item => {
    if (item.is_header) {
      const span = cols.map(() => '');
      span[0] = '';
      const itemColIdx = cols.findIndex(c => c.key === 'item');
      span[itemColIdx] = item.description ?? '';
      tableBody.push({ _type: 'section', cells: span, label: item.description });
      return;
    }

    if (item.is_subtotal) {
      const label = item.subtotal_label ?? 'Sub-total:';
      const val = calculations.subTotalGroups?.[label] ?? 0;
      sectionSubtotals.push({ label, value: val });
      return;
    }

    sno++;
    const row = cols.map(c => {
      switch (c.key) {
        case 'sno':              return String(sno);
        case 'item':             return item.description ?? '';
        case 'item_code':        return item.item_code ?? '';
        case 'description':      return item.description ?? '';
        case 'hsn_code':         return item.hsn_code ?? item.sac_code ?? '';
        case 'variant':          return item.variant_name ?? '';
        case 'qty':              return fmt(item.qty, 2);
        case 'uom':              return item.uom ?? '';
        case 'rate':             return fmt(item.base_rate_snapshot, 2);
        case 'discount_percent': return fmtPct(item.discount_percent);
        case 'rate_after_discount': return fmt(item.rate, 2);
        case 'tax_percent':      return fmtPct(item.tax_percent);
        case 'line_total':       return fmt(item.line_total, 2);
        case 'custom1':          return item.custom1 ?? '';
        case 'custom2':          return item.custom2 ?? '';
        default:                 return '';
      }
    });
    tableBody.push({ _type: 'normal', cells: row });
  });

  const bodyRows = tableBody.map(r => r.cells);

  autoTable(doc, {
    startY: curY,
    head: tableHead,
    body: bodyRows,
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_W,
    columnStyles: Object.fromEntries(
      cols.map((c, i) => [i, {
        cellWidth: c.width,
        halign: c.align,
        overflow: 'linebreak',
      }])
    ),
    headStyles: {
      fillColor: C.headerBg,
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 1.5, right: 1.5 },
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: C.text,
      cellPadding: { top: 2, bottom: 2, left: 1.5, right: 1.5 },
      lineColor: C.border,
      lineWidth: 0.15,
    },
    alternateRowStyles: { fillColor: C.altRow },
    didParseCell(data) {
      const meta = tableBody[data.row.index];
      if (!meta) return;

      if (meta._type === 'section') {
        data.cell.styles.fillColor = C.sectionHdr;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = C.primary;
        data.cell.styles.fontSize = 7.5;
        const itemColIdx = cols.findIndex(c => c.key === 'item');
        if (data.column.index !== itemColIdx && data.column.index !== 0) {
          data.cell.text = [''];
        }
      }

    },
    didDrawPage(data) {
      const pageNum = (doc.internal as any).getCurrentPageInfo().pageNumber;
      if (pageNum > 1) {
        const y = MARGIN;
        doc.setFillColor(...C.primary);
        doc.rect(MARGIN, y, CONTENT_W, 0.8, 'F');
        doc.setFont('Helvetica', 'Bold');
        doc.setFontSize(7);
        doc.setTextColor(...C.primary);
        doc.text(org.name ?? '', MARGIN + 2, y + 4);
        doc.setFont('Helvetica', 'Normal');
        doc.setTextColor(...C.muted);
        doc.text(`Quotation: ${header.quotation_no}  |  Continued`, PAGE_W - MARGIN, y + 4, { align: 'right' });
        doc.setLineWidth(0.25);
        doc.setDrawColor(...C.border);
        doc.line(MARGIN, y + 6, PAGE_W - MARGIN, y + 6);
      }
      doc.setFont('Helvetica', 'Normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.muted);
      doc.text(`Page ${pageNum}`, PAGE_W / 2, PAGE_H - 4, { align: 'center' });
    },
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
    showHead: 'everyPage',
    theme: 'grid',
  });

  const finalY: number = (doc as any).lastAutoTable.finalY ?? curY;
  const secSubH = sectionSubtotals.length > 0 ? 8 + sectionSubtotals.length * 5.5 + 2 : 0;
  const footerBlockH = computeFooterHeight(calculations, items);

  let fY = finalY + 4;
  if (fY + secSubH + footerBlockH > PAGE_H - MARGIN - 8) {
    doc.addPage();
    const y = MARGIN;
    doc.setFillColor(...C.primary);
    doc.rect(MARGIN, y, CONTENT_W, 0.8, 'F');
    doc.setFont('Helvetica', 'Bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.primary);
    doc.text(org.name ?? '', MARGIN + 2, y + 4);
    doc.setFont('Helvetica', 'Normal');
    doc.setTextColor(...C.muted);
    doc.text(`Quotation: ${header.quotation_no}  |  Summary`, PAGE_W - MARGIN, y + 4, { align: 'right' });
    doc.setLineWidth(0.25);
    doc.setDrawColor(...C.border);
    doc.line(MARGIN, y + 6, PAGE_W - MARGIN, y + 6);
    fY = y + 10;

    const pageNum = (doc.internal as any).getCurrentPageInfo().pageNumber;
    doc.setFont('Helvetica', 'Normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(`Page ${pageNum}`, PAGE_W / 2, PAGE_H - 4, { align: 'center' });
  }

  fY = drawSectionSubtotals(doc, fY, sectionSubtotals);
  drawFooterBlock(doc, fY, calculations, signatory, bankDetails, header.remarks, items, org.name);

  if (termsAndConditions && termsAndConditions.length > 0) {
    doc.addPage();
    const y0 = MARGIN;
    doc.setFillColor(...C.primary);
    doc.rect(MARGIN, y0, CONTENT_W, 1.5, 'F');
    doc.setFont('Helvetica', 'Bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.primary);
    doc.text(org.name ?? '', MARGIN + 2, y0 + 4);
    doc.setFont('Helvetica', 'Normal');
    doc.setTextColor(...C.muted);
    doc.text(`Quotation: ${header.quotation_no}  |  Terms & Conditions`, PAGE_W - MARGIN, y0 + 4, { align: 'right' });
    doc.setLineWidth(0.25);
    doc.setDrawColor(...C.border);
    doc.line(MARGIN, y0 + 6, PAGE_W - MARGIN, y0 + 6);
    
    let leftY = y0 + 14;
    
    doc.setFont('Helvetica', 'Bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.primary);
    doc.text('Terms & Conditions', MARGIN, leftY);
    leftY += 6;

    doc.setFont('Helvetica', 'Normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.text);
    termsAndConditions.forEach((t, i) => {
      const tLines = doc.splitTextToSize(`${i + 1}. ${t}`, CONTENT_W - 4);
      
      if (leftY + tLines.length * 4 > PAGE_H - MARGIN - 10) {
         doc.addPage();
         leftY = MARGIN + 10;
      }
      
      doc.text(tLines, MARGIN, leftY);
      leftY += tLines.length * 4.5 + 2;
    });

    const pageNum = (doc.internal as any).getCurrentPageInfo().pageNumber;
    doc.setFont('Helvetica', 'Normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(`Page ${pageNum}`, PAGE_W / 2, PAGE_H - 4, { align: 'center' });
  }

  return doc;
}

function computeFooterHeight(calc: Calculations, items?: QuotationItem[]): number {
  let h = 0;
  h += 8;

  let summaryH = 6;
  if (calc.totalItemDiscount > 0) summaryH += 6;
  if (calc.extraDiscountAmount && calc.extraDiscountAmount > 0) summaryH += 6;
  if (calc.taxGroups && Object.keys(calc.taxGroups).length > 0) {
    summaryH += Object.keys(calc.taxGroups).length * 6 * (calc.isInterState ? 1 : 2);
  } else {
    summaryH += calc.isInterState ? 6 : 12;
  }
  if (calc.roundOff !== 0) summaryH += 6;
  summaryH += 9;

  let leftH = 0;

  h += Math.max(summaryH, leftH) + 4;

  if (items) {
    const hsnRows = buildHsnTaxSummary(items, calc.isInterState);
    if (hsnRows.length > 0) {
      h += 6;
      h += 6;
      h += hsnRows.length * 5.5;
      h += 5.5;
    }
  }

  h += 5 + 4;
  h += 6;
  h += 30 + 6;

  return h + 6;
}

function drawSectionSubtotals(doc: jsPDF, y: number, subs: { label: string; value: number }[]): number {
  if (subs.length === 0) return y;

  doc.setFillColor(...C.sectionHdr);
  doc.rect(MARGIN, y, CONTENT_W, 6, 'F');
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.rect(MARGIN, y, CONTENT_W, 6);
  doc.setFont('Helvetica', 'Bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.primary);
  doc.text('SECTION SUBTOTALS', MARGIN + 3, y + 4);
  y += 6;

  subs.forEach(s => {
    doc.setFillColor(...C.white);
    doc.rect(MARGIN, y, CONTENT_W, 5.5, 'F');
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.1);
    doc.rect(MARGIN, y, CONTENT_W, 5.5);
    doc.setFont('Helvetica', 'Bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.text);
    doc.text(s.label, MARGIN + 3, y + 3.8);
    doc.setFont('Helvetica', 'Bold');
    doc.setTextColor(...C.primary);
    doc.text(fmtCur(s.value), PAGE_W - MARGIN - 3, y + 3.8, { align: 'right' });
    y += 5.5;
  });

  y += 2;
  return y;
}

function drawFooterBlock(
  doc: jsPDF,
  startY: number,
  calc: Calculations,
  signatory?: AuthorisedSignatory,
  bank?: BankDetails,
  remarks?: string,
  items?: QuotationItem[],
  orgName?: string
): number {
  let y = startY;

  const wordsText = calc.amountInWords || numberToWords(calc.grandTotal);
  doc.setFillColor(...C.primaryLight);
  doc.rect(MARGIN, y, CONTENT_W, 7, 'F');
  doc.setFont('Helvetica', 'Italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.primary);
  doc.text('Amount in Words: ' + wordsText, MARGIN + 3, y + 4.5);
  y += 8;

  const summaryW  = 90;
  const summaryX  = MARGIN + CONTENT_W - summaryW;
  const leftW     = CONTENT_W - summaryW - 2;
  const labelW    = 54;
  const valW      = summaryW - labelW;

  let leftY   = y;
  let rightY  = y;

  const drawSummaryRow = (label: string, value: string, isBold = false, bg?: [number, number, number]) => {
    const rowH = 6;
    if (bg) { doc.setFillColor(...bg); doc.rect(summaryX, rightY, summaryW, rowH, 'F'); }
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.2);
    doc.rect(summaryX, rightY, summaryW, rowH);
    doc.rect(summaryX + labelW, rightY, valW, rowH);
    doc.setFont('Helvetica', isBold ? 'Bold' : 'Normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...(isBold ? C.primary : C.text));
    doc.text(label, summaryX + 3, rightY + 4);
    doc.text(value, summaryX + summaryW - 2, rightY + 4, { align: 'right' });
    rightY += rowH;
  };

  drawSummaryRow('Sub-Total (before GST)', fmtCur(calc.subtotal), false, C.footerBg);

  if (calc.totalItemDiscount > 0) {
    drawSummaryRow('Item-level Discount', `- ${fmtCur(calc.totalItemDiscount)}`);
  }
  if (calc.extraDiscountAmount && calc.extraDiscountAmount > 0) {
    drawSummaryRow('Additional Discount', `- ${fmtCur(calc.extraDiscountAmount)}`);
  }

  if (calc.taxGroups && Object.keys(calc.taxGroups).length > 0) {
    Object.entries(calc.taxGroups).forEach(([rate, grp]) => {
      if (calc.isInterState) {
        drawSummaryRow(`IGST @ ${rate}%`, fmtCur(grp.taxAmount));
      } else {
        drawSummaryRow(`CGST @ ${parseFloat(rate) / 2}%`, fmtCur(grp.cgst));
        drawSummaryRow(`SGST @ ${parseFloat(rate) / 2}%`, fmtCur(grp.sgst));
      }
    });
  } else {
    if (calc.isInterState) {
      drawSummaryRow('IGST', fmtCur(calc.igst));
    } else {
      drawSummaryRow('CGST', fmtCur(calc.cgst));
      drawSummaryRow('SGST', fmtCur(calc.sgst));
    }
  }

  if (calc.roundOff !== 0) {
    drawSummaryRow('Round Off', (calc.roundOff >= 0 ? '+ ' : '- ') + fmtCur(Math.abs(calc.roundOff)));
  }

  const gtH = 9;
  doc.setFillColor(...C.grandTotal);
  doc.rect(summaryX, rightY, summaryW, gtH, 'F');
  doc.setFont('Helvetica', 'Bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.white);
  doc.text('GRAND TOTAL', summaryX + 3, rightY + 6);
  doc.text(fmtCur(calc.grandTotal), summaryX + summaryW - 2, rightY + 6, { align: 'right' });
  rightY += gtH;

  if (remarks && remarks.trim()) {
    doc.setFont('Helvetica', 'Bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.text);
    doc.text('Remarks:', MARGIN, leftY + 4);
    doc.setFont('Helvetica', 'Normal');
    doc.setTextColor(...C.muted);
    const rmLines = doc.splitTextToSize(remarks, leftW - 4);
    doc.text(rmLines, MARGIN, leftY + 8);
    leftY += 8 + rmLines.length * 3.8 + 3;
  }

  y = Math.max(leftY, rightY) + 4;

  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y - 2, PAGE_W - MARGIN, y - 2);

  if (items && items.length > 0) {
    const hsnRows = buildHsnTaxSummary(items, calc.isInterState);

    if (hsnRows.length > 0) {
      doc.setFillColor(...C.sectionHdr);
      doc.rect(MARGIN, y, CONTENT_W, 6, 'F');
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.2);
      doc.rect(MARGIN, y, CONTENT_W, 6);
      doc.setFont('Helvetica', 'Bold');
      doc.setFontSize(7);
      doc.setTextColor(...C.primary);
      doc.text('GST Summary  —  HSN / SAC wise', MARGIN + 3, y + 4);
      doc.setFont('Helvetica', 'Normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.muted);
      doc.text(calc.isInterState ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)',
        PAGE_W - MARGIN - 2, y + 4, { align: 'right' });
      y += 6;

      type HsnCol = { header: string; width: number; align: 'left' | 'center' | 'right' };

      const hsnCols: HsnCol[] = calc.isInterState
        ? [
            { header: 'HSN / SAC',    width: 26, align: 'center' },
            { header: 'Taxable Value',width: 38, align: 'right'  },
            { header: 'IGST Rate',    width: 22, align: 'center' },
            { header: 'IGST Amount',  width: 38, align: 'right'  },
            { header: 'Total Tax',    width: 32, align: 'right'  },
            { header: 'Total Amount', width: 34, align: 'right'  },
          ]
        : [
            { header: 'HSN / SAC',    width: 24, align: 'center' },
            { header: 'Taxable Value',width: 28, align: 'right'  },
            { header: 'CGST Rate',    width: 18, align: 'center' },
            { header: 'CGST Amount',  width: 26, align: 'right'  },
            { header: 'SGST Rate',    width: 18, align: 'center' },
            { header: 'SGST Amount',  width: 26, align: 'right'  },
            { header: 'Total Tax',    width: 24, align: 'right'  },
            { header: 'Total Amount', width: 26, align: 'right'  },
          ];

      const rawW = hsnCols.reduce((s, c) => s + c.width, 0);
      const sc   = CONTENT_W / rawW;
      hsnCols.forEach(c => { c.width = c.width * sc; });

      const rowH    = 5.5;
      const hdrH    = 6;
      const cellPad = 1.5;
      const fSz     = 7;

      doc.setFillColor(...C.headerBg);
      doc.rect(MARGIN, y, CONTENT_W, hdrH, 'F');
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.15);
      doc.setFont('Helvetica', 'Bold');
      doc.setFontSize(fSz);
      doc.setTextColor(...C.white);

      let cx = MARGIN;
      hsnCols.forEach(col => {
        doc.rect(cx, y, col.width, hdrH);
        const tx = col.align === 'right'  ? cx + col.width - cellPad
                 : col.align === 'center' ? cx + col.width / 2
                 : cx + cellPad;
        doc.text(col.header, tx, y + 4, { align: col.align });
        cx += col.width;
      });
      y += hdrH;

      let totTaxable = 0, totCgst = 0, totSgst = 0, totIgst = 0, totTax = 0, totAmt = 0;

      hsnRows.forEach((row, ri) => {
        if (ri % 2 === 0) {
          doc.setFillColor(...C.altRow);
          doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
        }
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.15);
        doc.rect(MARGIN, y, CONTENT_W, rowH);

        const totalAmt = row.taxableValue + row.totalTax;
        totTaxable += row.taxableValue;
        totCgst    += row.cgstAmt;
        totSgst    += row.sgstAmt;
        totIgst    += row.igstAmt;
        totTax     += row.totalTax;
        totAmt     += totalAmt;

        const cells: string[] = calc.isInterState
          ? [ row.hsn, fmt(row.taxableValue), row.igstRate + '%', fmt(row.igstAmt), fmt(row.totalTax), fmt(totalAmt) ]
          : [ row.hsn, fmt(row.taxableValue), row.cgstRate + '%', fmt(row.cgstAmt), row.sgstRate + '%', fmt(row.sgstAmt), fmt(row.totalTax), fmt(totalAmt) ];

        cx = MARGIN;
        cells.forEach((cell, ci) => {
          const col = hsnCols[ci];
          doc.rect(cx, y, col.width, rowH);

          if (ci === 0) {
            doc.setFillColor(...C.primaryLight);
            doc.rect(cx, y, col.width, rowH, 'F');
            doc.rect(cx, y, col.width, rowH);
          }

          const tx = col.align === 'right'  ? cx + col.width - cellPad
                   : col.align === 'center' ? cx + col.width / 2
                   : cx + cellPad;
          doc.setFont('Helvetica', ci === 0 ? 'Bold' : 'Normal');
          doc.setFontSize(fSz);
          doc.setTextColor(ci === 0 ? C.primary[0] : C.text[0],
                           ci === 0 ? C.primary[1] : C.text[1],
                           ci === 0 ? C.primary[2] : C.text[2]);
          doc.text(cell, tx, y + rowH - 1.5, { align: col.align });
          cx += col.width;
        });
        y += rowH;
      });

      doc.setFillColor(...C.footerBg);
      doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
      doc.setDrawColor(...C.primary);
      doc.setLineWidth(0.4);
      doc.rect(MARGIN, y, CONTENT_W, rowH);
      doc.setLineWidth(0.15);

      const totCells: string[] = calc.isInterState
        ? [ 'TOTAL', fmt(totTaxable), '', fmt(totIgst), fmt(totTax), fmt(totAmt) ]
        : [ 'TOTAL', fmt(totTaxable), '', fmt(totCgst), '', fmt(totSgst), fmt(totTax), fmt(totAmt) ];

      cx = MARGIN;
      totCells.forEach((cell, ci) => {
        const col = hsnCols[ci];
        doc.rect(cx, y, col.width, rowH);
        const tx = col.align === 'right'  ? cx + col.width - cellPad
                 : col.align === 'center' ? cx + col.width / 2
                 : cx + cellPad;
        doc.setFont('Helvetica', 'Bold');
        doc.setFontSize(fSz);
        doc.setTextColor(...C.primary);
        doc.text(cell, tx, y + rowH - 1.5, { align: col.align });
        cx += col.width;
      });
      y += rowH;
    }
  }

  y += 5;

  doc.setDrawColor(...C.primary);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  doc.setLineWidth(0.2);
  doc.setDrawColor(...C.border);
  doc.line(MARGIN, y + 1.2, PAGE_W - MARGIN, y + 1.2);
  y += 4;

  const colGap  = 1.5;
  const colW    = (CONTENT_W - colGap * 2) / 3;
  const col1X   = MARGIN;
  const col2X   = MARGIN + colW + colGap;
  const col3X   = MARGIN + (colW + colGap) * 2;

  const footerH   = 30;
  const hdrH      = 6;
  const pad       = 2.5;
  const lineH     = 3.8;

  const drawColHeader = (x: number, w: number, label: string) => {
    doc.setFillColor(...C.primary);
    doc.rect(x, y, w, hdrH, 'F');
    doc.setFont('Helvetica', 'Bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.white);
    doc.text(label, x + w / 2, y + 4, { align: 'center' });
  };

  drawColHeader(col1X, colW, 'BANK DETAILS');
  drawColHeader(col2X, colW, "RECEIVER'S SIGNATURE");
  drawColHeader(col3X, colW, 'FOR ' + (signatory?.for_company ?? orgName ?? '').toUpperCase());

  const bodyY = y + hdrH;

  [col1X, col2X, col3X].forEach((cx, i) => {
    doc.setFillColor(i === 1 ? C.white[0] : C.footerBg[0],
                     i === 1 ? C.white[1] : C.footerBg[1],
                     i === 1 ? C.white[2] : C.footerBg[2]);
    doc.rect(cx, bodyY, colW, footerH, 'F');
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.2);
    doc.rect(cx, bodyY, colW, footerH);
  });

  let by = bodyY + pad + 3;

  const drawBankRow = (label: string, value: string) => {
    doc.setFont('Helvetica', 'Normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.muted);
    doc.text(label, col1X + pad, by);
    doc.setFont('Helvetica', 'Bold');
    doc.setTextColor(...C.text);
    const valLines = doc.splitTextToSize(value, colW - pad * 2 - 18);
    doc.text(valLines[0] ?? '', col1X + colW - pad, by, { align: 'right' });
    by += lineH;
  };

  if (bank) {
    if (bank.bank_name)    drawBankRow('Bank',    bank.bank_name);
    if (bank.branch)       drawBankRow('Branch',  bank.branch);
    if (bank.account_name) drawBankRow('Name',    bank.account_name);
    if (bank.account_no)   drawBankRow('A/c No.', bank.account_no);
    if (bank.ifsc)         drawBankRow('IFSC',    bank.ifsc);
    if (bank.account_type) drawBankRow('Type',    bank.account_type);
    if (bank.swift)        drawBankRow('SWIFT',   bank.swift);
  } else {
    doc.setFont('Helvetica', 'Italic');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.muted);
    doc.text('Bank details not provided', col1X + colW / 2, bodyY + footerH / 2, { align: 'center' });
  }

  doc.setFont('Helvetica', 'Italic');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.muted);
  doc.text('Received with thanks', col2X + colW / 2, bodyY + 5, { align: 'center' });

  const sigAreaX = col2X + 4;
  const sigAreaW = colW - 8;
  const sigAreaY = bodyY + 8;
  const sigAreaH = 14;

  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1, 1], 0);
  doc.rect(sigAreaX, sigAreaY, sigAreaW, sigAreaH);
  doc.setLineDashPattern([], 0);

  doc.setFont('Helvetica', 'Normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.text);
  doc.text('Signature & Date', col2X + colW / 2, bodyY + footerH - pad, { align: 'center' });

  doc.setFont('Helvetica', 'Bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.primary);
  doc.text(signatory?.name ?? '', col3X + colW / 2, bodyY + footerH - pad - 3.5, { align: 'center' });

  doc.setFont('Helvetica', 'Normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.muted);
  doc.text(signatory?.designation ?? 'Authorised Signatory', col3X + colW / 2, bodyY + footerH - pad, { align: 'center' });

  return y + footerH + 5;
}
