import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useLeadAssignmentRule, useUpsertLeadAssignmentRule } from '../../../hooks/use-leads';
import { Save } from 'lucide-react';

export const LeadAssignmentConfig: React.FC = () => {
  const { data: rule, isLoading } = useLeadAssignmentRule();
  const upsertRule = useUpsertLeadAssignmentRule();
  const [method, setMethod] = useState<'round_robin' | 'manual'>('manual');
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (rule) {
      setMethod(rule.method);
      setIsActive(rule.is_active);
    }
  }, [rule]);

  const handleSave = async () => {
    try {
      await upsertRule.mutateAsync({
        organisation_id: '',
        method,
        user_ids: [],
        is_active: isActive,
        last_assigned_index: rule?.last_assigned_index || 0,
      });
    } catch (err) {
      console.error('Failed to save assignment rule:', err);
    }
  };

  if (isLoading) return <div style={{ fontSize: '13px', color: '#9ca3af' }}>Loading...</div>;

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#18181b', margin: '0 0 4px' }}>Lead Assignment Rules</h3>
        <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>
          Configure how new leads are automatically assigned to team members.
        </p>
      </div>

      <div style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '20px',
        maxWidth: '480px',
      }}>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Assignment Method</div>
          <select
            value={method}
            onChange={e => setMethod(e.target.value as 'round_robin' | 'manual')}
            style={{
              padding: '6px 8px',
              fontSize: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              width: '100%',
            }}
          >
            <option value="manual">Manual — no auto-assignment</option>
            <option value="round_robin">Round Robin — auto-assign to users in sequence</option>
          </select>
        </div>

        {method === 'round_robin' && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              padding: '8px 12px',
              background: '#f0f7ff',
              border: '1px solid #bfdbfe',
              borderRadius: '6px',
              fontSize: '11px',
              color: '#1e40af',
            }}>
              Round-robin assignment will be applied when creating leads. Configure assignment users in the team settings.
            </div>
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontSize: '12px', color: '#374151' }}>Enable auto-assignment</span>
          </label>
        </div>

        <button
          onClick={handleSave}
          disabled={upsertRule.isPending}
          style={{
            padding: '7px 16px',
            fontSize: '12px',
            fontWeight: 600,
            background: '#185FA5',
            border: '1px solid #185FA5',
            color: '#fff',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            opacity: upsertRule.isPending ? 0.6 : 1,
          }}
        >
          <Save size={13} />
          {upsertRule.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};
