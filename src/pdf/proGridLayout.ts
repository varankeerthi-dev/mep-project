import type { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/** Slate-100 style label cells */
export const PRO_GRID_LABEL_FILL: [number, number, number] = [241, 245, 249];
export const PRO_GRID_HEAD_FILL: [number, number, number] = [226, 232, 240];
export const PRO_GRID_LINE: [number, number, number] = [148, 163, 184];

export const PRO_MARGIN_MM = 12;

export function hexToRgb(hex: string | undefined | null): [number, number, number] {
  if (!hex || typeof hex !== 'string') return [37, 99, 235];
  const h = hex.replace('#', '').trim();
  if (h.length !== 6) return [37, 99, 235];
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return [37, 99, 235];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function drawProDoubleFrame(doc: jsPDF): void {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.35);
  doc.rect(4, 4, w - 8, h - 8);
  doc.setDrawColor(...PRO_GRID_LINE);
  doc.setLineWidth(0.15);
  doc.rect(5.5, 5.5, w - 11, h - 11);
}

export function renderProOrgBanner(
  doc: jsPDF,
  organisation: Record<string, unknown>,
  opts: { documentTitle: string; tagline?: string; themeHex?: string | null },
): number {
  const margin = PRO_MARGIN_MM;
  const pageWidth = doc.internal.pageSize.getWidth();
  const theme = hexToRgb((opts.themeHex as string) || (organisation.theme_color as string) || '#0f172a');
  let y = margin + 2;

  if (organisation.logo_url) {
    try {
      doc.addImage(organisation.logo_url as string, 'PNG', margin, y, 22, 18);
    } catch {
      /* ignore */
    }
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`GSTIN: ${String(organisation.gstin ?? '-')}`, pageWidth - margin, y + 4, { align: 'right' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(theme[0], theme[1], theme[2]);
  doc.text(opts.documentTitle.toUpperCase(), pageWidth / 2, y + 8, { align: 'center' });

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(String(organisation.name ?? 'Organisation'), pageWidth / 2, y + 16, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const addr = String(organisation.address ?? '');
  const addrLines = doc.splitTextToSize(addr || '—', pageWidth - 2 * margin - 24);
  doc.text(addrLines, pageWidth / 2, y + 21, { align: 'center' });
  y += 22 + addrLines.length * 3.6;

  const contact = [
    organisation.email ? `Email: ${organisation.email}` : null,
    organisation.phone ? `Ph: ${organisation.phone}` : null,
    organisation.website ? `Web: ${organisation.website}` : null,
  ]
    .filter(Boolean)
    .join('  |  ');
  if (contact) {
    doc.text(contact, pageWidth / 2, y, { align: 'center' });
    y += 4;
  }

  if (opts.tagline) {
    doc.setFontSize(7);
    doc.text(opts.tagline, pageWidth / 2, y + 1, { align: 'center' });
    y += 5;
  }

  y += 4;
  doc.setDrawColor(...PRO_GRID_LINE);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageWidth - margin, y);
  return y + 2;
}

/** Rows of [label1, value1, label2, value2] — empty strings skip pair for alignment */
export function appendLabelValueGrid(
  doc: jsPDF,
  startY: number,
  rows: string[][],
  options?: { title?: string },
): number {
  const margin = PRO_MARGIN_MM;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - 2 * margin;

  if (options?.title) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(options.title, margin, startY);
    startY += 4;
  }

  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    body: rows,
    theme: 'grid',
    showHead: false,
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      lineColor: PRO_GRID_LINE,
      lineWidth: 0.12,
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.18, fontStyle: 'bold', fillColor: PRO_GRID_LABEL_FILL, textColor: [51, 65, 85] },
      1: { cellWidth: contentWidth * 0.32 - 0.5 },
      2: { cellWidth: contentWidth * 0.18, fontStyle: 'bold', fillColor: PRO_GRID_LABEL_FILL, textColor: [51, 65, 85] },
      3: { cellWidth: contentWidth * 0.32 - 0.5 },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  doc.setTextColor(0, 0, 0);
  return finalY + 3;
}

export function appendSectionHeading(doc: jsPDF, y: number, title: string): number {
  const margin = PRO_MARGIN_MM;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(title, margin, y);
  return y + 4;
}

export function appendProFooterNote(doc: jsPDF, line: string): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(line, pageWidth / 2, pageHeight - 8, { align: 'center' });
}
