import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Approval, ApprovalActionLog } from '../types/approvals';

export class ApprovalPDFEnhancer {
  /**
   * Add approval section to existing PDF
   */
  static async addApprovalSection(
    existingPdfBytes: Uint8Array,
    approval: Approval,
    approvalActions: ApprovalActionLog[]
  ): Promise<Uint8Array> {
    try {
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();
      const lastPage = pages[pages.length - 1];

      // Add approval section at the bottom of the last page
      const { height } = lastPage.getSize();
      const approvalSection = this.generateApprovalSection(approval, approvalActions);
      
      // Add approval section as a new page if needed
      if (height < 400) {
        const newPage = pdfDoc.addPage([595, 842]); // A4 size
        newPage.drawText(approvalSection, {
          x: 50,
          y: 750,
          size: 10,
          font: await pdfDoc.embedFont(StandardFonts.Helvetica),
          color: rgb(0, 0, 0),
          maxWidth: 495
        });
      } else {
        lastPage.drawText(approvalSection, {
          x: 50,
          y: height - 100,
          size: 10,
          font: await pdfDoc.embedFont(StandardFonts.Helvetica),
          color: rgb(0, 0, 0),
          maxWidth: 495
        });
      }

      return await pdfDoc.save();
    } catch (error) {
      console.error('Error adding approval section to PDF:', error);
      throw error;
    }
  }

  /**
   * Generate approval section text
   */
  private static generateApprovalSection(
    approval: Approval,
    approvalActions: ApprovalActionLog[]
  ): string {
    const approvedAction = approvalActions.find(action => action.action === 'APPROVED');
    const formattedDate = new Date(approval.updated_at).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    let approvalSection = `
═════════════════════════════════════════════════════════════════════
                          APPROVAL DETAILS
═════════════════════════════════════════════════════════════════════

Approval ID: ${approval.id}
Approval Type: ${this.getApprovalTypeLabel(approval.approval_type)}
Status: ${approval.status}
Date: ${formattedDate}
Amount: ${approval.amount ? `₹${approval.amount.toLocaleString('en-IN')}` : 'N/A'}
Priority: ${approval.priority}
`;

    if (approvedAction && approvedAction.approver_id) {
      approvalSection += `
Approved By: ${approvedAction.approver_role || 'Approver'}
Approval Date: ${new Date(approvedAction.action_at).toLocaleDateString('en-IN')}
Approval Level: ${approval.current_level}/${approval.max_levels}
`;

      if (approvedAction.comments) {
        approvalSection += `Comments: ${approvedAction.comments}\n`;
      }
    }

    if (approvalActions.length > 0) {
      approvalSection += `
═════════════════════════════════════════════════════════════════════
                          APPROVAL HISTORY
═════════════════════════════════════════════════════════════════════
`;

      approvalActions.forEach((action, index) => {
        const actionDate = new Date(action.action_at).toLocaleDateString('en-IN');
        const actionTime = new Date(action.action_at).toLocaleTimeString('en-IN');
        
        approvalSection += `
${index + 1}. ${action.action} by ${action.approver_role || 'User'}
   Date: ${actionDate} ${actionTime}
   ${action.comments ? `Comments: ${action.comments}` : ''}
`;
      });
    }

    approvalSection += `
═════════════════════════════════════════════════════════════════════
This document is electronically approved and authenticated.
For verification, please contact the administration.
═════════════════════════════════════════════════════════════════════
`;

    return approvalSection;
  }

  /**
   * Generate standalone approval certificate
   */
  static async generateApprovalCertificate(
    approval: Approval,
    approvalActions: ApprovalActionLog[]
  ): Promise<Uint8Array> {
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595, 842]); // A4 size
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Title
      page.drawText('APPROVAL CERTIFICATE', {
        x: 150,
        y: 750,
        size: 24,
        font: boldFont,
        color: rgb(0, 0, 0)
      });

      // Approval details
      let yPosition = 700;
      const lineHeight = 25;

      const details = [
        `Approval ID: ${approval.id}`,
        `Type: ${this.getApprovalTypeLabel(approval.approval_type)}`,
        `Title: ${approval.title}`,
        `Amount: ${approval.amount ? `₹${approval.amount.toLocaleString('en-IN')}` : 'N/A'}`,
        `Status: ${approval.status}`,
        `Priority: ${approval.priority}`,
        `Requested Date: ${new Date(approval.requested_at).toLocaleDateString('en-IN')}`,
        `Final Action Date: ${new Date(approval.updated_at).toLocaleDateString('en-IN')}`
      ];

      details.forEach(detail => {
        page.drawText(detail, {
          x: 50,
          y: yPosition,
          size: 12,
          font: font,
          color: rgb(0, 0, 0)
        });
        yPosition -= lineHeight;
      });

      // Approval history
      yPosition -= 20;
      page.drawText('APPROVAL HISTORY:', {
        x: 50,
        y: yPosition,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0)
      });

      yPosition -= 30;
      approvalActions.forEach((action, index) => {
        const actionDate = new Date(action.action_at).toLocaleDateString('en-IN');
        const actionTime = new Date(action.action_at).toLocaleTimeString('en-IN');
        
        page.drawText(`${index + 1}. ${action.action}`, {
          x: 50,
          y: yPosition,
          size: 11,
          font: boldFont,
          color: rgb(0, 0, 0)
        });
        
        yPosition -= 20;
        page.drawText(`   By: ${action.approver_role || 'User'}`, {
          x: 50,
          y: yPosition,
          size: 10,
          font: font,
          color: rgb(0, 0, 0)
        });
        
        yPosition -= 15;
        page.drawText(`   Date: ${actionDate} ${actionTime}`, {
          x: 50,
          y: yPosition,
          size: 10,
          font: font,
          color: rgb(0, 0, 0)
        });
        
        if (action.comments) {
          yPosition -= 15;
          page.drawText(`   Comments: ${action.comments}`, {
            x: 50,
            y: yPosition,
            size: 10,
            font: font,
            color: rgb(0, 0, 0)
          });
        }
        
        yPosition -= 25;
      });

      // Footer
      yPosition = 100;
      page.drawText('═════════════════════════════════════════════════════════════════════', {
        x: 50,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0, 0, 0)
      });

      yPosition -= 20;
      page.drawText('This certificate confirms that the above-mentioned approval has been', {
        x: 50,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0, 0, 0)
      });

      yPosition -= 15;
      page.drawText('processed through the official approval workflow system.', {
        x: 50,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0, 0, 0)
      });

      yPosition -= 15;
      page.drawText('For verification, please contact the administration department.', {
        x: 50,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0, 0, 0)
      });

      yPosition -= 20;
      page.drawText('═════════════════════════════════════════════════════════════════════', {
        x: 50,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0, 0, 0)
      });

      return await pdfDoc.save();
    } catch (error) {
      console.error('Error generating approval certificate:', error);
      throw error;
    }
  }

  /**
   * Add approval watermark to PDF
   */
  static async addApprovalWatermark(
    pdfBytes: Uint8Array,
    approval: Approval
  ): Promise<Uint8Array> {
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();
      
      const watermarkText = this.getWatermarkText(approval);
      
      for (const page of pages) {
        const { width, height } = page.getSize();
        
        // Add watermark diagonally across the page
        page.drawText(watermarkText, {
          x: width / 2 - 150,
          y: height / 2,
          size: 60,
          font: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
          color: rgb(0.9, 0.9, 0.9),
          rotate: { type: 'degrees', angle: -45 }
        });
      }

      return await pdfDoc.save();
    } catch (error) {
      console.error('Error adding approval watermark:', error);
      throw error;
    }
  }

  /**
   * Generate approval summary report
   */
  static async generateApprovalSummaryReport(
    approvals: Approval[],
    approvalActions: { [key: string]: ApprovalActionLog[] }
  ): Promise<Uint8Array> {
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595, 842]); // A4 size
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Title
      page.drawText('APPROVAL SUMMARY REPORT', {
        x: 150,
        y: 750,
        size: 20,
        font: boldFont,
        color: rgb(0, 0, 0)
      });

      // Report date
      page.drawText(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, {
        x: 50,
        y: 720,
        size: 12,
        font: font,
        color: rgb(0, 0, 0)
      });

      // Summary statistics
      const stats = this.calculateApprovalStats(approvals);
      let yPosition = 680;

      page.drawText('SUMMARY STATISTICS:', {
        x: 50,
        y: yPosition,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0)
      });

      yPosition -= 25;
      const summaryLines = [
        `Total Approvals: ${stats.total}`,
        `Pending: ${stats.pending}`,
        `Approved: ${stats.approved}`,
        `Rejected: ${stats.rejected}`,
        `On Hold: ${stats.hold}`,
        `Total Amount: ₹${stats.totalAmount.toLocaleString('en-IN')}`
      ];

      summaryLines.forEach(line => {
        page.drawText(line, {
          x: 50,
          y: yPosition,
          size: 11,
          font: font,
          color: rgb(0, 0, 0)
        });
        yPosition -= 20;
      });

      // Detailed approvals
      yPosition -= 30;
      page.drawText('DETAILED APPROVALS:', {
        x: 50,
        y: yPosition,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0)
      });

      yPosition -= 30;
      
      // Table headers
      const headers = ['Type', 'Title', 'Amount', 'Status', 'Date'];
      const headerX = [50, 150, 350, 420, 480];
      
      headers.forEach((header, index) => {
        page.drawText(header, {
          x: headerX[index],
          y: yPosition,
          size: 10,
          font: boldFont,
          color: rgb(0, 0, 0)
        });
      });

      yPosition -= 20;
      
      // Table rows
      approvals.forEach((approval, index) => {
        if (yPosition < 100) {
          // Add new page if needed
          const newPage = pdfDoc.addPage([595, 842]);
          yPosition = 750;
        }

        const row = [
          this.getApprovalTypeLabel(approval.approval_type),
          approval.title.substring(0, 20) + (approval.title.length > 20 ? '...' : ''),
          approval.amount ? `₹${approval.amount.toLocaleString('en-IN')}` : 'N/A',
          approval.status,
          new Date(approval.created_at).toLocaleDateString('en-IN')
        ];

        row.forEach((cell, cellIndex) => {
          page.drawText(cell, {
            x: headerX[cellIndex],
            y: yPosition,
            size: 9,
            font: font,
            color: rgb(0, 0, 0)
          });
        });

        yPosition -= 15;
      });

      return await pdfDoc.save();
    } catch (error) {
      console.error('Error generating approval summary report:', error);
      throw error;
    }
  }

  /**
   * Get approval type label
   */
  private static getApprovalTypeLabel(type: string): string {
    const typeLabels: { [key: string]: string } = {
      'PURCHASE_ORDER': 'Purchase Order',
      'WORK_ORDER': 'Work Order',
      'QUOTATION': 'Quotation',
      'INVOICE': 'Invoice',
      'PROFORMA_INVOICE': 'Proforma Invoice',
      'PAYMENT_REQUEST': 'Payment Request',
      'MATERIAL_DISPATCH': 'Material Dispatch',
      'SITE_VISIT': 'Site Visit',
      'EXPENSE_CLAIM': 'Expense Claim'
    };
    return typeLabels[type] || type;
  }

  /**
   * Get watermark text
   */
  private static getWatermarkText(approval: Approval): string {
    if (approval.status === 'APPROVED') {
      return 'APPROVED';
    } else if (approval.status === 'REJECTED') {
      return 'REJECTED';
    } else if (approval.status === 'PENDING') {
      return 'PENDING APPROVAL';
    } else {
      return approval.status;
    }
  }

  /**
   * Calculate approval statistics
   */
  private static calculateApprovalStats(approvals: Approval[]) {
    const stats = {
      total: approvals.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      hold: 0,
      totalAmount: 0
    };

    approvals.forEach(approval => {
      switch (approval.status) {
        case 'PENDING':
          stats.pending++;
          break;
        case 'APPROVED':
          stats.approved++;
          break;
        case 'REJECTED':
          stats.rejected++;
          break;
        case 'HOLD':
          stats.hold++;
          break;
      }
      
      if (approval.amount) {
        stats.totalAmount += approval.amount;
      }
    });

    return stats;
  }

  /**
   * Generate approval QR code data
   */
  static generateApprovalQRData(approval: Approval): string {
    const qrData = {
      id: approval.id,
      type: approval.approval_type,
      status: approval.status,
      date: approval.updated_at,
      amount: approval.amount,
      verifyUrl: `${window.location.origin}/verify-approval/${approval.id}`
    };
    
    return JSON.stringify(qrData);
  }
}
