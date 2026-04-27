import { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { supabase } from '../supabase';

interface AddTeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  organisationId: string;
  onSuccess: () => void;
}

export function AddTeamMemberModal({ isOpen, onClose, organisationId, onSuccess }: AddTeamMemberModalProps) {
  const [formData, setFormData] = useState({
    emp_name: '',
    email: '',
    role: 'Assistant',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.emp_name || !formData.email) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    const empId = 'EMP-' + Date.now().toString().slice(-6);

    try {
      const { error } = await supabase.from('users').insert({
        ...formData,
        emp_id: empId,
        organisation_id: organisationId
      });

      if (error) throw error;

      setFormData({ emp_name: '', email: '', role: 'Assistant' });
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to add user:', error);
      alert('Failed to add user: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      backdropFilter: 'blur(2px)'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '460px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #e5e5e5',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: '#f5f5f5', padding: '6px', borderRadius: '6px' }}>
              <UserPlus size={16} color="#525252" />
            </div>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#171717',
              margin: 0,
            }}>
              Add Team Member
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              border: 'none',
              background: 'transparent',
              color: '#525252',
              cursor: 'pointer',
              borderRadius: '4px',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#525252',
              }}>
                Employee Name *
              </label>
              <input
                type="text"
                value={formData.emp_name}
                onChange={(e) => setFormData({ ...formData, emp_name: e.target.value })}
                placeholder="John Doe"
                required
                style={{
                  padding: '10px 12px',
                  border: '1px solid #d4d4d4',
                  borderRadius: '4px',
                  fontSize: '14px',
                  color: '#171717',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#171717'}
                onBlur={(e) => e.target.style.borderColor = '#d4d4d4'}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#525252',
              }}>
                Email Address *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                required
                style={{
                  padding: '10px 12px',
                  border: '1px solid #d4d4d4',
                  borderRadius: '4px',
                  fontSize: '14px',
                  color: '#171717',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#171717'}
                onBlur={(e) => e.target.style.borderColor = '#d4d4d4'}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#525252',
              }}>
                Role *
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d4d4d4',
                    borderRadius: '4px',
                    fontSize: '14px',
                    color: '#171717',
                    appearance: 'none',
                    background: '#fff',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#171717'}
                  onBlur={(e) => e.target.style.borderColor = '#d4d4d4'}
                >
                  <option value="Admin">Admin</option>
                  <option value="Engineer">Engineer</option>
                  <option value="Manager">Manager</option>
                  <option value="Assistant">Assistant</option>
                  <option value="Stores">Stores</option>
                  <option value="Site Engineer">Site Engineer</option>
                </select>
                <div style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none'
                }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="#525252" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '32px',
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px 16px',
                border: '1px solid #d4d4d4',
                borderRadius: '4px',
                background: '#fff',
                color: '#525252',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; e.currentTarget.style.color = '#171717'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#525252'; }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                flex: 1,
                padding: '10px 16px',
                border: 'none',
                borderRadius: '4px',
                background: '#171717',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 500,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => !isSubmitting && (e.currentTarget.style.background = '#262626')}
              onMouseLeave={(e) => e.currentTarget.style.background = '#171717'}
            >
              {isSubmitting ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
