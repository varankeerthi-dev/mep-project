import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  Tooltip,
  IconButton,
  LinearProgress,
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Download as DownloadIcon,
  History as HistoryIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';

interface EditableCell {
  rowId: string;
  columnKey: string;
  value: any;
  originalValue: any;
  isDirty: boolean;
}

interface ExcelEditRow {
  id: string;
  item_code: string;
  name: string;
  [key: string]: any;
}

interface ChangeAuditEntry {
  itemId: string;
  itemCode: string;
  itemName: string;
  field: string;
  oldValue: any;
  newValue: any;
  changedAt: string;
  changedBy?: string;
}

interface ExcelEditorProps {
  materials: any[];
  warehouses: any[];
  selectedFields: string[];
  onSave: (changes: ChangeAuditEntry[]) => void;
  onCancel: () => void;
}

const EDITABLE_COLUMNS: { key: string; label: string; width: number; editable: boolean; type?: string; warehouseId?: string }[] = [
  { key: 'item_code', label: 'Item Code', width: 120, editable: false },
  { key: 'name', label: 'Item Name', width: 200, editable: false },
  { key: 'display_name', label: 'Display Name', width: 200, editable: true },
  { key: 'main_category', label: 'Category', width: 120, editable: true },
  { key: 'sub_category', label: 'Sub Category', width: 120, editable: true },
  { key: 'size', label: 'Size', width: 100, editable: true },
  { key: 'size_lwh', label: 'L×W×H', width: 100, editable: true },
  { key: 'pressure_class', label: 'Pressure', width: 100, editable: true },
  { key: 'make', label: 'Make', width: 120, editable: true },
  { key: 'material', label: 'Material', width: 120, editable: true },
  { key: 'end_connection', label: 'Connection', width: 120, editable: true },
  { key: 'unit', label: 'Unit', width: 80, editable: true },
  { key: 'sale_price', label: 'Sale Price', width: 100, editable: true, type: 'number' },
  { key: 'purchase_price', label: 'Purchase Price', width: 120, editable: true, type: 'number' },
  { key: 'hsn_code', label: 'HSN', width: 100, editable: true },
  { key: 'gst_rate', label: 'GST%', width: 80, editable: true, type: 'number' },
  { key: 'part_number', label: 'Part #', width: 120, editable: true },
  { key: 'taxable', label: 'Taxable', width: 100, editable: true },
  { key: 'weight', label: 'Weight', width: 80, editable: true, type: 'number' },
  { key: 'upc', label: 'UPC', width: 120, editable: true },
  { key: 'mpn', label: 'MPN', width: 120, editable: true },
  { key: 'ean', label: 'EAN', width: 120, editable: true },
  { key: 'inventory_account', label: 'Inv Account', width: 130, editable: true },
  { key: 'is_active', label: 'Active', width: 80, editable: true, type: 'boolean' },
  { key: 'low_stock_level', label: 'Low Stock', width: 100, editable: true, type: 'number' },
];

export function getWarehouseStockColumns(warehouses: any[]): { key: string; label: string; width: number; editable: boolean; type: string; warehouseId: string }[] {
  return warehouses.map(wh => ({
    key: `stock_${wh.id}`,
    label: `Stock: ${wh.warehouse_name || wh.name || 'Warehouse'}`,
    width: 120,
    editable: true,
    type: 'number',
    warehouseId: wh.id,
  }));
}

export function ExcelEditor({ materials, warehouses, selectedFields, onSave, onCancel }: ExcelEditorProps) {
  const [rows, setRows] = useState<ExcelEditRow[]>([]);
  const [dirtyCells, setDirtyCells] = useState<Set<string>>(new Set());
  const [cellValues, setCellValues] = useState<Record<string, any>>({});
  const [originalValues, setOriginalValues] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [activeCell, setActiveCell] = useState<{ rowId: string; colKey: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build column configuration based on selected fields - compute directly
  const getColumnConfig = useMemo(() => {
    const baseCols = EDITABLE_COLUMNS.filter(col => selectedFields.includes(col.key));
    
    // Add stock columns for selected warehouses
    const stockCols = warehouses
      .filter(wh => selectedFields.includes(`stock_${wh.id}`))
      .map(wh => ({
        key: `stock_${wh.id}`,
        label: `Stock: ${wh.warehouse_name || wh.name || 'Warehouse'}`,
        width: 120,
        editable: true,
        type: 'number',
        warehouseId: wh.id,
      }));
    
    // Always include identifier columns
    const idCols = EDITABLE_COLUMNS.filter(col => col.key === 'item_code' || col.key === 'name');
    
    return [...idCols, ...baseCols, ...stockCols];
  }, [selectedFields, warehouses]);

  // Initialize rows from materials
  useEffect(() => {
    const initialRows = materials.map(m => {
      const row: ExcelEditRow = {
        id: m.id,
        item_code: m.item_code || '',
        name: m.name || '',
      };
      
      // Add all editable fields
      getColumnConfig.forEach(col => {
        if (col.key.startsWith('stock_')) {
          // Get stock from material_stock or item_stock
          const stockValue = m.stock?.[col.warehouseId] || m.current_stock || 0;
          row[col.key] = stockValue;
        } else {
          row[col.key] = m[col.key] ?? '';
        }
      });
      
      return row;
    });
    
    setRows(initialRows);
    
    // Store original values for change tracking
    const origValues: Record<string, any> = {};
    initialRows.forEach(row => {
      getColumnConfig.forEach(col => {
        if (col.editable) {
          origValues[`${row.id}_${col.key}`] = row[col.key];
        }
      });
    });
    setOriginalValues(origValues);
  }, [materials, getColumnConfig]);

  const handleCellClick = (rowId: string, colKey: string, col: any) => {
    if (!col.editable) return;
    
    const currentValue = cellValues[`${rowId}_${colKey}`] ?? rows.find(r => r.id === rowId)?.[colKey] ?? '';
    setActiveCell({ rowId, colKey });
    setEditValue(String(currentValue));
    
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const handleCellBlur = () => {
    if (!activeCell) return;
    
    const { rowId, colKey } = activeCell;
    const cellKey = `${rowId}_${colKey}`;
    const originalValue = originalValues[cellKey];
    
    // Parse value based on type
    let parsedValue: any = editValue;
    const col = getColumnConfig.find(c => c.key === colKey);
    
    if (col?.type === 'number') {
      parsedValue = parseFloat(editValue) || 0;
    } else if (col?.type === 'boolean') {
      parsedValue = ['true', 'yes', '1', 'active'].includes(editValue.toLowerCase());
    }
    
    // Update cell value
    setCellValues(prev => ({
      ...prev,
      [cellKey]: parsedValue,
    }));
    
    // Mark as dirty if changed
    const newDirty = new Set(dirtyCells);
    if (String(parsedValue) !== String(originalValue)) {
      newDirty.add(cellKey);
    } else {
      newDirty.delete(cellKey);
    }
    setDirtyCells(newDirty);
    
    setActiveCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!activeCell) return;
    
    const { rowId, colKey } = activeCell;
    const colIndex = getColumnConfig.findIndex(c => c.key === colKey);
    const rowIndex = rows.findIndex(r => r.id === rowId);
    
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        handleCellBlur();
        // Move to next row
        if (rowIndex < rows.length - 1) {
          const nextCol = getColumnConfig[colIndex];
          if (nextCol?.editable) {
            handleCellClick(rows[rowIndex + 1].id, colKey, nextCol);
          }
        }
        break;
      case 'Tab':
        e.preventDefault();
        handleCellBlur();
        // Move to next/prev column
        const direction = e.shiftKey ? -1 : 1;
        let nextColIndex = colIndex + direction;
        while (nextColIndex >= 0 && nextColIndex < getColumnConfig.length) {
          const nextCol = getColumnConfig[nextColIndex];
          if (nextCol?.editable) {
            handleCellClick(rowId, nextCol.key, nextCol);
            break;
          }
          nextColIndex += direction;
        }
        break;
      case 'Escape':
        setActiveCell(null);
        break;
    }
  };

  const generateChangeLog = (): ChangeAuditEntry[] => {
    const changes: ChangeAuditEntry[] = [];
    const now = new Date().toISOString();
    
    dirtyCells.forEach(cellKey => {
      const [rowId, colKey] = cellKey.split('_');
      const row = rows.find(r => r.id === rowId);
      if (!row) return;
      
      const col = getColumnConfig.find(c => c.key === colKey);
      const oldValue = originalValues[cellKey];
      const newValue = cellValues[cellKey];
      
      changes.push({
        itemId: rowId,
        itemCode: row.item_code,
        itemName: row.name,
        field: col?.label || colKey,
        oldValue,
        newValue,
        changedAt: now,
      });
    });
    
    return changes;
  };

  const handleSave = () => {
    if (dirtyCells.size === 0) {
      onCancel();
      return;
    }
    
    const changes = generateChangeLog();
    setShowPreview(true);
  };

  const confirmSave = async () => {
    setIsSaving(true);
    const changes = generateChangeLog();
    
    try {
      await onSave(changes);
      setIsSaving(false);
      setShowPreview(false);
      onCancel();
    } catch (error) {
      setIsSaving(false);
      alert('Save failed: ' + (error as Error).message);
    }
  };

  const dirtyCount = dirtyCells.size;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <Paper elevation={0} sx={{ p: 2, mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="h6" fontSize="16px">
            Excel Edit Mode
          </Typography>
          <Chip 
            label={`${dirtyCount} changes`} 
            color={dirtyCount > 0 ? "warning" : "default"}
            size="small"
          />
        </Box>
        
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<CancelIcon />}
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={dirtyCount === 0 || isSaving}
          >
            {isSaving ? 'Saving...' : `Save ${dirtyCount} Changes`}
          </Button>
        </Box>
      </Paper>

      {/* Instructions */}
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Navigation:</strong> Click any cell to edit. Use Tab to move right, Shift+Tab to move left, Enter to move down.
          <br />
          <strong>Saving:</strong> Click "Save Changes" when done. All changes will be logged for audit.
        </Typography>
      </Alert>

      {/* Spreadsheet Grid */}
      <Paper 
        ref={containerRef}
        elevation={0} 
        sx={{ 
          flex: 1, 
          overflow: 'auto', 
          border: '1px solid #e0e0e0',
          position: 'relative',
        }}
      >
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: getColumnConfig.reduce((sum, col) => sum + col.width, 0) }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ 
                border: '1px solid #ddd', 
                padding: '8px', 
                width: 50,
                backgroundColor: '#f5f5f5',
                fontWeight: 'bold',
                fontSize: '12px',
              }}>
                #
              </th>
              {getColumnConfig.map(col => (
                <th 
                  key={col.key} 
                  style={{ 
                    border: '1px solid #ddd', 
                    padding: '8px', 
                    width: col.width,
                    minWidth: col.width,
                    backgroundColor: col.editable ? '#e3f2fd' : '#f5f5f5',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    textAlign: 'left',
                  }}
                >
                  {col.label}
                  {col.editable && <span style={{ color: '#1976d2', marginLeft: 4 }}>*</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.id} style={{ backgroundColor: rowIndex % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ 
                  border: '1px solid #ddd', 
                  padding: '6px 8px', 
                  textAlign: 'center',
                  fontSize: '12px',
                  color: '#666',
                  backgroundColor: '#f5f5f5',
                }}>
                  {rowIndex + 1}
                </td>
                {getColumnConfig.map(col => {
                  const cellKey = `${row.id}_${col.key}`;
                  const isDirty = dirtyCells.has(cellKey);
                  const isActive = activeCell?.rowId === row.id && activeCell?.colKey === col.key;
                  const displayValue = isActive ? editValue : (cellValues[cellKey] ?? row[col.key] ?? '');
                  
                  return (
                    <td 
                      key={col.key}
                      onClick={() => handleCellClick(row.id, col.key, col)}
                      style={{ 
                        border: '1px solid #ddd', 
                        padding: 0,
                        width: col.width,
                        minWidth: col.width,
                        backgroundColor: isActive ? '#fff3cd' : isDirty ? '#fff8e1' : '#fff',
                        cursor: col.editable ? 'cell' : 'default',
                        position: 'relative',
                      }}
                    >
                      {isActive ? (
                        <input
                          ref={inputRef}
                          type={col.type === 'number' ? 'number' : 'text'}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleKeyDown}
                          style={{
                            width: '100%',
                            height: '100%',
                            border: '2px solid #1976d2',
                            padding: '6px 8px',
                            fontSize: '13px',
                            outline: 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                      ) : (
                        <div style={{ 
                          padding: '6px 8px', 
                          fontSize: '13px',
                          minHeight: '20px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {displayValue}
                          {isDirty && (
                            <span style={{ 
                              position: 'absolute', 
                              top: 0, 
                              right: 0, 
                              width: 0, 
                              height: 0, 
                              borderStyle: 'solid', 
                              borderWidth: '0 8px 8px 0', 
                              borderColor: 'transparent #ff9800 transparent transparent',
                            }} />
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Paper>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onClose={() => setShowPreview(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <HistoryIcon color="primary" />
            <Typography variant="h6">Review Changes</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              You are about to save {dirtyCount} changes. These changes will be logged for audit purposes.
            </Typography>
          </Alert>
          
          <Paper elevation={0} sx={{ maxHeight: 400, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f5f5f5' }}>
                <tr>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Item Code</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Item Name</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Field</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Old Value</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>New Value</th>
                </tr>
              </thead>
              <tbody>
                {generateChangeLog().map((change, idx) => (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #eee' }}>{change.itemCode}</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #eee' }}>{change.itemName}</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #eee', fontWeight: 500 }}>{change.field}</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #eee', color: '#666', textDecoration: 'line-through' }}>
                      {String(change.oldValue)}
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #eee', color: '#1976d2', fontWeight: 500 }}>
                      {String(change.newValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreview(false)} disabled={isSaving}>
            Back to Editing
          </Button>
          <Button 
            variant="contained" 
            onClick={confirmSave}
            disabled={isSaving}
            startIcon={isSaving ? <LinearProgress sx={{ width: 20 }} /> : <CheckIcon />}
          >
            {isSaving ? 'Saving...' : 'Confirm & Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Field Selection Component for Download/Upload
interface FieldSelectorProps {
  warehouses: any[];
  selectedFields: string[];
  onChange: (fields: string[]) => void;
}

export function FieldSelector({ warehouses, selectedFields, onChange }: FieldSelectorProps) {
  const handleToggle = (key: string) => {
    const newSelection = selectedFields.includes(key)
      ? selectedFields.filter(f => f !== key)
      : [...selectedFields, key];
    onChange(newSelection);
  };

  const handleSelectAll = () => {
    const allFields = [
      ...EDITABLE_COLUMNS.filter(c => c.editable).map(c => c.key),
      ...warehouses.map(wh => `stock_${wh.id}`),
    ];
    onChange(allFields);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const fieldGroups = [
    {
      title: 'Basic Information',
      fields: EDITABLE_COLUMNS.filter(c => ['display_name', 'main_category', 'sub_category', 'size', 'size_lwh', 'pressure_class'].includes(c.key)),
    },
    {
      title: 'Product Details',
      fields: EDITABLE_COLUMNS.filter(c => ['make', 'material', 'end_connection', 'unit', 'part_number'].includes(c.key)),
    },
    {
      title: 'Pricing & Tax',
      fields: EDITABLE_COLUMNS.filter(c => ['sale_price', 'purchase_price', 'hsn_code', 'gst_rate', 'taxable'].includes(c.key)),
    },
    {
      title: 'Codes & Classification',
      fields: EDITABLE_COLUMNS.filter(c => ['upc', 'mpn', 'ean', 'inventory_account'].includes(c.key)),
    },
    {
      title: 'Stock Settings',
      fields: EDITABLE_COLUMNS.filter(c => ['low_stock_level', 'is_active'].includes(c.key)),
    },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" mb={2}>
        <Typography variant="subtitle2">Select Fields to Edit</Typography>
        <Box>
          <Button size="small" onClick={handleSelectAll} sx={{ mr: 1 }}>Select All</Button>
          <Button size="small" onClick={handleClearAll}>Clear All</Button>
        </Box>
      </Box>

      {fieldGroups.map(group => (
        <Paper key={group.title} elevation={0} sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0' }}>
          <Typography variant="body2" fontWeight={600} color="primary" gutterBottom>
            {group.title}
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={2}>
            {group.fields.map(field => (
              <FormControlLabel
                key={field.key}
                control={
                  <Checkbox
                    checked={selectedFields.includes(field.key)}
                    onChange={() => handleToggle(field.key)}
                    size="small"
                  />
                }
                label={<Typography variant="body2">{field.label}</Typography>}
              />
            ))}
          </Box>
        </Paper>
      ))}

      {warehouses.length > 0 && (
        <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0' }}>
          <Typography variant="body2" fontWeight={600} color="primary" gutterBottom>
            Stock by Warehouse
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={2}>
            {warehouses.map(wh => (
              <FormControlLabel
                key={wh.id}
                control={
                  <Checkbox
                    checked={selectedFields.includes(`stock_${wh.id}`)}
                    onChange={() => handleToggle(`stock_${wh.id}`)}
                    size="small"
                  />
                }
                label={<Typography variant="body2">Stock: {wh.warehouse_name || wh.name}</Typography>}
              />
            ))}
          </Box>
        </Paper>
      )}
    </Box>
  );
}

export default ExcelEditor;
