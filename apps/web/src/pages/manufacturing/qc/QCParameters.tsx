import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { ArrowLeft, Plus, Loader2 } from 'lucide-react';
import { useMaterials } from '../../../hooks/useMaterials';
import { useQCParametersQuery, useCreateQCParameterMutation } from '../../../features/manufacturing';

type QCParametersProps = {
  onCancel: () => void;
};

export default function QCParameters({ onCancel }: QCParametersProps) {
  const { organisation } = useAuth();
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [paramName, setParamName] = useState('');
  const [specification, setSpecification] = useState('');
  const [unit, setUnit] = useState('');
  const [severity, setSeverity] = useState<'critical' | 'major' | 'minor'>('major');
  const [aqlLevel, setAqlLevel] = useState('II');

  const { data: materials = [], isLoading: materialsLoading } = useMaterials();
  const { data: parameters = [], isLoading: paramsLoading } = useQCParametersQuery(
    organisation?.id,
    selectedProductId || undefined
  );

  const createParam = useCreateQCParameterMutation();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      alert('Please select a product');
      return;
    }
    if (!paramName.trim()) {
      alert('Please enter a parameter name');
      return;
    }
    if (!specification.trim()) {
      alert('Please enter a specification');
      return;
    }

    createParam.mutate({
      param: {
        product_id: selectedProductId,
        bom_id: null,
        parameter_name: paramName,
        specification,
        measurement_unit: unit || undefined,
        severity,
        aql_level: aqlLevel,
        is_active: true,
        organisation_id: organisation?.id || ''
      }
    }, {
      onSuccess: () => {
        setParamName('');
        setSpecification('');
        setUnit('');
      }
    });
  };

  const inputClass = "w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none";

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
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Manage QC Parameters</h1>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Define specifications and tests for finished goods products</span>
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', display: 'flex', gap: '24px' }}>
        {/* Left Side: Create form */}
        <div style={{ flex: '1 1 350px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px', height: 'fit-content' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>
            New QC Specification Parameter
          </h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Select Product *</label>
              {materialsLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '32px' }}><Loader2 size={12} className="animate-spin text-zinc-400" /></div>
              ) : (
                <select
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">-- Choose Product --</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Parameter Name *</label>
              <input
                type="text"
                placeholder="e.g. Dimensions, Weight, Color"
                value={paramName}
                onChange={e => setParamName(e.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Specification *</label>
              <input
                type="text"
                placeholder="e.g. 10 ± 0.5 cm, Max 500g, Deep Blue"
                value={specification}
                onChange={e => setSpecification(e.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>UOM (Unit)</label>
                <input
                  type="text"
                  placeholder="e.g. cm, kg, mm"
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Severity</label>
                <select
                  value={severity}
                  onChange={e => setSeverity(e.target.value as any)}
                  className={inputClass}
                >
                  <option value="minor">Minor</option>
                  <option value="major">Major</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>AQL Inspection Level</label>
              <input
                type="text"
                value={aqlLevel}
                onChange={e => setAqlLevel(e.target.value)}
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={createParam.isPending}
              style={{
                marginTop: '8px',
                padding: '6px 12px',
                background: '#185FA5',
                border: 'none',
                color: '#fff',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              {createParam.isPending ? 'Saving...' : 'Add Parameter'}
            </button>
          </form>
        </div>

        {/* Right Side: List of defined parameters */}
        <div style={{ flex: '2 1 500px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>
            Defined Parameters
          </h3>

          {paramsLoading ? (
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}><Loader2 size={16} className="animate-spin text-zinc-400" /></div>
          ) : !selectedProductId ? (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: '11px', color: '#6b7280' }}>
              Select a product from the dropdown in the left form to view its quality parameters.
            </div>
          ) : parameters.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: '11px', color: '#6b7280' }}>
              No parameters defined for this product yet.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '8px 12px', fontWeight: 500 }}>Parameter Name</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500 }}>Specification</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500 }}>UOM</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500 }}>Severity</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500 }}>AQL</th>
                </tr>
              </thead>
              <tbody>
                {parameters.map(param => (
                  <tr key={param.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#111827' }}>{param.parameter_name}</td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>{param.specification}</td>
                    <td style={{ padding: '10px 12px', color: '#6b7280' }}>{param.measurement_unit || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${
                        param.severity === 'critical' ? 'bg-red-50 text-red-700 border-red-200' :
                        param.severity === 'major' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {param.severity.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>{param.aql_level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
