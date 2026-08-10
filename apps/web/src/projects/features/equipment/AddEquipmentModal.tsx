import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../../supabase';
import { Button } from '@/components/ui/button';

interface AddEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  organisationId: string;
  refetchEquipment: () => void;
}

export function AddEquipmentModal({
  isOpen,
  onClose,
  projectId,
  organisationId,
  refetchEquipment,
}: AddEquipmentModalProps) {
  const [eqFormData, setEqFormData] = useState({
    equipment_name: '',
    make_model: '',
    serial_number: '',
    supplier: '',
    quantity: 1,
    warranty_start_date: new Date().toISOString().split('T')[0],
    warranty_duration_months: 12
  });

  const [submitting, setSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setEqFormData({
        equipment_name: '',
        make_model: '',
        serial_number: '',
        supplier: '',
        quantity: 1,
        warranty_start_date: new Date().toISOString().split('T')[0],
        warranty_duration_months: 12
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleEqSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (!projectId || !organisationId) return;
      
      const { error } = await supabase
        .from('project_equipment')
        .insert([{
          project_id: projectId,
          organisation_id: organisationId,
          equipment_name: eqFormData.equipment_name,
          make_model: eqFormData.make_model || null,
          serial_number: eqFormData.serial_number || null,
          supplier: eqFormData.supplier || null,
          quantity: Number(eqFormData.quantity) || 1,
          warranty_start_date: eqFormData.warranty_start_date,
          warranty_duration_months: Number(eqFormData.warranty_duration_months) || 12,
        }]);

      if (error) throw error;
      
      refetchEquipment();
      alert('Equipment added successfully');
      onClose();
    } catch (err: any) {
      alert('Error adding equipment: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '550px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#1e293b' }}>Add Equipment to Project</h3>
          <Button variant="ghost" size="default" onClick={onClose} disabled={submitting}>
            <X size={20} />
          </Button>
        </div>
        <form onSubmit={handleEqSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Equipment Name *</label>
              <input
                type="text"
                required
                className="pl-input"
                value={eqFormData.equipment_name}
                onChange={e => setEqFormData(prev => ({ ...prev, equipment_name: e.target.value }))}
                style={{ width: '100%' }}
                disabled={submitting}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Make / Model</label>
                <input
                  type="text"
                  className="pl-input"
                  value={eqFormData.make_model}
                  onChange={e => setEqFormData(prev => ({ ...prev, make_model: e.target.value }))}
                  style={{ width: '100%' }}
                  disabled={submitting}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Serial Number</label>
                <input
                  type="text"
                  className="pl-input"
                  value={eqFormData.serial_number}
                  onChange={e => setEqFormData(prev => ({ ...prev, serial_number: e.target.value }))}
                  style={{ width: '100%' }}
                  disabled={submitting}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Supplier (Vendor)</label>
                <input
                  type="text"
                  className="pl-input"
                  value={eqFormData.supplier}
                  onChange={e => setEqFormData(prev => ({ ...prev, supplier: e.target.value }))}
                  style={{ width: '100%' }}
                  disabled={submitting}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Quantity</label>
                <input
                  type="number"
                  min="1"
                  className="pl-input"
                  value={eqFormData.quantity}
                  onChange={e => setEqFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  style={{ width: '100%' }}
                  disabled={submitting}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Warranty Start Date *</label>
                <input
                  type="date"
                  required
                  className="pl-input"
                  value={eqFormData.warranty_start_date}
                  onChange={e => setEqFormData(prev => ({ ...prev, warranty_start_date: e.target.value }))}
                  style={{ width: '100%' }}
                  disabled={submitting}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Warranty Duration (Months)</label>
                <input
                  type="number"
                  min="1"
                  className="pl-input"
                  value={eqFormData.warranty_duration_months}
                  onChange={e => setEqFormData(prev => ({ ...prev, warranty_duration_months: parseInt(e.target.value) || 12 }))}
                  style={{ width: '100%' }}
                  disabled={submitting}
                />
              </div>
            </div>
          </div>
          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
            <Button variant="outline" size="default" type="button" onClick={onClose} style={{ background: '#fff', border: '1px solid #cbd5e1' }} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="default" size="default" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Equipment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
