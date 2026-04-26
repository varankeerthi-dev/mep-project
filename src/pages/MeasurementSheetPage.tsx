import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCreateMeasurementSheet, MeasurementLineItem } from '../hooks/useMeasurementSheets';
import { exportMeasurementSheetPDF } from '../utils/exportMeasurementSheetPDF';
import { formatCurrency } from '../utils/formatters';
import { Download, Plus, Trash2, FileSpreadsheet, Save, X, Calculator, ArrowLeft } from 'lucide-react';

interface MeasurementSheetPageProps {
  workOrderId: string;
  workOrderNo: string;
  workDescription: string;
  subcontractorName: string;
  currentContractValue: number;
  existingSheetsCount: number;
  onBack: () => void;
  onSuccess: () => void;
}

type CellPosition = { row: number; col: number };

export function MeasurementSheetPage({
  workOrderId,
  workOrderNo,
  workDescription,
  subcontractorName,
  currentContractValue,
  existingSheetsCount,
  onBack,
  onSuccess
}: MeasurementSheetPageProps) {
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
      
      // Calculate amount and difference
      if (colKey === 'actual_qty' || colKey === 'rate') {
        item.amount = item.actual_qty * item.rate;
        item.difference = item.amount - (item.contract_qty * item.rate);
      }
      
      newRows[row] = item;
      return newRows;
    });
  };
  
  // Add new row
  const addRow = () => {
    setRows(prev => [...prev, { 
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
  const deleteRow = (rowIndex: number) => {
    if (rows.length > 1) {
      setRows(prev => prev.filter((_, i) => i !== rowIndex));
      if (activeCell.row >= rows.length - 1) {
        setActiveCell({ row: rows.length - 2, col: activeCell.col });
      }
    }
  };
  
  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isEditing) {
      if (e.key === 'Enter') {
        e.preventDefault();
        setIsEditing(false);
        updateCell(activeCell.row, activeCell.col, editValue);
        setActiveCell({ row: activeCell.row + 1, col: activeCell.col });
      } else if (e.key === 'Escape') {
        setIsEditing(false);
        setEditValue('');
      } else if (e.key === 'Tab') {
        e.preventDefault();
        setIsEditing(false);
        updateCell(activeCell.row, activeCell.col, editValue);
        setActiveCell({ 
          row: activeCell.row, 
          col: e.shiftKey ? Math.max(0, activeCell.col - 1) : Math.min(columns.length - 1, activeCell.col + 1) 
        });
      }
      return;
    }
    
    if (e.key === 'Tab') {
      e.preventDefault();
      setActiveCell({ 
        row: activeCell.row, 
        col: e.shiftKey ? Math.max(0, activeCell.col - 1) : Math.min(columns.length - 1, activeCell.col + 1) 
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setActiveCell({ row: Math.min(rows.length - 1, activeCell.row + 1), col: activeCell.col });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveCell({ row: Math.max(0, activeCell.row - 1), col: activeCell.col });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveCell({ row: Math.min(rows.length - 1, activeCell.row + 1), col: activeCell.col });
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setActiveCell({ row: activeCell.row, col: Math.max(0, activeCell.col - 1) });
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setActiveCell({ row: activeCell.row, col: Math.min(columns.length - 1, activeCell.col + 1) });
    } else if (e.key === 'F2') {
      e.preventDefault();
      setIsEditing(true);
      setEditValue(getCellValue(activeCell.row, activeCell.col));
    } else if (e.key === 'Delete' && columns[activeCell.col].type !== 'readonly' && columns[activeCell.col].type !== 'calculated') {
      updateCell(activeCell.row, activeCell.col, '');
    }
  }, [activeCell, isEditing, editValue, rows.length, columns.length]);
  
  // Focus input when editing
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing, activeCell]);
  
  const handleExportPDF = () => {
    exportMeasurementSheetPDF({
      sheetNo,
      workOrderNo,
      workDescription,
      subcontractorName,
      measurementDate,
      measuredBy,
      sheetDescription,
      notes,
      rows,
      totals
    });
  };
  
  const handleSave = async () => {
    if (!measuredBy) {
      alert('Please enter measured by');
      return;
    }
    
    if (rows.length === 0 || rows.every(row => !row.description)) {
      alert('Please add at least one item with description');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await createMeasurementSheet.mutateAsync({
        work_order_id: workOrderId,
        sheet_no: sheetNo,
        measurement_date: measurementDate,
        measured_by: measuredBy,
        sheet_description: sheetDescription,
        notes,
        line_items: rows.filter(row => row.description),
        contract_value: totals.contractValue,
        actual_value: totals.actualValue,
        difference: totals.difference
      });
      onSuccess();
    } catch (error) {
      console.error('Failed to save measurement sheet:', error);
      alert('Failed to save measurement sheet');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      {/* Breadcrumb */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e2e8f0',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
        color: '#64748b'
      }}>
        <span style={{ cursor: 'pointer', color: '#0f172a', fontWeight: '500' }} onClick={onBack}>Work Orders</span>
        <span style={{ color: '#cbd5e1' }}>/</span>
        <span style={{ cursor: 'pointer', color: '#0f172a', fontWeight: '500' }} onClick={onBack}>{workOrderNo}</span>
        <span style={{ color: '#cbd5e1' }}>/</span>
        <span style={{ color: '#0f172a', fontWeight: '600' }}>Create Measurement</span>
      </div>

      {/* Header */}
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
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: isSubmitting ? 0.6 : 1
            }}
          >
            <Save size={14} />
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onBack}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: '#fff',
              color: '#dc2626',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <X size={14} />
            Cancel
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header Form */}
        <div style={{
          background: '#fff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          padding: '16px',
          marginBottom: '16px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
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
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
                Measured By
              </label>
              <input
                type="text"
                value={measuredBy}
                onChange={(e) => setMeasuredBy(e.target.value)}
                placeholder="Enter name"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
                Sheet Description
              </label>
              <input
                type="text"
                value={sheetDescription}
                onChange={(e) => setSheetDescription(e.target.value)}
                placeholder="Brief description of this measurement"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>
          </div>
        </div>
        
        {/* Spreadsheet */}
        <div style={{
          background: '#fff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          padding: '16px',
          marginBottom: '16px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
        }}>
          <div>
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
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                  <th style={{ width: '40px', border: '1px solid #e2e8f0', background: '#f8fafc', padding: '8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={row.id}>
                    <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'center', background: '#f8fafc' }}>
                      {rowIndex + 1}
                    </td>
                    {columns.filter(col => col.key !== 'sno').map((col, colIndex) => {
                      const isActive = activeCell.row === rowIndex && activeCell.col === colIndex + 1;
                      const isEditingThisCell = isEditing && activeCell.row === rowIndex && activeCell.col === colIndex + 1;
                      return (
                        <td
                          key={col.key}
                          onClick={() => setActiveCell({ row: rowIndex, col: colIndex + 1 })}
                          onDoubleClick={() => {
                            setActiveCell({ row: rowIndex, col: colIndex + 1 });
                            setIsEditing(true);
                            setEditValue(getCellValue(rowIndex, colIndex + 1));
                          }}
                          style={{
                            border: '1px solid #e2e8f0',
                            padding: '8px',
                            background: isActive ? '#e0f2fe' : '#fff',
                            cursor: 'pointer',
                            fontSize: '13px',
                            color: '#0f172a',
                            minWidth: `${col.width}px`,
                            position: 'relative'
                          }}
                        >
                          {isEditingThisCell ? (
                            <input
                              ref={inputRef}
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => {
                                setIsEditing(false);
                                updateCell(activeCell.row, activeCell.col, editValue);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  setIsEditing(false);
                                  updateCell(activeCell.row, activeCell.col, editValue);
                                  setActiveCell({ row: activeCell.row + 1, col: activeCell.col });
                                } else if (e.key === 'Escape') {
                                  setIsEditing(false);
                                  setEditValue('');
                                } else if (e.key === 'Tab') {
                                  e.preventDefault();
                                  setIsEditing(false);
                                  updateCell(activeCell.row, activeCell.col, editValue);
                                  setActiveCell({
                                    row: activeCell.row,
                                    col: e.shiftKey ? Math.max(0, activeCell.col - 1) : Math.min(columns.length - 1, activeCell.col + 1)
                                  });
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: '4px',
                                fontSize: '13px',
                                border: '2px solid #0f172a',
                                borderRadius: '4px',
                                outline: 'none',
                                background: '#fff'
                              }}
                              autoFocus
                            />
                          ) : (
                            getCellValue(rowIndex, colIndex + 1)
                          )}
                        </td>
                      );
                    })}
                    <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'center' }}>
                      <button
                        onClick={() => deleteRow(rowIndex)}
                        style={{
                          padding: '4px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#94a3b8',
                          borderRadius: '4px'
                        }}
                        title="Delete row"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr>
                  <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'center', background: '#f8fafc' }}></td>
                  <td style={{ border: '1px solid #e2e8f0', padding: '8px', background: '#f8fafc', fontWeight: '600', color: '#0f172a' }} colSpan={3}>
                    TOTAL
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'right', background: '#f8fafc', fontWeight: '600', color: '#0f172a' }}>
                    {formatCurrency(totals.contractValue)}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'right', background: '#f8fafc', fontWeight: '600', color: '#0f172a' }}>
                    {formatCurrency(totals.actualValue)}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'right', color: totals.difference > 0 ? '#dc2626' : totals.difference < 0 ? '#16a34a' : '#0f172a', fontWeight: '600' }}>
                    {totals.difference > 0 ? '+' : ''}{formatCurrency(totals.difference)}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'center' }}></td>
                </tr>
              </tbody>
            </table>
            
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
        </div>
        
        {/* Summary Panel */}
        <div style={{
          background: '#fff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          padding: '16px',
          marginBottom: '16px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Calculator size={20} style={{ color: '#0f172a' }} />
            <span style={{ fontWeight: '700', color: '#0f172a' }}>SUMMARY</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div style={{
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
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
              background: '#f8fafc',
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
              background: totals.difference > 0 ? '#fef2f2' : totals.difference < 0 ? '#f0fdf4' : '#f8fafc',
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
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          padding: '16px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
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
