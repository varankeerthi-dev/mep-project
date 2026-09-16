import React from 'react';
import { X, Mic } from 'lucide-react';
import { getChecklistQuestions } from './types';

export interface SiteVisitCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  visit: any;
  checkoutData: {
    signed_off_by: string;
    signed_off_designation: string;
  };
  setCheckoutData: React.Dispatch<React.SetStateAction<{
    signed_off_by: string;
    signed_off_designation: string;
  }>>;
  checklistAnswers: Record<string, string>;
  setChecklistAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  jmsItems: Array<{ item_name: string; unit: string; agreed_qty: number; rate: number }>;
  setJmsItems: React.Dispatch<React.SetStateAction<Array<{ item_name: string; unit: string; agreed_qty: number; rate: number }>>>;
  jmsSubcontractorId: string;
  setJmsSubcontractorId: (id: string) => void;
  subcontractors: any[];
  projectEquipment: any[];
  tcEquipmentId: string;
  setTcEquipmentId: (id: string) => void;
  tcTestType: string;
  setTcTestType: (type: string) => void;
  tcWitnessedBy: string;
  setTcWitnessedBy: (witness: string) => void;
  tcReadings: Array<{ parameter: string; required_value: string; actual_value: string; status: 'Pass' | 'Fail' | 'Pending' }>;
  setTcReadings: React.Dispatch<React.SetStateAction<Array<{ parameter: string; required_value: string; actual_value: string; status: 'Pass' | 'Fail' | 'Pending' }>>>;
  observationOpen: boolean;
  setObservationOpen: (open: boolean) => void;
  observationCategory: string;
  setObservationCategory: (cat: string) => void;
  observationTitle: string;
  setObservationTitle: (title: string) => void;
  isListening: boolean;
  startListening: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  startDrawing: (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => void;
  draw: (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => void;
  stopDrawing: () => void;
  clearSignature: () => void;
  onSubmitCheckout: (visit: any) => void;
}

export const SiteVisitCheckoutModal: React.FC<SiteVisitCheckoutModalProps> = ({
  isOpen,
  onClose,
  visit,
  checkoutData,
  setCheckoutData,
  checklistAnswers,
  setChecklistAnswers,
  jmsItems,
  setJmsItems,
  jmsSubcontractorId,
  setJmsSubcontractorId,
  subcontractors,
  projectEquipment,
  tcEquipmentId,
  setTcEquipmentId,
  tcTestType,
  setTcTestType,
  tcWitnessedBy,
  setTcWitnessedBy,
  tcReadings,
  setTcReadings,
  observationOpen,
  setObservationOpen,
  observationCategory,
  setObservationCategory,
  observationTitle,
  setObservationTitle,
  isListening,
  startListening,
  canvasRef,
  startDrawing,
  draw,
  stopDrawing,
  clearSignature,
  onSubmitCheckout,
}) => {
  if (!isOpen || !visit) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '550px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#1e293b' }}>Visit Checkout & Client Sign-off</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Checklist Section */}
          <div>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visit Checklist</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {getChecklistQuestions(visit?.visit_type || '').map((q: any) => (
                <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.875rem', color: '#334155' }}>{q.text}</span>
                  <select
                    className="pl-input"
                    value={checklistAnswers[q.id] || 'Yes'}
                    onChange={e => setChecklistAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    style={{ width: '80px', padding: '0.25rem', fontSize: '0.8125rem' }}
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                    <option value="N/A">N/A</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0' }} />

          {/* Joint Measurement Sheet (JMS) Section */}
          <div>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Joint Measurement Sheet (JMS)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#475569', marginBottom: '0.25rem' }}>Subcontractor Link (Optional)</label>
                <select
                  className="pl-input"
                  value={jmsSubcontractorId}
                  onChange={e => setJmsSubcontractorId(e.target.value)}
                  style={{ width: '100%', fontSize: '0.8125rem', padding: '0.375rem' }}
                >
                  <option value="">Select Subcontractor</option>
                  {subcontractors.map((sub: any) => (
                    <option key={sub.id} value={sub.id}>{sub.company_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#475569' }}>Measured Items</span>
                  <button
                    type="button"
                    onClick={() => setJmsItems(prev => [...prev, { item_name: '', unit: 'Rmt', agreed_qty: 0, rate: 0 }])}
                    className="pl-btn"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                  >
                    + Add Item
                  </button>
                </div>
                {jmsItems.length === 0 ? (
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>No items added yet. Click "+ Add Item" if recording measured work.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {jmsItems.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="Item Description"
                          className="pl-input"
                          value={item.item_name}
                          onChange={e => {
                            const val = e.target.value;
                            setJmsItems(prev => prev.map((it, i) => i === idx ? { ...it, item_name: val } : it));
                          }}
                          style={{ flex: 2, fontSize: '0.75rem', padding: '0.25rem' }}
                          required
                        />
                        <input
                          type="text"
                          placeholder="Unit"
                          className="pl-input"
                          value={item.unit}
                          onChange={e => {
                            const val = e.target.value;
                            setJmsItems(prev => prev.map((it, i) => i === idx ? { ...it, unit: val } : it));
                          }}
                          style={{ width: '50px', fontSize: '0.75rem', padding: '0.25rem' }}
                          required
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          className="pl-input"
                          value={item.agreed_qty || ''}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setJmsItems(prev => prev.map((it, i) => i === idx ? { ...it, agreed_qty: val } : it));
                          }}
                          style={{ width: '60px', fontSize: '0.75rem', padding: '0.25rem' }}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setJmsItems(prev => prev.filter((_, i) => i !== idx))}
                          style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0' }} />

          {/* Testing & Commissioning (T&C) Section */}
          {projectEquipment && projectEquipment.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Testing & Commissioning (T&C) Protocol</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#475569', marginBottom: '0.25rem' }}>Equipment</label>
                    <select
                      className="pl-input"
                      value={tcEquipmentId}
                      onChange={e => setTcEquipmentId(e.target.value)}
                      style={{ width: '100%', fontSize: '0.8125rem', padding: '0.375rem' }}
                    >
                      <option value="">Select Equipment</option>
                      {projectEquipment.map((eq: any) => (
                        <option key={eq.id} value={eq.id}>{eq.equipment_name} ({eq.tag_number || 'No Tag'})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#475569', marginBottom: '0.25rem' }}>Test Type</label>
                    <input
                      type="text"
                      className="pl-input"
                      placeholder="e.g. Hydrostatic, Load Test"
                      value={tcTestType}
                      onChange={e => setTcTestType(e.target.value)}
                      style={{ width: '100%', fontSize: '0.8125rem', padding: '0.375rem' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#475569', marginBottom: '0.25rem' }}>Witnessed By (Client/Consultant Rep)</label>
                  <input
                    type="text"
                    className="pl-input"
                    placeholder="Representative Name"
                    value={tcWitnessedBy}
                    onChange={e => setTcWitnessedBy(e.target.value)}
                    style={{ width: '100%', fontSize: '0.8125rem', padding: '0.375rem' }}
                  />
                </div>

                {tcEquipmentId && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#475569' }}>Test Readings</span>
                      <button
                        type="button"
                        onClick={() => setTcReadings(prev => [...prev, { parameter: '', required_value: '', actual_value: '', status: 'Pass' }])}
                        className="pl-btn"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      >
                        + Add Reading
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {tcReadings.map((reading, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                          <input
                            type="text"
                            placeholder="Parameter"
                            className="pl-input"
                            value={reading.parameter}
                            onChange={e => {
                              const val = e.target.value;
                              setTcReadings(prev => prev.map((r, i) => i === idx ? { ...r, parameter: val } : r));
                            }}
                            style={{ flex: 2, fontSize: '0.75rem', padding: '0.25rem' }}
                            required
                          />
                          <input
                            type="text"
                            placeholder="Req. Value"
                            className="pl-input"
                            value={reading.required_value}
                            onChange={e => {
                              const val = e.target.value;
                              setTcReadings(prev => prev.map((r, i) => i === idx ? { ...r, required_value: val } : r));
                            }}
                            style={{ width: '80px', fontSize: '0.75rem', padding: '0.25rem' }}
                            required
                          />
                          <input
                            type="text"
                            placeholder="Act. Value"
                            className="pl-input"
                            value={reading.actual_value}
                            onChange={e => {
                              const val = e.target.value;
                              setTcReadings(prev => prev.map((r, i) => i === idx ? { ...r, actual_value: val } : r));
                            }}
                            style={{ width: '80px', fontSize: '0.75rem', padding: '0.25rem' }}
                            required
                          />
                          <select
                            className="pl-input"
                            value={reading.status}
                            onChange={e => {
                              const val = e.target.value as 'Pass' | 'Fail' | 'Pending';
                              setTcReadings(prev => prev.map((r, i) => i === idx ? { ...r, status: val } : r));
                            }}
                            style={{ width: '70px', fontSize: '0.75rem', padding: '0.25rem' }}
                          >
                            <option value="Pass">Pass</option>
                            <option value="Fail">Fail</option>
                            <option value="Pending">Pending</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => setTcReadings(prev => prev.filter((_, i) => i !== idx))}
                            style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0' }} />

          {/* Site Observation Section (Optional) */}
          <div>
            <div 
              onClick={() => setObservationOpen(!observationOpen)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: '0.5rem' }}
            >
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{observationOpen ? '▼' : '▶'}</span>
                Log Site Observation (Optional)
              </h4>
              {!observationOpen && (observationTitle || observationCategory) && (
                <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 500 }}>Added ✓</span>
              )}
            </div>

            {observationOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '0.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#475569', marginBottom: '0.375rem' }}>Category *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {[
                      { label: 'Improvement Opportunity', val: 'Improvement Opportunity' },
                      { label: 'Best Practice', val: 'Best Practice' },
                      { label: 'Client Feedback', val: 'Client Feedback' },
                      { label: 'Coordination Issue', val: 'Coordination Issue' },
                      { label: 'Safety Observation', val: 'Safety Observation' },
                      { label: 'Cost Saving Idea', val: 'Cost Saving Idea' }
                    ].map(cat => (
                      <label key={cat.val} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: '#334155', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="obs_category"
                          value={cat.val}
                          checked={observationCategory === cat.val}
                          onChange={e => setObservationCategory(e.target.value)}
                        />
                        {cat.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#475569', marginBottom: '0.25rem' }}>Title *</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="pl-input"
                      placeholder="e.g. Wrong flange size delivered for floor 4"
                      value={observationTitle}
                      onChange={e => setObservationTitle(e.target.value)}
                      style={{ flex: 1, fontSize: '0.75rem', padding: '0.375rem' }}
                    />
                    <button
                      type="button"
                      onClick={startListening}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0.375rem',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        background: isListening ? '#fee2e2' : '#f8fafc',
                        color: isListening ? '#ef4444' : '#475569',
                        cursor: 'pointer',
                        width: '32px',
                        height: '32px',
                      }}
                      title={isListening ? 'Listening...' : 'Dictate Title'}
                    >
                      <Mic size={14} style={{ animation: isListening ? 'pulse 1s infinite' : 'none' }} />
                    </button>
                  </div>
                  
                  {/* Quick Suggestions for MEP Engineers */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.5rem' }}>
                    {[
                      'Material dimension mismatch',
                      'Vendor supply delay',
                      'Drawing revision mismatch',
                      'Power / utility shut-off',
                      'Pressure test passed',
                      'Safety hazard detected'
                    ].map(template => (
                      <button
                        key={template}
                        type="button"
                        onClick={() => setObservationTitle(template)}
                        style={{
                          fontSize: '0.625rem',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          background: '#fff',
                          color: '#64748b',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {template}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0' }} />

          {/* Client Sign-off Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Client Representative Name *</label>
              <input
                type="text"
                required
                className="pl-input"
                value={checkoutData.signed_off_by}
                onChange={e => setCheckoutData(prev => ({ ...prev, signed_off_by: e.target.value }))}
                style={{ width: '100%' }}
                placeholder="e.g. John Doe"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Designation *</label>
              <input
                type="text"
                required
                className="pl-input"
                value={checkoutData.signed_off_designation}
                onChange={e => setCheckoutData(prev => ({ ...prev, signed_off_designation: e.target.value }))}
                style={{ width: '100%' }}
                placeholder="e.g. Site Manager"
              />
            </div>
          </div>

          {/* Drawing Canvas */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Digital Signature *</label>
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', background: '#f8fafc' }}>
              <canvas
                ref={canvasRef}
                width={500}
                height={150}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                style={{ display: 'block', width: '100%', height: '150px', cursor: 'crosshair', background: '#fff' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={clearSignature}
                className="pl-btn"
                style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}
              >
                Clear signature
              </button>
            </div>
          </div>

        </div>
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
          <button type="button" onClick={onClose} className="pl-btn" style={{ background: '#fff', border: '1px solid #cbd5e1' }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (!checkoutData.signed_off_by || !checkoutData.signed_off_designation) {
                alert('Please enter representative name and designation.');
                return;
              }
              onSubmitCheckout(visit);
            }}
            className="pl-btn pl-btn-primary"
          >
            Submit Sign-off & Checkout
          </button>
        </div>
      </div>
    </div>
  );
};
