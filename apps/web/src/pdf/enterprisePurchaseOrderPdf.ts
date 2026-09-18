import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { numberToWords } from './numberToWords';

// Helper to convert URL to base64 safely
async function getBase64ImageFromUrl(imageUrl: string): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.setAttribute('crossOrigin', 'anonymous');
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        try {
          const dataUrl = canvas.toDataURL('image/png');
          resolve({ dataUrl, width: img.width, height: img.height });
        } catch (e) {
          reject(e);
        }
      } else {
        reject(new Error('Canvas context not available'));
      }
    };
    img.onerror = (error) => {
      reject(error);
    };
    img.src = imageUrl;
  });
}

function formatDate(dateStr: any): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return String(dateStr);
  }
}

function fmt(n: number | string | undefined, decimals = 2): string {
  const v = parseFloat(String(n ?? 0)) || 0;
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v);
}

function fmtCur(n: number | string | undefined, currency = 'INR'): string {
  const symbol = currency === 'INR' ? 'Rs. ' : `${currency} `;
  return symbol + fmt(n, 2);
}

function fmtPct(n: number | string | undefined): string {
  const v = parseFloat(String(n ?? 0)) || 0;
  return v === 0 ? '-' : v + '%';
}

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
  footerBg:    [243, 246, 255] as [number, number, number],
  grandTotal:  [13, 71, 161]   as [number, number, number],
};

interface ColDef {
  key: string;
  header: string;
  width: number;
  align: 'left' | 'center' | 'right';
  include: boolean;
}

function buildPOColumns(columnSettings?: any): ColDef[] {
  const opt = columnSettings?.optional ?? {};
  const lbl = columnSettings?.labels ?? {};

  const defs: ColDef[] = [
    { key: 'sno',                 header: 'S.No',                     width: 10, align: 'center', include: opt.sno !== false },
    { key: 'item_code',           header: 'Item Code',                width: 18, align: 'left',   include: opt.item_code !== false && !!opt.item_code },
    { key: 'item',                header: lbl.item || 'Item Description', width: 0,  align: 'left',   include: opt.item !== false },
    { key: 'make',                header: 'Make',                     width: 16, align: 'left',   include: !!opt.make },
    { key: 'hsn_code',            header: 'HSN/SAC',                  width: 16, align: 'center', include: opt.hsn_code !== false && !!opt.hsn_code },
    { key: 'qty',                 header: 'Qty',                      width: 12, align: 'left',  include: opt.qty !== false },
    { key: 'uom',                 header: 'Unit',                     width: 12, align: 'left',  include: opt.uom !== false },
    { key: 'rate',                header: 'Rate',                     width: 20, align: 'left',  include: opt.rate !== false },
    { key: 'discount_percent',    header: 'Disc%',                    width: 12, align: 'left',  include: !!opt.discount_percent },
    { key: 'discount_amount',     header: 'Disc Amt',                 width: 16, align: 'left',  include: !!opt.discount_amount },
    { key: 'rate_after_discount', header: lbl.rate_after_discount || 'Final Rate', width: 20, align: 'left', include: !!opt.rate_after_discount },
    { key: 'tax_percent',         header: 'GST%',                     width: 12, align: 'left',  include: opt.tax_percent !== false },
    { key: 'tax_amount',          header: 'Tax Amt',                  width: 16, align: 'left',  include: !!opt.tax_amount },
    { key: 'line_total',          header: 'Amount',                   width: 24, align: 'left',  include: opt.line_total !== false && opt.base_amount !== false },
  ];

  const active = defs.filter(d => d.include);
  // Guarantee at least item and amount if everything is off
  const finalDefs = active.length > 0 ? active : [defs[2], defs[13]];

  // Auto calculate item description width to stretch across full content width
  const fixedTotal = finalDefs.reduce((s, c) => s + (c.key === 'item' ? 0 : c.width), 0);
  const itemCol = finalDefs.find(d => d.key === 'item');
  if (itemCol) {
    itemCol.width = Math.max(30, CONTENT_W - fixedTotal);
  }

  return finalDefs;
}

export async function generateEnterprisePurchaseOrderPdf(
  poData: any,
  orgData: any,
  templateSettings?: any
): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const cols = buildPOColumns(templateSettings?.column_settings);

  // Normalize organisation
  const org = {
    name: orgData?.name || orgData?.company_name || poData?.company_name || 'SAKTHI SOLUTIONS & SERVICES',
    address: orgData?.address || poData?.company_address || '',
    gstin: orgData?.gst_no || orgData?.gstin || poData?.company_gstin || '',
    phone: orgData?.phone || orgData?.mobile || poData?.company_phone || '',
    email: orgData?.email || poData?.company_email || '',
    logo_url: (templateSettings?.show_logo !== false) ? (orgData?.logo_url || poData?.company_logo || null) : null,
  };

  // Normalize vendor
  const vendorObj = poData?.vendor || {};
  const vendor = {
    name: vendorObj?.company_name || vendorObj?.name || poData?.vendor_name || 'Vendor Name',
    address: vendorObj?.billing_address || vendorObj?.address || poData?.vendor_address || '',
    gstin: vendorObj?.gstin || poData?.vendor_gstin || '',
    phone: vendorObj?.phone || vendorObj?.contact_person || poData?.vendor_contact || '',
    email: vendorObj?.email || '',
    state: vendorObj?.state || '',
  };

  // Header details
  const header = {
    po_number: poData?.po_number || 'PO-DRAFT',
    po_date: formatDate(poData?.po_date),
    delivery_date: formatDate(poData?.delivery_date),
    currency: poData?.currency || 'INR',
    payment_terms: poData?.terms || poData?.payment_terms || 'Net 30',
    reference_no: poData?.reference_no || '—',
    delivery_location: poData?.delivery_location || '—',
    notes: poData?.internal_notes || poData?.notes || '',
    terms_conditions: poData?.terms_conditions || '',
  };

  // Normalize line items
  const rawItems = poData?.items || [];
  const items = rawItems.map((it: any, idx: number) => {
    const qty = parseFloat(String(it.quantity ?? it.qty ?? 0)) || 0;
    const rate = parseFloat(String(it.rate ?? 0)) || 0;
    const discPct = parseFloat(String(it.discount_percent ?? it.discount ?? 0)) || 0;
    const discAmt = parseFloat(String(it.discount_amount ?? 0)) || ((rate * qty * discPct) / 100);
    const rateAfterDisc = rate - (rate * discPct) / 100;
    const taxable = it.taxable_value !== undefined ? parseFloat(String(it.taxable_value)) : (rateAfterDisc * qty);

    let gstPct = 0;
    if (it.tax_percent !== undefined) gstPct = parseFloat(String(it.tax_percent));
    else if (it.gst_rate !== undefined) gstPct = parseFloat(String(it.gst_rate));
    else if (it.cgst_percent !== undefined || it.sgst_percent !== undefined) {
      gstPct = (parseFloat(String(it.cgst_percent || 0)) + parseFloat(String(it.sgst_percent || 0)));
    } else if (it.igst_percent !== undefined) {
      gstPct = parseFloat(String(it.igst_percent));
    }

    const taxAmt = (taxable * gstPct) / 100;
    const lineTotal = it.total_amount !== undefined ? parseFloat(String(it.total_amount)) : (taxable + taxAmt);

    const itemName = it.item_name || it.name || it.description || 'Item';
    const showDesc = templateSettings?.column_settings?.optional?.description !== false;
    const itemText = (showDesc && it.description && it.description !== itemName)
      ? `${itemName}\n${it.description}`
      : itemName;

    return {
      sno: String(idx + 1),
      item_code: it.item_id || it.item_code || '',
      item: itemText,
      make: it.make || '',
      description: it.description || '',
      hsn_code: it.hsn_code || '—',
      qty,
      uom: it.unit || it.uom || 'Nos',
      rate,
      discount_percent: discPct,
      discount_amount: discAmt,
      rate_after_discount: rateAfterDisc,
      tax_percent: gstPct,
      tax_amount: taxAmt,
      line_total: lineTotal,
    };
  });

  // Totals & calculations
  const subtotal = poData?.subtotal ?? items.reduce((s: number, i: any) => s + (i.rate * i.qty), 0);
  const discountTotal = poData?.discount_amount ?? items.reduce((s: number, i: any) => s + i.discount_amount, 0);
  const taxableTotal = poData?.taxable_amount ?? items.reduce((s: number, i: any) => s + (i.rate_after_discount * i.qty), 0);
  const cgst = poData?.cgst_amount ?? 0;
  const sgst = poData?.sgst_amount ?? 0;
  const igst = poData?.igst_amount ?? 0;
  const isInterState = igst > 0;
  const totalTax = (cgst + sgst + igst) > 0 ? (cgst + sgst + igst) : items.reduce((s: number, i: any) => s + i.tax_amount, 0);
  const grandTotal = poData?.total_amount ?? (taxableTotal + totalTax);

  // Logo loading
  let logoBase64: { dataUrl: string; width: number; height: number } | null = null;
  if (org.logo_url) {
    try {
      logoBase64 = await getBase64ImageFromUrl(org.logo_url);
    } catch {
      logoBase64 = null;
    }
  }

  doc.setFont('helvetica');
  let curY = MARGIN;

  // 1. Draw Page Header
  const drawHeader = (d: jsPDF) => {
    const y0 = MARGIN;
    d.setFillColor(...C.primary);
    d.rect(MARGIN, y0, CONTENT_W, 1.5, 'F');

    const logoW = 28, logoH = 14;
    let textStartX = MARGIN;

    if (logoBase64) {
      try {
        d.addImage(logoBase64.dataUrl, 'PNG', MARGIN, y0 + 3, logoW, logoH);
        textStartX = MARGIN + logoW + 4;
      } catch (_) {}
    }

    d.setFont('helvetica', 'bold');
    d.setFontSize(13);
    d.setTextColor(...C.primary);
    d.text(org.name, textStartX, y0 + 9);

    d.setFont('helvetica', 'normal');
    d.setFontSize(7.5);
    d.setTextColor(...C.muted);
    const orgMeta = [
      org.address,
      org.gstin ? `GSTIN: ${org.gstin}` : '',
      [org.phone ? `Ph: ${org.phone}` : '', org.email ? `Email: ${org.email}` : ''].filter(Boolean).join('  |  '),
    ].filter(Boolean);
    orgMeta.forEach((line, i) => d.text(line, textStartX, y0 + 13 + i * 3.8));

    // Right top badge
    const stampX = PAGE_W - MARGIN - 42;
    d.setFillColor(...C.primaryLight);
    d.roundedRect(stampX, y0 + 2, 42, 10, 2, 2, 'F');
    d.setFont('helvetica', 'bold');
    d.setFontSize(9);
    d.setTextColor(...C.primary);
    d.text('PURCHASE ORDER', stampX + 21, y0 + 8.5, { align: 'center' });

    d.setDrawColor(...C.border);
    d.setLineWidth(0.3);
    d.line(MARGIN, y0 + 22, PAGE_W - MARGIN, y0 + 22);

    return y0 + 24;
  };

  curY = drawHeader(doc);

  // 2. Meta Cards: PO Details (Left) + Vendor Details (Right)
  const metaY = curY;
  const halfW = CONTENT_W / 2 - 2;

  // Left card: PO Details
  doc.setFillColor(...C.footerBg);
  doc.rect(MARGIN, metaY, halfW, 36, 'F');
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(MARGIN, metaY, halfW, 36);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.primary);
  doc.text('PO DETAILS', MARGIN + 3, metaY + 4.5);

  doc.setLineWidth(0.5);
  doc.setDrawColor(...C.accent);
  doc.line(MARGIN, metaY + 6, MARGIN + halfW, metaY + 6);

  const poMeta: [string, string][] = [
    ['PO Number', header.po_number],
    ['PO Date', header.po_date],
    ['Delivery Date', header.delivery_date],
    ['Payment Terms', header.payment_terms],
    ['Reference / RFQ', header.reference_no],
    ['Currency', header.currency],
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  let mY = metaY + 10;
  poMeta.forEach(([lbl, val]) => {
    doc.setTextColor(...C.muted);
    doc.text(lbl + ':', MARGIN + 3, mY);
    doc.setTextColor(...C.text);
    doc.setFont('helvetica', 'bold');
    doc.text(String(val), MARGIN + 32, mY);
    doc.setFont('helvetica', 'normal');
    mY += 4;
  });

  // Right card: Vendor Details
  const rightX = MARGIN + halfW + 4;
  doc.setFillColor(...C.white);
  doc.rect(rightX, metaY, halfW, 36, 'F');
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(rightX, metaY, halfW, 36);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.primary);
  doc.text('VENDOR DETAILS', rightX + 3, metaY + 4.5);

  doc.setLineWidth(0.5);
  doc.setDrawColor(...C.accent);
  doc.line(rightX, metaY + 6, rightX + halfW, metaY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.text);
  doc.text(vendor.name, rightX + 3, metaY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.muted);

  let vAddrY = metaY + 14;
  if (vendor.address) {
    const addrLines = doc.splitTextToSize(vendor.address, halfW - 6);
    addrLines.slice(0, 3).forEach((l: string) => {
      doc.text(l, rightX + 3, vAddrY);
      vAddrY += 3.6;
    });
  }
  if (vendor.gstin) {
    doc.setTextColor(...C.text);
    doc.text(`GSTIN: ${vendor.gstin}`, rightX + 3, vAddrY);
    vAddrY += 3.6;
  }
  if (vendor.phone) {
    doc.setTextColor(...C.muted);
    doc.text(`Contact: ${vendor.phone}`, rightX + 3, vAddrY);
  }

  curY = metaY + 40;

  // 3. Line Items Table (Dynamic Columns)
  const tableHead = [cols.map(c => c.header)];
  const tableBody = items.map(item => {
    return cols.map(c => {
      switch (c.key) {
        case 'sno':                 return item.sno;
        case 'item_code':           return item.item_code;
        case 'item':                return item.item;
        case 'make':                return item.make;
        case 'hsn_code':            return item.hsn_code;
        case 'qty':                 return fmt(item.qty, 2);
        case 'uom':                 return item.uom;
        case 'rate':                return fmt(item.rate, 2);
        case 'discount_percent':    return fmtPct(item.discount_percent);
        case 'discount_amount':     return fmt(item.discount_amount, 2);
        case 'rate_after_discount': return fmt(item.rate_after_discount, 2);
        case 'tax_percent':         return fmtPct(item.tax_percent);
        case 'tax_amount':          return fmt(item.tax_amount, 2);
        case 'line_total':          return fmt(item.line_total, 2);
        default:                    return '';
      }
    });
  });

  autoTable(doc, {
    startY: curY,
    head: tableHead,
    body: tableBody,
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
    showHead: 'everyPage',
    theme: 'grid',
    didDrawPage(data) {
      const pageNum = (doc.internal as any).getCurrentPageInfo().pageNumber;
      if (pageNum > 1) {
        const y = MARGIN;
        doc.setFillColor(...C.primary);
        doc.rect(MARGIN, y, CONTENT_W, 0.8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...C.primary);
        doc.text(org.name, MARGIN + 2, y + 4);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.muted);
        doc.text(`Purchase Order: ${header.po_number}  |  Continued`, PAGE_W - MARGIN, y + 4, { align: 'right' });
        doc.setLineWidth(0.25);
        doc.setDrawColor(...C.border);
        doc.line(MARGIN, y + 6, PAGE_W - MARGIN, y + 6);
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.muted);
      doc.text(`Page ${pageNum}`, PAGE_W / 2, PAGE_H - 4, { align: 'center' });
    },
  });

  let finalY: number = (doc as any).lastAutoTable.finalY ?? curY;

  // Check for page overflow before drawing totals block
  if (finalY + 65 > PAGE_H - MARGIN) {
    doc.addPage();
    finalY = MARGIN + 10;
  }

  // 4. Totals & Tax Summary Block
  let fY = finalY + 4;
  const wordsText = numberToWords(grandTotal);

  // Amount in words banner
  doc.setFillColor(...C.primaryLight);
  doc.rect(MARGIN, fY, CONTENT_W, 7, 'F');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.primary);
  doc.text('Amount in Words: ' + wordsText, MARGIN + 3, fY + 4.5);
  fY += 9;

  // Summary Table (Aligned Right)
  const summaryW = 85;
  const summaryX = MARGIN + CONTENT_W - summaryW;
  const labelW = 50;
  const valW = summaryW - labelW;

  let rightY = fY;
  const drawSummaryRow = (label: string, value: string, isBold = false, bg?: [number, number, number]) => {
    const rowH = 5.5;
    if (bg) { doc.setFillColor(...bg); doc.rect(summaryX, rightY, summaryW, rowH, 'F'); }
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.2);
    doc.rect(summaryX, rightY, summaryW, rowH);
    doc.rect(summaryX + labelW, rightY, valW, rowH);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...(isBold ? C.primary : C.text));
    doc.text(label, summaryX + 3, rightY + 3.8);
    doc.text(value, summaryX + summaryW - 2, rightY + 3.8, { align: 'right' });
    rightY += rowH;
  };

  drawSummaryRow('Sub-Total', fmtCur(subtotal, header.currency));
  if (discountTotal > 0) {
    drawSummaryRow('Discount', '-' + fmtCur(discountTotal, header.currency));
  }
  drawSummaryRow('Taxable Value', fmtCur(taxableTotal, header.currency));
  if (isInterState) {
    drawSummaryRow('IGST', fmtCur(igst || totalTax, header.currency));
  } else {
    drawSummaryRow('CGST', fmtCur(cgst || totalTax / 2, header.currency));
    drawSummaryRow('SGST', fmtCur(sgst || totalTax / 2, header.currency));
  }
  drawSummaryRow('Grand Total', fmtCur(grandTotal, header.currency), true, C.primaryLight);

  // Left: Delivery Location & Notes
  const leftW = CONTENT_W - summaryW - 4;
  let leftY = fY;

  if (header.delivery_location && header.delivery_location !== '—') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.primary);
    doc.text('Delivery Destination / Site:', MARGIN, leftY + 3);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.text);
    const locLines = doc.splitTextToSize(header.delivery_location, leftW);
    doc.text(locLines, MARGIN, leftY + 7);
    leftY += 8 + locLines.length * 3.5;
  }

  if (header.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.primary);
    doc.text('Notes / Instructions:', MARGIN, leftY + 3);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.muted);
    const nLines = doc.splitTextToSize(header.notes, leftW);
    doc.text(nLines, MARGIN, leftY + 7);
    leftY += 8 + nLines.length * 3.5;
  }

  fY = Math.max(rightY, leftY) + 6;

  // 5. Terms & Signatory Section
  if (fY + 35 > PAGE_H - MARGIN) {
    doc.addPage();
    fY = MARGIN + 10;
  }

  // Terms & Conditions (if present & show_terms !== false)
  if (header.terms_conditions && templateSettings?.show_terms !== false) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.primary);
    doc.text('Terms & Conditions:', MARGIN, fY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    const tLines = doc.splitTextToSize(header.terms_conditions, halfW + 10);
    doc.text(tLines, MARGIN, fY + 4);
  }

  // Authorised Signatory (Right) (if show_signature !== false)
  if (templateSettings?.show_signature !== false) {
    const sigW = 65;
    const sigX = PAGE_W - MARGIN - sigW;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.primary);
    doc.text(`For ${org.name}`, sigX + sigW / 2, fY, { align: 'center' });

    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.25);
    doc.line(sigX + 5, fY + 20, sigX + sigW - 5, fY + 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text('Authorised Signatory', sigX + sigW / 2, fY + 24, { align: 'center' });
  }

  // Footer Computer Generated Note
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.muted);
  doc.text('This is a computer-generated document. No signature is required.', MARGIN, PAGE_H - 4);

  return doc.output('blob');
}
