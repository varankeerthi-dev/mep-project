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
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        fontFamily: 'Inter, sans-serif'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '90vw',
          maxWidth: '1400px',
          height: '85vh',
          background: '#f8fafc',
          borderRadius: '12px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
      {/* Toolbar */}
      <div style={{
        position: 'sticky',
        top: 0,
        background: '#fff',
        borderBottom: '2px solid #0f172a',
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 50,
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={20} style={{ color: '#0f172a' }} />
            <span style={{ fontWeight: '700', color: '#0f172a' }}>{workOrderNo} - {sheetNo}</span>
          </div>
          <div style={{ fontSize: '13px', color: '#94a3b8' }}>|</div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Excel Mode (Tab: Move, Enter: Down, F2: Edit)</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleExportPDF}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: '#fff',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={14} />
            Export PDF
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: '#0f172a',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: isSubmitting ? 0.5 : 1
            }}
          >
            <Save size={14} />
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: '#fff',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500'
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>
      
      {/* Header Info */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e2e8f0',
        padding: '16px'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
              Measurement Date
            </label>
            <input
              type="date"
              value={measurementDate}
              onChange={(e) => setMeasurementDate(e.target.value)}
              style={{
                width: '100%',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                padding: '8px 12px',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
              Measured By *
            </label>
            <input
              type="text"
              value={measuredBy}
              onChange={(e) => setMeasuredBy(e.target.value)}
              placeholder="Engineer name"
              style={{
                width: '100%',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                padding: '8px 12px',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
              Description
            </label>
            <input
              type="text"
              value={sheetDescription}
              onChange={(e) => setSheetDescription(e.target.value)}
              placeholder="Phase/Location description"
              style={{
                width: '100%',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                padding: '8px 12px',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>
        </div>
      </div>
      
      {/* Formula Bar */}
      <div style={{
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span style={{ fontSize: '13px', fontWeight: '600', width: '80px', color: '#64748b' }}>
          Cell {String.fromCharCode(65 + activeCell.col)}{activeCell.row + 1}:
        </span>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            style={{
              flex: 1,
              borderRadius: '6px',
              border: '1px solid #3b82f6',
              padding: '6px 10px',
              fontSize: '14px',
              background: '#fff',
              outline: 'none'
            }}
          />
        ) : (
          <div style={{
            flex: 1,
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            padding: '6px 10px',
            fontSize: '14px',
            background: '#fff',
            minHeight: '28px'
          }}>
            {getCellValue(activeCell.row, activeCell.col)}
          </div>
        )}
      </div>
      
      {/* Spreadsheet Content */}
      <div style={{
        padding: '16px',
        overflow: 'auto',
        flex: 1,
        display: 'flex',
        flexDirection: 'column'
      }}>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
             <tr>
               <th style={{ width: '40px', border: '1px solid #e2e8f0', background: '#f8fafc', padding: '8px' }}></th>
               {columns.filter(col => col.key !== 'sno').map((col, i) => (
                 <th 
                   key={col.key}
                   style={{
                     border: '1px solid #e2e8f0',
                     background: '#f8fafc',
                     padding: '8px',
                     fontSize: '11px',
                     fontWeight: '600',
                     textAlign: 'center',
                     width: col.width,
                     minWidth: col.width
                   }}
                 >
                   {String.fromCharCode(65 + i)}
                 </th>
               ))}
               <th style={{ width: '40px', border: '1px solid #e2e8f0', background: '#f8fafc', padding: '8px' }}></th>
             </tr>
             <tr>
               <th style={{ border: '1px solid #e2e8f0', background: '#f1f5f9', padding: '8px', fontSize: '11px' }}>#</th>
               {columns.filter(col => col.key !== 'sno').map(col => (
                 <th 
                   key={col.key}
                   style={{
                     border: '1px solid #e2e8f0',
                     background: '#f1f5f9',
                     padding: '8px',
                     fontSize: '11px',
                     width: col.width,
                     minWidth: col.width
                   }}
                 >
                   {col.label}
                 </th>
               ))}
               <th style={{ border: '1px solid #e2e8f0', background: '#f1f5f9', padding: '8px', fontSize: '11px' }}>Del</th>
             </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.id}>
                <td style={{ border: '1px solid #e2e8f0', background: '#f8fafc', padding: '8px', textAlign: 'center', fontSize: '11px', fontWeight: '600' }}>
                  {rowIndex + 1}
                </td>
                {columns.filter(col => col.key !== 'sno').map((col, colIndex) => {
                  const isActive = activeCell.row === rowIndex && activeCell.col === colIndex + 1;
                  const isCalculated = col.type === 'calculated';
                  const value = getCellValue(rowIndex, colIndex + 1);
                  
                  return (
                    <td
                      key={col.key}
                      style={{
                        border: '1px solid #e2e8f0',
                        padding: 0,
                        background: isActive ? '#dbeafe' : isCalculated ? '#f8fafc' : 'transparent',
                        width: col.width,
                        minWidth: col.width,
                        height: '28px'
                      }}
                      onClick={() => handleCellClick(rowIndex, colIndex + 1)}
                    >
                      {isActive && isEditing && !isCalculated ? (
                        <input
                          ref={inputRef}
                          type={col.type === 'number' ? 'number' : 'text'}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          style={{
                            width: '100%',
                            height: '100%',
                            border: '2px solid #3b82f6',
                            padding: '4px 8px',
                            fontSize: '13px',
                            outline: 'none'
                          }}
                          step={col.type === 'number' ? '0.01' : undefined}
                        />
                      ) : (
                        <div 
                          style={{
                            width: '100%',
                            height: '100%',
                            padding: '4px 8px',
                            fontSize: '13px',
                            overflow: 'hidden',
                            textAlign: col.type === 'number' || col.type === 'calculated' ? 'right' : 'left',
                            color: col.key === 'difference' && row.difference > 0 ? '#dc2626' : col.key === 'difference' && row.difference < 0 ? '#16a34a' : '#0f172a',
                            fontWeight: col.key === 'difference' && row.difference !== 0 ? '600' : 'normal'
                          }}
                        >
                          {value}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'center' }}>
                  <button
                    onClick={() => deleteRow(rowIndex)}
                    disabled={rows.length <= 1}
                    style={{
                      color: '#dc2626',
                      cursor: rows.length <= 1 ? 'not-allowed' : 'pointer',
                      opacity: rows.length <= 1 ? 0.3 : 1,
                      background: 'none',
                      border: 'none',
                      padding: 0
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {/* TOTALS ROW */}
            <tr style={{ background: '#fef9c3', fontWeight: '600', borderTop: '2px solid #0f172a' }}>
              <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'center', fontSize: '11px', fontWeight: '600', background: '#f1f5f9' }}>
                TOTAL
              </td>
              <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'center' }} colSpan={4}></td>
              <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'right' }}>
                {formatCurrency(totals.actualValue)}
              </td>
              <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'right', color: totals.difference > 0 ? '#dc2626' : totals.difference < 0 ? '#16a34a' : '#0f172a' }}>
                {totals.difference > 0 ? '+' : ''}{formatCurrency(totals.difference)}
              </td>
              <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'center' }}></td>
            </tr>
          </tbody>
        </table>
        
        {/* Add Row Button */}
        <button
          onClick={addRow}
          style={{
            marginTop: '8px',
            padding: '8px 12px',
            borderRadius: '8px',
            background: '#fff',
            color: '#0f172a',
            border: '1px solid #e2e8f0',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Plus size={14} />
          Add Row
        </button>
      </div>
      
      {/* Summary Panel */}
      <div style={{
        background: '#f8fafc',
        borderTop: '2px solid #0f172a',
        padding: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <Calculator size={20} style={{ color: '#0f172a' }} />
          <span style={{ fontWeight: '700', color: '#0f172a' }}>SUMMARY</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div style={{
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: '#fff',
            padding: '12px'
          }}>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>
              Contract Value
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>
              {formatCurrency(totals.contractValue)}
            </div>
          </div>
          <div style={{
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: '#fff',
            padding: '12px'
          }}>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>
              Actual Value
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>
              {formatCurrency(totals.actualValue)}
            </div>
          </div>
          <div style={{
            borderRadius: '8px',
            border: totals.difference > 0 ? '1px solid #fca5a5' : totals.difference < 0 ? '1px solid #86efac' : '1px solid #e2e8f0',
            background: totals.difference > 0 ? '#fef2f2' : totals.difference < 0 ? '#f0fdf4' : '#fff',
            padding: '12px'
          }}>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>
              Difference
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: totals.difference > 0 ? '#dc2626' : totals.difference < 0 ? '#16a34a' : '#0f172a' }}>
              {totals.difference > 0 ? '+' : ''}{formatCurrency(totals.difference)}
            </div>
            {totals.difference > 0 && (
              <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px' }}>
                Amendment will be created on approval
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Notes */}
      <div style={{
        background: '#fff',
        borderTop: '1px solid #e2e8f0',
        padding: '16px'
      }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Additional observations, site conditions, etc."
          style={{
            width: '100%',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '8px 12px',
            fontSize: '14px',
            outline: 'none',
            resize: 'vertical'
          }}
        />
      </div>
      </div>
    </div>
  );
}
