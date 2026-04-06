import { useState } from 'react';
import { useMeasurementSheets, useApproveMeasurementSheet } from '../hooks/useMeasurementSheets';
import { formatCurrency } from '../utils/formatters';
import { CheckCircle, Clock, FileText, AlertTriangle } from 'lucide-react';

interface MeasurementSheetListProps {
  workOrderId: string;
  workOrderNo: string;
  currentContractValue: number;
  onCreateNew: () => void;
}

export function MeasurementSheetList({
  workOrderId,
  workOrderNo,
  currentContractValue,
  onCreateNew
}: MeasurementSheetListProps) {
  const { data: sheets, isLoading, error, refetch } = useMeasurementSheets(workOrderId);
  const approveMutation = useApproveMeasurementSheet();
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const handleApprove = async (sheetId: string) => {
    setApprovingId(sheetId);
    try {
      await approveMutation.mutateAsync({
        sheetId,
        workOrderId,
        workOrderNo,
        currentContractValue
      });
      refetch();
    } catch (err) {
      console.error('Error approving:', err);
      alert('Failed to approve measurement sheet');
    } finally {
      setApprovingId(null);
    }
  };

  const totalMeasuredValue = sheets?.reduce((sum, sheet) => 
    sheet.status === 'Approved' ? sum + sheet.actual_value : sum, 0
  ) || 0;

  if (isLoading) {
    return (
      <div className="text-center py-8" style={{ fontFamily: 'Courier New, monospace' }}>
        <Clock size={24} className="animate-spin mx-auto mb-2" />
        Loading measurement sheets...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 py-4" style={{ fontFamily: 'Courier New, monospace' }}>
        Error: {error.message}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Courier New, monospace' }}>
      {/* Summary Card */}
      <div className="border border-black p-4 mb-4 bg-gray-50">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider mb-1">Contract Value</div>
            <div className="text-xl font-bold">{formatCurrency(currentContractValue)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider mb-1">Total Measured</div>
            <div className="text-xl font-bold">{formatCurrency(totalMeasuredValue)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider mb-1">Difference</div>
            <div className={`text-xl font-bold ${totalMeasuredValue > currentContractValue ? 'text-red-600' : ''}`}>
              {totalMeasuredValue > currentContractValue ? '+' : ''}{formatCurrency(totalMeasuredValue - currentContractValue)}
            </div>
          </div>
        </div>
        
        {totalMeasuredValue > currentContractValue && (
          <div className="mt-3 p-2 border border-red-500 bg-red-50 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle size={16} />
            Total measurements exceed contract. Amendments created.
          </div>
        )}
      </div>

      {/* Create Button */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold">MEASUREMENT SHEETS ({sheets?.length || 0})</h3>
        <button
          onClick={onCreateNew}
          className="px-4 py-2 border border-black bg-black text-white hover:bg-gray-800 text-sm"
        >
          + Create Measurement Sheet
        </button>
      </div>

      {/* Sheets Table */}
      {sheets && sheets.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border border-black text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black p-2 text-left">Sheet No</th>
                <th className="border border-black p-2 text-left">Date</th>
                <th className="border border-black p-2 text-left">Description</th>
                <th className="border border-black p-2 text-right">Contract</th>
                <th className="border border-black p-2 text-right">Actual</th>
                <th className="border border-black p-2 text-right">Diff</th>
                <th className="border border-black p-2 text-center">Status</th>
                <th className="border border-black p-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {sheets.map((sheet) => (
                <tr key={sheet.id} className={sheet.status === 'Approved' ? 'bg-gray-50' : ''}>
                  <td className="border border-black p-2 font-bold">{sheet.sheet_no}</td>
                  <td className="border border-black p-2">{sheet.measurement_date}</td>
                  <td className="border border-black p-2">{sheet.description || '-'}</td>
                  <td className="border border-black p-2 text-right">{formatCurrency(sheet.contract_value)}</td>
                  <td className="border border-black p-2 text-right font-bold">{formatCurrency(sheet.actual_value)}</td>
                  <td className={`border border-black p-2 text-right ${sheet.difference > 0 ? 'text-red-600' : sheet.difference < 0 ? 'text-green-600' : ''}`}>
                    {sheet.difference > 0 ? '+' : ''}{formatCurrency(sheet.difference)}
                  </td>
                  <td className="border border-black p-2 text-center">
                    <span className={`text-xs px-2 py-0.5 border ${
                      sheet.status === 'Approved' 
                        ? 'border-green-500 text-green-600' 
                        : sheet.status === 'Draft'
                        ? 'border-gray-500 text-gray-600'
                        : 'border-red-500 text-red-600'
                    }`}>
                      {sheet.status}
                    </span>
                  </td>
                  <td className="border border-black p-2 text-center">
                    {sheet.status === 'Draft' && (
                      <button
                        onClick={() => handleApprove(sheet.id)}
                        disabled={approvingId === sheet.id}
                        className="px-2 py-1 border border-green-500 text-green-600 hover:bg-green-50 text-xs flex items-center gap-1 disabled:opacity-50"
                      >
                        <CheckCircle size={12} />
                        {approvingId === sheet.id ? '...' : 'Approve'}
                      </button>
                    )}
                    {sheet.amendment_created && (
                      <div className="text-xs text-blue-600 mt-1">
                        AMD Created
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 border border-black border-dashed text-gray-500">
          <FileText size={32} className="mx-auto mb-2 text-gray-300" />
          <p>No measurement sheets created yet.</p>
          <button
            onClick={onCreateNew}
            className="mt-2 px-4 py-2 border border-black hover:bg-gray-100 text-sm"
          >
            Create First Measurement Sheet
          </button>
        </div>
      )}
    </div>
  );
}
