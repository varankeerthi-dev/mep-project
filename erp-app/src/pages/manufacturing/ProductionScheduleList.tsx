import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Search, Calendar, Filter } from 'lucide-react';

type ProductionScheduleListProps = {
  onNavigate: (path: string) => void;
};

const PAGE_SIZE = 10;

export default function ProductionScheduleList({ onNavigate }: ProductionScheduleListProps) {
  const { organisation } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { data: schedules, isLoading } = useQuery({
    queryKey: ['production-schedules', organisation?.id, statusFilter, search],
    queryFn: async () => {
      if (!organisation?.id) return [];
      let query = supabase
        .from('production_schedules')
        .select('*')
        .eq('organisation_id', organisation.id);
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (search) query = query.or(`schedule_no.ilike.%${search}%,schedule_name.ilike.%${search}%`);
      const { data, error } = await query.order('schedule_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id
  });

  const totalPages = schedules ? Math.ceil(schedules.length / PAGE_SIZE) : 1;
  const pagedData = schedules?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) || [];

  const statusColors: Record<string, string> = {
    draft: 'bg-zinc-50 text-zinc-700 border-zinc-200',
    planned: 'bg-blue-50 text-blue-700 border-blue-200',
    in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
    completed: 'bg-green-50 text-green-700 border-green-200',
    cancelled: 'bg-rose-50 text-rose-700 border-rose-200'
  };

  const inputStyle: React.CSSProperties = {
    padding: '4px 12px 4px 32px',
    fontSize: '12px',
    height: '32px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    background: '#fff',
    color: '#111827',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    width: '100%'
  };

  const selectStyle: React.CSSProperties = {
    padding: '4px 12px',
    fontSize: '12px',
    height: '32px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    background: '#fff',
    color: '#111827',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  return (
    <div style={{ minHeight: '100%', background: '#fafafa' }}>
      {/* Header Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div>
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Production Schedules</h1>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Group multiple products for production</span>
        </div>
        <button
          onClick={() => onNavigate('/manufacturing/schedules/create')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            background: '#185FA5',
            border: '1px solid #185FA5',
            color: '#fff',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#185FA5'; e.currentTarget.style.borderColor = '#185FA5'; }}
        >
          <Plus size={14} /> Create Schedule
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          
          {/* Filter Bar */}
          <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', itemsAlign: 'center', gap: '12px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Search schedules by no. or name..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Filter size={12} /> Filter:
              </span>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                style={selectStyle}
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="planned">Planned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                  <th style={{ padding: '12px 24px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Schedule No</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Schedule Date</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Created</th>
                  <th style={{ padding: '12px 24px', width: '48px' }}></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td colSpan={6} style={{ padding: '16px 24px' }}>
                        <div style={{ height: '16px', background: '#f3f4f6', borderRadius: '4px', width: '100%' }} className="animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : pagedData.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '48px 24px', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>
                      No production schedules found. Create your first schedule to get started.
                    </td>
                  </tr>
                ) : (
                  pagedData.map((schedule) => (
                    <tr
                      key={schedule.id}
                      style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', transition: 'background-color 0.15s' }}
                      className="hover:bg-zinc-50/80"
                      onClick={() => onNavigate(`/manufacturing/schedules/edit?id=${schedule.id}`)}
                    >
                      <td style={{ padding: '14px 24px', fontSize: '12px', fontWeight: 600, color: '#111827' }}>
                        {schedule.schedule_no}
                      </td>
                      <td style={{ padding: '14px 24px', fontSize: '12px', color: '#374151' }}>
                        {schedule.schedule_name}
                      </td>
                      <td style={{ padding: '14px 24px', fontSize: '12px', color: '#374151' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={13} style={{ color: '#9ca3af' }} />
                          {new Date(schedule.schedule_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td style={{ padding: '14px 24px' }}>
                        <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full border ${statusColors[schedule.status] || 'bg-zinc-50 text-zinc-700 border-zinc-200'}`}>
                          {schedule.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '14px 24px', fontSize: '12px', color: '#6b7280' }}>
                        {new Date(schedule.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '14px 24px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onNavigate(`/manufacturing/schedules/edit?id=${schedule.id}`)}
                          style={{
                            padding: '4px 8px',
                            border: '1px solid #d1d5db',
                            background: '#fff',
                            color: '#374151',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {schedules && schedules.length > 0 && (
            <div style={{ padding: '14px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, schedules.length)} of {schedules.length} schedule{schedules.length !== 1 ? 's' : ''}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    height: '28px',
                    padding: '0 10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    background: '#fff',
                    color: '#374151',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: page === 1 ? 'not-allowed' : 'pointer',
                    opacity: page === 1 ? 0.5 : 1,
                    transition: 'all 0.15s'
                  }}
                >
                  Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    style={{
                      height: '28px',
                      width: '28px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: p === page ? '1px solid #185FA5' : '1px solid #d1d5db',
                      background: p === page ? '#185FA5' : '#fff',
                      color: p === page ? '#fff' : '#374151',
                      transition: 'all 0.15s'
                    }}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    height: '28px',
                    padding: '0 10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    background: '#fff',
                    color: '#374151',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: page === totalPages ? 'not-allowed' : 'pointer',
                    opacity: page === totalPages ? 0.5 : 1,
                    transition: 'all 0.15s'
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
