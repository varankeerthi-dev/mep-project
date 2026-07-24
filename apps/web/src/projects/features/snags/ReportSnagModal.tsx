import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../../supabase';

interface ReportSnagModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  organisationId: string;
  projectEquipment: any[];
  projectDrawings: any[];
  refetchSnags: () => void;
  initialData?: any;
}

export function ReportSnagModal({
  isOpen,
  onClose,
  projectId,
  organisationId,
  projectEquipment,
  projectDrawings,
  refetchSnags,
  initialData,
}: ReportSnagModalProps) {
  const [snagFormData, setSnagFormData] = useState({
    description: '',
    location_area: '',
    severity: 'Medium',
    status: 'Open',
    covered_under_warranty: false,
    equipment_id: '',
    drawing_id: '',
    pin_x: null as number | null,
    pin_y: null as number | null
  });

  const [submitting, setSubmitting] = useState(false);

  // Sync state with initialData when opened or changed
  useEffect(() => {
    if (isOpen) {
      setSnagFormData({
        description: initialData?.description || '',
        location_area: initialData?.location_area || '',
        severity: initialData?.severity || 'Medium',
        status: initialData?.status || 'Open',
        covered_under_warranty: initialData?.covered_under_warranty || false,
        equipment_id: initialData?.equipment_id || '',
        drawing_id: initialData?.drawing_id || '',
        pin_x: initialData?.pin_x !== undefined ? initialData.pin_x : null,
        pin_y: initialData?.pin_y !== undefined ? initialData.pin_y : null
      });
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSnagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (!projectId || !organisationId) return;

      const { error } = await supabase
        .from('project_snags')
        .insert([{
          project_id: projectId,
          organisation_id: organisationId,
          description: snagFormData.description,
          location_area: snagFormData.location_area || null,
          severity: snagFormData.severity,
          status: snagFormData.status,
          covered_under_warranty: snagFormData.covered_under_warranty,
          equipment_id: snagFormData.covered_under_warranty && snagFormData.equipment_id ? snagFormData.equipment_id : null,
          drawing_id: snagFormData.drawing_id || null,
          pin_x: snagFormData.pin_x,
          pin_y: snagFormData.pin_y
        }]);

      if (error) throw error;

      refetchSnags();
      alert('Defect snag registered successfully');
      onClose();
    } catch (err: any) {
      alert('Error adding snag: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '550px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#1e293b' }}>Report Defect / Snag</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer' }} disabled={submitting}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSnagSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Description *</label>
              <textarea
                required
                className="pl-input"
                value={snagFormData.description}
                onChange={e => setSnagFormData(prev => ({ ...prev, description: e.target.value }))}
                style={{ width: '100%', height: '80px', padding: '0.5rem' }}
                disabled={submitting}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Location Area / Zone</label>
                <input
                  type="text"
                  placeholder="e.g. Server Room B, 2nd Floor"
                  className="pl-input"
                  value={snagFormData.location_area}
                  onChange={e => setSnagFormData(prev => ({ ...prev, location_area: e.target.value }))}
                  style={{ width: '100%' }}
                  disabled={submitting}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Severity</label>
                <select
                  className="pl-input"
                  value={snagFormData.severity}
                  onChange={e => setSnagFormData(prev => ({ ...prev, severity: e.target.value }))}
                  style={{ width: '100%' }}
                  disabled={submitting}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Status</label>
                <select
                  className="pl-input"
                  value={snagFormData.status}
                  onChange={e => setSnagFormData(prev => ({ ...prev, status: e.target.value }))}
                  style={{ width: '100%' }}
                  disabled={submitting}
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', height: '100%', paddingTop: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, color: '#334155' }}>
                  <input
                    type="checkbox"
                    checked={snagFormData.covered_under_warranty}
                    onChange={e => setSnagFormData(prev => ({ ...prev, covered_under_warranty: e.target.checked }))}
                    style={{ width: '16px', height: '16px' }}
                    disabled={submitting}
                  />
                  Covered Under Warranty
                </label>
              </div>
            </div>

            {snagFormData.covered_under_warranty && (
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Link to Equipment *</label>
                <select
                  required={snagFormData.covered_under_warranty}
                  className="pl-input"
                  value={snagFormData.equipment_id}
                  onChange={e => setSnagFormData(prev => ({ ...prev, equipment_id: e.target.value }))}
                  style={{ width: '100%' }}
                  disabled={submitting}
                >
                  <option value="">Select Linked Equipment</option>
                  {projectEquipment.map((eq: any) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.equipment_name} {eq.serial_number ? `(S/N: ${eq.serial_number})` : ''} - Supplier: {eq.supplier || 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Floor Layout Drawing</label>
              <select
                className="pl-input"
                value={snagFormData.drawing_id || ''}
                onChange={e => setSnagFormData(prev => ({ ...prev, drawing_id: e.target.value, pin_x: null, pin_y: null }))}
                style={{ width: '100%' }}
                disabled={submitting}
              >
                <option value="">Select Drawing (Optional)</option>
                {projectDrawings.map((dw: any) => (
                  <option key={dw.id} value={dw.id}>{dw.name}</option>
                ))}
              </select>
            </div>

            {snagFormData.drawing_id && (() => {
              const selectedDrawing = projectDrawings.find((d: any) => d.id === snagFormData.drawing_id);
              if (!selectedDrawing) return null;
              return (
                <div style={{ marginTop: '0.5rem' }}>
                  <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#64748b', marginBottom: '0.25rem' }}>
                    Click on the floor plan below to pin the defect location:
                  </span>
                  <div 
                    onClick={(e) => {
                      if (submitting) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pin_x = ((e.clientX - rect.left) / rect.width) * 100;
                      const pin_y = ((e.clientY - rect.top) / rect.height) * 100;
                      setSnagFormData(prev => ({ ...prev, pin_x, pin_y }));
                    }}
                    style={{ 
                      position: 'relative', 
                      cursor: submitting ? 'not-allowed' : 'crosshair', 
                      borderRadius: '6px', 
                      overflow: 'hidden', 
                      border: '1px solid #cbd5e1',
                      maxHeight: '200px',
                      background: '#f1f5f9',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}
                  >
                    <img 
                      src={selectedDrawing.file_url} 
                      alt="Floor Plan" 
                      style={{ width: '100%', height: 'auto', maxHeight: '200px', objectFit: 'contain' }} 
                    />
                    {snagFormData.pin_x !== null && snagFormData.pin_y !== null && (
                      <div 
                        style={{
                          position: 'absolute',
                          left: `${snagFormData.pin_x}%`,
                          top: `${snagFormData.pin_y}%`,
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: '#ef4444',
                          border: '2px solid #fff',
                          transform: 'translate(-50%, -50%)',
                          boxShadow: '0 0 0 4px rgba(239, 68, 68, 0.4)',
                          pointerEvents: 'none'
                        }}
                      />
                    )}
                  </div>
                  {snagFormData.pin_x !== null && (
                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem' }}>
                      Pin mapped at X: {snagFormData.pin_x.toFixed(1)}%, Y: {snagFormData.pin_y?.toFixed(1)}%
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
            <button type="button" onClick={onClose} className="pl-btn" style={{ background: '#fff', border: '1px solid #cbd5e1' }} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="pl-btn pl-btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Snag'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
