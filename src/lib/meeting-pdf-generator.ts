import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Meeting, MeetingMinutesItem, MeetingAttendee } from '../meetings/types';

export interface PDFOptions {
  includeAttendees?: boolean;
  includeMinutes?: boolean;
  pageOrientation?: 'portrait' | 'landscape';
  fontSize?: {
    title?: number;
    subtitle?: number;
    body?: number;
    table?: number;
  };
}

const DEFAULT_OPTIONS: Required<PDFOptions> = {
  includeAttendees: true,
  includeMinutes: true,
  pageOrientation: 'portrait',
  fontSize: {
    title: 20,
    subtitle: 14,
    body: 12,
    table: 9,
  },
};

export function generateMinutesPDF(
  meeting: Meeting,
  minutesItems: MeetingMinutesItem[],
  attendees: MeetingAttendee[],
  options: PDFOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const doc = new jsPDF(opts.pageOrientation);
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  
  // Title
  doc.setFontSize(opts.fontSize.title);
  doc.setFont('helvetica', 'bold');
  doc.text('Minutes of Meeting', pageWidth / 2, 20, { align: 'center' });
  
  // Meeting Info Section
  doc.setFontSize(opts.fontSize.subtitle);
  doc.setFont('helvetica', 'bold');
  let currentY = 35;
  
  // Client and Vendor Row
  doc.setFontSize(opts.fontSize.body);
  doc.setFont('helvetica', 'normal');
  const colWidth = (pageWidth - margin * 2) / 3;
  
  // Client Name
  doc.text('Client:', margin, currentY);
  doc.setFont('helvetica', 'bold');
  doc.text(meeting.client_name || '-', margin, currentY + 6);
  
  // Vendor Name
  doc.setFont('helvetica', 'normal');
  doc.text('Vendor:', margin + colWidth, currentY);
  doc.setFont('helvetica', 'bold');
  doc.text(meeting.vendor_name || '-', margin + colWidth, currentY + 6);
  
  // Date & Time
  doc.setFont('helvetica', 'normal');
  doc.text('Date & Time:', margin + colWidth * 2, currentY);
  doc.setFont('helvetica', 'bold');
  const dateTime = meeting.meeting_time 
    ? `${meeting.meeting_date} at ${meeting.meeting_time}`
    : meeting.meeting_date;
  doc.text(dateTime, margin + colWidth * 2, currentY + 6);
  
  currentY += 18;
  
  // Location Row
  doc.setFont('helvetica', 'normal');
  doc.text('Location:', margin, currentY);
  doc.setFont('helvetica', 'bold');
  doc.text(meeting.location || '-', margin, currentY + 6);
  
  // Meeting Type
  doc.setFont('helvetica', 'normal');
  doc.text('Type:', margin + colWidth, currentY);
  doc.setFont('helvetica', 'bold');
  doc.text(formatMeetingType(meeting.meeting_type), margin + colWidth, currentY + 6);
  
  // Status
  doc.setFont('helvetica', 'normal');
  doc.text('Status:', margin + colWidth * 2, currentY);
  doc.setFont('helvetica', 'bold');
  doc.text(formatMinutesStatus(meeting.minutes_status), margin + colWidth * 2, currentY + 6);
  
  currentY += 18;
  
  // Description if exists
  if (meeting.description) {
    doc.setFont('helvetica', 'normal');
    doc.text('Description:', margin, currentY);
    doc.setFont('helvetica', 'bold');
    const descLines = doc.splitTextToSize(meeting.description, pageWidth - margin * 2);
    doc.text(descLines, margin, currentY + 6);
    currentY += 6 + (descLines.length * 5);
  }
  
  currentY += 10;
  
  // Attendees Section
  if (opts.includeAttendees && attendees.length > 0) {
    doc.setFontSize(opts.fontSize.subtitle);
    doc.setFont('helvetica', 'bold');
    doc.text('Attendees', margin, currentY);
    currentY += 8;
    
    doc.setFontSize(opts.fontSize.body);
    doc.setFont('helvetica', 'normal');
    const attendeeText = attendees.map(a => 
      `${a.name}${a.role ? ` (${formatRole(a.role)})` : ''}${a.organisation ? ` - ${a.organisation}` : ''}`
    ).join(', ');
    
    const attendeeLines = doc.splitTextToSize(attendeeText, pageWidth - margin * 2);
    doc.text(attendeeLines, margin, currentY);
    currentY += attendeeLines.length * 5 + 8;
  }
  
  // Minutes Table
  if (opts.includeMinutes && minutesItems.length > 0) {
    doc.setFontSize(opts.fontSize.subtitle);
    doc.setFont('helvetica', 'bold');
    doc.text('Minutes', margin, currentY);
    currentY += 5;
    
    const tableData = minutesItems.map((item, index) => [
      (index + 1).toString(),
      item.description || '-',
      item.client_scope || '-',
      item.vendor_scope || '-',
      item.target_date || '-',
      item.remarks || '-',
      item.requirement || '-',
    ]);
    
    autoTable(doc, {
      startY: currentY,
      head: [['S.No', 'Description', 'Client Scope', 'Vendor Scope', 'Target Date', 'Remarks', 'Requirement']],
      body: tableData,
      styles: {
        fontSize: opts.fontSize.table,
        cellPadding: 3,
        valign: 'top',
      },
      headStyles: {
        fillColor: [41, 41, 41],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248],
      },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 35 },
        2: { cellWidth: 30 },
        3: { cellWidth: 30 },
        4: { cellWidth: 22 },
        5: { cellWidth: 30 },
        6: { cellWidth: 30 },
      },
      margin: { left: margin, right: margin },
      didDrawPage: (data) => {
        // Footer on each page
        const pageNum = doc.getCurrentPageInfo().pageNumber;
        const totalPages = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `Page ${pageNum} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
        doc.text(
          `Generated: ${new Date().toLocaleDateString()}`,
          pageWidth - margin,
          pageHeight - 10,
          { align: 'right' }
        );
      },
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 15;
  }
  
  // Finalize info if applicable
  if (meeting.minutes_status === 'finalized' && meeting.minutes_created_at) {
    doc.setFontSize(opts.fontSize.body);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Finalized on: ${new Date(meeting.minutes_created_at).toLocaleString()}`,
      margin,
      currentY
    );
  }
  
  // Save the PDF
  const fileName = `minutes-${sanitizeFileName(meeting.client_name)}-${meeting.meeting_date}.pdf`;
  doc.save(fileName);
  
  return fileName;
}

export function generateMinutesPDFDataURL(
  meeting: Meeting,
  minutesItems: MeetingMinutesItem[],
  attendees: MeetingAttendee[],
  options?: PDFOptions
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const doc = new jsPDF(opts.pageOrientation);
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  
  // Title
  doc.setFontSize(opts.fontSize.title);
  doc.setFont('helvetica', 'bold');
  doc.text('Minutes of Meeting', pageWidth / 2, 20, { align: 'center' });
  
  // Content (same as above, condensed)
  doc.setFontSize(opts.fontSize.body);
  let currentY = 35;
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Client: ${meeting.client_name || '-'}`, margin, currentY);
  doc.text(`Date: ${meeting.meeting_date}`, margin, currentY + 6);
  
  if (opts.includeMinutes && minutesItems.length > 0) {
    currentY += 20;
    
    const tableData = minutesItems.map((item, index) => [
      (index + 1).toString(),
      item.description || '-',
      item.target_date || '-',
    ]);
    
    autoTable(doc, {
      startY: currentY,
      head: [['S.No', 'Description', 'Target Date']],
      body: tableData,
      styles: { fontSize: opts.fontSize.table },
      headStyles: { fillColor: [41, 41, 41] },
    });
  }
  
  return doc.output('dataurlstring');
}

// Helper functions
function formatMeetingType(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatMinutesStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatRole(role: string): string {
  const roleMap: Record<string, string> = {
    organizer: 'Organizer',
    client_rep: 'Client Representative',
    vendor_rep: 'Vendor Representative',
    project_manager: 'Project Manager',
    site_engineer: 'Site Engineer',
    team_member: 'Team Member',
    attendee: 'Attendee',
    observer: 'Observer',
  };
  return roleMap[role] || role;
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-z0-9]/gi, '-')
    .toLowerCase()
    .substring(0, 50);
}

// Export action items to PDF
export function generateActionItemsPDF(
  meeting: Meeting,
  actionItems: Array<{
    title: string;
    description?: string;
    assigned_to_name?: string;
    due_date?: string;
    priority: string;
    status: string;
  }>
): string {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  
  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Action Items', pageWidth / 2, 20, { align: 'center' });
  
  // Meeting Info
  doc.setFontSize(12);
  doc.text(`Meeting: ${meeting.client_name}`, margin, 30);
  doc.text(`Date: ${meeting.meeting_date}`, margin, 38);
  
  if (actionItems.length === 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('No action items for this meeting.', margin, 50);
  } else {
    const tableData = actionItems.map((item, index) => [
      (index + 1).toString(),
      item.title,
      item.assigned_to_name || '-',
      item.due_date || '-',
      item.priority.toUpperCase(),
      item.status.toUpperCase(),
    ]);
    
    autoTable(doc, {
      startY: 45,
      head: [['#', 'Action Item', 'Assigned To', 'Due Date', 'Priority', 'Status']],
      body: tableData,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [41, 41, 41] },
    });
  }
  
  const fileName = `action-items-${sanitizeFileName(meeting.client_name)}-${meeting.meeting_date}.pdf`;
  doc.save(fileName);
  
  return fileName;
}