import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { usePettyCashFloats, useCreatePettyCashFloat, useTopUpFloat, useOrgEmployees, useProjects } from '../hooks/useAdvanceExpense';
import type { PettyCashFloat } from '../types';

const FLOAT_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: 'Active', color: '#10B981', bg: '#D1FAE5' },
  FROZEN: { label: 'Frozen', color: '#F59E0B', bg: '#FEF3C7' },
  CLOSED: { label: 'Closed', color: '#6B7280', bg: '#F3F4F6' },
};

const TABLE_HEADER: React.CSSProperties = {
  padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#71717a',
  textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left',
  borderBottom: '1px solid #e4e4e7', background: '#fafafa',
};

const CELL: React.CSSProperties = {
  padding: '10px 12px', fontSize: '12px', color: '#18181b', borderBottom: '1px solid #f0f0f0',
};

export const PettyCashManagement: React.FC = () => {
  const { organisation } = useAuth();
  const orgId = organisation?.id;
  const { data: floats = [], isLoading } = usePettyCashFloats(orgId);
  const createMutation = useCreatePettyCashFloat();
  const topUpMutation = useTopUpFloat();
  const { data: employees = [] } = useOrgEmployees(orgId);
  const { data: projects = [] } = useProjects(orgId);

  const [showCreate, setShowCreate] = useState(false);
  const [holderId, setHolderId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [floatAmount, setFloatAmount] = useState(0);
  const [topUpId, setTopUpId] = useState<string | null>(null);
  const [topUpAmount, setTopUpAmount] = useState(0);

  const handleCreate = async () => {
    if (!holderId || !floatAmount || floatAmount <= 0) return;
    await createMutation.mutateAsync({ holder_id: holderId, project_id: projectId, float_amount: floatAmount });
    setShowCreate(false);
    setHolderId('');
    setProjectId('');
    setFloatAmount(0);
  };

  const handleTopUp = async () => {
    if (!topUpId || !topUpAmount || topUpAmount <= 0) return;
    await topUpMutation.mutateAsync({ float_id: topUpId, amount: topUpAmount });
    setTopUpId(null);
    setTopUpAmount(0);
  };

  const getBalanceColor = (balance: number, total: number) => {
    const pct = total > 0 ? balance / total : 0;
    if (pct > 0.25) return '#10B981';
    if (pct > 0) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div style={{ padding: '16px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button onClick={() => setShowCreate(!showCreate)} style={{
          padding: '8px 16px', fontSize: '12px', fontWeight: 600,
          color: '#fff', background: '#185FA5', border: '1px solid #185FA5',
          borderRadius: '6px', cursor: 'pointer',
        }}>
          {showCreate ? 'Cancel' : '+ New Float'}
        </button>
      </div>

      {showCreate && (
        <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: '8px', padding: '16px 20px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#18181b', marginBottom: '12px' }}>Create Petty Cash Float</div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <select value={holderId} onChange={(e) => setHolderId(e.target.value)}
              style={{ padding: '8px 12px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', flex: 1, background: '#fff' }}>
              <option value="">Select Holder</option>
              {employees.map((e: any) => (
                <option key={e.user_id} value={e.user_id}>{e.full_name}</option>
              ))}
            </select>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
              style={{ padding: '8px 12px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', flex: 1, background: '#fff' }}>
              <option value="">Select Project</option>
              {projects.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input type="number" placeholder="Float Amount" value={floatAmount || ''}
              onChange={(e) => setFloatAmount(Number(e.target.value))}
              style={{ padding: '8px 12px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', width: '160px' }} />
            <button onClick={handleCreate} style={{
              padding: '8px 16px', fontSize: '12px', fontWeight: 600,
              color: '#fff', background: '#059669', border: '1px solid #059669',
              borderRadius: '6px', cursor: 'pointer',
            }}>Create</button>
          </div>
        </div>
      )}

      {topUpId && (
        <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: '8px', padding: '16px 20px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#18181b', marginBottom: '12px' }}>Top Up Float</div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input type="number" placeholder="Top-up Amount" value={topUpAmount || ''}
              onChange={(e) => setTopUpAmount(Number(e.target.value))}
              style={{ padding: '8px 12px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', width: '200px' }} />
            <button onClick={handleTopUp} style={{
              padding: '8px 16px', fontSize: '12px', fontWeight: 600,
              color: '#fff', background: '#185FA5', border: '1px solid #185FA5',
              borderRadius: '6px', cursor: 'pointer',
            }}>Submit Top-Up</button>
            <button onClick={() => setTopUpId(null)} style={{
              padding: '8px 16px', fontSize: '12px', fontWeight: 600,
              color: '#374151', background: '#fff', border: '1px solid #d1d5db',
              borderRadius: '6px', cursor: 'pointer',
            }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: '8px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TABLE_HEADER}>Holder</th>
              <th style={TABLE_HEADER}>Project</th>
              <th style={{ ...TABLE_HEADER, textAlign: 'right' }}>Float Amount</th>
              <th style={{ ...TABLE_HEADER, textAlign: 'right' }}>Balance</th>
              <th style={TABLE_HEADER}>Status</th>
              <th style={TABLE_HEADER}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} style={{ ...CELL, textAlign: 'center', color: '#71717a' }}>Loading...</td></tr>
            )}
            {!isLoading && floats.length === 0 && (
              <tr><td colSpan={6} style={{ ...CELL, textAlign: 'center', color: '#71717a' }}>No floats found</td></tr>
            )}
            {floats.map((f: PettyCashFloat) => {
              const cfg = FLOAT_STATUS_CONFIG[f.status] || { label: f.status, color: '#6B7280', bg: '#F3F4F6' };
              const balColor = getBalanceColor(Number(f.current_balance), Number(f.float_amount));
              return (
                <tr key={f.id}>
                  <td style={CELL}>{f.holder_name}</td>
                  <td style={CELL}>{f.project_name || '-'}</td>
                  <td style={{ ...CELL, textAlign: 'right', fontWeight: 600 }}>
                    ₹{Number(f.float_amount).toLocaleString('en-IN')}
                  </td>
                  <td style={{ ...CELL, textAlign: 'right', fontWeight: 600, color: balColor }}>
                    ₹{Number(f.current_balance).toLocaleString('en-IN')}
                  </td>
                  <td style={CELL}>
                    <span style={{ padding: '2px 8px', fontSize: '11px', fontWeight: 600, color: cfg.color, background: cfg.bg, borderRadius: '4px' }}>
                      {cfg.label}
                    </span>
                  </td>
                  <td style={CELL}>
                    {f.status === 'ACTIVE' && (
                      <button onClick={() => setTopUpId(f.id)} style={{
                        padding: '4px 10px', fontSize: '11px', fontWeight: 600,
                        color: '#185FA5', background: '#fff', border: '1px solid #185FA5',
                        borderRadius: '4px', cursor: 'pointer',
                      }}>Top Up</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
