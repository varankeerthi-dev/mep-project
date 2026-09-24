import { useState, useMemo, useRef, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { formatCurrency } from '../utils/formatters';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  X,
  FileSpreadsheet,
  Download,
  Printer,
  RotateCcw,
  Layers,
  ArrowRight,
  Maximize2,
  Minimize2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export interface RevisionSnapshot {
  revision_no: number;
  saved_at: string;
  reason?: string;
  items: any[];
  header?: {
    subtotal?: number;
    total?: number;
    grand_total?: number;
    discount_amount?: number;
    discount_percent?: number;
    total_tax?: number;
    extra_discount_amount?: number;
    extra_discount_percent?: number;
  };
  header_discounts?: Record<string, number>;
  extra_discount_percent?: number;
  extra_discount_amount?: number;
}

export interface QuotationRevisionCompareModalProps {
  open: boolean;
  onClose: () => void;
  quotationId?: string;
  documentNumber: string;
  revisionHistory: RevisionSnapshot[];
  currentRevisionNo: number;
  currentItems?: any[];
  currentTotal?: number;
  currentHeader?: any;
  onRestoreRevision?: (revision: RevisionSnapshot) => void;
}

interface AlignedRevisionCell {
  present: boolean;
  qty: number | string;
  rate: number;
  discount_percent: number;
  amount: number;
  changedQty?: boolean;
  changedRate?: boolean;
  changedDisc?: boolean;
  changedAmount?: boolean;
  isNew?: boolean;
  isRemoved?: boolean;
}

interface AlignedItemRow {
  key: string;
  sno: number;
  itemName: string;
  itemSpec: string | null;
  item_code: string;
  description: string;
  uom: string;
  section: string;
  revisions: Record<number, AlignedRevisionCell>;
}

// ─── PDF / Export Number & Currency Formatters ──────────────────────────────
function fmtPdfNum(n: number | string | undefined, decimals = 2): string {
  const v = parseFloat(String(n ?? 0)) || 0;
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v);
}

function fmtPdfCur(n: number | string | undefined): string {
  if (n === '-' || n === undefined || n === null) return '-';
  const v = parseFloat(String(n));
  if (isNaN(v)) return '-';
  return 'Rs. ' + fmtPdfNum(v, 2);
}

function fmtPdfQty(n: number | string | undefined): string {
  if (n === '-' || n === undefined || n === null) return '-';
  const v = parseFloat(String(n));
  if (isNaN(v)) return String(n);
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(v);
}

export function QuotationRevisionCompareModal({
  open,
  onClose,
  quotationId,
  documentNumber,
  revisionHistory = [],
  currentRevisionNo = 1,
  currentItems,
  currentTotal = 0,
  currentHeader,
  onRestoreRevision,
}: QuotationRevisionCompareModalProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [groupBySection, setGroupBySection] = useState(true);
  const printContainerRef = useRef<HTMLDivElement>(null);

  // If current items not passed, load from quotation_items
  const { data: fetchedItems = [] } = useQuery({
    queryKey: ['quotation-items-compare', quotationId],
    queryFn: async () => {
      if (!quotationId) return [];
      const { data, error } = await supabase
        .from('quotation_items')
        .select('*, item:materials(id, item_code, display_name, name, hsn_code, unit), material:materials(id, item_code, display_name, name, hsn_code, unit)')
        .eq('quotation_id', quotationId)
        .order('display_order', { ascending: true });
      if (error) {
        console.error('Error fetching quotation items for comparison:', error);
        return [];
      }
      return data || [];
    },
    enabled: open && !!quotationId && (!currentItems || currentItems.length === 0),
  });

  const effectiveCurrentItems = useMemo(() => {
    if (currentItems && currentItems.length > 0) return currentItems;
    return fetchedItems;
  }, [currentItems, fetchedItems]);

  // Collect all material IDs across all snapshots and current items to guarantee name resolution
  const allItemIds = useMemo(() => {
    const ids = new Set<string>();
    const addItemId = (it: any) => {
      if (!it) return;
      const id = it.item_id || it.material_id || it.item?.id || it.material?.id;
      if (id && typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        ids.add(id);
      }
    };

    revisionHistory.forEach((snap) => {
      (snap.items || []).forEach(addItemId);
    });

    (effectiveCurrentItems || []).forEach(addItemId);

    return Array.from(ids);
  }, [revisionHistory, effectiveCurrentItems]);

  const { data: materialsMap = new Map<string, any>() } = useQuery({
    queryKey: ['materials-for-revision-compare', allItemIds.sort().join(',')],
    queryFn: async () => {
      if (allItemIds.length === 0) return new Map<string, any>();
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, display_name, item_code, unit, hsn_code')
        .in('id', allItemIds);
      if (error) {
        console.error('Error fetching materials for revision compare:', error);
        return new Map<string, any>();
      }
      const map = new Map<string, any>();
      (data || []).forEach((m) => map.set(m.id, m));
      return map;
    },
    enabled: open && allItemIds.length > 0,
  });

  // Build the chronological list of revisions (Rev 1, Rev 2, Rev 3...)
  const revisionsList = useMemo(() => {
    const map = new Map<number, {
      revision_no: number;
      title: string;
      saved_at: string;
      isCurrent: boolean;
      items: any[];
      total: number;
      rawSnapshot?: RevisionSnapshot;
    }>();

    // 1. Historical snapshots
    revisionHistory.forEach((snap) => {
      const revNo = snap.revision_no || 1;
      const isOriginal = revNo === 1;
      map.set(revNo, {
        revision_no: revNo,
        title: isOriginal ? 'Original (Rev 01)' : `Revision ${String(revNo).padStart(2, '0')}`,
        saved_at: snap.saved_at || '',
        isCurrent: false,
        items: snap.items || [],
        total: snap.header?.total ?? snap.header?.grand_total ?? 0,
        rawSnapshot: snap,
      });
    });

    // 2. Current active revision
    if (!map.has(currentRevisionNo) && effectiveCurrentItems && effectiveCurrentItems.length > 0) {
      const isOriginal = currentRevisionNo === 1;
      map.set(currentRevisionNo, {
        revision_no: currentRevisionNo,
        title: isOriginal ? 'Original (Rev 01)' : `Revision ${String(currentRevisionNo).padStart(2, '0')} (Current)`,
        saved_at: 'Current Active',
        isCurrent: true,
        items: effectiveCurrentItems,
        total: currentTotal || 0,
        rawSnapshot: {
          revision_no: currentRevisionNo,
          saved_at: new Date().toISOString(),
          items: effectiveCurrentItems,
          header: currentHeader || { total: currentTotal, grand_total: currentTotal }
        }
      });
    }

    return Array.from(map.values()).sort((a, b) => a.revision_no - b.revision_no);
  }, [revisionHistory, currentRevisionNo, effectiveCurrentItems, currentTotal, currentHeader]);

  // Align rows across all revisions
  const alignedRows = useMemo(() => {
    const getItemKey = (item: any): string => {
      const isErection =
        item.section === 'erection' ||
        (item.item_id === null && item.sac_code !== null) ||
        (typeof item.description === 'string' && item.description.includes(' - Erection'));

      if (isErection) {
        const desc = (item.description || item.item_name || 'erection').trim().toLowerCase();
        return `erection:${desc}`;
      }

      const mId = item.item_id || item.material_id || item.item?.id || item.material?.id;
      const desc = (item.description || '').trim().toLowerCase();
      if (mId) {
        return desc ? `id:${mId}::${desc}` : `id:${mId}`;
      }
      const code = (item.item_code || item.item?.item_code || item.material?.item_code || '').trim().toLowerCase();
      if (code) {
        return desc ? `code:${code}::${desc}` : `code:${code}`;
      }
      return `desc:${desc || item.item_name || item.name || 'item'}`;
    };

    // Helper to extract proper item name, spec, code, and UOM
    const resolveItemInfo = (item: any) => {
      const isErection =
        item.section === 'erection' ||
        (item.item_id === null && item.sac_code !== null) ||
        (typeof item.description === 'string' && item.description.includes(' - Erection'));

      if (isErection) {
        const rawDesc = (item.description || item.item_name || item.name || 'Installation & Erection').trim();
        return {
          itemName: rawDesc,
          itemSpec: item.custom1?.trim() || null,
          itemCode: item.sac_code || item.item_code || '-',
          uom: item.uom || item.unit || 'LS',
          section: 'Installation & Erection',
        };
      }

      // Supply of Materials
      const mId = item.item_id || item.material_id || item.item?.id || item.material?.id;
      const mat = (mId ? materialsMap.get(mId) : null) || item.material || item.item;

      // The true item name from material record or item name field
      const candidateName =
        mat?.display_name ||
        mat?.name ||
        item.display_name ||
        item.item_name ||
        item.name;

      let itemName = candidateName ? String(candidateName).trim() : '';
      let itemSpec: string | null = null;

      const rawDesc = typeof item.description === 'string' ? item.description.trim() : '';

      if (itemName) {
        // If we have a genuine item name from material/item, then whatever is in item.description
        // (if not equal to itemName) is the user's custom specification / notes (e.g. "4-mt length")
        if (rawDesc && rawDesc.toLowerCase() !== itemName.toLowerCase()) {
          itemSpec = rawDesc;
        } else if (item.custom1 && item.custom1.trim()) {
          itemSpec = item.custom1.trim();
        }
      } else {
        // If no candidate name was found on material/item, check if rawDesc exists
        if (rawDesc) {
          itemName = rawDesc;
        } else {
          itemName = 'Item';
        }
      }

      const itemCode = mat?.item_code || item.item_code || item.hsn_code || '-';
      const uom = item.uom || mat?.unit || item.item?.unit || item.unit || 'Nos';

      return {
        itemName,
        itemSpec,
        itemCode,
        uom,
        section: 'Supply of Materials',
      };
    };

    // Track keyed items per revision
    const revKeyedMaps = new Map<number, Map<string, any>>();
    const masterKeysOrdered: Array<{ key: string; item: any }> = [];
    const seenMasterKeys = new Set<string>();

    revisionsList.forEach((rev) => {
      const itemOccurrence: Record<string, number> = {};
      const keyed = new Map<string, any>();

      (rev.items || []).forEach((item: any) => {
        if (item.is_header || item.is_subtotal) return;
        const baseKey = getItemKey(item);
        const count = itemOccurrence[baseKey] || 0;
        itemOccurrence[baseKey] = count + 1;
        const fullKey = `${baseKey}#${count}`;
        keyed.set(fullKey, item);

        const existingIdx = masterKeysOrdered.findIndex((m) => m.key === fullKey);
        if (existingIdx === -1) {
          masterKeysOrdered.push({ key: fullKey, item });
        } else {
          const curMaster = masterKeysOrdered[existingIdx].item;
          if (!curMaster.material && (item.material || item.item)) {
            masterKeysOrdered[existingIdx].item = item;
          }
        }
      });

      revKeyedMaps.set(rev.revision_no, keyed);
    });

    // Build the AlignedItemRow array
    let snoCounter = 1;
    const rows: AlignedItemRow[] = masterKeysOrdered.map(({ key, item }) => {
      const rowRevs: Record<number, AlignedRevisionCell> = {};
      let prevCell: AlignedRevisionCell | null = null;

      revisionsList.forEach((rev, idx) => {
        const revMap = revKeyedMaps.get(rev.revision_no);
        const revItem = revMap ? revMap.get(key) : null;

        if (revItem) {
          const qty = Number(revItem.qty ?? 0);
          const rate = Number(revItem.rate ?? revItem.base_rate_snapshot ?? 0);
          const disc = Number(revItem.discount_percent ?? 0);
          const amt = Number(revItem.line_total ?? (qty * rate));

          const cell: AlignedRevisionCell = {
            present: true,
            qty: revItem.qty !== undefined ? revItem.qty : 0,
            rate,
            discount_percent: disc,
            amount: amt,
            changedQty: prevCell?.present ? prevCell.qty !== revItem.qty : false,
            changedRate: prevCell?.present ? prevCell.rate !== rate : false,
            changedDisc: prevCell?.present ? prevCell.discount_percent !== disc : false,
            changedAmount: prevCell?.present ? prevCell.amount !== amt : false,
            isNew: idx > 0 && (!prevCell || !prevCell.present),
          };
          rowRevs[rev.revision_no] = cell;
          prevCell = cell;
        } else {
          const cell: AlignedRevisionCell = {
            present: false,
            qty: '-',
            rate: 0,
            discount_percent: 0,
            amount: 0,
            isRemoved: prevCell?.present === true,
          };
          rowRevs[rev.revision_no] = cell;
          prevCell = cell;
        }
      });

      const resolved = resolveItemInfo(item);

      return {
        key,
        sno: snoCounter++,
        itemName: resolved.itemName,
        itemSpec: resolved.itemSpec,
        item_code: resolved.itemCode,
        description: resolved.itemName + (resolved.itemSpec ? ` (${resolved.itemSpec})` : ''),
        uom: resolved.uom,
        section: resolved.section,
        revisions: rowRevs,
      };
    });

    return rows;
  }, [revisionsList, materialsMap]);

  // Calculate section totals and overall totals
  const sectionTotals = useMemo(() => {
    const sections: Record<string, Record<number, number>> = {};

    alignedRows.forEach((row) => {
      const sec = row.section;
      if (!sections[sec]) sections[sec] = {};
      revisionsList.forEach((rev) => {
        const cell = row.revisions[rev.revision_no];
        if (cell && cell.present) {
          sections[sec][rev.revision_no] = (sections[sec][rev.revision_no] || 0) + cell.amount;
        }
      });
    });

    return sections;
  }, [alignedRows, revisionsList]);

  const grandTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    revisionsList.forEach((rev) => {
      let sum = 0;
      alignedRows.forEach((row) => {
        const cell = row.revisions[rev.revision_no];
        if (cell && cell.present) {
          sum += cell.amount;
        }
      });
      // Fallback to rev.total if items sum is 0
      totals[rev.revision_no] = sum > 0 ? sum : rev.total;
    });
    return totals;
  }, [alignedRows, revisionsList]);

  // Grouped rows if grouping enabled
  const groupedData = useMemo(() => {
    if (!groupBySection) {
      return [{ sectionName: 'All Line Items', rows: alignedRows }];
    }
    const map = new Map<string, AlignedItemRow[]>();
    alignedRows.forEach((row) => {
      const sec = row.section || 'General';
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(row);
    });
    return Array.from(map.entries()).map(([sectionName, rows]) => ({ sectionName, rows }));
  }, [alignedRows, groupBySection]);

  // Overall Variance calculation (Original vs Latest)
  const varianceMetrics = useMemo(() => {
    if (revisionsList.length < 2) return null;
    const firstRev = revisionsList[0];
    const lastRev = revisionsList[revisionsList.length - 1];
    const firstTotal = grandTotals[firstRev.revision_no] || firstRev.total || 0;
    const lastTotal = grandTotals[lastRev.revision_no] || lastRev.total || 0;
    const diff = lastTotal - firstTotal;
    const pct = firstTotal > 0 ? (diff / firstTotal) * 100 : 0;

    return {
      firstTitle: firstRev.title,
      lastTitle: lastRev.title,
      firstTotal,
      lastTotal,
      diff,
      pct,
    };
  }, [revisionsList, grandTotals]);

  // ─── Export to Excel ────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (revisionsList.length === 0) return;

    // Header 1 (Meta title)
    const titleRow = [`QUOTATION REVISION COMPARISON — ${documentNumber}`];
    const metaRow = [`Generated: ${new Date().toLocaleString()}`, `Revisions Compared: ${revisionsList.length}`];
    const blankRow: any[] = [];

    // Table Header Row 1 (Revision Groups)
    const revHeaderRow = ['#', 'Item Name', 'Specification / Notes', 'Code', 'UOM'];
    revisionsList.forEach((rev) => {
      revHeaderRow.push(rev.title, '', '', '');
    });

    // Table Header Row 2 (Sub-columns)
    const subHeaderRow = ['', '', '', '', ''];
    revisionsList.forEach(() => {
      subHeaderRow.push('Qty', 'Rate (Net)', 'Disc %', 'Amount');
    });

    // Data Rows
    const dataRows: any[] = [];
    groupedData.forEach(({ sectionName, rows }) => {
      if (groupBySection) {
        dataRows.push([`--- ${sectionName.toUpperCase()} ---`]);
      }
      rows.forEach((r) => {
        const rowVals: any[] = [
          r.sno,
          r.itemName,
          r.itemSpec || '',
          r.item_code,
          r.uom,
        ];
        revisionsList.forEach((rev) => {
          const c = r.revisions[rev.revision_no];
          if (c && c.present) {
            rowVals.push(
              typeof c.qty === 'number' ? c.qty : parseFloat(String(c.qty)) || 0,
              c.rate,
              c.discount_percent ? `${c.discount_percent}%` : '0%',
              c.amount
            );
          } else {
            rowVals.push('-', '-', '-', '-');
          }
        });
        dataRows.push(rowVals);
      });

      // Section total
      if (groupBySection && sectionTotals[sectionName]) {
        const secRow: any[] = ['', `Subtotal: ${sectionName}`, '', '', ''];
        revisionsList.forEach((rev) => {
          const amt = sectionTotals[sectionName]?.[rev.revision_no] || 0;
          secRow.push('-', '-', '-', amt);
        });
        dataRows.push(secRow);
      }
    });

    // Grand total row
    const grandRow: any[] = ['', 'GRAND TOTAL (BASIC)', '', '', ''];
    revisionsList.forEach((rev) => {
      grandRow.push('-', '-', '-', grandTotals[rev.revision_no] || 0);
    });
    dataRows.push(grandRow);

    const sheetData = [
      titleRow,
      metaRow,
      blankRow,
      revHeaderRow,
      subHeaderRow,
      ...dataRows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Apply merges for revision group headers
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 + revisionsList.length * 4 } },
      // Merge Item details
      { s: { r: 3, c: 0 }, e: { r: 4, c: 0 } },
      { s: { r: 3, c: 1 }, e: { r: 4, c: 1 } },
      { s: { r: 3, c: 2 }, e: { r: 4, c: 2 } },
      { s: { r: 3, c: 3 }, e: { r: 4, c: 3 } },
      { s: { r: 3, c: 4 }, e: { r: 4, c: 4 } },
    ];

    revisionsList.forEach((_, idx) => {
      const startCol = 5 + idx * 4;
      ws['!merges']?.push({
        s: { r: 3, c: startCol },
        e: { r: 3, c: startCol + 3 },
      });
    });

    // Auto widths
    ws['!cols'] = [
      { wch: 6 },  // S.No
      { wch: 32 }, // Item Name
      { wch: 22 }, // Specification / Notes
      { wch: 15 }, // Code
      { wch: 8 },  // UOM
      ...revisionsList.flatMap(() => [
        { wch: 10 }, // Qty
        { wch: 16 }, // Rate
        { wch: 10 }, // Disc%
        { wch: 18 }, // Amount
      ]),
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Revision Comparison');
    XLSX.writeFile(wb, `Quotation_${documentNumber}_Revision_Comparison.xlsx`);
  };

  // ─── Export to PDF ──────────────────────────────────────────────────────────
  const handleExportPdf = () => {
    if (revisionsList.length === 0) return;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(`Quotation Revision Comparison — ${documentNumber}`, 14, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleString()}  |  Total Revisions: ${revisionsList.length}`, 14, 20);

    // Build head
    const headRow1: any[] = [
      { content: '#', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Item Name & Specification', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
      { content: 'UOM', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
    ];

    revisionsList.forEach((rev) => {
      headRow1.push({
        content: rev.title,
        colSpan: 4,
        styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 23, 42] },
      });
    });

    const headRow2: any[] = [];
    revisionsList.forEach(() => {
      headRow2.push(
        { content: 'Qty', styles: { halign: 'center' } },
        { content: 'Rate (Net)', styles: { halign: 'left' } },
        { content: 'Disc %', styles: { halign: 'center' } },
        { content: 'Amount', styles: { halign: 'left' } }
      );
    });

    const bodyRows: any[] = [];
    groupedData.forEach(({ sectionName, rows }) => {
      if (groupBySection) {
        bodyRows.push([
          {
            content: sectionName.toUpperCase(),
            colSpan: 3 + revisionsList.length * 4,
            styles: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105] },
          },
        ]);
      }
      rows.forEach((r) => {
        let itemLabel = r.itemName;
        if (r.itemSpec) {
          itemLabel += `\n(${r.itemSpec})`;
        }
        if (r.item_code && r.item_code !== '-') {
          itemLabel += `\nCode: ${r.item_code}`;
        }

        const rowVals: any[] = [
          { content: String(r.sno), styles: { halign: 'center' } },
          { content: itemLabel, styles: { halign: 'left' } },
          { content: r.uom, styles: { halign: 'center' } },
        ];
        revisionsList.forEach((rev) => {
          const c = r.revisions[rev.revision_no];
          if (c && c.present) {
            rowVals.push(
              { content: fmtPdfQty(c.qty), styles: { halign: 'center', fontStyle: c.changedQty ? 'bold' : 'normal' } },
              { content: fmtPdfCur(c.rate), styles: { halign: 'left', fontStyle: c.changedRate ? 'bold' : 'normal' } },
              { content: c.discount_percent ? `${c.discount_percent}%` : '-', styles: { halign: 'center', fontStyle: c.changedDisc ? 'bold' : 'normal' } },
              { content: fmtPdfCur(c.amount), styles: { halign: 'left', fontStyle: c.changedAmount ? 'bold' : 'normal' } }
            );
          } else {
            rowVals.push(
              { content: '-', styles: { halign: 'center', textColor: [148, 163, 184] } },
              { content: '-', styles: { halign: 'left', textColor: [148, 163, 184] } },
              { content: '-', styles: { halign: 'center', textColor: [148, 163, 184] } },
              { content: '-', styles: { halign: 'left', textColor: [148, 163, 184] } }
            );
          }
        });
        bodyRows.push(rowVals);
      });

      // Section total
      if (groupBySection && sectionTotals[sectionName]) {
        const secRow: any[] = [
          { content: '', colSpan: 1 },
          { content: `Subtotal: ${sectionName}`, colSpan: 2, styles: { fontStyle: 'bold' } },
        ];
        revisionsList.forEach((rev) => {
          const amt = sectionTotals[sectionName]?.[rev.revision_no] || 0;
          secRow.push(
            { content: '-', styles: { halign: 'center' } },
            { content: '-', styles: { halign: 'left' } },
            { content: '-', styles: { halign: 'center' } },
            { content: fmtPdfCur(amt), styles: { halign: 'left', fontStyle: 'bold' } }
          );
        });
        bodyRows.push(secRow);
      }
    });

    // Grand total
    const grandRow: any[] = [
      { content: '', colSpan: 1 },
      { content: 'GRAND TOTAL (BASIC)', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
    ];
    revisionsList.forEach((rev) => {
      grandRow.push(
        { content: '-', styles: { halign: 'center', fillColor: [241, 245, 249] } },
        { content: '-', styles: { halign: 'left', fillColor: [241, 245, 249] } },
        { content: '-', styles: { halign: 'center', fillColor: [241, 245, 249] } },
        { content: fmtPdfCur(grandTotals[rev.revision_no] || 0), styles: { halign: 'left', fontStyle: 'bold', fillColor: [241, 245, 249] } }
      );
    });
    bodyRows.push(grandRow);

    // Smart column styles
    const colStyles: Record<number, any> = {
      0: { cellWidth: 9, halign: 'center' },
      1: { minCellWidth: 40, halign: 'left' },
      2: { cellWidth: 12, halign: 'center' },
    };
    revisionsList.forEach((_, idx) => {
      const baseIdx = 3 + idx * 4;
      colStyles[baseIdx] = { cellWidth: 14, halign: 'center' };      // Qty
      colStyles[baseIdx + 1] = { cellWidth: 24, halign: 'left' };    // Rate (Net)
      colStyles[baseIdx + 2] = { cellWidth: 13, halign: 'center' };  // Disc %
      colStyles[baseIdx + 3] = { cellWidth: 26, halign: 'left' };    // Amount
    });

    autoTable(doc, {
      startY: 25,
      head: [headRow1, headRow2],
      body: bodyRows,
      theme: 'grid',
      columnStyles: colStyles,
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        lineColor: [203, 213, 225],
        lineWidth: 0.15,
        textColor: [30, 41, 59],
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
      },
    });

    doc.save(`Quotation_${documentNumber}_Revision_Comparison.pdf`);
  };

  // ─── Print View ─────────────────────────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-2 sm:p-4 select-none"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl flex flex-col border border-slate-300 transition-all duration-200 overflow-hidden ${
          isFullScreen ? 'w-full h-full rounded-none' : 'w-[96vw] max-w-[1500px] h-[92vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-300 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-700 flex items-center justify-center font-bold">
              <Layers size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 m-0">
                  Revision Comparison Grid
                </h2>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-200 text-slate-800 border border-slate-300">
                  {documentNumber}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  {revisionsList.length} {revisionsList.length === 1 ? 'Version' : 'Versions'}
                </span>
              </div>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Side-by-side comparison of line items, rates, discounts, and amounts across all quotation revisions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Group by section toggle */}
            <button
              type="button"
              onClick={() => setGroupBySection(!groupBySection)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                groupBySection
                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
              }`}
              title="Group items by Supply vs Erection section"
            >
              Sections: {groupBySection ? 'ON' : 'OFF'}
            </button>

            {/* Export to Excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition-colors cursor-pointer"
              title="Download comparison table as Microsoft Excel (.xlsx)"
            >
              <FileSpreadsheet size={14} />
              Export to Excel
            </button>

            {/* Export to PDF */}
            <button
              type="button"
              onClick={handleExportPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white shadow-xs transition-colors cursor-pointer"
              title="Download comparison as landscape PDF"
            >
              <Download size={14} />
              PDF
            </button>

            {/* Print View */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-colors cursor-pointer"
              title="Print comparison table"
            >
              <Printer size={14} />
              Print
            </button>

            {/* Fullscreen toggle */}
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-md transition-colors"
              title={isFullScreen ? 'Exit full screen' : 'Expand full screen'}
            >
              {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-md transition-colors"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Sub-toolbar: Variance KPI bar */}
        {varianceMetrics && (
          <div className="px-5 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs text-slate-700 shrink-0 flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">{varianceMetrics.firstTitle}:</span>
                <span className="font-bold text-slate-900">{formatCurrency(varianceMetrics.firstTotal)}</span>
              </div>
              <ArrowRight size={14} className="text-slate-400" />
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">{varianceMetrics.lastTitle}:</span>
                <span className="font-bold text-slate-900">{formatCurrency(varianceMetrics.lastTotal)}</span>
              </div>
              <div className="h-4 w-px bg-slate-300 mx-1" />
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Net Negotiation Delta:</span>
                <span
                  className={`font-bold ${
                    varianceMetrics.diff < 0
                      ? 'text-emerald-700'
                      : varianceMetrics.diff > 0
                      ? 'text-amber-700'
                      : 'text-slate-700'
                  }`}
                >
                  {varianceMetrics.diff > 0 ? '+' : ''}
                  {formatCurrency(varianceMetrics.diff)} ({varianceMetrics.pct > 0 ? '+' : ''}
                  {varianceMetrics.pct.toFixed(2)}%)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-900"></span>
                <strong>Bold:</strong> Changed Value
              </span>
              <span className="flex items-center gap-1">
                <span className="text-slate-400 font-bold">- :</span> Not Present in Version
              </span>
            </div>
          </div>
        )}

        {/* Table Content Container */}
        <div ref={printContainerRef} className="flex-1 overflow-auto bg-white select-text">
          {revisionsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
              <AlertCircle size={36} className="text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">No revisions found for this quotation.</p>
              <p className="text-xs text-slate-400 mt-1">Revisions are automatically captured when negotiation mode is saved.</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left font-sans text-xs">
              {/* Sticky Table Header */}
              <thead className="sticky top-0 z-30 shadow-xs">
                {/* Header Row 1: Fixed Item Columns + Revision Super-Headers */}
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-40 bg-slate-100 border-r border-slate-300 px-2.5 py-2 text-center font-bold text-slate-700 w-10 shrink-0"
                  >
                    #
                  </th>
                  <th
                    rowSpan={2}
                    className="sticky left-10 z-40 bg-slate-100 border-r border-slate-300 px-3 py-2 text-left font-bold text-slate-800 min-w-[240px] max-w-[320px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"
                  >
                    Item Name & Specification
                  </th>
                  <th
                    rowSpan={2}
                    className="border-r border-slate-300 px-2 py-2 text-center font-bold text-slate-700 w-14 shrink-0 bg-slate-100"
                  >
                    UOM
                  </th>

                  {/* Per Revision Header */}
                  {revisionsList.map((rev) => (
                    <th
                      key={rev.revision_no}
                      colSpan={4}
                      className="border-r border-slate-300 px-3 py-1.5 text-center bg-slate-100"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-left">
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            {rev.title}
                            {rev.isCurrent && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold">
                                Live
                              </span>
                            )}
                          </div>
                          {rev.saved_at && rev.saved_at !== 'Current Active' && (
                            <div className="text-[10px] font-normal text-slate-500">
                              {new Date(rev.saved_at).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          )}
                        </div>

                        {/* Restore button */}
                        {!rev.isCurrent && onRestoreRevision && rev.rawSnapshot && (
                          <button
                            type="button"
                            onClick={() => onRestoreRevision(rev.rawSnapshot!)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-700 hover:bg-blue-800 text-white text-[11px] font-semibold cursor-pointer shadow-xs transition-colors shrink-0"
                            title={`Restore Quotation to ${rev.title}`}
                          >
                            <RotateCcw size={11} />
                            Restore
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>

                {/* Header Row 2: Sub-headers for each revision */}
                <tr className="bg-slate-50 border-b border-slate-300 text-[11px]">
                  {revisionsList.map((rev) => (
                    <Fragment key={`sub-${rev.revision_no}`}>
                      <th className="border-r border-slate-300 px-2 py-1.5 text-center font-semibold text-slate-600 bg-slate-50 w-16">
                        Qty
                      </th>
                      <th className="border-r border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-600 bg-slate-50 w-24">
                        Rate (Net)
                      </th>
                      <th className="border-r border-slate-300 px-2 py-1.5 text-center font-semibold text-slate-600 bg-slate-50 w-16">
                        Disc %
                      </th>
                      <th className="border-r border-slate-300 px-2.5 py-1.5 text-left font-semibold text-slate-600 bg-slate-50 w-28">
                        Amount
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-200">
                {groupedData.map(({ sectionName, rows }) => (
                  <Fragment key={sectionName}>
                    {/* Section Header Row */}
                    {groupBySection && (
                      <tr className="bg-slate-100/90 font-bold text-slate-700 text-xs border-y border-slate-300">
                        <td
                          colSpan={3 + revisionsList.length * 4}
                          className="px-3 py-1.5 bg-slate-100 font-bold text-slate-800 tracking-wide uppercase text-[11px]"
                        >
                          📁 {sectionName} ({rows.length} {rows.length === 1 ? 'item' : 'items'})
                        </td>
                      </tr>
                    )}

                    {/* Aligned Line Items */}
                    {rows.map((row, rowIdx) => (
                      <tr
                        key={row.key}
                        className={`hover:bg-blue-50/40 transition-colors ${
                          rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                        }`}
                      >
                        {/* S.No */}
                        <td className="sticky left-0 z-20 bg-inherit border-r border-slate-200 px-2.5 py-2 text-center text-slate-500 font-mono text-[11px]">
                          {row.sno}
                        </td>

                        {/* Item Name & Specification */}
                        <td className="sticky left-10 z-20 bg-inherit border-r border-slate-300 px-3 py-2 text-left shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                          <div className="font-semibold text-slate-900 leading-tight">
                            {row.itemName}
                          </div>
                          {row.itemSpec && (
                            <div className="text-[11px] text-slate-600 italic mt-0.5 font-normal">
                              {row.itemSpec}
                            </div>
                          )}
                          {row.item_code && row.item_code !== '-' && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              Code: {row.item_code}
                            </div>
                          )}
                        </td>

                        {/* UOM */}
                        <td className="border-r border-slate-200 px-2 py-2 text-center text-slate-600 font-mono text-[11px]">
                          {row.uom}
                        </td>

                        {/* Revision Cells */}
                        {revisionsList.map((rev) => {
                          const cell = row.revisions[rev.revision_no];
                          if (!cell || !cell.present) {
                            return (
                              <Fragment key={rev.revision_no}>
                                <td className="border-r border-slate-200 px-2 py-2 text-center text-slate-300 font-normal">
                                  -
                                </td>
                                <td className="border-r border-slate-200 px-2 py-2 text-left text-slate-300 font-normal">
                                  -
                                </td>
                                <td className="border-r border-slate-200 px-2 py-2 text-center text-slate-300 font-normal">
                                  -
                                </td>
                                <td className="border-r border-slate-300 px-2.5 py-2 text-left text-slate-300 font-normal">
                                  -
                                </td>
                              </Fragment>
                            );
                          }

                          return (
                            <Fragment key={rev.revision_no}>
                              {/* Qty */}
                              <td
                                className={`border-r border-slate-200 px-2 py-2 text-center text-slate-800 ${
                                  cell.changedQty ? 'font-bold text-slate-950 bg-amber-50/60' : 'font-normal'
                                }`}
                              >
                                {cell.qty}
                              </td>

                              {/* Rate */}
                              <td
                                className={`border-r border-slate-200 px-2 py-2 text-left text-slate-800 ${
                                  cell.changedRate ? 'font-bold text-slate-950 bg-amber-50/60' : 'font-normal'
                                }`}
                              >
                                {formatCurrency(cell.rate)}
                              </td>

                              {/* Disc % */}
                              <td
                                className={`border-r border-slate-200 px-2 py-2 text-center text-slate-600 ${
                                  cell.changedDisc ? 'font-bold text-slate-950 bg-amber-50/60' : 'font-normal'
                                }`}
                              >
                                {cell.discount_percent ? `${cell.discount_percent}%` : '-'}
                              </td>

                              {/* Amount (strictly left-aligned) */}
                              <td
                                className={`border-r border-slate-300 px-2.5 py-2 text-left text-slate-900 ${
                                  cell.changedAmount ? 'font-bold text-slate-950 bg-amber-50/60' : 'font-normal'
                                }`}
                              >
                                {formatCurrency(cell.amount)}
                              </td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    ))}

                    {/* Section Subtotal Row */}
                    {groupBySection && (
                      <tr className="bg-slate-100 font-semibold border-y border-slate-300 text-[11px]">
                        <td className="sticky left-0 bg-slate-100 border-r border-slate-200 px-2 py-1.5 text-center"></td>
                        <td className="sticky left-10 bg-slate-100 border-r border-slate-300 px-3 py-1.5 text-left font-bold text-slate-800 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                          Subtotal — {sectionName}
                        </td>
                        <td className="border-r border-slate-200 px-2 py-1.5 text-center"></td>

                        {revisionsList.map((rev) => {
                          const secAmt = sectionTotals[sectionName]?.[rev.revision_no] || 0;
                          return (
                            <Fragment key={`sec-tot-${rev.revision_no}`}>
                              <td className="border-r border-slate-200 px-2 py-1.5 text-center text-slate-400 font-normal">
                                -
                              </td>
                              <td className="border-r border-slate-200 px-2 py-1.5 text-left text-slate-400 font-normal">
                                -
                              </td>
                              <td className="border-r border-slate-200 px-2 py-1.5 text-center text-slate-400 font-normal">
                                -
                              </td>
                              <td className="border-r border-slate-300 px-2.5 py-1.5 text-left font-bold text-slate-900">
                                {formatCurrency(secAmt)}
                              </td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>

              {/* Table Footer: Grand Total */}
              <tfoot className="sticky bottom-0 z-30 shadow-md">
                <tr className="bg-slate-200 border-t-2 border-slate-400 text-xs font-bold text-slate-900">
                  <td className="sticky left-0 bg-slate-200 border-r border-slate-300 px-2 py-2.5 text-center">
                    ∑
                  </td>
                  <td className="sticky left-10 bg-slate-200 border-r border-slate-400 px-3 py-2.5 text-left font-bold text-slate-900 uppercase tracking-wider shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                    Grand Total (Basic)
                  </td>
                  <td className="border-r border-slate-300 px-2 py-2.5 text-center"></td>

                  {revisionsList.map((rev) => (
                    <Fragment key={`grand-${rev.revision_no}`}>
                      <td className="border-r border-slate-300 px-2 py-2.5 text-center text-slate-500 font-normal">
                        -
                      </td>
                      <td className="border-r border-slate-300 px-2 py-2.5 text-left text-slate-500 font-normal">
                        -
                      </td>
                      <td className="border-r border-slate-300 px-2 py-2.5 text-center text-slate-500 font-normal">
                        -
                      </td>
                      <td className="border-r border-slate-400 px-2.5 py-2.5 text-left font-bold text-slate-950 text-xs bg-slate-200">
                        {formatCurrency(grandTotals[rev.revision_no] || 0)}
                      </td>
                    </Fragment>
                  ))}
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Modal Footer Bar */}
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-300 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>
              Total Rows: <strong className="text-slate-800">{alignedRows.length}</strong>
            </span>
            <span>•</span>
            <span>
              Revisions: <strong className="text-slate-800">{revisionsList.length}</strong>
            </span>
            {varianceMetrics && (
              <>
                <span>•</span>
                <span>
                  Net Difference:{' '}
                  <strong
                    className={
                      varianceMetrics.diff < 0
                        ? 'text-emerald-700'
                        : varianceMetrics.diff > 0
                        ? 'text-amber-700'
                        : 'text-slate-800'
                    }
                  >
                    {varianceMetrics.diff > 0 ? '+' : ''}
                    {formatCurrency(varianceMetrics.diff)} ({varianceMetrics.pct > 0 ? '+' : ''}
                    {varianceMetrics.pct.toFixed(2)}%)
                  </strong>
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
