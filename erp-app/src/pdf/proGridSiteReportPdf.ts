import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PRO_MARGIN_MM, drawProDoubleFrame, appendProFooterNote } from './proGridLayout';

// ─────────────────────────────────────────────────────────────────────────────
//  STRICT TWO-TONE PALETTE  (MS Excel / Primavera style)
//
//  DARK  → [30, 41, 59]   slate-800  — headers, labels, borders
//  LIGHT → [241, 245, 249] slate-100  — label cell fill, banded rows
//  WHITE → [255,255,255]              — data cell fill
//  TEXT  → [15, 23, 42]   slate-900  — body text
//  MUTED → [100,116,139]  slate-500  — caption / helper text
//  LINE  → [203,213,225]  slate-300  — cell borders
// ─────────────────────────────────────────────────────────────────────────────
const DARK:  [number,number,number] = [30,  41,  59];   // section header fill
const LIGHT: [number,number,number] = [241,245,249];    // label bg / alt row
const WHITE: [number,number,number] = [255,255,255];
const INK:   [number,number,number] = [15,  23,  42];   // headings / values
const MUTED: [number,number,number] = [100,116,139];    // small captions
const LINE:  [number,number,number] = [203,213,225];    // borders

const M = PRO_MARGIN_MM; // 12 mm

// ─── helpers ─────────────────────────────────────────────────────────────────
function lastY(doc: jsPDF): number {
  return (doc as any).lastAutoTable?.finalY ?? M;
}
function usableW(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth() - 2 * M;
}
function guard(doc: jsPDF, y: number, need: number): number {
  if (y + need > doc.internal.pageSize.getHeight() - M - 8) {
    doc.addPage();
    drawProDoubleFrame(doc);
    return M + 4;
  }
  return y;
}

/** HH:MM or HH:MM:SS → "9:00 AM" */
function fmt12(t?: string): string {
  if (!t) return '—';
  const s = t.trim();
  if (/am|pm/i.test(s)) return s;
  const p = s.split(':');
  if (p.length < 2) return s;
  let h = parseInt(p[0], 10);
  if (isNaN(h)) return s;
  const m   = p[1].padStart(2, '0');
  const apm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${apm}`;
}

/** yyyy-mm-dd → dd-mm-yyyy */
function fmtDate(d?: string): string {
  if (!d) return '—';
  const c = d.trim().split('T')[0];
  const p = c.split('-');
  if (p.length === 3 && p[0].length === 4) return `${p[2]}-${p[1]}-${p[0]}`;
  return c;
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMPACT SINGLE-ROW ORG HEADER
//  [ Logo ]  Org name  +  address  +  contact  |  [ DOC TITLE box ]  GSTIN
// ─────────────────────────────────────────────────────────────────────────────
function renderHeader(
  doc: jsPDF,
  org: Record<string, unknown>,
  title: string,
): number {
  const pw       = doc.internal.pageSize.getWidth();
  const y0       = M + 1;
  const logoW    = 22;
  const logoH    = 16;
  const rightW   = 46;
  const centreX  = M + logoW + 3;
  const centreW  = usableW(doc) - logoW - 3 - rightW - 2;

  // Logo
  if (org.logo_url) {
    try { doc.addImage(org.logo_url as string, 'PNG', M, y0, logoW, logoH); }
    catch { /* ignore */ }
  }

  // Org name
  let cy = y0 + 4;
  doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK);
  doc.text(String(org.name ?? 'Organisation'), centreX, cy);
  cy += 4.5;

  // Address (max 2 lines)
  const addr = String(org.address ?? '');
  if (addr) {
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED);
    const lines: string[] = doc.splitTextToSize(addr, centreW);
    doc.text(lines.slice(0, 2), centreX, cy);
    cy += lines.slice(0, 2).length * 3.4;
  }

  // Contact line
  const contact = [
    org.phone   ? `Ph: ${org.phone}`   : null,
    org.email   ? `${org.email}`        : null,
    org.website ? `${org.website}`      : null,
  ].filter(Boolean).join('   ·   ');
  if (contact) {
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED);
    doc.text(contact, centreX, cy);
    cy += 3.5;
  }

  // Right — document title box (dark fill, white text)
  const rx = pw - M - rightW;
  doc.setFillColor(...DARK);
  doc.rect(rx, y0, rightW, 7, 'F');
  doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
  doc.text(title.toUpperCase(), rx + rightW / 2, y0 + 4.8, { align: 'center' });

  // GSTIN
  if (org.gstin) {
    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED);
    doc.text(`GSTIN: ${org.gstin}`, rx + rightW / 2, y0 + 11, { align: 'center' });
  }

  // Separator — thin dark rule
  const lineY = y0 + Math.max(logoH, cy - y0) + 1;
  doc.setDrawColor(...DARK);
  doc.setLineWidth(0.5);
  doc.line(M, lineY, pw - M, lineY);

  return lineY + 2.5;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SPOTLIGHT — 3 identity boxes: CLIENT | PROJECT | DATE
// ─────────────────────────────────────────────────────────────────────────────
function renderSpotlight(
  doc: jsPDF,
  y: number,
  client: string,
  project: string,
  date: string,
  status: string,
): number {
  const w  = usableW(doc);
  const bw = w / 3;
  const bh = 16;

  const boxes = [
    { label: 'CLIENT',      value: client  },
    { label: 'PROJECT',     value: project },
    { label: 'REPORT DATE', value: date    },
  ];

  boxes.forEach((b, i) => {
    const bx = M + i * bw;
    // Fill alternating light / dark for the top stripe
    doc.setFillColor(...LIGHT);
    doc.rect(bx, y, bw, bh, 'F');
    doc.setFillColor(...DARK);
    doc.rect(bx, y, bw, 2.5, 'F');           // top stripe
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.rect(bx, y, bw, bh);
    // Label (white on dark stripe)
    doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
    doc.text(b.label, bx + bw / 2, y + 1.9, { align: 'center' });
    // Value
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK);
    const lines: string[] = doc.splitTextToSize(b.value || '—', bw - 4);
    doc.text(lines[0] || '—', bx + bw / 2, y + 11.5, { align: 'center' });
  });

  // Status — plain text badge top-right (no colour, just border)
  if (status) {
    const tw = doc.getTextWidth(status) + 6;
    const tx = M + w - tw;
    doc.setFillColor(...LIGHT);
    doc.rect(tx, y - 5.5, tw, 5, 'F');
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.rect(tx, y - 5.5, tw, 5);
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK);
    doc.text(status, tx + tw / 2, y - 2.3, { align: 'center' });
  }

  return y + bh + 3;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION HEADING  — dark filled bar, white bold text
// ─────────────────────────────────────────────────────────────────────────────
function sectionHead(doc: jsPDF, y: number, title: string): number {
  y = guard(doc, y, 8);
  const w = usableW(doc);
  doc.setFillColor(...DARK);
  doc.rect(M, y, w, 6.5, 'F');
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
  doc.text(title.toUpperCase(), M + 3, y + 4.5);
  return y + 8;
}

// ─────────────────────────────────────────────────────────────────────────────
//  2-COLUMN KV GRID  (label | value | label | value)
// ─────────────────────────────────────────────────────────────────────────────
function kvGrid(doc: jsPDF, y: number, rows: (string | undefined)[][]): number {
  const half = usableW(doc) / 2;
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    body: rows.map(r => [r[0] ?? '', r[1] ?? '—', r[2] ?? '', r[3] ?? (r[2] ? '—' : '')]),
    theme: 'grid',
    showHead: false,
    styles: {
      fontSize: 8,
      cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
      lineColor: LINE,
      lineWidth: 0.15,
      valign: 'middle',
      textColor: INK,
    },
    columnStyles: {
      0: { cellWidth: half * 0.35, fontStyle: 'bold', fillColor: LIGHT, textColor: INK },
      1: { cellWidth: half * 0.65, fillColor: WHITE },
      2: { cellWidth: half * 0.35, fontStyle: 'bold', fillColor: LIGHT, textColor: INK },
      3: { cellWidth: half * 0.65, fillColor: WHITE },
    },
  });
  return lastY(doc) + 2;
}

// ─────────────────────────────────────────────────────────────────────────────
//  FULL-WIDTH KV  (label | long value)
// ─────────────────────────────────────────────────────────────────────────────
function fwGrid(doc: jsPDF, y: number, rows: (string | undefined)[][]): number {
  const w      = usableW(doc);
  const labelW = 44;
  const data   = rows.filter(r => r[1]);
  if (!data.length) return y;
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    body: data.map(r => [r[0] ?? '', r[1] ?? '']),
    theme: 'grid',
    showHead: false,
    styles: {
      fontSize: 8,
      cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
      lineColor: LINE,
      lineWidth: 0.15,
      valign: 'top',
      textColor: INK,
    },
    columnStyles: {
      0: { cellWidth: labelW, fontStyle: 'bold', fillColor: LIGHT, textColor: INK },
      1: { cellWidth: w - labelW, fillColor: WHITE },
    },
  });
  return lastY(doc) + 2;
}

// ─────────────────────────────────────────────────────────────────────────────
//  DATA TABLE  — dark header, banded LIGHT rows
// ─────────────────────────────────────────────────────────────────────────────
function dataTable(
  doc: jsPDF,
  y: number,
  head: string[],
  body: string[][],
  colW: number[],
): number {
  if (!body.length) return y;
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [head],
    body,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
      lineColor: LINE,
      lineWidth: 0.15,
      valign: 'middle',
      textColor: INK,
      fillColor: WHITE,
    },
    headStyles: {
      fillColor: DARK,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: Object.fromEntries(colW.map((w, i) => [i, { cellWidth: w }])),
  });
  return lastY(doc) + 2;
}

// ─────────────────────────────────────────────────────────────────────────────
//  PROGRESS BAR  — plain dark-filled rectangle, no colour
// ─────────────────────────────────────────────────────────────────────────────
function progressBar(doc: jsPDF, y: number, label: string, pctStr?: string): number {
  const pct  = Math.min(100, Math.max(0, parseFloat(pctStr ?? '0') || 0));
  const w    = usableW(doc);
  const barW = w - 52;
  const bx   = M + 52;
  const barH = 5;

  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK);
  doc.text(label, M + 3, y + 3.8);

  // Track
  doc.setFillColor(...LIGHT);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.rect(bx, y + 0.5, barW, barH, 'FD');

  // Fill
  if (pct > 0) {
    doc.setFillColor(...DARK);
    doc.rect(bx, y + 0.5, (barW * pct) / 100, barH, 'F');
  }

  // Label
  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK);
  doc.text(`${pct}%`, bx + barW + 2, y + 4.2);

  return y + barH + 3;
}

// ─────────────────────────────────────────────────────────────────────────────
//  KPI BAR  — 4 stat boxes, dark bottom rule, no colour fill
// ─────────────────────────────────────────────────────────────────────────────
function kpiBar(
  doc: jsPDF,
  y: number,
  stats: { label: string; value: string }[],
): number {
  const w  = usableW(doc);
  const bw = w / stats.length;
  const bh = 13;

  stats.forEach((s, i) => {
    const bx = M + i * bw;
    doc.setFillColor(...LIGHT);
    doc.rect(bx, y, bw, bh, 'F');
    // Bottom rule — dark
    doc.setFillColor(...DARK);
    doc.rect(bx, y + bh - 1.5, bw, 1.5, 'F');
    // Border
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.rect(bx, y, bw, bh);
    // Value
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK);
    doc.text(s.value || '—', bx + bw / 2, y + 7, { align: 'center' });
    // Label
    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED);
    doc.text(s.label.toUpperCase(), bx + bw / 2, y + 11, { align: 'center' });
  });
  return y + bh + 3;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SAFETY ROW  — label | YES/NO plain text (no colour badges)
// ─────────────────────────────────────────────────────────────────────────────
function safetyRow(
  doc: jsPDF,
  y: number,
  items: { label: string; val: boolean | undefined }[],
): number {
  const w  = usableW(doc);
  const bw = w / items.length;
  const bh = 7;
  items.forEach((s, i) => {
    const bx = M + i * bw;
    // Label cell
    doc.setFillColor(...LIGHT);
    doc.rect(bx, y, bw * 0.45, bh, 'F');
    // Value cell
    doc.setFillColor(...WHITE);
    doc.rect(bx + bw * 0.45, y, bw * 0.55, bh, 'F');
    // Border
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.15);
    doc.rect(bx, y, bw, bh);
    // Label text
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK);
    doc.text(s.label, bx + 3, y + 4.5);
    // Value text
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...INK);
    doc.text(s.val ? 'Yes' : 'No', bx + bw * 0.45 + 3, y + 4.5);
  });
  return y + bh + 1;
}

function checkIndicator(val: boolean | undefined): string {
  return val ? 'Yes' : 'No';
}

// =============================================================================
//  TYPES
// =============================================================================
export type SiteReportData = {
  id: string;
  report_date: string;
  client_name?: string;
  project_name?: string;
  pm_name?: string;
  pm_status?: string;
  weather?: string;
  start_time?: string;
  end_time?: string;
  total_manpower?: string;
  skilled_manpower?: string;
  unskilled_manpower?: string;
  planned_progress?: string;
  actual_progress?: string;
  percent_complete?: string;
  equipment_on_site?: string;
  breakdown_issues?: string;
  toolbox_meeting?: boolean;
  ppe_followed?: boolean;
  inspection_status?: string;
  satisfied_percent?: string;
  rework_required_reason?: string;
  is_rework?: boolean;
  rework_reason?: string;
  rework_start?: string;
  rework_end?: string;
  rework_material_used?: string;
  rework_total_manpower?: string;
  work_plan_next_day?: string;
  special_instructions?: string;
  issues_faced?: string;
  doc_type?: string;
  doc_no?: string;
  received_signature?: string;
  quote_to_be_sent?: boolean;
  mail_received?: boolean;
  is_filed?: boolean;
  tools_locked?: boolean;
  site_pictures_status?: string;
  manpower: {
    subContractors: Array<{ name: string; count: string; start_time?: string; end_time?: string }>;
    workCarriedOut: Array<{ description: string; trade?: string }>;
    milestonesCompleted: Array<{ description: string }>;
  };
  photos: Array<{ file_name: string; file_path?: string }>;
  footer: { enginear?: string; signatureDate?: string };
};

export type SiteReportParams = {
  siteReport: SiteReportData;
  organisation?: Record<string, unknown>;
  orientation?: 'portrait' | 'landscape';
  pageFormat?: 'a4' | 'letter';
};

// =============================================================================
//  MAIN EXPORT
// =============================================================================
export function generateProGridSiteReportPdf(params: SiteReportParams): jsPDF {
  const { siteReport: r, organisation = {}, pageFormat = 'a4' } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: pageFormat === 'letter' ? 'letter' : 'a4',
  });
  drawProDoubleFrame(doc);

  // 1. HEADER
  let y = renderHeader(doc, organisation, 'Daily Site Report');

  // 2. CLIENT / PROJECT / DATE SPOTLIGHT
  y = guard(doc, y, 22);
  y = renderSpotlight(doc, y,
    r.client_name  || '—',
    r.project_name || '—',
    fmtDate(r.report_date),
    r.pm_status    || '',
  );

  // 3. MANPOWER KPI BAR
  y = guard(doc, y, 18);
  y = kpiBar(doc, y, [
    { label: 'Total Manpower',  value: r.total_manpower     || '—' },
    { label: 'Skilled',         value: r.skilled_manpower   || '—' },
    { label: 'Unskilled',       value: r.unskilled_manpower || '—' },
    { label: 'Completion',      value: r.percent_complete ? `${r.percent_complete}%` : '—' },
  ]);

  // 4. MANPOWER DETAILS
  y = guard(doc, y, 30);
  y = sectionHead(doc, y, '1.  Manpower');
  y = kvGrid(doc, y, [
    ['Total',   r.total_manpower,   'Shift Period', `${fmt12(r.start_time)} — ${fmt12(r.end_time)}`],
    ['Skilled', r.skilled_manpower, 'Unskilled',    r.unskilled_manpower],
  ]);

  const subs = (r.manpower?.subContractors || []).filter(s => s.name);
  if (subs.length > 0) {
    y = guard(doc, y, 12 + subs.length * 7);
    const tw = usableW(doc);
    y = dataTable(doc, y,
      ['#', 'Sub-Contractor', 'Count', 'Start', 'End'],
      subs.map((s, i) => [`${i + 1}`, s.name, s.count || '—', fmt12(s.start_time), fmt12(s.end_time)]),
      [8, tw - 88, 20, 30, 30],
    );
  }

  // 5. WORK CARRIED OUT
  const works = (r.manpower?.workCarriedOut || []).filter(w => w.description);
  if (works.length > 0) {
    y = guard(doc, y, 14 + works.length * 7);
    const tw = usableW(doc);
    y = sectionHead(doc, y, '2.  Work Carried Out');
    y = dataTable(doc, y,
      ['#', 'Trade / Category', 'Description of Work'],
      works.map((w, i) => [`${i + 1}`, w.trade || 'General', w.description]),
      [8, 42, tw - 50],
    );
  }

  // 6. MILESTONES
  const milestones = (r.manpower?.milestonesCompleted || []).filter(m => m.description);
  if (milestones.length > 0) {
    y = guard(doc, y, 14 + milestones.length * 7);
    const tw = usableW(doc);
    y = sectionHead(doc, y, '3.  Milestones Completed');
    y = dataTable(doc, y,
      ['#', 'Milestone Description'],
      milestones.map((m, i) => [`${i + 1}`, m.description]),
      [8, tw - 8],
    );
  }

  // 7. PROGRESS
  y = guard(doc, y, 40);
  y = sectionHead(doc, y, '4.  Progress');
  y = kvGrid(doc, y, [
    ['Planned Progress', r.planned_progress, 'Actual Progress', r.actual_progress],
  ]);
  y = guard(doc, y, 12);
  y = progressBar(doc, y, 'Overall Completion', r.percent_complete);

  // 8. EQUIPMENT & SAFETY
  y = guard(doc, y, 38);
  y = sectionHead(doc, y, '5.  Equipment & Safety');
  y = safetyRow(doc, y, [
    { label: 'Toolbox Meeting', val: r.toolbox_meeting },
    { label: 'PPE Followed',    val: r.ppe_followed    },
  ]);
  y = kvGrid(doc, y, [
    ['Inspection Status', r.inspection_status,
     'Satisfied %', r.satisfied_percent ? `${r.satisfied_percent}%` : undefined],
  ]);
  if (r.equipment_on_site || r.breakdown_issues) {
    y = fwGrid(doc, y, [
      ['Equipment on Site', r.equipment_on_site],
      ['Breakdown Issues',  r.breakdown_issues],
    ]);
  }

  // 9. REWORK (conditional)
  if (r.is_rework) {
    y = guard(doc, y, 38);
    y = sectionHead(doc, y, '6.  Rework Details');
    y = kvGrid(doc, y, [
      ['Rework Required', 'Yes',               'Reason',         r.rework_reason],
      ['Start Time',      fmt12(r.rework_start),'End Time',      fmt12(r.rework_end)],
      ['Material Used',   r.rework_material_used,'Total Manpower',r.rework_total_manpower],
    ]);
  }

  // 10. PLANNING & NOTES
  const hasNotes = r.work_plan_next_day || r.special_instructions || r.issues_faced;
  if (hasNotes) {
    y = guard(doc, y, 30);
    y = sectionHead(doc, y, '7.  Planning & Notes');
    y = fwGrid(doc, y, [
      ['Work Plan (Next Day)',  r.work_plan_next_day],
      ['Special Instructions', r.special_instructions],
      ['Issues Faced',         r.issues_faced],
    ]);
  }

  // 11. DOCUMENTATION
  y = guard(doc, y, 38);
  y = sectionHead(doc, y, '8.  Documentation & Sign-off');
  y = kvGrid(doc, y, [
    ['Doc Type',       r.doc_type,                      'Doc No',        r.doc_no],
    ['Received Sign.', r.received_signature,             'Site Pictures', r.site_pictures_status],
    ['Quote to Send',  checkIndicator(r.quote_to_be_sent),'Mail Received',checkIndicator(r.mail_received)],
    ['Filed',          checkIndicator(r.is_filed),       'Tools Locked',  checkIndicator(r.tools_locked)],
  ]);

  // 12. PHOTOS
  if (r.photos?.length > 0) {
    y = guard(doc, y, 14);
    y = sectionHead(doc, y, '9.  Site Photos');
    const tw = usableW(doc);
    y = dataTable(doc, y,
      ['#', 'File Name'],
      r.photos.map((p, i) => [`${i + 1}`, p.file_name]),
      [8, tw - 8],
    );
  }

  // 13. SIGN-OFF BOX
  y = guard(doc, y, 26);
  const sigW = usableW(doc) / 2;
  const sigH = 18;

  // Left — engineer
  doc.setFillColor(...LIGHT);
  doc.rect(M, y, sigW, sigH, 'F');
  doc.setDrawColor(...LINE); doc.setLineWidth(0.2);
  doc.rect(M, y, sigW, sigH);
  doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED);
  doc.text('ENGINEER / SUPERVISOR', M + 3, y + 4);
  doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK);
  doc.text(r.footer?.enginear || '—', M + 3, y + 10.5);
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED);
  doc.text('Signature ________________________________', M + 3, y + 16.5);

  // Right — date (dark fill)
  doc.setFillColor(...DARK);
  doc.rect(M + sigW, y, sigW, sigH, 'F');
  doc.setDrawColor(...LINE);
  doc.rect(M + sigW, y, sigW, sigH);
  doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...LIGHT);
  doc.text('SIGNATURE DATE', M + sigW + 3, y + 4);
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
  doc.text(fmtDate(r.footer?.signatureDate), M + sigW + 3, y + 12);

  // PER-PAGE FOOTER
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    appendProFooterNote(
      doc,
      `Daily Site Report  ·  ${r.project_name || ''}  ·  ${fmtDate(r.report_date)}   |   Page ${i} of ${totalPages}   |   Computer generated`,
    );
    // thin dark rule at bottom
    const ph = doc.internal.pageSize.getHeight();
    doc.setFillColor(...DARK);
    doc.rect(M, ph - 5, usableW(doc), 0.6, 'F');
  }

  return doc;
}
