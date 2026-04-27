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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', fontFamily: 'Inter, sans-serif' }}>
        <Clock size={24} style={{ animation: 'spin 1s linear infinite', marginRight: '8px' }} />
        Loading measurement sheets...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '16px', color: '#dc2626', fontFamily: 'Inter, sans-serif' }}>
        Error: {error.message}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Summary Card */}
      <div style={{
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        background: '#f8fafc',
        padding: '16px',
        marginBottom: '16px',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '4px' }}>
              Contract Value
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>
              {formatCurrency(currentContractValue)}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '4px' }}>
              Total Measured
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>
              {formatCurrency(totalMeasuredValue)}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '4px' }}>
              Difference
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: totalMeasuredValue > currentContractValue ? '#dc2626' : '#0f172a' }}>
              {totalMeasuredValue > currentContractValue ? '+' : ''}{formatCurrency(totalMeasuredValue - currentContractValue)}
            </div>
          </div>
        </div>
        
        {totalMeasuredValue > currentContractValue && (
          <div style={{
            marginTop: '12px',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #fca5a5',
            background: '#fef2f2',
            color: '#dc2626',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertTriangle size={16} />
            Total measurements exceed contract. Amendments created.
          </div>
        )}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
          MEASUREMENT SHEETS ({sheets?.length || 0})
        </h3>
        <button
          onClick={onCreateNew}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            borderRadius: '8px',
            background: '#0f172a',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '600',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = '#1e293b'}
          onMouseOut={(e) => e.currentTarget.style.background = '#0f172a'}
        >
          <span style={{ fontSize: '14px' }}>+</span> Create Measurement Sheet
        </button>
      </div>

      {/* Sheets Table */}
      {sheets && sheets.length > 0 ? (
        <div style={{
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          background: '#fff',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                {['Sheet No', 'Date', 'Description', 'Contract', 'Actual', 'Diff', 'Status', 'Action'].map((header) => (
                  <th key={header} style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: '#64748b'
                  }}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheets.map((sheet) => (
                <tr key={sheet.id} style={{ borderBottom: '1px solid #f1f5f9', background: sheet.status === 'Approved' ? '#f8fafc' : 'transparent' }}>
                  <td style={{ padding: '16px', fontSize: '14px', color: '#0f172a', fontWeight: '600' }}>
                    {sheet.sheet_no}
                  </td>
                  <td style={{ padding: '16px', fontSize: '14px', color: '#64748b' }}>
                    {sheet.measurement_date}
                  </td>
                  <td style={{ padding: '16px', fontSize: '14px', color: '#334155' }}>
                    {sheet.description || '-'}
                  </td>
                  <td style={{ padding: '16px', fontSize: '14px', color: '#64748b', textAlign: 'right' }}>
                    {formatCurrency(sheet.contract_value)}
                  </td>
                  <td style={{ padding: '16px', fontSize: '14px', color: '#0f172a', fontWeight: '600', textAlign: 'right' }}>
                    {formatCurrency(sheet.actual_value)}
                  </td>
                  <td style={{ padding: '16px', fontSize: '14px', color: sheet.difference > 0 ? '#dc2626' : sheet.difference < 0 ? '#16a34a' : '#64748b', fontWeight: '500', textAlign: 'right' }}>
                    {sheet.difference > 0 ? '+' : ''}{formatCurrency(sheet.difference)}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      background: sheet.status === 'Approved' ? '#dcfce7' : sheet.status === 'Draft' ? '#f1f5f9' : '#fee2e2',
                      color: sheet.status === 'Approved' ? '#166534' : sheet.status === 'Draft' ? '#475569' : '#991b1b'
                    }}>
                      {sheet.status}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    {sheet.status === 'Draft' && (
                      <button
                        onClick={() => handleApprove(sheet.id)}
                        disabled={approvingId === sheet.id}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          borderRadius: '6px',
                          background: '#dcfce7',
                          color: '#166534',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          opacity: approvingId === sheet.id ? 0.5 : 1
                        }}
                      >
                        <CheckCircle size={12} />
                        {approvingId === sheet.id ? '...' : 'Approve'}
                      </button>
                    )}
                    {sheet.amendment_created && (
                      <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '4px' }}>
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
        <div style={{
          padding: '64px 24px',
          textAlign: 'center',
          border: '1px dashed #e2e8f0',
          borderRadius: '8px',
          color: '#94a3b8'
        }}>
          <FileText size={32} style={{ margin: '0 auto 16px', color: '#cbd5e1' }} />
          <p style={{ fontSize: '14px', marginBottom: '16px' }}>No measurement sheets created yet.</p>
          <button
            onClick={onCreateNew}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: '#fff',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500'
            }}
          >
            Create First Measurement Sheet
          </button>
        </div>
      )}
    </div>
  );
}
