import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCreateMeasurementSheet, MeasurementLineItem } from '../hooks/useMeasurementSheets';
import { exportMeasurementSheetPDF } from '../utils/exportMeasurementSheetPDF';
import { formatCurrency } from '../utils/formatters';
import { Download, Plus, Trash2, FileSpreadsheet, Save, X, Calculator } from 'lucide-react';

interface SpreadsheetMeasurementSheetProps {
  workOrderId: string;
  workOrderNo: string;
  workDescription: string;
  subcontractorName: string;
  currentContractValue: number;
  existingSheetsCount: number;
  onClose: () => void;
  onSuccess: () => void;
}

type CellPosition = { row: number; col: number };

export function SpreadsheetMeasurementSheet({
  workOrderId,
  workOrderNo,
  workDescription,
  subcontractorName,
  currentContractValue,
  existingSheetsCount,
  onClose,
  onSuccess
}: SpreadsheetMeasurementSheetProps) {
  // Header data
  const [measurementDate, setMeasurementDate] = useState(new Date().toISOString().split('T')[0]);
  const [measuredBy, setMeasuredBy] = useState('');
  const [sheetDescription, setSheetDescription] = useState('');
  const [notes, setNotes] = useState('');
  
  // Spreadsheet data
  const [rows, setRows] = useState<MeasurementLineItem[]>([
    { id: uuidv4(), description: '', unit: 'sq.ft', contract_qty: 0, actual_qty: 0, rate: 0, amount: 0, difference: 0 }
  ]);
  
  // Active cell tracking
  const [activeCell, setActiveCell] = useState<CellPosition>({ row: 0, col: 0 });
  const [editValue, setEditValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const createMeasurementSheet = useCreateMeasurementSheet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const sheetNo = `MS/${String(existingSheetsCount + 1).padStart(3, '0')}`;
  
  // Column definitions
  const columns = [
    { key: 'sno', label: 'S.No', width: 50, type: 'readonly' },
    { key: 'description', label: 'Description', width: 250, type: 'text' },
    { key: 'unit', label: 'Unit', width: 80, type: 'text' },
    { key: 'contract_qty', label: 'Contract Qty', width: 100, type: 'number' },
    { key: 'actual_qty', label: 'Actual Qty', width: 100, type: 'number' },
    { key: 'rate', label: 'Rate', width: 100, type: 'number' },
    { key: 'amount', label: 'Amount', width: 120, type: 'calculated' },
    { key: 'difference', label: 'Difference', width: 120, type: 'calculated' }
  ];
  
  // Calculate totals
  const totals = rows.reduce((acc, row) => ({
    contractValue: acc.contractValue + (row.contract_qty * row.rate),
    actualValue: acc.actualValue + row.amount,
    difference: acc.difference + row.difference
  }), { contractValue: 0, actualValue: 0, difference: 0 });
  
  // Cell value getter
  const getCellValue = (row: number, col: number): string => {
    if (row < 0 || row >= rows.length || col < 0 || col >= columns.length) return '';
    
    // Handle S.No column
    if (columns[col].key === 'sno') {
      return String(row + 1);
    }
    
    const item = rows[row];
    const colKey = columns[col].key as keyof MeasurementLineItem;
    const value = item[colKey];
    
    if (columns[col].type === 'calculated') {
      return formatCurrency(value as number);
    }
    return String(value ?? '');
  };
  
  // Cell update handler
  const updateCell = (row: number, col: number, value: string) => {
    if (row < 0 || row >= rows.length) return;
    
    const colKey = columns[col].key as keyof MeasurementLineItem;
    let parsedValue: string | number = value;
    
    if (columns[col].type === 'number') {
      parsedValue = parseFloat(value) || 0;
    }
    
    setRows(prevRows => {
      const newRows = [...prevRows];
      const item = { ...newRows[row], [colKey]: parsedValue };
      
      // Recalculate amount and difference
      if (colKey === 'actual_qty' || colKey === 'rate' || colKey === 'contract_qty') {
        item.amount = (item.actual_qty || 0) * (item.rate || 0);
        item.difference = item.amount - ((item.contract_qty || 0) * (item.rate || 0));
      }
      
      newRows[row] = item;
      return newRows;
    });
  };
  
  // Navigation handlers
  const moveCell = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    setActiveCell(prev => {
      let newRow = prev.row;
      let newCol = prev.col;
      
      switch (direction) {
        case 'up': newRow = Math.max(0, prev.row - 1); break;
        case 'down': newRow = Math.min(rows.length - 1, prev.row + 1); break;
        case 'left': newCol = Math.max(0, prev.col - 1); break;
        case 'right': newCol = Math.min(columns.length - 1, prev.col + 1); break;
      }
      
      return { row: newRow, col: newCol };
    });
  }, [rows.length, columns.length]);
  
  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isEditing) {
      switch (e.key) {
        case 'ArrowUp': moveCell('up'); e.preventDefault(); break;
        case 'ArrowDown': moveCell('down'); e.preventDefault(); break;
        case 'ArrowLeft': moveCell('left'); e.preventDefault(); break;
        case 'ArrowRight': moveCell('right'); e.preventDefault(); break;
        case 'Enter':
        case 'F2':
          setIsEditing(true);
          setEditValue(getCellValue(activeCell.row, activeCell.col));
          break;
        case 'Tab':
          e.preventDefault();
          if (e.shiftKey) {
            if (activeCell.col > 0) {
              setActiveCell({ ...activeCell, col: activeCell.col - 1 });
            } else if (activeCell.row > 0) {
              setActiveCell({ row: activeCell.row - 1, col: columns.length - 1 });
            }
          } else {
            if (activeCell.col < columns.length - 1) {
              setActiveCell({ ...activeCell, col: activeCell.col + 1 });
            } else if (activeCell.row < rows.length - 1) {
              setActiveCell({ row: activeCell.row + 1, col: 0 });
            } else {
              addRow();
              setTimeout(() => setActiveCell({ row: rows.length, col: 0 }), 0);
            }
          }
          break;
      }
    } else {
      if (e.key === 'Enter') {
        e.preventDefault();
        updateCell(activeCell.row, activeCell.col, editValue);
        setIsEditing(false);
        moveCell('down');
      } else if (e.key === 'Escape') {
        setIsEditing(false);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        updateCell(activeCell.row, activeCell.col, editValue);
        setIsEditing(false);
        if (e.shiftKey) {
          moveCell('left');
        } else {
          moveCell('right');
        }
      }
    }
  };
  
  // Add row
  const addRow = () => {
    setRows([...rows, {
      id: uuidv4(),
      description: '',
      unit: 'sq.ft',
      contract_qty: 0,
      actual_qty: 0,
      rate: 0,
      amount: 0,
      difference: 0
    }]);
  };
  
  // Delete row
  const deleteRow = (index: number) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, i) => i !== index));
    if (activeCell.row >= rows.length - 1) {
      setActiveCell({ row: Math.max(0, rows.length - 2), col: activeCell.col });
    }
  };
  
  // Cell click handler
  const handleCellClick = (row: number, col: number) => {
    if (columns[col].type === 'calculated' || columns[col].type === 'readonly') return; // Can't edit calculated or readonly cells
    setActiveCell({ row, col });
    setEditValue(getCellValue(row, col));
    setIsEditing(true);
  };
  
  // Export PDF
  const handleExportPDF = () => {
    exportMeasurementSheetPDF({
      sheet: {
        id: 'temp',
        work_order_id: workOrderId,
        sheet_no: sheetNo,
        measurement_date: measurementDate,
        measured_by: measuredBy,
        description: sheetDescription,
        line_items: rows,
        contract_value: totals.contractValue,
        actual_value: totals.actualValue,
        difference: totals.difference,
        amendment_created: false,
        status: 'Draft',
        created_at: new Date().toISOString()
      },
      workOrderNo,
      subcontractorName,
      workDescription
    });
  };
  
  // Save measurement sheet
  const handleSave = async () => {
    if (!measuredBy.trim()) {
      alert('Measured By is required');
      return;
    }
    
    if (rows.every(r => !r.description.trim())) {
      alert('Add at least one line item with description');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await createMeasurementSheet.mutateAsync({
        workOrderId,
        sheetNo,
        measurementDate,
        measuredBy,
        description: sheetDescription,
        lineItems: rows.filter(r => r.description.trim()),
        notes
      });
      onSuccess();
    } catch (err: any) {
      alert(err.message || 'Failed to save');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing, activeCell]);
  
  return (
    <div 
      className="fixed inset-0 bg-gray-100 overflow-auto"
      style={{ fontFamily: 'Courier New, monospace' }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Toolbar */}
      <div className="sticky top-0 bg-white border-b-2 border-black px-4 py-2 flex justify-between items-center z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={20} />
            <span className="font-bold">{workOrderNo} - {sheetNo}</span>
          </div>
          <div className="text-sm text-gray-600">|</div>
          <div className="text-sm">Excel Mode (Tab: Move, Enter: Down, F2: Edit)</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportPDF}
            className="px-3 py-1 border border-black hover:bg-gray-100 flex items-center gap-1 text-sm"
          >
            <Download size={14} />
            Export PDF
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="px-3 py-1 border border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1 text-sm disabled:opacity-50"
          >
            <Save size={14} />
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1 border border-black hover:bg-gray-100 text-sm"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      
      {/* Header Info */}
      <div className="bg-white border-b border-black p-4">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-xs font-bold uppercase">Measurement Date</label>
            <input
              type="date"
              value={measurementDate}
              onChange={(e) => setMeasurementDate(e.target.value)}
              className="w-full border border-gray-400 p-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase">Measured By *</label>
            <input
              type="text"
              value={measuredBy}
              onChange={(e) => setMeasuredBy(e.target.value)}
              placeholder="Engineer name"
              className="w-full border border-gray-400 p-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase">Description</label>
            <input
              type="text"
              value={sheetDescription}
              onChange={(e) => setSheetDescription(e.target.value)}
              placeholder="Phase/Location description"
              className="w-full border border-gray-400 p-1 text-sm"
            />
          </div>
        </div>
      </div>
      
      {/* Formula Bar */}
      <div className="bg-gray-50 border-b border-black px-4 py-2 flex items-center gap-2">
        <span className="text-sm font-bold w-20">Cell {String.fromCharCode(65 + activeCell.col)}{activeCell.row + 1}:</span>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1 border border-blue-500 p-1 text-sm bg-white"
          />
        ) : (
          <div className="flex-1 border border-gray-300 p-1 text-sm bg-white min-h-[28px]">
            {getCellValue(activeCell.row, activeCell.col)}
          </div>
        )}
      </div>
      
      {/* Spreadsheet Grid */}
      <div className="bg-white p-4 overflow-auto">
        <table className="border-collapse">
          <thead>
             <tr>
               <th className="w-10 border border-gray-400 bg-gray-100 p-1"></th>
               {columns.filter(col => col.key !== 'sno').map((col, i) => (
                 <th 
                   key={col.key}
                   className="border border-gray-400 bg-gray-100 p-1 text-xs font-bold text-center"
                   style={{ width: col.width, minWidth: col.width }}
                 >
                   {String.fromCharCode(65 + i)}
                 </th>
               ))}
               <th className="w-10 border border-gray-400 bg-gray-100 p-1"></th>
             </tr>
             <tr>
               <th className="border border-gray-400 bg-gray-200 p-1 text-xs">#</th>
               {columns.filter(col => col.key !== 'sno').map(col => (
                 <th 
                   key={col.key}
                   className="border border-gray-400 bg-gray-200 p-1 text-xs"
                   style={{ width: col.width, minWidth: col.width }}
                 >
                   {col.label}
                 </th>
               ))}
               <th className="border border-gray-400 bg-gray-200 p-1 text-xs">Del</th>
             </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.id}>
                <td className="border border-gray-400 bg-gray-100 p-1 text-center text-xs font-bold">
                  {rowIndex + 1}
                </td>
                {columns.filter(col => col.key !== 'sno').map((col, colIndex) => {
                  const isActive = activeCell.row === rowIndex && activeCell.col === colIndex + 1; // +1 because S.No is col 0
                  const isCalculated = col.type === 'calculated';
                  const value = getCellValue(rowIndex, colIndex + 1);
                  
                  return (
                    <td
                      key={col.key}
                      className={`border border-gray-400 p-0 ${isActive ? 'bg-blue-100' : ''} ${isCalculated ? 'bg-gray-50' : ''}`}
                      style={{ width: col.width, minWidth: col.width, height: '28px' }}
                      onClick={() => handleCellClick(rowIndex, colIndex + 1)}
                    >
                      {isActive && isEditing && !isCalculated ? (
                        <input
                          ref={inputRef}
                          type={col.type === 'number' ? 'number' : 'text'}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full h-full border-2 border-blue-500 p-1 text-sm outline-none"
                          step={col.type === 'number' ? '0.01' : undefined}
                        />
                      ) : (
                        <div 
                          className={`w-full h-full p-1 text-sm overflow-hidden ${
                            col.type === 'number' || col.type === 'calculated' ? 'text-right' : 'text-left'
                          } ${col.key === 'difference' && row.difference > 0 ? 'text-red-600 font-bold' : ''} ${col.key === 'difference' && row.difference < 0 ? 'text-green-600' : ''}`}
                        >
                          {value}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="border border-gray-400 p-1 text-center">
                  <button
                    onClick={() => deleteRow(rowIndex)}
                    disabled={rows.length <= 1}
                    className="text-red-600 hover:text-red-800 disabled:text-gray-300"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {/* TOTALS ROW */}
            <tr className="bg-yellow-50 font-bold border-t-2 border-black">
              <td className="border border-gray-400 p-1 text-center text-xs font-bold bg-gray-200">
                TOTAL
              </td>
              <td className="border border-gray-400 p-1 text-center" colSpan={4}></td>
              <td className="border border-gray-400 p-1 text-right">
                {formatCurrency(totals.actualValue)}
              </td>
              <td className={`border border-gray-400 p-1 text-right ${totals.difference > 0 ? 'text-red-600' : totals.difference < 0 ? 'text-green-600' : ''}`}>
                {totals.difference > 0 ? '+' : ''}{formatCurrency(totals.difference)}
              </td>
              <td className="border border-gray-400 p-1 text-center"></td>
            </tr>
          </tbody>
        </table>
        
        {/* Add Row Button */}
        <button
          onClick={addRow}
          className="mt-2 px-3 py-1 border border-black hover:bg-gray-100 flex items-center gap-1 text-sm"
        >
          <Plus size={14} />
          Add Row
        </button>
      </div>
      
      {/* Summary Panel */}
      <div className="bg-gray-100 border-t-2 border-black p-4">
        <div className="flex items-center gap-4 mb-4">
          <Calculator size={20} />
          <span className="font-bold">SUMMARY</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-black p-3">
            <div className="text-xs uppercase text-gray-600">Contract Value</div>
            <div className="text-xl font-bold">{formatCurrency(totals.contractValue)}</div>
          </div>
          <div className="bg-white border border-black p-3">
            <div className="text-xs uppercase text-gray-600">Actual Value</div>
            <div className="text-xl font-bold">{formatCurrency(totals.actualValue)}</div>
          </div>
          <div className={`border p-3 ${totals.difference > 0 ? 'bg-red-50 border-red-500' : totals.difference < 0 ? 'bg-green-50 border-green-500' : 'bg-white border-black'}`}>
            <div className="text-xs uppercase text-gray-600">Difference</div>
            <div className={`text-xl font-bold ${totals.difference > 0 ? 'text-red-600' : totals.difference < 0 ? 'text-green-600' : ''}`}>
              {totals.difference > 0 ? '+' : ''}{formatCurrency(totals.difference)}
            </div>
            {totals.difference > 0 && (
              <div className="text-xs text-red-600 mt-1">
                Amendment will be created on approval
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Notes */}
      <div className="bg-white border-t border-black p-4">
        <label className="text-xs font-bold uppercase block mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Additional observations, site conditions, etc."
          className="w-full border border-gray-400 p-2 text-sm"
        />
      </div>
    </div>
  );
}
