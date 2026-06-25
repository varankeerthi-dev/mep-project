import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useLeadStatuses, useCreateLeadStatus, useUpdateLeadStatus, useDeleteLeadStatus } from '../../../hooks/use-leads';
import { Plus, Trash2, Edit2 } from 'lucide-react';

export const LeadStatusConfig: React.FC = () => {
  const { data: statuses = [], isLoading } = useLeadStatuses();
  const createStatus = useCreateLeadStatus();
  const updateStatus = useUpdateLeadStatus();
  const deleteStatus = useDeleteLeadStatus();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6B7280');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await createStatus.mutateAsync({
        name: newName.trim(),
        color: newColor,
        sort_order: statuses.length + 1,
        category: 'open',
      });
      setNewName('');
    } catch (err) {
      console.error('Failed to create status:', err);
    }
  };

  const handleEdit = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await updateStatus.mutateAsync({ id, patch: { name: editName.trim(), color: editColor } });
      setEditingId(null);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this status? Leads with this status will have no status.')) return;
    try {
      await deleteStatus.mutateAsync(id);
    } catch (err) {
      console.error('Failed to delete status:', err);
    }
  };

  if (isLoading) return <div style={{ fontSize: '13px', color: '#9ca3af' }}>Loading...</div>;

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#18181b', margin: '0 0 4px' }}>Lead Statuses</h3>
        <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>Configure the statuses available for leads in this organisation.</p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Status Name</div>
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="New status name"
            style={{
              padding: '6px 8px',
              fontSize: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              width: '200px',
            }}
          />
        </div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Color</div>
          <input
            type="color"
            value={newColor}
            onChange={e => setNewColor(e.target.value)}
            style={{ width: '36px', height: '32px', padding: '2px', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
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
          Add Status
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {statuses.map(status => (
          <div
            key={status.id}
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
            {editingId === status.id ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1 }}>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', width: '200px' }}
                />
                <input
                  type="color"
                  value={editColor}
                  onChange={e => setEditColor(e.target.value)}
                  style={{ width: '32px', height: '28px', padding: '2px', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                />
                <button onClick={() => handleEdit(status.id)} style={{ padding: '4px 10px', fontSize: '11px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save</button>
                <button onClick={() => setEditingId(null)} style={{ padding: '4px 10px', fontSize: '11px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: status.color }} />
                  <span style={{ fontSize: '12px', fontWeight: 500, color: '#18181b' }}>{status.name}</span>
                  <span style={{
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: status.is_default ? '#dbeafe' : '#f3f4f6',
                    color: status.is_default ? '#1e40af' : '#6b7280',
                  }}>
                    {status.category}
                    {status.is_default ? ' (default)' : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => { setEditingId(status.id); setEditName(status.name); setEditColor(status.color); }}
                    style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280' }}
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(status.id)}
                    style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
