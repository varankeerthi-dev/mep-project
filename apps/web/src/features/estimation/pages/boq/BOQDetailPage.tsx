import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBOQ, useSections, useAllItems, useCreateSection, useUpdateSection, useDeleteSection, useCreateItem, useUpdateItem, useDeleteItem } from '../../hooks/useBOQ';
import { PermissionGuard } from '../../../../rbac';
import { ArrowLeft, Plus, Trash2, Edit3, Save, X, GripVertical, FileDown, FileSpreadsheet, Table } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { openSansRegular, openSansBold } from '../../../../fonts/openSans';

const calcRow = (rate: any, discountPercent: any, quantity: any) => {
  const r = parseFloat(rate) || 0;
  const d = parseFloat(discountPercent) || 0;
  const q = parseFloat(quantity) || 0;
  return { rateAfterDiscount: Math.round(r - (r * d) / 100), totalAmount: (Math.round(r - (r * d) / 100)) * q };
};

export default function BOQDetailPage() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const navigate = useNavigate();
  const { data: boq, isLoading: boqLoading } = useBOQ(id || null);
  const { data: sections, isLoading: sectionsLoading } = useSections(id || null);
  const { data: allItems, isLoading: itemsLoading } = useAllItems(id || null);

  const createSection = useCreateSection();
  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();

  const [newSectionName, setNewSectionName] = useState('');
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editSectionName, setEditSectionName] = useState('');
  const [newItemDesc, setNewItemDesc] = useState<Record<string, string>>({});
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editItemData, setEditItemData] = useState<any>({});
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleAddSection = () => {
    if (!newSectionName.trim() || !id) return;
    createSection.mutate(
      { boq_id: id, name: newSectionName.trim(), section_order: (sections?.length || 0) + 1 },
      { onSuccess: () => setNewSectionName('') }
    );
  };

  const handleAddItem = (sectionId: string) => {
    const desc = newItemDesc[sectionId]?.trim();
    if (!desc) return;
    createItem.mutate(
      { section_id: sectionId, description: desc, item_order: (allItems?.filter((i: any) => i.section_id === sectionId).length || 0) + 1 } as any,
      { onSuccess: () => setNewItemDesc({ ...newItemDesc, [sectionId]: '' }) }
    );
  };

  const startEditItem = (item: any) => {
    setEditingItem(item.id);
    setEditItemData({
      description: item.description || '',
      specification: item.specification || '',
      unit: item.unit || '',
      quantity: item.quantity || 0,
      rate: item.rate || 0,
      discount_percent: item.discount_percent || 0,
      remarks: item.remarks || '',
    });
  };

  const saveEditItem = (itemId: string, sectionId: string) => {
    updateItem.mutate({ id: itemId, input: editItemData });
    setEditingItem(null);
  };

  const sectionTotals = useMemo(() => {
    const totals: Record<string, { qty: number; amount: number }> = {};
    (allItems || []).forEach((item: any) => {
      if (!totals[item.section_id]) totals[item.section_id] = { qty: 0, amount: 0 };
      totals[item.section_id].qty += parseFloat(item.quantity) || 0;
      const { totalAmount } = calcRow(item.rate, item.discount_percent, item.quantity);
      totals[item.section_id].amount += totalAmount;
    });
    return totals;
  }, [allItems]);

  const grandTotal = useMemo(() => {
    return Object.values(sectionTotals).reduce((sum, t) => sum + t.amount, 0);
  }, [sectionTotals]);

  // ─── Export ─────────────────────────────────────────────────────────────────

  const exportToPDF = () => {
    if (!boq) return;
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 10;
    if (openSansRegular && openSansBold) {
      try {
        doc.addFileToVFS('OpenSans-Regular.ttf', openSansRegular);
        doc.addFileToVFS('OpenSans-Bold.ttf', openSansBold);
        doc.addFont('OpenSans-Regular.ttf', 'OpenSans', 'normal');
        doc.addFont('OpenSans-Bold.ttf', 'OpenSans', 'bold');
        doc.setFont('OpenSans', 'normal');
      } catch { }
    }

    const columns = [
      { key: 'sno', title: 'S.No', width: 12 },
      { key: 'description', title: 'Description', width: 80 },
      { key: 'specification', title: 'Specification', width: 30 },
      { key: 'unit', title: 'Unit', width: 15 },
      { key: 'quantity', title: 'Qty', width: 15 },
      { key: 'rate', title: 'Rate', width: 20 },
      { key: 'discount_percent', title: 'Disc %', width: 15 },
      { key: 'total', title: 'Amount', width: 25 },
    ];
    const totalWidth = columns.reduce((s, c) => s + c.width, 0);
    const scale = (pageWidth - marginX * 2) / totalWidth;
    const columnStyles: Record<number, any> = {};
    columns.forEach((c, i) => { columnStyles[i] = { cellWidth: c.width * scale, halign: c.key === 'description' ? 'left' : 'center' }; });

    const clientName = (boq as any)?.client?.client_name || '';
    const projectName = (boq as any)?.project?.project_name || '';

    (sections || []).forEach((section: any, idx: number) => {
      if (idx > 0) doc.addPage();
      doc.setFont('OpenSans', 'normal'); doc.setFontSize(12);
      doc.text('BILL OF QUANTITIES', marginX, 12);
      doc.setFont('OpenSans', 'bold');
      doc.text(section.name || '', pageWidth / 2, 12, { align: 'center' });
      const labelW = 26;
      const valueW = (pageWidth - marginX * 2 - labelW * 2) / 2;
      autoTable(doc, {
        startY: 16, theme: 'grid',
        styles: { font: 'OpenSans', fontSize: 9, cellPadding: 1.2, textColor: 20, lineColor: [0, 0, 0], lineWidth: 0.1 },
        head: [],
        body: [
          ['Client:', clientName, 'Project:', projectName],
          ['BoQ No:', boq.boq_no || '', 'Date:', boq.date ? new Date(boq.date).toLocaleDateString() : ''],
        ],
        columnStyles: {
          0: { cellWidth: labelW, halign: 'left', fontStyle: 'bold' },
          1: { cellWidth: valueW, halign: 'left' },
          2: { cellWidth: labelW, halign: 'left', fontStyle: 'bold' },
          3: { cellWidth: valueW, halign: 'left' },
        },
      });

      const items = (allItems || []).filter((i: any) => i.section_id === section.id);
      const rows: any[][] = [];
      let sno = 0, totalQty = 0, totalAmount = 0;
      items.forEach((item: any) => {
        sno++;
        const qty = parseFloat(item.quantity) || 0;
        const { totalAmount: ta } = calcRow(item.rate, item.discount_percent, item.quantity);
        totalQty += qty;
        totalAmount += ta;
        rows.push([
          sno, item.description || '', item.specification || '', item.unit || '',
          qty, item.rate || 0, item.discount_percent || 0, ta,
        ]);
      });
      rows.push(columns.map((c) => {
        if (c.key === 'description') return 'Total';
        if (c.key === 'quantity') return totalQty;
        if (c.key === 'total') return totalAmount;
        return '';
      }));

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 5,
        head: [columns.map((c) => c.title)],
        body: rows,
        theme: 'grid',
        styles: { font: 'OpenSans', fontSize: 8, cellPadding: 1.2, textColor: 20, lineColor: [0, 0, 0], lineWidth: 0.1 },
        headStyles: { fontStyle: 'bold', fillColor: [245, 245, 245], textColor: 20, lineColor: [0, 0, 0], lineWidth: 0.2, halign: 'center' },
        columnStyles,
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.row.index === rows.length - 1) {
            data.cell.styles.fillColor = [216, 232, 247];
            data.cell.styles.fontStyle = 'bold';
          }
        },
      });
    });

    doc.save(`${boq.boq_no || 'BOQ'}.pdf`);
    setShowExportMenu(false);
  };

  const exportToExcel = async () => {
    if (!boq) return;
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const clientName = (boq as any)?.client?.client_name || '';
    const projectName = (boq as any)?.project?.project_name || '';

    (sections || []).forEach((section: any) => {
      const sheetData: any[][] = [];
      sheetData.push(['BOQ No', boq.boq_no, 'Client', clientName]);
      sheetData.push(['Date', boq.date ? new Date(boq.date).toLocaleDateString() : '', 'Project', projectName]);
      sheetData.push([]);
      sheetData.push(['S.No', 'Description', 'Specification', 'Unit', 'Qty', 'Rate', 'Disc %', 'Amount']);
      const items = (allItems || []).filter((i: any) => i.section_id === section.id);
      let sno = 0;
      items.forEach((item: any) => {
        sno++;
        const { totalAmount } = calcRow(item.rate, item.discount_percent, item.quantity);
        sheetData.push([sno, item.description, item.specification, item.unit, item.quantity, item.rate, item.discount_percent, totalAmount]);
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetData), (section.name || 'Sheet').substring(0, 31));
    });
    XLSX.writeFile(wb, `${boq.boq_no || 'BOQ'}.xlsx`);
    setShowExportMenu(false);
  };

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (boqLoading || sectionsLoading || itemsLoading) return <div className="p-6">Loading...</div>;
  if (!boq) return <div className="p-6 text-red-500">BOQ not found</div>;

  const sectionItems = (sectionId: string) => allItems?.filter((i: any) => i.section_id === sectionId) || [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/estimation/boq')} className="p-1.5 hover:bg-zinc-100 rounded">
            <ArrowLeft className="h-5 w-5 text-zinc-600" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-zinc-800">{boq.boq_no}</h1>
            {boq.title && <p className="text-sm text-zinc-500">{boq.title}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-zinc-300 rounded-lg hover:bg-zinc-50">
              <FileDown className="h-4 w-4" /> Export
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg z-50 min-w-[160px]">
                <button onClick={exportToPDF} className="w-full px-4 py-2 text-sm text-left hover:bg-zinc-50 flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" /> Export to PDF
                </button>
                <button onClick={exportToExcel} className="w-full px-4 py-2 text-sm text-left hover:bg-zinc-50 flex items-center gap-2">
                  <Table className="h-4 w-4" /> Export to Excel
                </button>
              </div>
            )}
          </div>
          <PermissionGuard permission="estimation.boq.update">
            <button onClick={() => navigate(`/estimation/boq/edit?id=${id}`)}
              className="px-3 py-1.5 text-sm border border-zinc-300 rounded-lg hover:bg-zinc-50">
              Edit
            </button>
          </PermissionGuard>
        </div>
      </div>

      {/* Meta info */}
      <div className="flex items-center gap-4 px-6 py-2 bg-zinc-50 border-b border-zinc-200 text-xs text-zinc-600">
        <span>Status: <span className={`font-medium ${boq.status === 'Approved' ? 'text-green-600' : boq.status === 'Final' ? 'text-blue-600' : 'text-zinc-700'}`}>{boq.status}</span></span>
        <span>Client: <span className="font-medium text-zinc-700">{(boq as any)?.client?.client_name || '-'}</span></span>
        <span>Project: <span className="font-medium text-zinc-700">{(boq as any)?.project?.project_name || '-'}</span></span>
        <span>Grand Total: <span className="font-medium text-blue-700">₹{grandTotal.toLocaleString()}</span></span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {(sections || []).map((section: any) => {
            const items = sectionItems(section.id!);
            const totals = sectionTotals[section.id!] || { qty: 0, amount: 0 };

            return (
              <div key={section.id} className="bg-white border border-zinc-200 rounded-lg">
                {/* Section Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
                  <div className="flex items-center gap-2 flex-1">
                    <GripVertical className="h-4 w-4 text-zinc-300" />
                    {editingSection === section.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input value={editSectionName} onChange={(e) => setEditSectionName(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-zinc-300 rounded" autoFocus />
                        <button onClick={() => { updateSection.mutate({ id: section.id!, input: { name: editSectionName } }); setEditingSection(null); }}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"><Save className="h-4 w-4" /></button>
                        <button onClick={() => setEditingSection(null)} className="p-1 text-zinc-400 hover:bg-zinc-100 rounded"><X className="h-4 w-4" /></button>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium text-zinc-800">{section.name}</span>
                        <span className="text-xs text-zinc-400">({items.length} items)</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <PermissionGuard permission="estimation.boq.update">
                      <button onClick={() => { setEditingSection(section.id!); setEditSectionName(section.name); }}
                        className="p-1.5 hover:bg-zinc-100 rounded text-zinc-400 hover:text-zinc-600"><Edit3 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => { if (confirm('Delete this section and its items?')) deleteSection.mutate({ id: section.id!, boqId: id! }); }}
                        className="p-1.5 hover:bg-red-50 rounded text-zinc-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </PermissionGuard>
                  </div>
                </div>

                {/* Items List */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200">
                        <th className="px-3 py-2 text-left font-medium text-zinc-500 w-10">#</th>
                        <th className="px-3 py-2 text-left font-medium text-zinc-500">Description</th>
                        <th className="px-3 py-2 text-left font-medium text-zinc-500 w-24">Specification</th>
                        <th className="px-3 py-2 text-center font-medium text-zinc-500 w-14">Unit</th>
                        <th className="px-3 py-2 text-right font-medium text-zinc-500 w-16">Qty</th>
                        <th className="px-3 py-2 text-right font-medium text-zinc-500 w-20">Rate</th>
                        <th className="px-3 py-2 text-right font-medium text-zinc-500 w-14">Disc %</th>
                        <th className="px-3 py-2 text-right font-medium text-zinc-500 w-24">Amount</th>
                        <th className="px-3 py-2 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {items.length === 0 ? (
                        <tr><td colSpan={9} className="px-3 py-6 text-center text-zinc-400">No items yet</td></tr>
                      ) : (
                        items.map((item: any, idx: number) => {
                          const { rateAfterDiscount, totalAmount } = calcRow(item.rate, item.discount_percent, item.quantity);
                          const isEditing = editingItem === item.id;

                          return (
                            <tr key={item.id} className="hover:bg-zinc-50">
                              {isEditing ? (
                                <>
                                  <td className="px-3 py-1.5 text-zinc-500">{idx + 1}</td>
                                  <td className="px-3 py-1.5">
                                    <input value={editItemData.description} onChange={(e) => setEditItemData({ ...editItemData, description: e.target.value })}
                                      className="w-full px-1.5 py-0.5 text-xs border border-zinc-300 rounded" />
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <input value={editItemData.specification} onChange={(e) => setEditItemData({ ...editItemData, specification: e.target.value })}
                                      className="w-full px-1.5 py-0.5 text-xs border border-zinc-300 rounded" />
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <input value={editItemData.unit} onChange={(e) => setEditItemData({ ...editItemData, unit: e.target.value })}
                                      className="w-full px-1.5 py-0.5 text-xs border border-zinc-300 rounded text-center" />
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <input type="number" value={editItemData.quantity} onChange={(e) => setEditItemData({ ...editItemData, quantity: e.target.value })}
                                      className="w-full px-1.5 py-0.5 text-xs border border-zinc-300 rounded text-right" />
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <input type="number" value={editItemData.rate} onChange={(e) => setEditItemData({ ...editItemData, rate: e.target.value })}
                                      className="w-full px-1.5 py-0.5 text-xs border border-zinc-300 rounded text-right" />
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <input type="number" value={editItemData.discount_percent} onChange={(e) => setEditItemData({ ...editItemData, discount_percent: e.target.value })}
                                      className="w-full px-1.5 py-0.5 text-xs border border-zinc-300 rounded text-right" />
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-medium text-zinc-700">
                                    ₹{(calcRow(editItemData.rate, editItemData.discount_percent, editItemData.quantity).totalAmount).toLocaleString()}
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <div className="flex items-center gap-1">
                                      <button onClick={() => saveEditItem(item.id!, section.id!)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Save className="h-3.5 w-3.5" /></button>
                                      <button onClick={() => setEditingItem(null)} className="p-1 text-zinc-400 hover:bg-zinc-100 rounded"><X className="h-3.5 w-3.5" /></button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-3 py-1.5 text-zinc-500">{idx + 1}</td>
                                  <td className="px-3 py-1.5 text-zinc-700">{item.description || '-'}</td>
                                  <td className="px-3 py-1.5 text-zinc-500">{item.specification || '-'}</td>
                                  <td className="px-3 py-1.5 text-center text-zinc-600">{item.unit || '-'}</td>
                                  <td className="px-3 py-1.5 text-right text-zinc-700">{item.quantity || 0}</td>
                                  <td className="px-3 py-1.5 text-right text-zinc-600">₹{Number(item.rate || 0).toLocaleString()}</td>
                                  <td className="px-3 py-1.5 text-right text-zinc-600">{item.discount_percent || 0}%</td>
                                  <td className="px-3 py-1.5 text-right font-medium text-blue-700">₹{totalAmount.toLocaleString()}</td>
                                  <td className="px-3 py-1.5">
                                    <PermissionGuard permission="estimation.boq.update">
                                      <div className="flex items-center gap-1">
                                        <button onClick={() => startEditItem(item)} className="p-1 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100"><Edit3 className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => { if (confirm('Delete this item?')) deleteItem.mutate({ id: item.id!, sectionId: section.id! }); }}
                                          className="p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
                                      </div>
                                    </PermissionGuard>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-blue-50 font-semibold border-t border-zinc-200">
                        <td colSpan={4} className="px-3 py-2 text-right text-zinc-700">Total</td>
                        <td className="px-3 py-2 text-right text-zinc-700">{totals.qty}</td>
                        <td colSpan={2}></td>
                        <td className="px-3 py-2 text-right text-blue-700">₹{totals.amount.toLocaleString()}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Add Item */}
                <PermissionGuard permission="estimation.boq.update">
                  <div className="flex items-center gap-2 px-4 py-2 border-t border-dashed border-zinc-200">
                    <input value={newItemDesc[section.id!] || ''} onChange={(e) => setNewItemDesc({ ...newItemDesc, [section.id!]: e.target.value })}
                      placeholder="Add item description..." className="flex-1 px-2 py-1 text-sm border border-transparent focus:border-zinc-300 rounded focus:outline-none"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(section.id!); }} />
                    <button onClick={() => handleAddItem(section.id!)} disabled={!newItemDesc[section.id!]?.trim()}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30"><Plus className="h-4 w-4" /></button>
                  </div>
                </PermissionGuard>
              </div>
            );
          })}

          {/* Add Section */}
          <PermissionGuard permission="estimation.boq.update">
            <div className="flex items-center gap-2 p-4 border-2 border-dashed border-zinc-200 rounded-lg">
              <input value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="New section name..." className="flex-1 px-3 py-1.5 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddSection(); }} />
              <button onClick={handleAddSection} disabled={!newSectionName.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                <Plus className="h-4 w-4" /> Add Section
              </button>
            </div>
          </PermissionGuard>

          {/* Terms & Preface */}
          {(boq.terms_conditions || boq.preface) && (
            <div className="grid grid-cols-2 gap-4">
              {boq.terms_conditions && (
                <div className="bg-white border border-zinc-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-zinc-800 mb-2">Terms & Conditions</h3>
                  <p className="text-xs text-zinc-600 whitespace-pre-wrap">{boq.terms_conditions}</p>
                </div>
              )}
              {boq.preface && (
                <div className="bg-white border border-zinc-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-zinc-800 mb-2">Preface</h3>
                  <p className="text-xs text-zinc-600 whitespace-pre-wrap">{boq.preface}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
