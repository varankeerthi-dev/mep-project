import { toast } from '@/lib/logger';

export const downloadVisitPDF = async (visit: any, projectManagers?: any[]) => {
  try {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Header Brand
    doc.setFillColor(37, 99, 235); // Blue
    doc.rect(0, 0, 210, 15, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('MEP PROJECT MANAGEMENT SYSTEM', 20, 10);

    // Document title
    doc.setFontSize(22);
    doc.setTextColor(23, 23, 23); // #171717
    doc.text('SITE VISIT REPORT', 20, 32);

    // Visit ID
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(115, 115, 115); // #737373
    doc.text(`Visit ID: SV-${visit.id.slice(0, 6).toUpperCase()}`, 20, 39);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 145, 39);

    // Divider
    doc.setDrawColor(229, 229, 229);
    doc.setLineWidth(0.5);
    doc.line(20, 43, 190, 43);

    let y = 52;

    // Section: Scheduling details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(37, 99, 235); // Blue
    doc.text('1. Scheduling & Client Details', 20, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(82, 82, 82);

    const leftColX = 20;
    const rightColX = 110;

    const printField = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(82, 82, 82);
      doc.text(`${label}:`, leftColX, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(23, 23, 23);
      doc.text(String(value || 'N/A'), leftColX + 35, y);
    };

    const printFieldRight = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(82, 82, 82);
      doc.text(`${label}:`, rightColX, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(23, 23, 23);
      doc.text(String(value || 'N/A'), rightColX + 35, y);
    };

    // Client and Date
    printField('Client', visit.clients?.client_name);
    printFieldRight('Visit Date', visit.visit_date ? new Date(visit.visit_date).toLocaleDateString() : 'N/A');
    y += 7;

    // Purpose and Time
    printField('Purpose', visit.purpose_of_visit);
    printFieldRight('Visit Time', visit.visit_time || 'N/A');
    y += 7;

    // Engineer and Status
    printField('Engineer', visit.engineer || 'N/A');
    printFieldRight('Status', visit.status ? visit.status.toUpperCase() : 'N/A');
    y += 7;

    // PO/WO/Contract and Project Manager
    const manager = projectManagers?.find((pm: any) => pm.id === visit.project_manager_id);
    const pmName = manager ? (manager.full_name || manager.email) : 'N/A';
    printField('PO/WO/Contract', visit.po_wo_contract);
    printFieldRight('Project Manager', pmName);
    y += 7;

    // Visit Type and Priority
    printField('Visit Type', visit.visit_type);
    printFieldRight('Priority', visit.priority);
    y += 7;

    // PPE and Access Restrictions
    printField('PPE Req.', visit.ppe_requirements);
    printFieldRight('Access Restr.', visit.access_restrictions);
    y += 7;

    // Site Contact details
    printField('Contact Person', visit.site_contact_person);
    printFieldRight('Contact Phone', visit.site_contact_phone);
    y += 7;

    printField('Designation', visit.site_contact_designation);
    printFieldRight('Chargeable', visit.is_chargeable ? 'Yes' : 'No');
    y += 7;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(82, 82, 82);
    doc.text('Site Address:', leftColX, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(23, 23, 23);
    const addressLines = doc.splitTextToSize(visit.site_address || 'N/A', 130);
    doc.text(addressLines, leftColX + 35, y);
    y += (addressLines.length * 5) + 3;

    // Section 2: Operational Report
    doc.setDrawColor(229, 229, 229);
    doc.line(20, y, 190, y);
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(37, 99, 235);
    doc.text('2. Operational Report Details', 20, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(82, 82, 82);

    printField('Out Time', visit.out_time);
    printFieldRight('Weather', visit.weather_conditions);
    y += 7;

    printField('Travel Time', visit.travel_time_minutes ? `${visit.travel_time_minutes} mins` : 'N/A');
    printFieldRight('Total Man Hours', visit.total_man_hours ? `${visit.total_man_hours} hrs` : 'N/A');
    y += 9;

    // Text areas with page break check
    const printTextArea = (label: string, text: string) => {
      const lines = doc.splitTextToSize(text || 'None recorded.', 160);
      const estimatedHeight = 5 + (lines.length * 5) + 5;
      if (y + estimatedHeight > 275) {
        doc.addPage();
        y = 25;
      }
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(82, 82, 82);
      doc.text(`${label}:`, leftColX, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(23, 23, 23);
      doc.text(lines, leftColX, y);
      y += (lines.length * 5) + 6;
    };

    printTextArea('Equipment/Tools Used', visit.equipment_used);
    printTextArea('Safety Hazards Identified', visit.safety_hazards);
    printTextArea('Discussion & Minutes of Meeting', visit.discussion_points);
    printTextArea('Measurements & Dimensions', visit.measurements);
    printTextArea('Actionable Recommendations', visit.recommendations);

    // Section 3: Expenses
    const travelExp = visit.travel_expense || 0;
    const stayExp = visit.accommodation_expense || 0;
    const miscExp = visit.misc_expense || 0;
    const totalExp = travelExp + stayExp + miscExp;

    const estimatedExpHeight = 8 + 8 + 7 + 7 + 10;
    if (y + estimatedExpHeight > 275) {
      doc.addPage();
      y = 25;
    }

    doc.setDrawColor(229, 229, 229);
    doc.line(20, y, 190, y);
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(37, 99, 235);
    doc.text('3. Visit Expenses', 20, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(82, 82, 82);

    printField('Travel Expense', `INR ${travelExp.toFixed(2)}`);
    printFieldRight('Stay/Accommodation', `INR ${stayExp.toFixed(2)}`);
    y += 7;
    printField('Misc. Expense', `INR ${miscExp.toFixed(2)}`);
    doc.setFont('helvetica', 'bold');
    printFieldRight('Total Expenses', `INR ${totalExp.toFixed(2)}`);
    y += 12;

    // Footer
    if (y > 275) {
      doc.addPage();
      y = 25;
    }
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text('This is an automated system generated report.', 20, y);

    doc.save(`Site_Visit_Report_SV-${visit.id.slice(0, 6).toUpperCase()}.pdf`);
    toast.success('PDF downloaded successfully');
  } catch (err: any) {
    console.error(err);
    toast.error('Failed to generate PDF');
  }
};
