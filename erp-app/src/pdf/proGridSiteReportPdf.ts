import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PRO_MARGIN_MM, drawProDoubleFrame, renderProOrgBanner, appendSectionHeading, appendProFooterNote } from './proGridLayout';

type SiteReportData = {
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
    subContractors: Array<{
      name: string;
      count: string;
      start_time?: string;
      end_time?: string;
    }>;
    workCarriedOut: Array<{
      description: string;
      trade?: string;
    }>;
    milestonesCompleted: Array<{
      description: string;
    }>;
  };
  photos: Array<{
    file_name: string;
    file_path?: string;
  }>;
  footer: {
    enginear?: string;
    signatureDate?: string;
  };
};

type SiteReportParams = {
  siteReport: SiteReportData;
  organisation?: Record<string, unknown>;
  orientation?: 'portrait' | 'landscape';
  pageFormat?: 'a4' | 'letter';
};

const THEME: [number, number, number] = [15, 23, 42];
const LABEL_BG: [number, number, number] = [241, 245, 249];
const HEAD_BG: [number, number, number] = [30, 41, 59];
const WHITE: [number, number, number] = [255, 255, 255];
const GRAY_TEXT: [number, number, number] = [51, 65, 85];
const LIGHT_LINE: [number, number, number] = [203, 213, 225];

function getLastY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function checkPageBreak(doc: jsPDF, currentY: number, neededSpace: number, margin: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (currentY + neededSpace > pageH - margin - 10) {
    doc.addPage();
    drawProDoubleFrame(doc);
    return margin + 6;
  }
  return currentY;
}

/**
 * Renders a 2-column grid of label-value pairs.
 * Each row in `pairs` is [label1, value1, label2, value2].
 * If label2 is empty, the cell spans full width.
 */
function renderGrid(
  doc: jsPDF,
  startY: number,
  pairs: string[][],
): number {
  const margin = PRO_MARGIN_MM;
  const pageW = doc.internal.pageSize.getWidth();
  const totalW = pageW - 2 * margin;
  const colW = totalW / 2;

  const body = pairs.map(row => {
    const l1 = row[0] || '';
    const v1 = row[1] || '—';
    const l2 = row[2] || '';
    const v2 = row[3] || '—';
    return [l1, v1, l2, v2];
  });

  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    head: [],
    body,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      lineColor: LIGHT_LINE,
      lineWidth: 0.1,
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: colW * 0.32, fontStyle: 'bold', fillColor: LABEL_BG, textColor: THEME },
      1: { cellWidth: colW * 0.68, textColor: GRAY_TEXT },
      2: { cellWidth: colW * 0.32, fontStyle: 'bold', fillColor: LABEL_BG, textColor: THEME },
      3: { cellWidth: colW * 0.68, textColor: GRAY_TEXT },
    },
  });
  return getLastY(doc) + 2;
}

/**
 * Renders a single-column key-value table for long text.
 */
function renderFullWidth(
  doc: jsPDF,
  startY: number,
  rows: string[][],
): number {
  const margin = PRO_MARGIN_MM;
  const pageW = doc.internal.pageSize.getWidth();
  const totalW = pageW - 2 * margin;
  const col0 = 42;

  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    head: [],
    body: rows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      lineColor: LIGHT_LINE,
      lineWidth: 0.1,
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: col0, fontStyle: 'bold', fillColor: LABEL_BG, textColor: THEME },
      1: { cellWidth: totalW - col0, textColor: GRAY_TEXT },
    },
  });
  return getLastY(doc) + 2;
}

/**
 * Renders a data table with header.
 */
function renderTable(
  doc: jsPDF,
  startY: number,
  head: string[][],
  body: string[][],
  colWidths?: number[],
): number {
  const margin = PRO_MARGIN_MM;
  const pageW = doc.internal.pageSize.getWidth();
  const totalW = pageW - 2 * margin;

  const columnStyles: Record<number, { cellWidth: number }> = {};
  if (colWidths) {
    colWidths.forEach((w, i) => { columnStyles[i] = { cellWidth: w }; });
  } else {
    const n = head[0]?.length || 1;
    const w = totalW / n;
    for (let i = 0; i < n; i++) columnStyles[i] = { cellWidth: w };
  }

  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    head,
    body,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      lineColor: LIGHT_LINE,
      lineWidth: 0.1,
      textColor: [30, 41, 59],
      valign: 'middle',
    },
    headStyles: {
      fillColor: HEAD_BG,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fillColor: WHITE,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles,
  });
  return getLastY(doc) + 2;
}

export function generateProGridSiteReportPdf(params: SiteReportParams): jsPDF {
  const { siteReport, organisation, orientation = 'portrait', pageFormat = 'a4' } = params;

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: pageFormat === 'letter' ? 'letter' : 'a4',
  });

  drawProDoubleFrame(doc);

  let y = renderProOrgBanner(
    doc,
    organisation || {},
    {
      documentTitle: 'Site Report',
      tagline: `Report Date: ${siteReport.report_date || 'N/A'}`,
    },
  );

  const margin = PRO_MARGIN_MM;

  // ── REPORT DETAILS (2-col grid) ──
  y = appendSectionHeading(doc, y, 'REPORT DETAILS');
  y = renderGrid(doc, y, [
    ['Report Date', siteReport.report_date, 'Client', siteReport.client_name],
    ['Project', siteReport.project_name, 'PM Status', siteReport.pm_status],
    ['Start Time', siteReport.start_time, 'End Time', siteReport.end_time],
    ['Weather', siteReport.weather, '', ''],
  ]);

  // ── MANPOWER (2-col grid) ──
  y = checkPageBreak(doc, y, 30, margin);
  y = appendSectionHeading(doc, y, 'MANPOWER');
  y = renderGrid(doc, y, [
    ['Total Manpower', siteReport.total_manpower, 'Skilled', siteReport.skilled_manpower],
    ['Unskilled', siteReport.unskilled_manpower, '', ''],
  ]);

  // ── SUB-CONTRACTORS TABLE ──
  if (siteReport.manpower?.subContractors?.length > 0) {
    const subData = siteReport.manpower.subContractors
      .filter(s => s.name)
      .map((s, i) => [`${i + 1}`, s.name || '', s.count || '', s.start_time || '', s.end_time || '']);
    if (subData.length > 0) {
      y = checkPageBreak(doc, y, 15 + subData.length * 8, margin);
      y = appendSectionHeading(doc, y, 'SUB-CONTRACTORS');
      y = renderTable(doc, y, [['#', 'Name', 'Count', 'Start', 'End']], subData, [10, 55, 25, 40, 40]);
    }
  }

  // ── WORK PROGRESS (2-col grid + full-width) ──
  y = checkPageBreak(doc, y, 30, margin);
  y = appendSectionHeading(doc, y, 'WORK PROGRESS');
  y = renderGrid(doc, y, [
    ['Planned Progress', siteReport.planned_progress, 'Actual Progress', siteReport.actual_progress],
    ['% Complete', siteReport.percent_complete ? `${siteReport.percent_complete}%` : undefined, '', ''],
  ]);

  // ── EQUIPMENT & SAFETY (2-col grid) ──
  y = checkPageBreak(doc, y, 30, margin);
  y = appendSectionHeading(doc, y, 'EQUIPMENT & SAFETY');
  y = renderGrid(doc, y, [
    ['Toolbox Meeting', siteReport.toolbox_meeting ? 'Yes' : 'No', 'PPE Followed', siteReport.ppe_followed ? 'Yes' : 'No'],
    ['Inspection Status', siteReport.inspection_status, 'Satisfied %', siteReport.satisfied_percent ? `${siteReport.satisfied_percent}%` : undefined],
  ]);

  // ── EQUIPMENT (full-width for long text) ──
  if (siteReport.equipment_on_site || siteReport.breakdown_issues) {
    y = checkPageBreak(doc, y, 25, margin);
    y = renderFullWidth(doc, y, [
      ['Equipment on Site', siteReport.equipment_on_site],
      ['Breakdown Issues', siteReport.breakdown_issues],
    ]);
  }

  // ── WORK CARRIED OUT ──
  if (siteReport.manpower?.workCarriedOut?.length > 0) {
    const workData = siteReport.manpower.workCarriedOut
      .filter(w => w.description)
      .map((w, i) => [`${i + 1}`, w.trade || 'General', w.description]);
    if (workData.length > 0) {
      y = checkPageBreak(doc, y, 15 + workData.length * 8, margin);
      y = appendSectionHeading(doc, y, 'WORK CARRIED OUT');
      y = renderTable(doc, y, [['#', 'Trade', 'Description']], workData, [10, 40, 146]);
    }
  }

  // ── MILESTONES COMPLETED ──
  if (siteReport.manpower?.milestonesCompleted?.length > 0) {
    const msData = siteReport.manpower.milestonesCompleted
      .filter(m => m.description)
      .map((m, i) => [`${i + 1}`, m.description]);
    if (msData.length > 0) {
      y = checkPageBreak(doc, y, 15 + msData.length * 8, margin);
      y = appendSectionHeading(doc, y, 'MILESTONES COMPLETED');
      y = renderTable(doc, y, [['#', 'Description']], msData, [10, 186]);
    }
  }

  // ── REWORK (2-col grid, conditional) ──
  if (siteReport.is_rework) {
    y = checkPageBreak(doc, y, 30, margin);
    y = appendSectionHeading(doc, y, 'REWORK DETAILS');
    y = renderGrid(doc, y, [
      ['Rework Required', 'Yes', 'Reason', siteReport.rework_reason],
      ['Start Time', siteReport.rework_start, 'End Time', siteReport.rework_end],
      ['Material Used', siteReport.rework_material_used, 'Total Manpower', siteReport.rework_total_manpower],
    ]);
  }

  // ── PLANNING & NOTES (full-width for long text) ──
  const hasNotes = siteReport.work_plan_next_day || siteReport.special_instructions || siteReport.issues_faced;
  if (hasNotes) {
    y = checkPageBreak(doc, y, 30, margin);
    y = appendSectionHeading(doc, y, 'PLANNING & NOTES');
    y = renderFullWidth(doc, y, [
      ['Work Plan (Next Day)', siteReport.work_plan_next_day],
      ['Special Instructions', siteReport.special_instructions],
      ['Issues Faced', siteReport.issues_faced],
    ]);
  }

  // ── DOCUMENTATION (2-col grid) ──
  y = checkPageBreak(doc, y, 30, margin);
  y = appendSectionHeading(doc, y, 'DOCUMENTATION');
  y = renderGrid(doc, y, [
    ['Doc Type', siteReport.doc_type, 'Doc No', siteReport.doc_no],
    ['Received Signature', siteReport.received_signature, 'Site Pictures', siteReport.site_pictures_status],
    ['Quote to be Sent', siteReport.quote_to_be_sent ? 'Yes' : 'No', 'Mail Received', siteReport.mail_received ? 'Yes' : 'No'],
    ['Filed', siteReport.is_filed ? 'Yes' : 'No', 'Tools Locked', siteReport.tools_locked ? 'Yes' : 'No'],
  ]);

  // ── PHOTOS ──
  if (siteReport.photos?.length > 0) {
    y = checkPageBreak(doc, y, 15, margin);
    y = appendSectionHeading(doc, y, 'PHOTOS');
    siteReport.photos.forEach((photo, i) => {
      y = checkPageBreak(doc, y, 6, margin);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(`${i + 1}. ${photo.file_name}`, margin + 2, y);
      y += 4.5;
    });
    y += 2;
  }

  // ── SIGN-OFF (2-col grid) ──
  y = checkPageBreak(doc, y, 20, margin);
  y = appendSectionHeading(doc, y, 'SIGN-OFF');
  y = renderGrid(doc, y, [
    ['Engineer / Supervisor', siteReport.footer?.enginear, 'Signature Date', siteReport.footer?.signatureDate],
  ]);

  // Footer note
  appendProFooterNote(doc, 'Site report — computer generated.');

  return doc;
}
