import React from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { ArrowLeft, Loader2, Award, AlertTriangle, ShieldCheck } from 'lucide-react';
import {
  useQCInspectionDetailQuery,
  useQCParameterResultsQuery
} from '../../../features/manufacturing';

type QCInspectionDetailProps = {
  inspectionId: string;
  onCancel: () => void;
};

export default function QCInspectionDetail({ inspectionId, onCancel }: QCInspectionDetailProps) {
  const { organisation } = useAuth();

  const { data: inspection, isLoading: inspectionLoading } = useQCInspectionDetailQuery(inspectionId);
  const { data: results = [], isLoading: resultsLoading } = useQCParameterResultsQuery(inspectionId);

  if (inspectionLoading) {
    return (
      <div style={{ padding: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '8px' }}>
        <Loader2 className="animate-spin text-zinc-400" size={24} />
        <span style={{ fontSize: '12px', color: '#6b7280' }}>Loading QC inspection details...</span>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444' }}>
        Quality inspection record not found.
      </div>
    );
  }

  const resultColors: Record<string, string> = {
    pending: 'bg-zinc-50 text-zinc-700 border-zinc-200',
    accepted: 'bg-green-50 text-green-700 border-green-200',
    partially_accepted: 'bg-amber-50 text-amber-700 border-amber-200',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200'
  };

  return (
    <div style={{ minHeight: '100%', background: '#fafafa', paddingBottom: '40px' }}>
      {/* Header Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '16px', position: 'sticky', top: 0, zIndex: 40 }}>
        <button
          onClick={onCancel}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}
        >
          <ArrowLeft size={14} />
        </button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Inspection {inspection.inspection_no}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${resultColors[inspection.inspection_result] || ''}`}>
              {inspection.inspection_result.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Product: {inspection.materials?.name}</span>
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Summary Card */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>
            Inspection Summary
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4" style={{ fontSize: '11px' }}>
            <div>
              <span style={{ color: '#6b7280', display: 'block' }}>Batch / Lot Reference</span>
              <span style={{ fontWeight: 600, color: '#374151' }}>{inspection.batch_no}</span>
            </div>
            <div>
              <span style={{ color: '#6b7280', display: 'block' }}>Inspection Date</span>
              <span style={{ fontWeight: 600, color: '#374151' }}>{new Date(inspection.inspection_date).toLocaleDateString()}</span>
            </div>
            <div>
              <span style={{ color: '#6b7280', display: 'block' }}>Presented Qty</span>
              <span style={{ fontWeight: 600, color: '#374151' }}>{inspection.produced_qty} {inspection.materials?.unit}</span>
            </div>
            <div>
              <span style={{ color: '#6b7280', display: 'block' }}>Sample Size</span>
              <span style={{ fontWeight: 600, color: '#374151' }}>{inspection.sample_size || '—'}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4" style={{ marginTop: '20px', borderTop: '1px dashed #e5e7eb', paddingTop: '16px', fontSize: '11px' }}>
            <div style={{ background: '#f0fdf4', padding: '10px', borderRadius: '6px', border: '1px solid #dcfce7' }}>
              <span style={{ color: '#15803d', display: 'block', fontWeight: 500 }}>Accepted (to FG)</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#166534' }}>{inspection.accepted_qty}</span>
            </div>
            <div style={{ background: '#fef2f2', padding: '10px', borderRadius: '6px', border: '1px solid #fee2e2' }}>
              <span style={{ color: '#b91c1c', display: 'block', fontWeight: 500 }}>Rejected (to Rej)</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#991b1b' }}>{inspection.rejected_qty}</span>
            </div>
            <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '6px', border: '1px solid #dbeafe' }}>
              <span style={{ color: '#1d4ed8', display: 'block', fontWeight: 500 }}>Rework (to WIP)</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e40af' }}>{inspection.rework_qty}</span>
            </div>
          </div>
        </div>

        {/* Parameter Checklist results */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>
            Parameter Tests Result
          </h3>

          {resultsLoading ? (
            <div style={{ padding: '12px', display: 'flex', justifyContent: 'center' }}><Loader2 size={14} className="animate-spin text-zinc-400" /></div>
          ) : results.length === 0 ? (
            <div style={{ padding: '12px', textAlign: 'center', fontSize: '11px', color: '#6b7280' }}>
              No custom checklists recorded for this inspection.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '8px 12px', fontWeight: 500 }}>Parameter Name</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500 }}>Specification Threshold</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500 }}>Measured value</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500, width: '100px', textAlign: 'center' }}>Test result</th>
                </tr>
              </thead>
              <tbody>
                {results.map((res) => (
                  <tr key={res.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#111827' }}>
                      {res.parameter?.parameter_name}
                      <span style={{ fontSize: '9px', color: '#9ca3af', display: 'block', textTransform: 'capitalize' }}>
                        Severity: {res.parameter?.severity}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#4b5563' }}>
                      {res.parameter?.specification} {res.parameter?.measurement_unit}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#374151' }}>
                      {res.measured_value || '—'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {res.is_pass ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#10b981', fontWeight: 600 }}>
                          <ShieldCheck size={12} /> Pass
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#ef4444', fontWeight: 600 }}>
                          <AlertTriangle size={12} /> Fail
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Remarks section */}
        {inspection.remarks && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '12px' }}>
              Inspector Remarks / Log Notes
            </h3>
            <p style={{ fontSize: '11px', color: '#4b5563', lineHeight: '1.5', margin: 0 }}>
              {inspection.remarks}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
