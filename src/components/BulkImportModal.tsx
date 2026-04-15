import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  Preview as PreviewIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  X as CloseIcon,
} from 'lucide-react';
import {
  parseExcelData,
  applyBulkImport,
  generateImportTemplate,
  generateImportTemplateCSV,
  generateImportTemplateXLSX,
  IMPORT_COLUMNS,
  ImportValidationResult,
} from '../utils/bulkImport';
import { cn } from '../lib/utils';

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

  if (!open) return null;

  const handleTabChange = (newValue: number) => {
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

  const getActionClass = (action: string) => {
    switch (action) {
      case 'create': return 'bg-emerald-100 text-emerald-700';
      case 'update': return 'bg-blue-100 text-blue-700';
      case 'error': return 'bg-rose-100 text-rose-700';
      default: return 'bg-slate-100 text-slate-700';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Bulk Import/Update Items</h2>
          <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6">
          {['Upload', 'Preview & Validate', 'Results'].map((tab, idx) => (
            <button
              key={tab}
              onClick={() => handleTabChange(idx)}
              disabled={(idx === 1 && !validationResult) || (idx === 2 && !result)}
              className={cn(
                "px-6 py-4 text-sm font-bold border-b-2 transition-all",
                activeTab === idx 
                  ? "border-blue-600 text-blue-600" 
                  : "border-transparent text-slate-400 hover:text-slate-600 disabled:opacity-30"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 0 && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-blue-800 text-sm">
                <p className="font-bold mb-1">Supported formats:</p>
                <p>Excel (copy-paste), CSV, or TSV files</p>
                <p className="font-bold mt-2 mb-1">Required columns:</p>
                <p>item_code or name</p>
                <p className="mt-2 text-blue-600 font-medium italic">Tip: Download the template below to see the expected format</p>
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <button onClick={() => handleDownloadTemplate('tsv')} className="btn btn-outline flex items-center gap-2 text-sm font-bold">
                  <DownloadIcon className="w-4 h-4" /> Download Template (TSV)
                </button>
                <button onClick={() => handleDownloadTemplate('csv')} className="btn btn-outline flex items-center gap-2 text-sm font-bold">
                  <DownloadIcon className="w-4 h-4" /> Download Template (CSV)
                </button>
                <button onClick={() => handleDownloadTemplate('xlsx')} className="btn btn-outline flex items-center gap-2 text-sm font-bold">
                  <DownloadIcon className="w-4 h-4" /> Download Template (XLSX)
                </button>
                <button onClick={handleDownloadSample} className="btn btn-outline flex items-center gap-2 text-sm font-bold">
                  <DownloadIcon className="w-4 h-4" /> Download Current Items ({materials.length})
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="btn flex items-center gap-2 text-sm font-bold bg-slate-900 text-white hover:bg-slate-800">
                  <UploadIcon className="w-4 h-4" /> Upload File
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".txt,.csv,.tsv,.xlsx" onChange={handleFileUpload} />
              </div>

              {materials.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-emerald-800 text-sm flex items-center gap-2">
                  <CheckIcon className="w-4 h-4" />
                  <span><strong>{materials.length} items</strong> available. Click "Download Current Items" to edit them.</span>
                </div>
              )}

              <div className="space-y-2">
                <textarea
                  className="w-full h-80 p-4 font-mono text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`Paste your data here (tab-separated or comma-separated)...

Example:
item_code\tname\tmain_category\tsale_price\tpurchase_price\tgst_rate
ITEM-001\tBall Valve 2 inch\tVALVE\t1250\t980\t18
ITEM-002\tGI Pipe 2 inch\tPIPE\t450\t350\t18`}
                />
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => handleValidate()}
                  disabled={!importText.trim()}
                  className="btn bg-blue-600 text-white hover:bg-blue-700 px-8 py-3 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  <PreviewIcon className="w-5 h-5" />
                  Preview & Validate
                </button>
              </div>
            </div>
          )}

          {activeTab === 1 && validationResult && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">{validationResult.summary.total} Total</span>
                  <span className="px-3 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200">{validationResult.summary.toCreate} to Create</span>
                  <span className="px-3 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200">{validationResult.summary.toUpdate} to Update</span>
                  {validationResult.summary.errors > 0 && (
                    <span className="px-3 py-1 rounded-lg bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200">{validationResult.summary.errors} Errors</span>
                  )}
                  {validationResult.summary.warnings > 0 && (
                    <span className="px-3 py-1 rounded-lg bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200">{validationResult.summary.warnings} Warnings</span>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <button onClick={handleSelectAll} className="text-xs font-bold text-blue-600 hover:underline">Select All</button>
                  <button onClick={handleDeselectAll} className="text-xs font-bold text-slate-400 hover:underline">Deselect All</button>
                </div>
              </div>

              {validationResult.errorRows.length > 0 && (
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-rose-800 text-sm space-y-1">
                  <p className="font-bold">Rows with errors (will be skipped):</p>
                  {validationResult.errorRows.map(row => (
                    <p key={row.rowNo}>Row {row.rowNo}: {row.errors.join(', ')}</p>
                  ))}
                </div>
              )}

              <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto max-h-[400px]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="p-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedRows.size === validationResult.validRows.length && validationResult.validRows.length > 0}
                          onChange={(e) => e.target.checked ? handleSelectAll() : handleDeselectAll()}
                        />
                      </th>
                      <th className="p-3 font-bold text-slate-600">Row</th>
                      <th className="p-3 font-bold text-slate-600">Action</th>
                      <th className="p-3 font-bold text-slate-600">Item Code</th>
                      <th className="p-3 font-bold text-slate-600">Name</th>
                      <th className="p-3 font-bold text-slate-600">Category</th>
                      <th className="p-3 font-bold text-slate-600">Sale Price</th>
                      <th className="p-3 font-bold text-slate-600">Purchase Price</th>
                      <th className="p-3 font-bold text-slate-600">Stock</th>
                      <th className="p-3 font-bold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validationResult.validRows.map((row) => (
                      <tr key={row.rowNo} className={cn("hover:bg-slate-50", selectedRows.has(row.rowNo) && "bg-blue-50/30")}>
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(row.rowNo)}
                            onChange={() => handleRowToggle(row.rowNo)}
                          />
                        </td>
                        <td className="p-3 text-slate-500">{row.rowNo}</td>
                        <td className="p-3">
                          <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-black", getActionClass(row.action))}>
                            {getActionLabel(row.action)}
                          </span>
                        </td>
                        <td className="p-3 font-mono">{row.data.item_code || row.item?.item_code || '-'}</td>
                        <td className="p-3 font-medium text-slate-900">{row.data.name || row.item?.name || row.item?.display_name || '-'}</td>
                        <td className="p-3 text-slate-500">{row.data.main_category || row.item?.main_category || '-'}</td>
                        <td className="p-3 text-slate-600">{row.data.sale_price ?? row.item?.sale_price ?? '-'}</td>
                        <td className="p-3 text-slate-600">{row.data.purchase_price ?? row.item?.purchase_price ?? '-'}</td>
                        <td className="p-3 text-slate-600">{row.data.current_stock ?? '-'}</td>
                        <td className="p-3">
                          {row.warnings.length > 0 && (
                            <span title={row.warnings.join(', ')}>
                              <WarningIcon className="w-4 h-4 text-amber-500" />
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl">
                  <span className="text-sm font-bold text-slate-600">{selectedRows.size} of {validationResult.validRows.length} rows selected</span>
                  <button
                    onClick={handleApplyImport}
                    disabled={selectedRows.size === 0 || isProcessing}
                    className="btn bg-indigo-600 text-white hover:bg-indigo-700 px-8 py-3 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-600/20"
                  >
                    {!isProcessing && <CheckIcon className="w-5 h-5" />}
                    {isProcessing ? 'Processing...' : `Import ${selectedRows.size} Items`}
                  </button>
                </div>

                {isProcessing && (
                  <div className="space-y-2">
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Importing data... {Math.round(progress)}%
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 2 && result && (
            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
              <div className={cn(
                "p-8 rounded-[32px] border-2 flex flex-col items-center text-center",
                result.failed === 0 ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"
              )}>
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center mb-6 shadow-lg",
                  result.failed === 0 ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                )}>
                  {result.failed === 0 ? <CheckIcon className="w-8 h-8" /> : <WarningIcon className="w-8 h-8" />}
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">Import Complete</h3>
                <p className="text-slate-600 font-bold">
                  {result.success} items processed successfully
                  {result.failed > 0 && <span className="text-rose-600"> | {result.failed} items failed</span>}
                </p>
              </div>

              {result.failed > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-black text-rose-600 uppercase tracking-widest px-2">Error Log</p>
                  <div className="bg-rose-50 border border-rose-100 rounded-[24px] p-6 max-h-60 overflow-y-auto font-mono text-xs text-rose-800 space-y-2">
                    {result.errors.map((error, idx) => (
                      <p key={idx} className="flex gap-2">
                        <span className="opacity-50">•</span>
                        {error}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-center pt-8">
                <button onClick={handleClose} className="btn bg-slate-900 text-white px-12 py-4 rounded-2xl font-bold shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all">
                  Close Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
