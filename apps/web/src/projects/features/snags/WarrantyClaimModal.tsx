import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../../supabase';
import { Button } from '@/components/ui/button';

interface WarrantyClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  organisationId: string;
  projectEquipment: any[];
  userRole: string;
  refetchClaims: () => void;
  initialData?: {
    id?: string;
    snag_id?: string;
    equipment_id?: string;
    vendor_name?: string;
    claim_reference_number?: string;
    status?: string;
    vendor_dispute_reason?: string;
    parts_covered?: boolean;
    labor_covered?: boolean;
    vendor_claimed_cost?: string | number;
    vendor_approved_cost?: string | number;
    internal_cost_incurred?: string | number;
    resolution_method?: string;
    resolution_date?: string;
  };
}

const emptyClaimForm = {
  id: '',
  snag_id: '',
  equipment_id: '',
  vendor_name: '',
  claim_reference_number: '',
  status: 'Draft',
  vendor_dispute_reason: '',
  parts_covered: true,
  labor_covered: false,
  vendor_claimed_cost: '' as string | number,
  vendor_approved_cost: '' as string | number,
  internal_cost_incurred: '' as string | number,
  resolution_method: 'N/A',
  resolution_date: ''
};

export function WarrantyClaimModal({
  isOpen,
  onClose,
  organisationId,
  projectEquipment,
  userRole,
  refetchClaims,
  initialData,
}: WarrantyClaimModalProps) {
  const [claimFormData, setClaimFormData] = useState({ ...emptyClaimForm });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setClaimFormData({
          id: initialData.id || '',
          snag_id: initialData.snag_id || '',
          equipment_id: initialData.equipment_id || '',
          vendor_name: initialData.vendor_name || '',
          claim_reference_number: initialData.claim_reference_number || '',
          status: initialData.status || 'Draft',
          vendor_dispute_reason: initialData.vendor_dispute_reason || '',
          parts_covered: initialData.parts_covered !== undefined ? initialData.parts_covered : true,
          labor_covered: initialData.labor_covered || false,
          vendor_claimed_cost: initialData.vendor_claimed_cost !== undefined ? initialData.vendor_claimed_cost : '',
          vendor_approved_cost: initialData.vendor_approved_cost !== undefined ? initialData.vendor_approved_cost : '',
          internal_cost_incurred: initialData.internal_cost_incurred !== undefined ? initialData.internal_cost_incurred : '',
          resolution_method: initialData.resolution_method || 'N/A',
          resolution_date: initialData.resolution_date || ''
        });
      } else {
        setClaimFormData({ ...emptyClaimForm });
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const isPrivileged = ['Project Manager', 'Admin'].includes(userRole);

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (!organisationId) return;

      const claimData: any = {
        organisation_id: organisationId,
        snag_id: claimFormData.snag_id,
        equipment_id: claimFormData.equipment_id,
        vendor_name: claimFormData.vendor_name,
        claim_reference_number: claimFormData.claim_reference_number || null,
        status: claimFormData.status,
        vendor_dispute_reason: claimFormData.vendor_dispute_reason || null,
        parts_covered: claimFormData.parts_covered,
        labor_covered: claimFormData.labor_covered,
        resolution_method: claimFormData.resolution_method,
        resolution_date: claimFormData.resolution_date || null
      };

      // Gated cost inputs (PM/Admin only)
      if (isPrivileged) {
        claimData.vendor_claimed_cost = claimFormData.vendor_claimed_cost ? Number(claimFormData.vendor_claimed_cost) : null;
        claimData.vendor_approved_cost = claimFormData.vendor_approved_cost ? Number(claimFormData.vendor_approved_cost) : null;
        claimData.internal_cost_incurred = claimFormData.internal_cost_incurred ? Number(claimFormData.internal_cost_incurred) : null;
      }

      // Date Snapshotting: on transitioning to Pending Response, capture equipment warranty dates
      if (claimFormData.status === 'Pending Response') {
        const matchingEquipment = projectEquipment.find((e: any) => e.id === claimFormData.equipment_id);
        if (matchingEquipment) {
          claimData.date_escalated = new Date().toISOString().split('T')[0];
          claimData.escalated_warranty_start = matchingEquipment.warranty_start_date;
          claimData.escalated_warranty_end = matchingEquipment.warranty_end_date;
        }
      }

      let error;
      if (claimFormData.id) {
        const { error: editErr } = await supabase
          .from('warranty_claims')
          .update(claimData)
          .eq('id', claimFormData.id);
        error = editErr;
      } else {
        const { error: createErr } = await supabase
          .from('warranty_claims')
          .insert([claimData]);
        error = createErr;
      }

      if (error) throw error;

      refetchClaims();
      alert('Warranty claim saved successfully');
      onClose();
    } catch (err: any) {
      alert('Error saving warranty claim: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#1e293b' }}>
            {claimFormData.id ? 'Edit Warranty Claim' : 'Escalate to Warranty Claim'}
          </h3>
          <Button variant="default" size="icon-xs" onClick={onClose} disabled={submitting}>
            <X size={20} />
          </Button>
        </div>
        <form onSubmit={handleClaimSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Vendor / Supplier Name *</label>
                <input
                  type="text"
                  required
                  className="pl-input"
                  value={claimFormData.vendor_name}
                  onChange={e => setClaimFormData(prev => ({ ...prev, vendor_name: e.target.value }))}
                  style={{ width: '100%' }}
                  disabled={submitting}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Claim Reference / RMA Number</label>
                <input
                  type="text"
                  className="pl-input"
                  placeholder="RMA-12345"
                  value={claimFormData.claim_reference_number}
                  onChange={e => setClaimFormData(prev => ({ ...prev, claim_reference_number: e.target.value }))}
                  style={{ width: '100%' }}
                  disabled={submitting}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Status</label>
                <select
                  className="pl-input"
                  value={claimFormData.status}
                  onChange={e => setClaimFormData(prev => ({ ...prev, status: e.target.value }))}
                  style={{ width: '100%' }}
                  disabled={submitting}
                >
                  <option value="Draft">Draft</option>
                  <option value="Pending Response">Pending Response</option>
                  <option value="Acknowledged">Acknowledged</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Partially Accepted">Partially Accepted</option>
                  <option value="Disputed">Disputed</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', height: '100%', paddingTop: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, color: '#334155' }}>
                  <input
                    type="checkbox"
                    checked={claimFormData.parts_covered}
                    onChange={e => setClaimFormData(prev => ({ ...prev, parts_covered: e.target.checked }))}
                    style={{ width: '16px', height: '16px' }}
                    disabled={submitting}
                  />
                  Parts Covered
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, color: '#334155' }}>
                  <input
                    type="checkbox"
                    checked={claimFormData.labor_covered}
                    onChange={e => setClaimFormData(prev => ({ ...prev, labor_covered: e.target.checked }))}
                    style={{ width: '16px', height: '16px' }}
                    disabled={submitting}
                  />
                  Labor Covered
                </label>
              </div>
            </div>

            {claimFormData.status === 'Disputed' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Vendor Dispute Reason</label>
                <textarea
                  className="pl-input"
                  value={claimFormData.vendor_dispute_reason}
                  onChange={e => setClaimFormData(prev => ({ ...prev, vendor_dispute_reason: e.target.value }))}
                  style={{ width: '100%', height: '60px', padding: '0.5rem' }}
                  disabled={submitting}
                />
              </div>
            )}

            {/* Gated Procurement Costs — PM/Admin only */}
            {isPrivileged && (
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Procurement & Financial details (Gated View)</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#475569', marginBottom: '0.25rem' }}>Claimed Cost</label>
                    <input
                      type="number"
                      step="0.01"
                      className="pl-input"
                      value={claimFormData.vendor_claimed_cost}
                      onChange={e => setClaimFormData(prev => ({ ...prev, vendor_claimed_cost: e.target.value }))}
                      style={{ width: '100%' }}
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#475569', marginBottom: '0.25rem' }}>Approved Cost</label>
                    <input
                      type="number"
                      step="0.01"
                      className="pl-input"
                      value={claimFormData.vendor_approved_cost}
                      onChange={e => setClaimFormData(prev => ({ ...prev, vendor_approved_cost: e.target.value }))}
                      style={{ width: '100%' }}
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#475569', marginBottom: '0.25rem' }}>Internal Cost Incurred</label>
                    <input
                      type="number"
                      step="0.01"
                      className="pl-input"
                      value={claimFormData.internal_cost_incurred}
                      onChange={e => setClaimFormData(prev => ({ ...prev, internal_cost_incurred: e.target.value }))}
                      style={{ width: '100%' }}
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Resolution Method</label>
                <select
                  className="pl-input"
                  value={claimFormData.resolution_method}
                  onChange={e => setClaimFormData(prev => ({ ...prev, resolution_method: e.target.value }))}
                  style={{ width: '100%' }}
                  disabled={submitting}
                >
                  <option value="N/A">N/A - Not Resolved</option>
                  <option value="Replaced">Replaced</option>
                  <option value="Repaired">Repaired</option>
                  <option value="Credited">Credited</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Resolution Date</label>
                <input
                  type="date"
                  className="pl-input"
                  value={claimFormData.resolution_date}
                  onChange={e => setClaimFormData(prev => ({ ...prev, resolution_date: e.target.value }))}
                  style={{ width: '100%' }}
                  disabled={submitting}
                />
              </div>
            </div>
          </div>
          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
            <Button variant="outline" size="sm" type="button" onClick={onClose} style={{ background: '#fff', border: '1px solid #cbd5e1' }} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="default" size="icon-xs" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Claim Details'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
