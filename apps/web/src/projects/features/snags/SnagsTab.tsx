import React, { useState } from 'react';
import { Plus, Folder, Link2, AlertTriangle, X } from 'lucide-react';
import { supabase } from '../../../supabase';
import { Button } from '@/components/ui/button';

interface SnagsTabProps {
  selectedProject: any;
  organisation: any;
  projectSnags: any[];
  projectEquipment: any[];
  projectDrawings: any[];
  warrantyClaims: any[];
  userRole: string;
  setSnagFormData: (data: any) => void;
  setIsSnagModalOpen: (open: boolean) => void;
  setClaimFormData: (data: any) => void;
  setIsClaimModalOpen: (open: boolean) => void;
  refetchDrawings: () => void;
  refetchClaims: () => void;
  fmt: (val: any) => string;
  fmtD: (val: any) => string;
}

export function SnagsTab({
  selectedProject,
  organisation,
  projectSnags,
  projectEquipment,
  projectDrawings,
  warrantyClaims,
  userRole,
  setSnagFormData,
  setIsSnagModalOpen,
  setClaimFormData,
  setIsClaimModalOpen,
  refetchDrawings,
  refetchClaims,
  fmt,
  fmtD,
}: SnagsTabProps) {
  // Local States
  const [activeDrawingId, setActiveDrawingId] = useState<string>(
    projectDrawings[0]?.id || ''
  );
  const [highlightedSnagId, setHighlightedSnagId] = useState<string | null>(null);
  const [isAddingDrawing, setIsAddingDrawing] = useState(false);
  const [newDrawingName, setNewDrawingName] = useState('');
  const [newDrawingUrl, setNewDrawingUrl] = useState('');

  // Local States for Notify Claim Modal
  const [notifyingClaim, setNotifyingClaim] = useState<any | null>(null);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifySlaDays, setNotifySlaDays] = useState(7);
  const [sendingLetter, setSendingLetter] = useState(false);

  // Sync activeDrawingId if it's empty but drawings exist
  if (!activeDrawingId && projectDrawings.length > 0) {
    setActiveDrawingId(projectDrawings[0].id);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Drawings Selector Bar */}
      <div className="pl-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Layout Drawings & Schematic Blueprints</h3>
          <Button variant="default" size="sm" onClick={() => {
              setSnagFormData({
                description: '',
                location_area: '',
                severity: 'Medium',
                status: 'Open',
                covered_under_warranty: false,
                equipment_id: '',
                drawing_id: '',
                pin_x: null,
                pin_y: null
              });
              setIsSnagModalOpen(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem' }}
          >
            <Plus size={14} /> Add Snag
          </Button>
        </div>
        
        <div style={{ marginTop: '1rem' }}>
          {projectDrawings.length === 0 ? (
            <div style={{ padding: '1.5rem', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>No drawing layouts uploaded for this project yet.</p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Button variant="default" size="sm" onClick={async () => {
                    try {
                      if (!selectedProject?.id || !organisation?.id) return;
                      const { error } = await supabase
                        .from('project_drawings')
                        .insert([{
                          organisation_id: organisation.id,
                          project_id: selectedProject.id,
                          name: 'Ground Floor HVAC & Piping Layout',
                          file_url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1000&auto=format&fit=crop'
                        }]);
                      if (error) throw error;
                      refetchDrawings();
                      alert('Ground Floor Layout initialized successfully');
                    } catch (err: any) {
                      alert('Error initializing: ' + err.message);
                    }
                  }}
                >
                  Initialize Default Blueprint
                </Button>
                <Button variant="outline" size="sm" style={{ background: '#fff', border: '1px solid #cbd5e1', fontSize: '0.8125rem' }} onClick={() => setIsAddingDrawing(true)}
                >
                  Upload Custom Drawing
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#64748b' }}>Select Layout:</span>
              {projectDrawings.map((dw: any) => (
                <Button variant="default" size="sm" key={dw.id} onClick={() => {
                    setActiveDrawingId(dw.id);
                    setHighlightedSnagId(null);
                  }}
                  className="pl-btn"
                  style={{
                    fontSize: '0.8125rem',
                    padding: '0.25rem 0.75rem',
                    background: activeDrawingId === dw.id ? '#2563eb' : '#fff',
                    color: activeDrawingId === dw.id ? '#fff' : '#475569',
                    border: '1px solid ' + (activeDrawingId === dw.id ? '#2563eb' : '#cbd5e1'),
                  }}
                >
                  {dw.name}
                </Button>
              ))}
              <Button variant="default" size="sm" onClick={() => setIsAddingDrawing(true)} 
                className="pl-btn"
                style={{
                  fontSize: '0.8125rem',
                  padding: '0.25rem 0.5rem',
                  background: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                <Plus size={14} /> Add Drawing
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content: Split layout */}
      <div style={{ display: 'flex', gap: '1.5rem', flexDirection: 'row', flexWrap: 'wrap' }}>
        
        {/* Snags Table column */}
        <div className="pl-card" style={{ flex: '1 1 55%', minWidth: '400px', padding: '1.25rem' }}>
          <h4 style={{ margin: '0 0 1rem 0', fontWeight: 600, color: '#1e293b' }}>Defect Registry</h4>
          {projectSnags.length === 0 ? (
            <div className="pl-empty" style={{ padding: '2.5rem' }}>
              <Folder className="pl-empty-icon" />
              <p className="pl-empty-text">No snags or defects reported yet</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="pl-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Location</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Warranty</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projectSnags.map((snag: any) => {
                    const linkedEquipment = projectEquipment.find((e: any) => e.id === snag.equipment_id);
                    const matchingClaim = warrantyClaims.find((c: any) => c.snag_id === snag.id);
                    const isHighlighted = highlightedSnagId === snag.id;
                    
                    let severityBg = '#f4f4f5';
                    let severityColor = '#52525b';
                    if (snag.severity === 'Critical') {
                      severityBg = '#fee2e2';
                      severityColor = '#991b1b';
                    } else if (snag.severity === 'High') {
                      severityBg = '#ffedd5';
                      severityColor = '#c2410c';
                    } else if (snag.severity === 'Medium') {
                      severityBg = '#fef3c7';
                      severityColor = '#b45309';
                    } else if (snag.severity === 'Low') {
                      severityBg = '#e0f2fe';
                      severityColor = '#0369a1';
                    }

                    let statusBg = '#f4f4f5';
                    let statusColor = '#52525b';
                    if (snag.status === 'Resolved' || snag.status === 'Closed') {
                      statusBg = '#d1fae5';
                      statusColor = '#065f46';
                    } else if (snag.status === 'In Progress') {
                      statusBg = '#dbeafe';
                      statusColor = '#1e40af';
                    } else if (snag.status === 'Open') {
                      statusBg = '#fee2e2';
                      statusColor = '#991b1b';
                    }

                    return (
                      <tr 
                        key={snag.id} 
                        onClick={() => {
                          if (snag.drawing_id) {
                            setActiveDrawingId(snag.drawing_id);
                          }
                          setHighlightedSnagId(snag.id);
                        }}
                        style={{ 
                          cursor: 'pointer',
                          background: isHighlighted ? '#f0fdf4' : 'transparent',
                          transition: 'background 0.2s'
                        }}
                      >
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{snag.description}</td>
                        <td>{snag.location_area || '-'}</td>
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            background: severityBg,
                            color: severityColor
                          }}>
                            {snag.severity}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            background: statusBg,
                            color: statusColor
                          }}>
                            {snag.status}
                          </span>
                        </td>
                        <td>
                          {snag.covered_under_warranty ? (
                            <span style={{ color: '#059669', fontSize: '0.75rem', fontWeight: 600 }}>
                              Yes {linkedEquipment ? `(${linkedEquipment.equipment_name})` : ''}
                            </span>
                          ) : (
                            <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>No</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
                            {snag.covered_under_warranty && (
                              <>
                                {matchingClaim ? (
                                  <Button variant="default" size="sm" onClick={() => {
                                      setClaimFormData({
                                        id: matchingClaim.id,
                                        snag_id: matchingClaim.snag_id || '',
                                        equipment_id: matchingClaim.equipment_id || '',
                                        vendor_name: matchingClaim.vendor_name || '',
                                        claim_reference_number: matchingClaim.claim_reference_number || '',
                                        status: matchingClaim.status || 'Draft',
                                        vendor_dispute_reason: matchingClaim.vendor_dispute_reason || '',
                                        parts_covered: matchingClaim.parts_covered ?? true,
                                        labor_covered: matchingClaim.labor_covered ?? false,
                                        vendor_claimed_cost: matchingClaim.vendor_claimed_cost?.toString() || '',
                                        vendor_approved_cost: matchingClaim.vendor_approved_cost?.toString() || '',
                                        internal_cost_incurred: matchingClaim.internal_cost_incurred?.toString() || '',
                                        resolution_method: matchingClaim.resolution_method || 'N/A',
                                        resolution_date: matchingClaim.resolution_date || ''
                                      });
                                      setIsClaimModalOpen(true);
                                    }}
                                    style={{
                                      fontSize: '0.7rem',
                                      padding: '0.2rem 0.4rem',
                                      background: '#eff6ff',
                                      color: '#1e40af',
                                      border: '1px solid #bfdbfe'
                                    }}
                                  >
                                    Claim: {matchingClaim.status}
                                  </Button>
                                ) : (
                                  <Button variant="default" size="sm" onClick={() => {
                                      const supplierName = linkedEquipment?.supplier || '';
                                      setClaimFormData({
                                        id: '',
                                        snag_id: snag.id,
                                        equipment_id: snag.equipment_id || '',
                                        vendor_name: supplierName,
                                        claim_reference_number: '',
                                        status: 'Draft',
                                        vendor_dispute_reason: '',
                                        parts_covered: true,
                                        labor_covered: false,
                                        vendor_claimed_cost: '',
                                        vendor_approved_cost: '',
                                        internal_cost_incurred: '',
                                        resolution_method: 'N/A',
                                        resolution_date: ''
                                      });
                                      setIsClaimModalOpen(true);
                                    }}
                                    style={{
                                      fontSize: '0.7rem',
                                      padding: '0.2rem 0.4rem',
                                      background: '#10b981',
                                      border: 'none',
                                      color: '#fff'
                                    }}
                                  >
                                    Claim
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Interactive Map column */}
        {activeDrawingId && (() => {
          const activeDrawing = projectDrawings.find((d: any) => d.id === activeDrawingId);
          if (!activeDrawing) return null;

          const drawingSnags = projectSnags.filter((s: any) => s.drawing_id === activeDrawingId && s.pin_x !== null && s.pin_y !== null);

          return (
            <div className="pl-card" style={{ flex: '1 1 38%', minWidth: '320px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>Visual Pin-Map</h4>
                <span style={{ fontSize: '0.75rem', padding: '0.125rem 0.375rem', background: '#f1f5f9', color: '#475569', borderRadius: '4px', fontWeight: 500 }}>
                  {activeDrawing.name}
                </span>
              </div>
              
              <div style={{ 
                position: 'relative', 
                borderRadius: '8px', 
                overflow: 'hidden', 
                border: '1px solid #cbd5e1', 
                background: '#f8fafc',
                minHeight: '300px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <img 
                  src={activeDrawing.file_url} 
                  alt="Floor layout blueprint" 
                  style={{ width: '100%', height: 'auto', maxHeight: '500px', objectFit: 'contain' }}
                />
                
                {/* Render pins */}
                {drawingSnags.map((snag: any) => {
                  const isHighlighted = highlightedSnagId === snag.id;
                  
                  let pinColor = '#ef4444'; // default open
                  if (snag.status === 'Resolved' || snag.status === 'Closed') {
                    pinColor = '#10b981'; // green
                  } else if (snag.status === 'In Progress') {
                    pinColor = '#3b82f6'; // blue
                  }

                  return (
                    <div 
                      key={snag.id}
                      onClick={() => setHighlightedSnagId(snag.id)}
                      style={{
                        position: 'absolute',
                        left: `${snag.pin_x}%`,
                        top: `${snag.pin_y}%`,
                        width: isHighlighted ? '18px' : '12px',
                        height: isHighlighted ? '18px' : '12px',
                        borderRadius: '50%',
                        background: pinColor,
                        border: '2px solid #fff',
                        transform: 'translate(-50%, -50%)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: isHighlighted ? `0 0 0 6px ${pinColor}80` : '0 2px 4px rgba(0,0,0,0.2)',
                        zIndex: isHighlighted ? 10 : 2
                      }}
                      title={`${snag.description} (${snag.severity}) - ${snag.status}`}
                    />
                  );
                })}
              </div>

              {/* Info Panel for highlighted snag */}
              {highlightedSnagId && (() => {
                const snag = projectSnags.find((s: any) => s.id === highlightedSnagId);
                if (!snag) return null;
                return (
                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8125rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 600, color: '#334155' }}>Selected Snag Details</span>
                      <Button variant="default" size="sm" onClick={() => setHighlightedSnagId(null)} 
                        style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                    <p style={{ margin: '0.25rem 0', color: '#475569' }}>{snag.description}</p>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', color: '#64748b', fontSize: '0.75rem' }}>
                      <span><strong>Location:</strong> {snag.location_area || 'N/A'}</span>
                      <span><strong>Severity:</strong> {snag.severity}</span>
                      <span><strong>Status:</strong> {snag.status}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

      </div>

      {/* Warranty Claims Card */}
      <div className="pl-card" style={{ padding: '1.25rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontWeight: 600, color: 'var(--text-primary)' }}>Warranty Claims Registry</h3>
        {warrantyClaims.length === 0 ? (
          <div className="pl-empty" style={{ padding: '2rem' }}>
            <Folder className="pl-empty-icon" />
            <p className="pl-empty-text">No active warranty claims registered</p>
          </div>
        ) : (
          <table className="pl-table">
            <thead>
              <tr>
                <th>Equipment</th>
                <th>Vendor</th>
                <th>Claim Ref / RMA</th>
                <th>Status</th>
                <th>Coverage</th>
                <th>Escalated Dates</th>
                {['Project Manager', 'Admin'].includes(userRole) && (
                  <>
                    <th style={{ textAlign: 'left' }}>Claimed Cost</th>
                    <th style={{ textAlign: 'left' }}>Approved Cost</th>
                    <th style={{ textAlign: 'left' }}>Internal Cost</th>
                  </>
                )}
                <th>Resolution</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {warrantyClaims.map((claim: any) => {
                let statusColor = '#4b5563';
                let statusBg = '#f3f4f6';
                if (claim.status === 'Resolved') {
                  statusColor = '#065f46';
                  statusBg = '#d1fae5';
                } else if (claim.status === 'Pending Response') {
                  statusColor = '#92400e';
                  statusBg = '#fef3c7';
                } else if (claim.status === 'Draft') {
                  statusColor = '#374151';
                  statusBg = '#e5e7eb';
                } else if (claim.status === 'Rejected' || claim.status === 'Disputed') {
                  statusColor = '#991b1b';
                  statusBg = '#fee2e2';
                }

                return (
                  <tr key={claim.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {claim.equipment?.equipment_name || '-'}
                    </td>
                    <td>{claim.vendor_name}</td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
                      {claim.claim_reference_number || '-'}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        background: statusBg,
                        color: statusColor
                      }}>
                        {claim.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem' }}>
                      <div>Parts: {claim.parts_covered ? 'Yes' : 'No'}</div>
                      <div>Labor: {claim.labor_covered ? 'Yes' : 'No'}</div>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {claim.date_escalated ? (
                        <>
                          <div>Sent: {fmtD(claim.date_escalated)}</div>
                          <div>End: {fmtD(claim.escalated_warranty_end)}</div>
                        </>
                      ) : (
                        'Not Sent Yet'
                      )}
                    </td>
                    {['Project Manager', 'Admin'].includes(userRole) && (
                      <>
                        <td style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'left' }}>{claim.vendor_claimed_cost ? fmt(claim.vendor_claimed_cost) : '-'}</td>
                        <td style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'left' }}>{claim.vendor_approved_cost ? fmt(claim.vendor_approved_cost) : '-'}</td>
                        <td style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'left' }}>{claim.internal_cost_incurred ? fmt(claim.internal_cost_incurred) : '-'}</td>
                      </>
                    )}
                    <td>
                      {claim.resolution_method && claim.resolution_method !== 'N/A' ? (
                        <div>
                          <div style={{ fontWeight: 500 }}>{claim.resolution_method}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{fmtD(claim.resolution_date)}</div>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                        <Button variant="default" size="sm" onClick={() => {
                            setClaimFormData({
                              id: claim.id,
                              snag_id: claim.snag_id || '',
                              equipment_id: claim.equipment_id || '',
                              vendor_name: claim.vendor_name || '',
                              claim_reference_number: claim.claim_reference_number || '',
                              status: claim.status || 'Draft',
                              vendor_dispute_reason: claim.vendor_dispute_reason || '',
                              parts_covered: claim.parts_covered ?? true,
                              labor_covered: claim.labor_covered ?? false,
                              vendor_claimed_cost: claim.vendor_claimed_cost?.toString() || '',
                              vendor_approved_cost: claim.vendor_approved_cost?.toString() || '',
                              internal_cost_incurred: claim.internal_cost_incurred?.toString() || '',
                              resolution_method: claim.resolution_method || 'N/A',
                              resolution_date: claim.resolution_date || ''
                            });
                            setIsClaimModalOpen(true);
                          }}
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.5rem',
                            background: '#f3f4f6',
                            border: '1px solid #d1d5db',
                            cursor: 'pointer'
                          }}
                        >
                          Edit
                        </Button>
                        <Button variant="default" size="sm" onClick={() => {
                            setNotifyingClaim(claim);
                            setNotifyEmail(claim.vendor_email || '');
                            setNotifySlaDays(7);
                          }}
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.5rem',
                            background: '#fef3c7',
                            color: '#b45309',
                            border: '1px solid #fcd34d',
                            cursor: 'pointer'
                          }}
                        >
                          {claim.vendor_notified_at ? 'Re-send Letter' : 'Send Claim Letter'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Local Add Drawing Modal */}
      {isAddingDrawing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '400px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#1e293b' }}>Add Layout Drawing</h3>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Drawing Name *</label>
              <input 
                type="text" 
                required
                placeholder="e.g. Ground Floor Piping"
                className="pl-input"
                value={newDrawingName}
                onChange={e => setNewDrawingName(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Drawing Image URL *</label>
              <input 
                type="text" 
                required
                placeholder="e.g. https://example.com/drawing.jpg"
                className="pl-input"
                value={newDrawingUrl}
                onChange={e => setNewDrawingUrl(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <Button variant="default" size="sm" onClick={() => setIsAddingDrawing(false)} style={{ background: '#fff', border: '1px solid #cbd5e1' }}>
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={async () => {
                  if (!newDrawingName || !newDrawingUrl) return;
                  try {
                    if (!selectedProject?.id || !organisation?.id) return;
                    const { error } = await supabase
                      .from('project_drawings')
                      .insert([{
                        organisation_id: organisation.id,
                        project_id: selectedProject.id,
                        name: newDrawingName,
                        file_url: newDrawingUrl
                      }]);
                    if (error) throw error;
                    setNewDrawingName('');
                    setNewDrawingUrl('');
                    setIsAddingDrawing(false);
                    refetchDrawings();
                    alert('Layout drawing added successfully');
                  } catch (err: any) {
                    alert('Error: ' + err.message);
                  }
                }}
              >
                Add Layout
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Local Send Claim Letter Notification Modal */}
      {notifyingClaim && (() => {
        const matchingEquipment = projectEquipment.find((e: any) => e.id === notifyingClaim.equipment_id);
        const matchingSnag = projectSnags.find((s: any) => s.id === notifyingClaim.snag_id);

        const letterBody = `Dear ${notifyingClaim.vendor_name || 'Vendor'},\n\n` +
          `This is a formal warranty claim escalation for the following equipment:\n` +
          `- Equipment Name: ${matchingEquipment?.equipment_name || 'N/A'}\n` +
          `- Make/Model: ${matchingEquipment?.make_model || 'N/A'}\n` +
          `- Serial Number: ${matchingEquipment?.serial_number || 'N/A'}\n\n` +
          `Reported Issue:\n` +
          `"${matchingSnag?.description || 'N/A'}"\n\n` +
          `Please provide a resolution plan within ${notifySlaDays} days as per the service level agreement.\n\n` +
          `Regards,\n` +
          `MEP Operations Team`;

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
            <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '500px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#1e293b' }}>Send Warranty Claim Letter</h3>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Vendor Notification Email *</label>
                <input 
                  type="email" 
                  placeholder="e.g. support@vendor.com"
                  className="pl-input"
                  value={notifyEmail}
                  onChange={e => setNotifyEmail(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Resolution SLA Days</label>
                <input 
                  type="number" 
                  min={1}
                  className="pl-input"
                  value={notifySlaDays}
                  onChange={e => setNotifySlaDays(parseInt(e.target.value) || 7)}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Letter Preview</label>
                <textarea 
                  readOnly
                  rows={8}
                  className="pl-input"
                  style={{ width: '100%', fontReplacements: 'monospace', fontSize: '0.75rem', background: '#f8fafc', cursor: 'default' }}
                  value={letterBody}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <Button variant="default" size="sm" onClick={() => setNotifyingClaim(null)} style={{ background: '#fff', border: '1px solid #cbd5e1' }} disabled={sendingLetter}>
                  Cancel
                </Button>
                <Button variant="default" size="sm" disabled={!notifyEmail || sendingLetter} onClick={async () => {
                    try {
                      setSendingLetter(true);
                      // Trigger email logic or save to DB
                      const { error } = await supabase
                        .from('warranty_claims')
                        .update({
                          vendor_email: notifyEmail,
                          vendor_notified_at: new Date().toISOString(),
                          sla_resolution_days: notifySlaDays,
                          status: notifyingClaim.status === 'Draft' ? 'Pending Response' : notifyingClaim.status
                        })
                        .eq('id', notifyingClaim.id);

                      if (error) throw error;
                      alert('Warranty claim letter sent successfully to ' + notifyEmail);
                      setNotifyingClaim(null);
                      refetchClaims();
                    } catch (err: any) {
                      alert('Error: ' + err.message);
                    } finally {
                      setSendingLetter(false);
                    }
                  }}
                >
                  {sendingLetter ? 'Sending...' : 'Send Email Letter'}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
