import React, { useState } from 'react';
import { X, Building2, CheckSquare, Square } from 'lucide-react';
import { PartyRole, CreatePartyInput } from '@/types/party';
import { useCreateParty } from '@/api/party';

interface CreatePartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  organisationId: string;
  initialName?: string;
  onPartyCreated: (partyId: string, partyName: string, selectedRole: PartyRole) => void;
}

export function CreatePartyModal({
  isOpen,
  onClose,
  organisationId,
  initialName = '',
  onPartyCreated,
}: CreatePartyModalProps) {
  const [name, setName] = useState(initialName);
  const [gstin, setGstin] = useState('');
  const [state, setState] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [address, setAddress] = useState('');
  const [roles, setRoles] = useState<PartyRole[]>(['customer']);
  const [errorMsg, setErrorMsg] = useState('');

  const createPartyMutation = useCreateParty();

  if (!isOpen) return null;

  const toggleRole = (role: PartyRole) => {
    if (roles.includes(role)) {
      if (roles.length === 1) {
        setErrorMsg('At least one role must be selected.');
        return;
      }
      setRoles(roles.filter((r) => r !== role));
    } else {
      setErrorMsg('');
      setRoles([...roles, role]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Party Name is required.');
      return;
    }
    if (roles.length === 0) {
      setErrorMsg('At least one role must be selected.');
      return;
    }

    try {
      const input: CreatePartyInput = {
        organisation_id: organisationId,
        name: name.trim(),
        roles,
        gstin: gstin.trim() || undefined,
        state: state.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        contact_person: contactPerson.trim() || undefined,
        address: address.trim() || undefined,
      };

      const newParty = await createPartyMutation.mutateAsync(input);
      onPartyCreated(newParty.id, newParty.name, roles[0]);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create party.');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      background: 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '520px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={20} style={{ color: '#2563eb' }} />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
              Create New Business Party
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {errorMsg && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}>
              {errorMsg}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Party Legal Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Acme Engineering Pvt Ltd"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
            />
          </div>

          {/* Roles Checkboxes */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Business Roles (Select all that apply) *
            </label>
            <div style={{ display: 'flex', gap: '16px' }}>
              {(['customer', 'vendor', 'subcontractor'] as PartyRole[]).map((r) => {
                const isSelected = roles.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRole(r)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: isSelected ? '#eff6ff' : '#f8fafc',
                      border: `1px solid ${isSelected ? '#3b82f6' : '#cbd5e1'}`,
                      color: isSelected ? '#1e40af' : '#475569',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500
                    }}
                  >
                    {isSelected ? <CheckSquare size={14} style={{ color: '#2563eb' }} /> : <Square size={14} />}
                    <span style={{ textTransform: 'capitalize' }}>{r}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                GSTIN
              </label>
              <input
                type="text"
                placeholder="27AAAAA0000A1Z5"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                State
              </label>
              <input
                type="text"
                placeholder="Maharashtra"
                value={state}
                onChange={(e) => setState(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Email
              </label>
              <input
                type="email"
                placeholder="accounts@acme.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Phone
              </label>
              <input
                type="tel"
                placeholder="+91 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'white',
                border: '1px solid #cbd5e1',
                color: '#475569',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createPartyMutation.isPending}
              style={{
                background: '#2563eb',
                border: 'none',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: createPartyMutation.isPending ? 0.7 : 1
              }}
            >
              {createPartyMutation.isPending ? 'Saving...' : 'Create Party'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
