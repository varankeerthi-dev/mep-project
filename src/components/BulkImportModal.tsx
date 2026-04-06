import { useState, useRef } from 'react';
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

  const handleDownloadTemplate = (format: 'tsv' | 'csv' = 'tsv') => {
    const content = format === 'csv' ? generateImportTemplateCSV() : generateImportTemplate();
    const blob = new Blob([content], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `item_import_template.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSample = () => {
    const headers = IMPORT_COLUMNS.map(col => col.key);
    const sampleRow = IMPORT_COLUMNS.map(col => {
      switch (col.key) {
        case 'item_code': return 'VLV-001';
        case 'name': return 'Ball Valve 2 inch';
        case 'display_name': return '2" Ball Valve - SS316';
        case 'main_category': return 'VALVE';
        case 'sub_category': return 'Ball Valve';
        case 'size': return '2 inch';
        case 'size_lwh': return '2 x 1.5 x 1';
        case 'pressure_class': return 'PN16';
        case 'make': return 'KITZ';
        case 'material': return 'SS316';
        case 'end_connection': return 'Screwed';
        case 'unit': return 'nos';
        case 'sale_price': return '1250.00';
        case 'purchase_price': return '980.00';
        case 'hsn_code': return '848180';
        case 'gst_rate': return '18';
        case 'part_number': return 'KITZ-BV-2IN-SS';
        case 'taxable': return 'taxable';
        case 'weight': return '2.5';
        case 'upc': return '890123456789';
        case 'mpn': return 'BV2SS';
        case 'ean': return '1234567890123';
        case 'inventory_account': return 'inventory asset';
        case 'is_active': return 'true';
        case 'low_stock_level': return '10';
        case 'current_stock': return '50';
        case 'warehouse': return 'Main Warehouse';
        default: return '';
      }
    });
    
    const content = [headers.join('\t'), sampleRow.join('\t')].join('\n');
    const blob = new Blob([content], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'item_import_sample.txt';
    a.click();
    URL.revokeObjectURL(url);
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

            <Box display="flex" gap={2} mb={2}>
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
                onClick={handleDownloadSample}
              >
                Download Sample Data
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
