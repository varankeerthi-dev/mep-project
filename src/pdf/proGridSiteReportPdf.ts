import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PRO_MARGIN_MM, appendLabelValueGrid, drawProDoubleFrame, renderProOrgBanner, appendSectionHeading, appendProFooterNote } from './proGridLayout';

type SiteReportData = {
  id: string;
  report_date: string;
  client_name?: string;
  project_name?: string;
  pm_name?: string;
  pm_status: string;
  weather: string;
  manpower: {
    subContractors: Array<{
      name: string;
      count: string;
    }>;
    workCarriedOut: Array<{
      description: string;
    }>;
    milestonesCompleted: Array<{
      description: string;
    }>;
  };
  photos: Array<{
    file_name: string;
    file_path: string;
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

export function generateProGridSiteReportPdf(params: SiteReportParams): jsPDF {
  const { siteReport, organisation, orientation = 'portrait', pageFormat = 'a4' } = params;
  
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: pageFormat === 'letter' ? 'letter' : 'a4'
  });

  drawProDoubleFrame(doc);
  
  let currentY = renderProOrgBanner(
    doc,
    organisation || {},
    {
      documentTitle: 'Site Report',
      tagline: `Report Date: ${siteReport.report_date}`
    }
  );

  // Header Section
  currentY = appendSectionHeading(doc, currentY, 'Site Report Details');
  
  // Report Information Table
  const reportTableData = [
    ['Report Date', siteReport.report_date],
    ['Client', siteReport.client_name || 'N/A'],
    ['Project', siteReport.project_name || 'N/A'],
    ['Project Manager', siteReport.pm_name || 'N/A'],
    ['Status', siteReport.pm_status],
    ['Weather', siteReport.weather || 'N/A']
  ];

  doc.autoTable({
    head: [['Field', 'Value']],
    body: reportTableData,
    startY: currentY,
    theme: 'grid',
    styles: { 
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      fontStyle: 'bold'
    },
    headStyles: {
      fillColor: [200, 200, 200],
      textColor: [0, 0, 0],
      fontStyle: 'bold'
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0]
    },
    columnStyles: {
      0: { cellWidth: 40, cellPadding: 2 },
      1: { cellWidth: 60, cellPadding: 2 }
    },
    margin: { top: 5, left: PRO_MARGIN_MM, right: PRO_MARGIN_MM, bottom: 5 }
  });

  currentY += 35; // Space after table

  // Manpower Section
  currentY = appendSectionHeading(doc, currentY, 'Manpower');
  
  if (siteReport.manpower.subContractors && siteReport.manpower.subContractors.length > 0) {
    const manpowerTableData = siteReport.manpower.subContractors.map(sub => [
      sub.name,
      sub.count
    ]);

    doc.autoTable({
      head: [['Sub-Contractor Name', 'Count']],
      body: manpowerTableData,
      startY: currentY,
      theme: 'grid',
      styles: { 
        fillColor: [245, 245, 245],
        textColor: [0, 0, 0]
      },
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: [0, 0, 0]
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0]
      },
      columnStyles: {
        0: { cellWidth: 80, cellPadding: 2 },
        1: { cellWidth: 30, cellPadding: 2 }
      },
      margin: { top: 5, left: PRO_MARGIN_MM, right: PRO_MARGIN_MM, bottom: 5 }
    });

    currentY += 25; // Space after manpower table
  }

  // Work Carried Out Section
  currentY = appendSectionHeading(doc, currentY, 'Work Carried Out');
  
  if (siteReport.manpower.workCarriedOut && siteReport.manpower.workCarriedOut.length > 0) {
    const workTableData = siteReport.manpower.workCarriedOut.map((work, index) => [
      `${index + 1}.`,
      work.description
    ]);

    doc.autoTable({
      head: [['#', 'Description']],
      body: workTableData,
      startY: currentY,
      theme: 'grid',
      styles: { 
        fillColor: [245, 245, 245],
        textColor: [0, 0, 0]
      },
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: [0, 0, 0]
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0]
      },
      columnStyles: {
        0: { cellWidth: 15, cellPadding: 2 },
        1: { cellWidth: 125, cellPadding: 2 }
      },
      margin: { top: 5, left: PRO_MARGIN_MM, right: PRO_MARGIN_MM, bottom: 5 }
    });

    currentY += 25; // Space after work table
  }

  // Milestones Completed Section
  currentY = appendSectionHeading(doc, currentY, 'Milestones Completed');
  
  if (siteReport.manpower.milestonesCompleted && siteReport.manpower.milestonesCompleted.length > 0) {
    const milestonesTableData = siteReport.manpower.milestonesCompleted.map((milestone, index) => [
      `${index + 1}.`,
      milestone.description
    ]);

    doc.autoTable({
      head: [['#', 'Description']],
      body: milestonesTableData,
      startY: currentY,
      theme: 'grid',
      styles: { 
        fillColor: [245, 245, 245],
        textColor: [0, 0, 0]
      },
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: [0, 0, 0]
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0]
      },
      columnStyles: {
        0: { cellWidth: 15, cellPadding: 2 },
        1: { cellWidth: 125, cellPadding: 2 }
      },
      margin: { top: 5, left: PRO_MARGIN_MM, right: PRO_MARGIN_MM, bottom: 5 }
    });

    currentY += 25; // Space after milestones table
  }

  // Photos Section
  if (siteReport.photos && siteReport.photos.length > 0) {
    currentY = appendSectionHeading(doc, currentY, 'Photos');
    
    // Add photos as simple list
    siteReport.photos.forEach((photo, index) => {
      currentY += 5;
      doc.setFontSize(10);
      doc.text(`${index + 1}. ${photo.file_name}`, PRO_MARGIN_MM, currentY);
      currentY += 8;
    });
    
    currentY += 10; // Space after photos
  }

  // Footer Section
  if (siteReport.footer) {
    currentY = appendSectionHeading(doc, currentY, 'Footer');
    
    const footerTableData = [
      ['Engineer/Supervisor Name', siteReport.footer.enginear || 'N/A'],
      ['Signature Date', siteReport.footer.signatureDate || 'N/A']
    ];

    doc.autoTable({
      head: [['Field', 'Value']],
      body: footerTableData,
      startY: currentY,
      theme: 'grid',
      styles: { 
        fillColor: [245, 245, 245],
        textColor: [0, 0, 0]
      },
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: [0, 0, 0]
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0]
      },
      columnStyles: {
        0: { cellWidth: 60, cellPadding: 2 },
        1: { cellWidth: 80, cellPadding: 2 }
      },
      margin: { top: 5, left: PRO_MARGIN_MM, right: PRO_MARGIN_MM, bottom: 5 }
    });

    currentY += 20; // Space after footer
  }

  // Add footer note
  appendProFooterNote(doc, currentY);

  return doc;
}
