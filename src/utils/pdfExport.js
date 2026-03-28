import { format } from 'date-fns';
import { supabase } from '../supabase';

export async function exportDCToPDF(challan) {
  const { default: jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;
  const doc = new jsPDF();
  if (typeof doc.autoTable !== 'function') { doc.autoTable = (...args) => autoTable(doc, ...args); }
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Load items if not already loaded
  let items = challan.items;
  if (!items || items.length === 0) {
    const { data: loadedItems } = await supabase
      .from('delivery_challan_items')
      .select('*')
      .eq('delivery_challan_id', challan.id);
    items = loadedItems || [];
  }

  // --- PAGE BORDER ---
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
  doc.rect(6, 6, pageWidth - 12, pageHeight - 12);

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('DELIVERY CHALLAN', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`DC No: ${challan.dc_number}`, 14, 35);
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${challan.dc_date ? format(new Date(challan.dc_date), 'dd/MM/yyyy') : '-'}`, 14, 42);
  
  let yPos = 50;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Client Details:', 14, yPos);
  doc.setFont('helvetica', 'normal');
  yPos += 7;
  doc.text(`Client: ${challan.client_name || '-'}`, 14, yPos);
  yPos += 7;
  doc.text(`Site Address: ${challan.site_address || '-'}`, 14, yPos);
  yPos += 7;
  doc.text(`Vehicle No: ${challan.vehicle_number || '-'}`, 14, yPos);
  yPos += 7;
  doc.text(`Driver: ${challan.driver_name || '-'}`, 14, yPos);
  
  yPos += 15;
  
  const tableData = (items || []).map((item, index) => [
    index + 1,
    item.material_name,
    item.unit,
    item.size || '-',
    item.quantity,
    item.rate ? `₹${parseFloat(item.rate).toFixed(2)}` : '-',
    item.amount ? `₹${parseFloat(item.amount).toFixed(2)}` : '-'
  ]);
  
  doc.autoTable({
    startY: yPos,
    head: [['S.No', 'Material', 'Unit', 'Size', 'Qty', 'Rate/Unit', 'Amount']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [26, 26, 26] },
    styles: { fontSize: 10 }
  });
  
  const finalY = doc.lastAutoTable.finalY + 10;
  
  const totalAmount = (items || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Total Amount:', 140, finalY);
  doc.text(`₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 175, finalY, { align: 'right' });
  
  if (challan.remarks) {
    doc.setFont('helvetica', 'normal');
    doc.text(`Remarks: ${challan.remarks}`, 14, finalY + 20);
  }
  
  doc.setFontSize(10);
  doc.text('Authorized Signature', 140, finalY + 40);
  doc.line(130, finalY + 38, 190, finalY + 38);
  
  doc.save(`${challan.dc_number}.pdf`);
}

export async function exportDateWiseConsolidationPDF(data, filters) {
  const { default: jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;
  const doc = new jsPDF();
  if (typeof doc.autoTable !== 'function') { doc.autoTable = (...args) => autoTable(doc, ...args); }
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Date-wise Consolidation Report', 105, 15, { align: 'center' });
  
  let yPos = 25;
  
  if (filters.startDate || filters.endDate) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let dateRange = 'Period: ';
    if (filters.startDate) dateRange += `From ${format(new Date(filters.startDate), 'dd/MM/yyyy')}`;
    if (filters.endDate) dateRange += ` To ${format(new Date(filters.endDate), 'dd/MM/yyyy')}`;
    doc.text(dateRange, 14, yPos);
    yPos += 10;
  }
  
  let grandTotal = 0;
  let totalItems = 0;
  
  data.forEach(group => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(format(new Date(group.date), 'dd MMMM yyyy'), 14, yPos);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const groupAmount = group.dcs.reduce((sum, dc) => 
      sum + (dc.items?.reduce((s, item) => s + (parseFloat(item.amount) || 0), 0) || 0), 0);
    doc.text(`${group.dcs.length} DC(s) - ₹${groupAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 80, yPos);
    
    yPos += 5;
    
    group.dcs.forEach(dc => {
      const tableData = dc.items.map((item, idx) => [
        idx + 1,
        item.material_name,
        item.unit,
        item.size || '-',
        item.quantity,
        item.rate ? `₹${parseFloat(item.rate).toFixed(2)}` : '-',
        `₹${(parseFloat(item.amount) || 0).toFixed(2)}`
      ]);
      
      doc.autoTable({
        startY: yPos,
        head: [['S.No', 'Material', 'Unit', 'Size', 'Qty', 'Rate', 'Amount']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [60, 60, 60], fontSize: 8 },
        styles: { fontSize: 8 },
        margin: { left: 14 }
      });
      
      yPos = doc.lastAutoTable.finalY + 10;
    });
    
    grandTotal += group.totalAmount;
    totalItems += group.totalItems;
  });
  
  yPos += 5;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Grand Total:', 140, yPos);
  doc.text(`₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 190, yPos, { align: 'right' });
  
  doc.save('date-wise-consolidation.pdf');
}

export async function exportMaterialWiseConsolidationPDF(data, dcColumns, filters) {
  const { default: jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;
  const doc = new jsPDF('landscape');
  if (typeof doc.autoTable !== 'function') { doc.autoTable = (...args) => autoTable(doc, ...args); }
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Material-wise Consolidation Report', 148, 15, { align: 'center' });
  
  let yPos = 25;
  
  if (filters.startDate || filters.endDate) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    let dateRange = 'Period: ';
    if (filters.startDate) dateRange += `From ${format(new Date(filters.startDate), 'dd/MM/yyyy')}`;
    if (filters.endDate) dateRange += ` To ${format(new Date(filters.endDate), 'dd/MM/yyyy')}`;
    doc.text(dateRange, 14, yPos);
    yPos += 8;
  }
  
  const headRow1 = ['S.No', 'Material', 'Size'];
  const headRow2 = ['', '', ''];
  const displayColumns = dcColumns.slice(0, 8);
  
  displayColumns.forEach(dc => {
    const [dcNumber, dcDate] = dc.split('|');
    headRow1.push(dcNumber);
    headRow2.push(dcDate ? format(new Date(dcDate), 'dd/MM') : '');
  });
  
  if (dcColumns.length > 8) {
    headRow1.push('...');
    headRow2.push('');
  }
  
  headRow1.push('Total Qty', 'Rate', 'Amount');
  headRow2.push('', '', '');
  
  const tableData = data.map((item, idx) => {
    const row = [idx + 1, item.materialName, item.size || '-'];
    
    displayColumns.forEach(dc => {
      const [dcNumber] = dc.split('|');
      const qty = item.dcItems.find(i => i.dcNumber === dcNumber)?.quantity || '-';
      row.push(qty);
    });
    
    if (dcColumns.length > 8) row.push('...');
    
    row.push(`${item.totalQuantity.toFixed(2)} ${item.unit}`);
    row.push(item.dcItems[0]?.rate ? `₹${parseFloat(item.dcItems[0].rate).toFixed(2)}` : '-');
    row.push(`₹${item.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    
    return row;
  });
  
  doc.autoTable({
    startY: yPos,
    head: [headRow1, headRow2],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [26, 26, 26], fontSize: 8 },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 40 }
    }
  });
  
  const finalY = doc.lastAutoTable.finalY + 10;
  
  const grandTotal = data.reduce((sum, item) => sum + item.totalAmount, 0);
  const grandQty = data.reduce((sum, item) => sum + item.totalQuantity, 0);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Materials: ${data.length}`, 14, finalY);
  doc.text(`Total Quantity: ${grandQty.toFixed(2)}`, 80, finalY);
  doc.text(`Total Amount: ₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 280, finalY, { align: 'right' });
  
  doc.save('material-wise-consolidation.pdf');
}
