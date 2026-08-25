import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, Building2, User, Truck, HardHat } from 'lucide-react';
import { PartyRole, PartySearchResult } from '@/types/party';
import { usePartySearch } from '@/api/party';
import { CreatePartyModal } from './CreatePartyModal';

interface SmartPartyDropdownProps {
  value: string;
  onChange: (party: PartySearchResult) => void;
  organisationId: string;
  defaultRole?: PartyRole;
  placeholder?: string;
  disabled?: boolean;
}

export function SmartPartyDropdown({
  value,
  onChange,
  organisationId,
  defaultRole = 'customer',
  placeholder = 'Search client, vendor, or subcontractor...',
  disabled = false,
}: SmartPartyDropdownProps) {
  const [searchTerm, setSearchTerm] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: searchResults = [], isLoading } = usePartySearch(organisationId, searchTerm);

  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (party: PartySearchResult) => {
    onChange(party);
    setSearchTerm(party.party_name);
    setIsOpen(false);
  };

  const renderRoleBadge = (role: PartyRole) => {
    switch (role) {
      case 'customer':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>
            <User size={10} /> Client
          </span>
        );
      case 'vendor':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>
            <Truck size={10} /> Vendor
          </span>
        );
      case 'subcontractor':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#f3e8ff', color: '#6b21a8', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>
            <HardHat size={10} /> Subcontractor
          </span>
        );
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          value={searchTerm}
          disabled={disabled}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          style={{
            width: '100%',
            padding: '8px 12px 8px 32px',
            fontSize: '12px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: disabled ? '#f8fafc' : 'white',
            outline: 'none'
          }}
        />
        <Search size={14} style={{ position: 'absolute', left: '10px', color: '#94a3b8', pointerEvents: 'none' }} />
      </div>

      {isOpen && !disabled && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          zIndex: 100,
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
          maxHeight: '260px',
          overflowY: 'auto'
        }}>
          {isLoading && (
            <div style={{ padding: '10px 12px', fontSize: '12px', color: '#64748b' }}>
              Searching parties...
            </div>
          )}

          {!isLoading && searchResults.length > 0 && (
            <div>
              {searchResults.map((party) => (
                <div
                  key={party.party_id}
                  onClick={() => handleSelect(party)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    transition: 'background 0.1s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                      {party.party_name}
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {party.roles.map((r) => renderRoleBadge(r))}
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', gap: '12px' }}>
                    {party.gstin && <span>GST: {party.gstin}</span>}
                    {party.state && <span>{party.state}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && searchResults.length === 0 && searchTerm.trim().length >= 1 && (
            <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
              No existing party matched "{searchTerm}".
            </div>
          )}

          {/* Action to create new party explicitly */}
          <div
            onClick={() => {
              setIsOpen(false);
              setIsModalOpen(true);
            }}
            style={{
              padding: '10px 12px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#2563eb',
              fontSize: '12px',
              fontWeight: 600
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#f8fafc')}
          >
            <Plus size={14} />
            <span>Create New Party</span>
          </div>
        </div>
      )}

      {/* Modal for creating a new party */}
      <CreatePartyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        organisationId={organisationId}
        initialName={searchTerm}
        onPartyCreated={(partyId, partyName, selectedRole) => {
          handleSelect({
            party_id: partyId,
            organisation_id: organisationId,
            party_name: partyName,
            roles: [selectedRole]
          });
        }}
      />
    </div>
  );
}
