import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Tabs,
  Tab,
  TextField,
  Alert,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  IconButton,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  Preview as PreviewIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import {
  parseExcelData,
  applyBulkImport,
  generateImportTemplate,
  generateImportTemplateCSV,
  generateImportTemplateXLSX,
  IMPORT_COLUMNS,
  BulkImportRow,
  ImportValidationResult,
} from '../utils/bulkImport';

interface BulkImportModalProps {
  open: boolean;
  onClose: () => void;
  materials: any[];
  warehouses: any[];
  onSuccess: () => void;
}

export default function BulkImportModal({ open, onClose, materials, warehouses, onSuccess }: BulkImportModalProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [importText, setImportText] = useState('');
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTabChange = (_: any, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      setImportText(text);
      handleValidate(text);
    };
    reader.readAsText(file);
  };

  const handleValidate = async (text: string = importText) => {
    if (!text.trim()) return;
    
    try {
      const result = await parseExcelData(text, materials, warehouses);
      setValidationResult(result);
      setSelectedRows(new Set(result.validRows.map(r => r.rowNo)));
      setActiveTab(1);
    } catch (error) {
      alert('Validation error: ' + (error as Error).message);
    }
  };

  const handleDownloadTemplate = (format: 'tsv' | 'csv' | 'xlsx' = 'tsv') => {
    if (format === 'xlsx') {
      const buffer = generateImportTemplateXLSX();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'item_import_template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const content = format === 'csv' ? generateImportTemplateCSV() : generateImportTemplate();
      const mimeType = format === 'csv' ? 'text/csv' : 'text/tab-separated-values';
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `item_import_template.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDownloadSample = () => {
    if (materials.length === 0) {
      // Create sample XLSX with headers and one sample row
      const sampleData = [
        IMPORT_COLUMNS.reduce((acc, col) => {
          switch (col.key) {
            case 'item_code': acc[col.label] = 'ITEM-001'; break;
            case 'name': acc[col.label] = 'Ball Valve 2 inch'; break;
            case 'display_name': acc[col.label] = '2" Ball Valve - SS316'; break;
            case 'main_category': acc[col.label] = 'VALVE'; break;
            case 'sub_category': acc[col.label] = 'Ball Valve'; break;
            case 'size': acc[col.label] = '2 inch'; break;
            case 'size_lwh': acc[col.label] = '2 x 1.5 x 1'; break;
            case 'pressure_class': acc[col.label] = 'PN16'; break;
            case 'make': acc[col.label] = 'KITZ'; break;
            case 'material': acc[col.label] = 'SS316'; break;
            case 'end_connection': acc[col.label] = 'Screwed'; break;
            case 'unit': acc[col.label] = 'nos'; break;
            case 'sale_price': acc[col.label] = 1250.00; break;
            case 'purchase_price': acc[col.label] = 980.00; break;
            case 'hsn_code': acc[col.label] = '848180'; break;
            case 'gst_rate': acc[col.label] = 18; break;
            case 'part_number': acc[col.label] = 'KITZ-BV-2IN-SS'; break;
            case 'taxable': acc[col.label] = 'taxable'; break;
            case 'weight': acc[col.label] = 2.5; break;
            case 'upc': acc[col.label] = '890123456789'; break;
            case 'mpn': acc[col.label] = 'BV2SS'; break;
            case 'ean': acc[col.label] = '1234567890123'; break;
            case 'inventory_account': acc[col.label] = 'inventory asset'; break;
            case 'is_active': acc[col.label] = 'true'; break;
            case 'low_stock_level': acc[col.label] = 10; break;
            case 'current_stock': acc[col.label] = 50; break;
            case 'warehouse': acc[col.label] = 'Main Warehouse'; break;
            default: acc[col.label] = '';
          }
          return acc;
        }, {} as Record<string, any>)
      ];
      
      const ws = XLSX.utils.json_to_sheet(sampleData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Items');
      XLSX.writeFile(wb, 'item_sample_data.xlsx');
    } else {
      // Export actual items as XLSX
      const data = materials.map(item => {
        return IMPORT_COLUMNS.reduce((acc, col) => {
          const value = item[col.key];
          if (value === null || value === undefined) {
            acc[col.label] = '';
          } else if (typeof value === 'boolean') {
            acc[col.label] = value ? 'true' : 'false';
          } else {
            acc[col.label] = value;
          }
          return acc;
        }, {} as Record<string, any>);
      });
      
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Items');
      XLSX.writeFile(wb, `items_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
  };

  const handleRowToggle = (rowNo: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowNo)) {
      newSelected.delete(rowNo);
    } else {
      newSelected.add(rowNo);
    }
    setSelectedRows(newSelected);
  };

  const handleSelectAll = () => {
    if (validationResult) {
      const allRowNos = validationResult.validRows.map(r => r.rowNo);
      setSelectedRows(new Set(allRowNos));
    }
  };

  const handleDeselectAll = () => {
    setSelectedRows(new Set());
  };

  const handleApplyImport = async () => {
    if (!validationResult) return;
    
    const rowsToImport = validationResult.validRows.filter(r => selectedRows.has(r.rowNo));
    if (rowsToImport.length === 0) {
      alert('No rows selected for import');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    
    try {
      const result = await applyBulkImport(rowsToImport, (current, total) => {
        setProgress((current / total) * 100);
      });
      
      setResult(result);
      setActiveTab(2);
      
      if (result.failed === 0) {
        onSuccess();
      }
    } catch (error) {
      alert('Import error: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setImportText('');
    setValidationResult(null);
    setResult(null);
    setSelectedRows(new Set());
    setActiveTab(0);
    onClose();
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'success';
      case 'update': return 'info';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'create': return 'Create';
      case 'update': return 'Update';
      case 'error': return 'Error';
      default: return action;
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xl" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Bulk Import/Update Items</Typography>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <Tabs value={activeTab} onChange={handleTabChange} sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Upload" />
        <Tab label="Preview & Validate" disabled={!validationResult} />
        <Tab label="Results" disabled={!result} />
      </Tabs>

      <DialogContent>
        {activeTab === 0 && (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Supported formats:</strong> Excel (copy-paste), CSV, or TSV files
                <br />
                <strong>Required columns:</strong> item_code or name
                <br />
                <strong>Tip:</strong> Download the template below to see the expected format
              </Typography>
            </Alert>

            <Box display="flex" gap={2} mb={2} flexWrap="wrap" alignItems="center">
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() => handleDownloadTemplate('tsv')}
              >
                Download Template (TSV)
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() => handleDownloadTemplate('csv')}
              >
                Download Template (CSV)
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() => handleDownloadTemplate('xlsx')}
              >
                Download Template (XLSX)
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadSample}
              >
                Download Current Items ({materials.length})
              </Button>
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => fileInputRef.current?.click()}
              >
                Upload File
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".txt,.csv,.tsv,.xlsx"
                onChange={handleFileUpload}
              />
            </Box>

            {materials.length > 0 && (
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>{materials.length} items</strong> available in your database. 
                  Click "Download Current Items" to export them for editing.
                </Typography>
              </Alert>
            )}

            <TextField
              fullWidth
              multiline
              rows={15}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`Paste your data here (tab-separated or comma-separated)...

Example:
item_code\tname\tmain_category\tsale_price\tpurchase_price\tgst_rate
ITEM-001\tBall Valve 2 inch\tVALVE\t1250\t980\t18
ITEM-002\tGI Pipe 2 inch\tPIPE\t450\t350\t18`}
              sx={{ 
                fontFamily: 'monospace',
                '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '12px' }
              }}
            />

            <Box display="flex" justifyContent="flex-end" mt={2}>
              <Button
                variant="contained"
                startIcon={<PreviewIcon />}
                onClick={() => handleValidate()}
                disabled={!importText.trim()}
              >
                Preview & Validate
              </Button>
            </Box>
          </Box>
        )}

        {activeTab === 1 && validationResult && (
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Box display="flex" gap={2}>
                <Chip 
                  label={`${validationResult.summary.total} Total`} 
                  color="default" 
                  variant="outlined"
                />
                <Chip 
                  label={`${validationResult.summary.toCreate} to Create`} 
                  color="success" 
                  variant="filled"
                />
                <Chip 
                  label={`${validationResult.summary.toUpdate} to Update`} 
                  color="info" 
                  variant="filled"
                />
                {validationResult.summary.errors > 0 && (
                  <Chip 
                    label={`${validationResult.summary.errors} Errors`} 
                    color="error" 
                    variant="filled"
                  />
                )}
                {validationResult.summary.warnings > 0 && (
                  <Chip 
                    label={`${validationResult.summary.warnings} Warnings`} 
                    color="warning" 
                    variant="outlined"
                  />
                )}
              </Box>
              
              <Box display="flex" gap={1}>
                <Button size="small" onClick={handleSelectAll}>Select All</Button>
                <Button size="small" onClick={handleDeselectAll}>Deselect All</Button>
              </Box>
            </Box>

            {validationResult.errorRows.length > 0 && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Rows with errors (will be skipped):</Typography>
                {validationResult.errorRows.map(row => (
                  <Typography key={row.rowNo} variant="body2">
                    Row {row.rowNo}: {row.errors.join(', ')}
                  </Typography>
                ))}
              </Alert>
            )}

            <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <FormControlLabel
                        control={
                          <Switch
                            checked={selectedRows.size === validationResult.validRows.length && validationResult.validRows.length > 0}
                            onChange={(e) => e.target.checked ? handleSelectAll() : handleDeselectAll()}
                            size="small"
                          />
                        }
                        label=""
                      />
                    </TableCell>
                    <TableCell>Row</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Item Code</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Sale Price</TableCell>
                    <TableCell>Purchase Price</TableCell>
                    <TableCell>Stock</TableCell>
                    <TableCell>Warnings</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {validationResult.validRows.map((row) => (
                    <TableRow 
                      key={row.rowNo}
                      selected={selectedRows.has(row.rowNo)}
                      hover
                    >
                      <TableCell padding="checkbox">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(row.rowNo)}
                          onChange={() => handleRowToggle(row.rowNo)}
                        />
                      </TableCell>
                      <TableCell>{row.rowNo}</TableCell>
                      <TableCell>
                        <Chip 
                          size="small" 
                          color={getActionColor(row.action) as any}
                          label={getActionLabel(row.action)}
                        />
                      </TableCell>
                      <TableCell>{row.data.item_code || row.item?.item_code || '-'}</TableCell>
                      <TableCell>
                        {row.data.name || row.item?.name || row.item?.display_name || '-'}
                      </TableCell>
                      <TableCell>{row.data.main_category || row.item?.main_category || '-'}</TableCell>
                      <TableCell>{row.data.sale_price ?? row.item?.sale_price ?? '-'}</TableCell>
                      <TableCell>{row.data.purchase_price ?? row.item?.purchase_price ?? '-'}</TableCell>
                      <TableCell>{row.data.current_stock ?? '-'}</TableCell>
                      <TableCell>
                        {row.warnings.length > 0 && (
                          <Tooltip title={row.warnings.join('\n')}>
                            <WarningIcon color="warning" fontSize="small" />
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
              <Typography variant="body2" color="text.secondary">
                {selectedRows.size} of {validationResult.validRows.length} rows selected
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={handleApplyImport}
                disabled={selectedRows.size === 0 || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <LinearProgress sx={{ width: 20, mr: 1 }} />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckIcon sx={{ mr: 1 }} />
                    Import {selectedRows.size} Items
                  </>
                )}
              </Button>
            </Box>

            {isProcessing && (
              <Box mt={2}>
                <LinearProgress variant="determinate" value={progress} />
                <Typography variant="body2" align="center" mt={1}>
                  Processing... {Math.round(progress)}%
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {activeTab === 2 && result && (
          <Box>
            <Alert severity={result.failed === 0 ? 'success' : result.success > 0 ? 'warning' : 'error'}>
              <Typography variant="h6">
                Import Complete
              </Typography>
              <Typography variant="body1">
                {result.success} items imported successfully
                {result.failed > 0 && `, ${result.failed} items failed`}
              </Typography>
            </Alert>

            {result.failed > 0 && (
              <Box mt={2}>
                <Typography variant="subtitle2" color="error" gutterBottom>
                  Errors:
                </Typography>
                <Paper sx={{ p: 2, maxHeight: 300, overflow: 'auto', bgcolor: '#ffebee' }}>
                  {result.errors.map((error, idx) => (
                    <Typography key={idx} variant="body2" color="error">
                      • {error}
                    </Typography>
                  ))}
                </Paper>
              </Box>
            )}

            <Box display="flex" justifyContent="flex-end" mt={3}>
              <Button variant="contained" onClick={handleClose}>
                Close
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
