import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const accent = '#7f1d1d';
const fg = '#1c1917';
const muted = '#a8a29e';
const border = '#e7e5e4';
const bgCard = '#fafaf9';

interface ReportGroup {
  id: string;
  title: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
  path: string;
}

const ReportsDashboard = () => {
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState('this-month');

  const groups: ReportGroup[] = useMemo(() => [
    { id: 'financial', title: 'Financial', count: 156, trend: 'up', path: '/reports/financial' },
    { id: 'projects', title: 'Projects', count: 89, trend: 'up', path: '/reports/projects' },
    { id: 'inventory', title: 'Inventory', count: 234, trend: 'stable', path: '/reports/inventory' },
    { id: 'compliance', title: 'Compliance', count: 67, trend: 'down', path: '/reports/compliance' },
    { id: 'invoices', title: 'Invoices', count: 412, trend: 'up', path: '/reports/invoices' },
    { id: 'profit', title: 'Profit & Loss', count: 28, trend: 'up', path: '/reports/profit' },
  ], []);

  const recentReports = useMemo(() => [
    { id: 1, name: 'Q1 Financial Summary', type: 'Financial', date: '03 May 2024', status: 'Completed' },
    { id: 2, name: 'Project Portfolio Review', type: 'Projects', date: '02 May 2024', status: 'Completed' },
    { id: 3, name: 'Stock Movement Analysis', type: 'Inventory', date: '01 May 2024', status: 'In Progress' },
    { id: 4, name: 'Safety Compliance Audit', type: 'Compliance', date: '30 Apr 2024', status: 'Completed' },
    { id: 5, name: 'Monthly Cost Analysis', type: 'Financial', date: '29 Apr 2024', status: 'Scheduled' },
    { id: 6, name: 'Invoice Aging Report', type: 'Invoices', date: '28 Apr 2024', status: 'Completed' },
  ], []);

  const kpi = useMemo(() => [
    { label: 'Reports Generated', value: '1,247', change: '+12%' },
    { label: 'This Month', value: '88', change: '+5%' },
    { label: 'Scheduled', value: '23', change: '+2' },
    { label: 'Avg Generation', value: '2.3s', change: '-0.5s' },
  ], []);

  const style: Record<string, React.CSSProperties> = {
    page: { minHeight: '100%', background: '#fff' },
    header: {
      padding: '36px 40px 0', display: 'flex', alignItems: 'flex-end',
      justifyContent: 'space-between', borderBottom: `1px solid ${border}`,
    },
    headerInner: { paddingBottom: '24px' },
    h1: {
      fontSize: '28px', fontWeight: 400, color: fg, margin: 0,
      fontFamily: 'Georgia, "Times New Roman", serif', letterSpacing: '-0.02em',
    },
    h1Sub: { fontSize: '13px', color: muted, margin: '6px 0 0', fontFamily: 'system-ui, sans-serif' },
    select: {
      padding: '6px 28px 6px 12px', fontSize: '12px', border: `1px solid ${border}`,
      borderRadius: '0', background: '#fff', color: fg, outline: 'none',
      appearance: 'none' as const, fontFamily: 'system-ui, sans-serif',
      backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 12 12%27%3E%3Cpath fill=%27%23a8a29e%27 d=%27M6 8L1 3h10z%27/%3E%3C/svg%3E")',
      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
    },
    kpiBar: {
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      borderBottom: `1px solid ${border}`,
    },
    kpiCell: {
      padding: '20px 40px', borderRight: `1px solid ${border}`,
    },
    kpiLabel: { fontSize: '10px', color: muted, textTransform: 'uppercase' as const, letterSpacing: '0.08em', fontFamily: 'system-ui, sans-serif' },
    kpiValue: {
      fontSize: '28px', fontWeight: 400, color: fg, marginTop: '6px',
      fontFamily: '"Courier New", Courier, monospace', letterSpacing: '-0.03em',
    },
    kpiChange: { fontSize: '11px', color: '#16a34a', marginTop: '4px', fontFamily: 'system-ui, sans-serif' },
    section: { padding: '0 40px 40px' },
    sectionHead: {
      padding: '24px 0 16px', borderBottom: `1px solid ${border}`,
      marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
    },
    sectionTitle: {
      fontSize: '10px', fontWeight: 500, color: muted, textTransform: 'uppercase' as const,
      letterSpacing: '0.1em', fontFamily: 'system-ui, sans-serif',
    },
    grid6: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1px', background: border },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1px', background: border },
    groupItem: {
      padding: '20px 24px', background: bgCard, cursor: 'pointer',
      display: 'flex', flexDirection: 'column' as const, gap: '8px',
      transition: 'background 0.12s',
    },
    groupName: {
      fontSize: '12px', fontWeight: 500, color: fg, fontFamily: 'system-ui, sans-serif',
    },
    groupCount: {
      fontSize: '22px', fontWeight: 400, color: fg,
      fontFamily: '"Courier New", Courier, monospace', letterSpacing: '-0.02em',
    },
    groupTrend: { fontSize: '10px', fontFamily: 'system-ui, sans-serif' },
    reportRow: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 24px', background: bgCard, transition: 'background 0.12s',
    },
    reportName: { fontSize: '13px', fontWeight: 400, color: fg, fontFamily: 'system-ui, sans-serif' },
    reportMeta: { fontSize: '11px', color: muted, fontFamily: 'system-ui, sans-serif' },
    badge: {
      fontSize: '10px', fontWeight: 500, padding: '2px 8px',
      fontFamily: 'system-ui, sans-serif', letterSpacing: '0.02em',
    },
    footerAction: {
      padding: '16px 24px', background: bgCard, cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: '12px', border: 'none',
      width: '100%', textAlign: 'left' as const, transition: 'background 0.12s',
    },
    actionLabel: { fontSize: '13px', fontWeight: 400, color: fg, fontFamily: 'system-ui, sans-serif' },
    actionDesc: { fontSize: '11px', color: muted, marginTop: '1px', fontFamily: 'system-ui, sans-serif' },
    divider: { border: 'none', borderTop: `2px solid ${fg}`, margin: 0 },
  };

  const trendColor = (t: string) => t === 'up' ? '#16a34a' : t === 'down' ? '#dc2626' : muted;
  const trendArrow = (t: string) => t === 'up' ? '▲' : t === 'down' ? '▼' : '―';

  return (
    <div style={style.page}>
      {/* Header — editorial spread */}
      <div style={style.header}>
        <div style={style.headerInner}>
          <h1 style={style.h1}>Reports</h1>
          <p style={style.h1Sub}>Generate and manage business intelligence</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', paddingBottom: '24px' }}>
          <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)} style={style.select}>
            <option value="this-month">This Month</option>
            <option value="last-month">Last Month</option>
            <option value="this-quarter">This Quarter</option>
            <option value="this-year">This Year</option>
          </select>
          <button style={{
            padding: '6px 16px', fontSize: '12px', fontWeight: 500, color: '#fff',
            background: accent, border: 'none', cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
          }}>
            Schedule
          </button>
        </div>
      </div>

      {/* KPI bar — dense, no icons, monospace numbers */}
      <div style={style.kpiBar}>
        {kpi.map((s, i) => (
          <div key={i} style={{ ...style.kpiCell, borderRight: i < 3 ? `1px solid ${border}` : 'none' }}>
            <div style={style.kpiLabel}>{s.label}</div>
            <div style={style.kpiValue}>{s.value}</div>
            <div style={style.kpiChange}>{s.change}</div>
          </div>
        ))}
      </div>

      {/* Report Categories — flat grid, no icon boxes */}
      <div style={style.section}>
        <div style={style.sectionHead}>
          <span style={style.sectionTitle}>Categories</span>
          <span style={{ fontSize: '11px', color: muted, fontFamily: 'system-ui, sans-serif' }}>
            {groups.reduce((a, g) => a + g.count, 0).toLocaleString()} total
          </span>
        </div>
        <div style={style.grid6}>
          {groups.map((g) => (
            <div
              key={g.id}
              onClick={() => navigate(g.path)}
              style={style.groupItem}
              onMouseEnter={e => { e.currentTarget.style.background = '#f5f4f3'; }}
              onMouseLeave={e => { e.currentTarget.style.background = bgCard; }}
            >
              <span style={style.groupName}>{g.title}</span>
              <span style={style.groupCount}>{g.count.toLocaleString()}</span>
              <span style={{ ...style.groupTrend, color: trendColor(g.trend) }}>
                {trendArrow(g.trend)} this month
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom split: Recent Reports | Quick Actions */}
      <div>
        <hr style={style.divider} />
        <div style={{ padding: '0 40px 40px' }}>
          <div style={style.sectionHead}>
            <span style={style.sectionTitle}>Recent Reports</span>
            <span style={{ fontSize: '11px', color: accent, cursor: 'pointer', fontFamily: 'system-ui, sans-serif' }}>
              View all →
            </span>
          </div>
          <div style={style.grid2}>
            {/* Left — report rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: border }}>
              {recentReports.map((r) => (
                <div key={r.id} style={style.reportRow}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f5f4f3'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = bgCard; }}
                >
                  <div>
                    <div style={style.reportName}>{r.name}</div>
                    <div style={style.reportMeta}>{r.type} · {r.date}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      ...style.badge,
                      background: r.status === 'Completed' ? '#f0fdf4' : r.status === 'In Progress' ? '#fffbeb' : '#f5f5f4',
                      color: r.status === 'Completed' ? '#16a34a' : r.status === 'In Progress' ? '#d97706' : muted,
                    }}>
                      {r.status}
                    </span>
                    <span style={{ fontSize: '16px', color: muted, cursor: 'pointer', lineHeight: 1 }}>↓</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Right — quick actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: border }}>
              {[
                { label: 'Create Report', desc: 'Custom filters & layout' },
                { label: 'Schedule', desc: 'Automated generation' },
                { label: 'Export All', desc: 'Download as archive' },
              ].map((a, i) => (
                <button key={i} style={style.footerAction}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f5f4f3'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = bgCard; }}
                >
                  <span style={{ width: '28px', height: '28px', background: '#e7e5e4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', flexShrink: 0 }}>
                    {['⚲', '◷', '⇲'][i]}
                  </span>
                  <div>
                    <div style={style.actionLabel}>{a.label}</div>
                    <div style={style.actionDesc}>{a.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsDashboard;
