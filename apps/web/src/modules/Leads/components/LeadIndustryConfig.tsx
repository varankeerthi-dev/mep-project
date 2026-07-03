import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useLeadIndustries, useCreateLeadIndustry, useDeleteLeadIndustry } from '../../../hooks/use-leads';
import { Plus, Trash2 } from 'lucide-react';

export const LeadIndustryConfig: React.FC = () => {
  const { data: industries = [], isLoading } = useLeadIndustries();
  const createIndustry = useCreateLeadIndustry();
  const deleteIndustry = useDeleteLeadIndustry();
  const [newName, setNewName] = useState('');

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await createIndustry.mutateAsync({
        name: newName.trim(),
        sort_order: industries.length + 1,
      });
      setNewName('');
    } catch (err) {
      console.error('Failed to create industry:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this industry?')) return;
    try {
      await deleteIndustry.mutateAsync(id);
    } catch (err) {
      console.error('Failed to delete industry:', err);
    }
  };

  if (isLoading) return <div style={{ fontSize: '13px', color: '#9ca3af' }}>Loading...</div>;

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#18181b', margin: '0 0 4px' }}>Lead Industries</h3>
        <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>Configure the industry picklist for leads.</p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Industry Name</div>
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="New industry name"
            style={{
              padding: '6px 8px',
              fontSize: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              width: '260px',
            }}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          />
        </div>
        <button
          onClick={handleAdd}
          style={{
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 600,
            background: '#185FA5',
            border: '1px solid #185FA5',
            color: '#fff',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Plus size={13} />
          Add Industry
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '400px', overflow: 'auto' }}>
        {industries.map(ind => (
          <div
            key={ind.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#18181b' }}>{ind.name}</span>
            <button
              onClick={() => handleDelete(ind.id)}
              style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280' }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
