import { useState, useMemo } from 'react';
import { FileSignature, Users, FileText } from 'lucide-react';
import { AppTable } from '../../../../components/ui/AppTable';
import { cn } from '../../../../lib/utils';

interface DailyLogsTabProps {
  dailyLogs: any[];
  manpowerAttendance: any[];
  labourCategories: any[];
}

export function DailyLogsTab({ dailyLogs, manpowerAttendance, labourCategories }: DailyLogsTabProps) {
  const [dailyLogsSubTab, setDailyLogsSubTab] = useState('logs');
  const [attDateFrom, setAttDateFrom] = useState('');
  const [attDateTo, setAttDateTo] = useState('');
  const [attWorkType, setAttWorkType] = useState('');
  const [attCategory, setAttCategory] = useState('');
  const [attStatus, setAttStatus] = useState('');

  const filteredManpowerAttendance = useMemo(() => {
    return manpowerAttendance.filter((att: any) => {
      if (attDateFrom && att.attendance_date < attDateFrom) return false;
      if (attDateTo && att.attendance_date > attDateTo) return false;
      if (attWorkType && att.work_unit_type !== attWorkType) return false;
      if (attCategory && att.labour_category_id !== attCategory) return false;
      if (attStatus && att.status !== attStatus) return false;
      return true;
    });
  }, [manpowerAttendance, attDateFrom, attDateTo, attWorkType, attCategory, attStatus]);

  return (
    <div style={{
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    }}>
      {/* Sub-tab Navigation */}
      <div style={{ display: 'flex', gap: '4px', padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
        {[
          { id: 'logs', label: 'Logs', icon: FileSignature },
          { id: 'attendance', label: 'Attendance', icon: Users },
          { id: 'summary', label: 'Summary', icon: FileText },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setDailyLogsSubTab(tab.id)} style={{
            padding: '6px 14px', borderRadius: '6px', border: 'none',
            background: dailyLogsSubTab === tab.id ? '#171717' : 'transparent',
            color: dailyLogsSubTab === tab.id ? '#fff' : '#9ca3af',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Logs Sub-tab */}
      {dailyLogsSubTab === 'logs' && (
        <div style={{ padding: '8px' }}>
          <AppTable
            data={dailyLogs}
            columns={[
              { header: 'Log Date', accessorKey: 'log_date', cell: (i: any) => <span className="font-black text-zinc-900">{i.getValue()}</span> },
              { header: 'Work Progress', accessorKey: 'work_done', cell: (i: any) => <span className="font-bold text-zinc-700">{i.getValue()}</span> },
              { header: 'Safety/Issues', accessorKey: 'safety_incidents', cell: ({ row }: any) => <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-400">{row.original.delays || 'No Delays'}</span>
                <span className="mx-2 text-zinc-200">|</span>
                <span className={cn("text-xs font-bold", row.original.safety_incidents ? "text-red-500" : "text-emerald-500")}>{row.original.safety_incidents || 'No Incidents'}</span>
              </div> }
            ]}
            emptyMessage="No progress logs recorded."
          />
        </div>
      )}

      {/* Attendance Sub-tab */}
      {dailyLogsSubTab === 'attendance' && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '12px', padding: '12px 16px', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>From</label>
              <input type="date" value={attDateFrom} onChange={(e) => setAttDateFrom(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '12px', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>To</label>
              <input type="date" value={attDateTo} onChange={(e) => setAttDateTo(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '12px', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Work Type</label>
              <select value={attWorkType} onChange={(e) => setAttWorkType(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '12px', outline: 'none', background: '#fff' }}>
                <option value="">All</option>
                <option value="PROJECT">Project</option>
                <option value="ALTERATION">Alteration</option>
                <option value="AMC">AMC</option>
                <option value="WORK_ORDER">Work Order</option>
                <option value="GENERAL">General</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Category</label>
              <select value={attCategory} onChange={(e) => setAttCategory(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '12px', outline: 'none', background: '#fff' }}>
                <option value="">All</option>
                {labourCategories.map((lc: any) => (
                  <option key={lc.id} value={lc.id}>{lc.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Status</label>
              <select value={attStatus} onChange={(e) => setAttStatus(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '12px', outline: 'none', background: '#fff' }}>
                <option value="">All</option>
                <option value="DRAFT">Draft</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button onClick={() => { setAttDateFrom(''); setAttDateTo(''); setAttWorkType(''); setAttCategory(''); setAttStatus(''); }} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', fontSize: '12px', cursor: 'pointer', color: '#6b7280' }}>
                Clear
              </button>
            </div>
          </div>

          {/* Table */}
          <div style={{ padding: '8px' }}>
            <AppTable
              data={filteredManpowerAttendance}
              columns={[
                { header: 'Date', accessorKey: 'attendance_date', cell: (i: any) => <span className="font-black text-zinc-900">{i.getValue()}</span> },
                { header: 'Work Unit', accessorKey: 'work_unit_type', cell: ({ row }: any) => <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{row.original.work_unit_type || '—'}</span> },
                { header: 'Category', accessorKey: 'labour_categories', cell: ({ row }: any) => <span className="font-bold text-zinc-700">{row.original.labour_categories?.name || 'General'}</span> },
                { header: 'Workers', accessorKey: 'workers_count', cell: (i: any) => <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 font-bold text-white text-[11px]">{i.getValue()}</div> },
                { header: 'Hours', accessorKey: 'hours_worked', cell: (i: any) => <span className="font-bold text-zinc-600">{i.getValue()}</span> },
                { header: 'Rate', accessorKey: 'adjusted_rate', cell: (i: any) => <span className="font-bold text-zinc-600">₹{Number(i.getValue()).toFixed(2)}</span> },
                { header: 'Amount', accessorKey: 'adjusted_amount', cell: (i: any) => <span className="font-black text-zinc-900">₹{Number(i.getValue()).toFixed(2)}</span> },
                { header: 'Status', accessorKey: 'status', cell: ({ row }: any) => <span style={{
                  padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                  background: row.original.status === 'APPROVED' ? '#dcfce7' : row.original.status === 'DRAFT' ? '#f1f5f9' : row.original.status === 'REJECTED' ? '#fef2f2' : '#fef9c3',
                  color: row.original.status === 'APPROVED' ? '#16a34a' : row.original.status === 'DRAFT' ? '#64748b' : row.original.status === 'REJECTED' ? '#dc2626' : '#ca8a04',
                }}>{row.original.status}</span> },
                { header: 'Source', accessorKey: 'source', cell: ({ row }: any) => <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{row.original.source === 'site_report' ? 'Site Report' : row.original.source === 'direct' ? 'Direct' : '—'}</span> },
              ]}
              emptyMessage="No attendance records found for this period."
            />
          </div>
        </div>
      )}

      {/* Summary Sub-tab */}
      {dailyLogsSubTab === 'summary' && (
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Total Workers</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>{manpowerAttendance.reduce((s: number, a: any) => s + a.workers_count, 0)}</div>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Total Amount</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>₹{manpowerAttendance.reduce((s: number, a: any) => s + Number(a.adjusted_amount), 0).toFixed(2)}</div>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Approved</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a' }}>₹{manpowerAttendance.filter((a: any) => a.status === 'APPROVED').reduce((s: number, a: any) => s + Number(a.adjusted_amount), 0).toFixed(2)}</div>
            </div>
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '12px' }}>By Work Type</div>
          <AppTable
            data={Object.entries(
              manpowerAttendance.reduce((acc: any, att: any) => {
                const wt = att.work_unit_type || 'UNSPECIFIED';
                acc[wt] = (acc[wt] || 0) + att.workers_count;
                return acc;
              }, {})
            ).map(([type, count]) => ({ type, count }))}
            columns={[
              { header: 'Work Type', accessorKey: 'type', cell: (i: any) => <span className="font-bold text-zinc-700">{i.getValue()}</span> },
              { header: 'Total Workers', accessorKey: 'count', cell: (i: any) => <span className="font-black text-zinc-900">{i.getValue() as number}</span> },
            ]}
            emptyMessage="No attendance data."
          />
        </div>
      )}
    </div>
  );
}
export default DailyLogsTab;
