import React, { useState, useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useAdvanceExpenses, useAeKpis } from '../hooks/useAdvanceExpense';
import { KpiCards } from './KpiCards';
import type { AdvanceExpense } from '../types';

const TABLE_HEADER: React.CSSProperties = {
  padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#71717a',
  textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left',
  borderBottom: '1px solid #e4e4e7', background: '#fafafa',
};

const CELL: React.CSSProperties = {
  padding: '10px 12px', fontSize: '12px', color: '#18181b', borderBottom: '1px solid #f0f0f0',
};

interface Props {
  onView: (id: string) => void;
}

export const CeoDashboard: React.FC<Props> = ({ onView }) => {
  const { organisation } = useAuth();
  const orgId = organisation?.id;

  const { data: allRecords = [] } = useAdvanceExpenses(orgId);
  const { data: kpis } = useAeKpis(orgId);

  const pendingRecords = useMemo(() => {
    return allRecords.filter((r) => r.status === 'PENDING');
  }, [allRecords]);

  const groupedByProject = useMemo(() => {
    const map = new Map<string, { project: string; records: AdvanceExpense[]; total: number }>();
    for (const r of pendingRecords) {
      const key = r.project_id || 'no-project';
      const existing = map.get(key) || { project: r.project_name || 'No Project', records: [], total: 0 };
      existing.records.push(r);
      existing.total += Number(r.amount);
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [pendingRecords]);

  const groupedByManager = useMemo(() => {
    const map = new Map<string, { manager: string; count: number; total: number; oldest: string }>();
    for (const r of pendingRecords) {
      const key = r.created_by;
      const existing = map.get(key) || {
        manager: r.created_by_name || 'Unknown',
        count: 0,
        total: 0,
        oldest: r.created_at,
      };
      existing.count++;
      existing.total += Number(r.amount);
      if (r.created_at < existing.oldest) existing.oldest = r.created_at;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [pendingRecords]);

  const grandTotal = pendingRecords.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div style={{ padding: '16px 24px' }}>
      {kpis && <KpiCards data={kpis} />}

      <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: '8px', padding: '16px 20px', marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#18181b', marginBottom: '4px' }}>
          Pending Approvals Summary
        </div>
        <div style={{ fontSize: '24px', fontWeight: 700, color: '#185FA5' }}>
          ₹{grandTotal.toLocaleString('en-IN')}
        </div>
        <div style={{ fontSize: '11px', color: '#71717a', marginTop: '2px' }}>
          {pendingRecords.length} claim{pendingRecords.length !== 1 ? 's' : ''} awaiting approval
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: '8px', overflow: 'auto' }}>
          <div style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#18181b', borderBottom: '1px solid #e4e4e7' }}>
            By Project
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TABLE_HEADER}>Project</th>
                <th style={{ ...TABLE_HEADER, textAlign: 'right' }}>Claims</th>
                <th style={{ ...TABLE_HEADER, textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {groupedByProject.map((g) => (
                <tr key={g.project}>
                  <td style={CELL}>{g.project}</td>
                  <td style={{ ...CELL, textAlign: 'right' }}>{g.records.length}</td>
                  <td style={{ ...CELL, textAlign: 'right', fontWeight: 600 }}>₹{g.total.toLocaleString('en-IN')}</td>
                </tr>
              ))}
              {groupedByProject.length === 0 && (
                <tr><td colSpan={3} style={{ ...CELL, textAlign: 'center', color: '#71717a' }}>No pending claims</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: '8px', overflow: 'auto' }}>
          <div style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#18181b', borderBottom: '1px solid #e4e4e7' }}>
            By Manager
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TABLE_HEADER}>Manager</th>
                <th style={{ ...TABLE_HEADER, textAlign: 'right' }}>Pending</th>
                <th style={{ ...TABLE_HEADER, textAlign: 'right' }}>Total</th>
                <th style={TABLE_HEADER}>Oldest</th>
              </tr>
            </thead>
            <tbody>
              {groupedByManager.map((g) => (
                <tr key={g.manager}>
                  <td style={CELL}>{g.manager}</td>
                  <td style={{ ...CELL, textAlign: 'right' }}>{g.count}</td>
                  <td style={{ ...CELL, textAlign: 'right', fontWeight: 600 }}>₹{g.total.toLocaleString('en-IN')}</td>
                  <td style={CELL}>{new Date(g.oldest).toLocaleDateString()}</td>
                </tr>
              ))}
              {groupedByManager.length === 0 && (
                <tr><td colSpan={4} style={{ ...CELL, textAlign: 'center', color: '#71717a' }}>No pending claims</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: '8px', overflow: 'auto', marginTop: '16px' }}>
        <div style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#18181b', borderBottom: '1px solid #e4e4e7' }}>
          All Pending Approvals
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TABLE_HEADER}>TXN</th>
              <th style={TABLE_HEADER}>Employee</th>
              <th style={TABLE_HEADER}>Project</th>
              <th style={TABLE_HEADER}>Category</th>
              <th style={{ ...TABLE_HEADER, textAlign: 'right' }}>Amount</th>
              <th style={TABLE_HEADER}>Date</th>
            </tr>
          </thead>
          <tbody>
            {pendingRecords.map((r) => (
              <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => onView(r.id)}>
                <td style={CELL}>{r.transaction_no || '-'}</td>
                <td style={CELL}>{r.employee_name}</td>
                <td style={CELL}>{r.project_name || '-'}</td>
                <td style={CELL}>{r.category_name || '-'}</td>
                <td style={{ ...CELL, textAlign: 'right', fontWeight: 600 }}>
                  ₹{Number(r.amount).toLocaleString('en-IN')}
                </td>
                <td style={CELL}>{new Date(r.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {pendingRecords.length === 0 && (
              <tr><td colSpan={6} style={{ ...CELL, textAlign: 'center', color: '#71717a' }}>No pending approvals</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
