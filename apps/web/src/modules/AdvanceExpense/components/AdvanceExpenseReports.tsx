import React, { useState, useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useAdvanceExpenses, useAeKpis, useExpenseCategories, useOrgEmployees } from '../hooks/useAdvanceExpense';
import { KpiCards } from './KpiCards';

export const AdvanceExpenseReports: React.FC = () => {
  const { organisation } = useAuth();
  const orgId = organisation?.id;
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [type, setType] = useState('ALL');
  const [groupBy, setGroupBy] = useState('category');

  const { data: records = [] } = useAdvanceExpenses(orgId, {
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });
  const { data: kpis } = useAeKpis(orgId);
  const { data: categories = [] } = useExpenseCategories(orgId);
  const { data: employees = [] } = useOrgEmployees(orgId);

  const filtered = useMemo(() => {
    let result = records;
    if (employeeId) result = result.filter((r) => r.employee_id === employeeId);
    if (categoryId) result = result.filter((r) => r.category_id === categoryId);
    if (type !== 'ALL') result = result.filter((r) => r.type === type);
    return result;
  }, [records, employeeId, categoryId, type]);

  const grouped = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const r of filtered) {
      const key = groupBy === 'category' ? (r.category_name || 'Uncategorized') : (r.employee_name || 'Unknown');
      const existing = map.get(key) || { count: 0, total: 0 };
      existing.count++;
      existing.total += Number(r.amount);
      map.set(key, existing);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [filtered, groupBy]);

  return (
    <div style={{ padding: '16px 24px' }}>
      {kpis && <KpiCards data={kpis} />}

      <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: '8px', padding: '16px 20px', marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#18181b', marginBottom: '12px' }}>Filters</div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            style={{ padding: '8px 12px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px' }} />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            style={{ padding: '8px 12px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px' }} />
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
            style={{ padding: '8px 12px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff' }}>
            <option value="">All Employees</option>
            {employees.map((e: any) => (
              <option key={e.user_id} value={e.user_id}>{e.full_name}</option>
            ))}
          </select>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
            style={{ padding: '8px 12px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff' }}>
            <option value="">All Categories</option>
            {categories.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)}
            style={{ padding: '8px 12px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff' }}>
            <option value="ALL">All Types</option>
            <option value="ADVANCE">Advance</option>
            <option value="EXPENSE">Expense</option>
            <option value="REIMBURSEMENT">Reimbursement</option>
          </select>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}
            style={{ padding: '8px 12px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff' }}>
            <option value="category">Group by Category</option>
            <option value="employee">Group by Employee</option>
          </select>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid #e4e4e7', background: '#fafafa' }}>
                {groupBy === 'category' ? 'Category' : 'Employee'}
              </th>
              <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', textAlign: 'right', borderBottom: '1px solid #e4e4e7', background: '#fafafa' }}>
                Count
              </th>
              <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', textAlign: 'right', borderBottom: '1px solid #e4e4e7', background: '#fafafa' }}>
                Total Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(([key, val]) => (
              <tr key={key}>
                <td style={{ padding: '10px 12px', fontSize: '12px', color: '#18181b', borderBottom: '1px solid #f0f0f0' }}>{key}</td>
                <td style={{ padding: '10px 12px', fontSize: '12px', textAlign: 'right', color: '#18181b', borderBottom: '1px solid #f0f0f0' }}>{val.count}</td>
                <td style={{ padding: '10px 12px', fontSize: '12px', textAlign: 'right', fontWeight: 600, color: '#18181b', borderBottom: '1px solid #f0f0f0' }}>
                  ₹{val.total.toLocaleString('en-IN')}
                </td>
              </tr>
            ))}
            <tr>
              <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 700, color: '#18181b', borderTop: '2px solid #e4e4e7' }}>Total</td>
              <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 700, textAlign: 'right', color: '#18181b', borderTop: '2px solid #e4e4e7' }}>
                {grouped.reduce((s, [, v]) => s + v.count, 0)}
              </td>
              <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 700, textAlign: 'right', color: '#18181b', borderTop: '2px solid #e4e4e7' }}>
                ₹{grouped.reduce((s, [, v]) => s + v.total, 0).toLocaleString('en-IN')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
