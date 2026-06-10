import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';

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
    draft: 'bg-zinc-100 text-zinc-600',
    planned: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600'
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Production Schedules</h1>
          <p className="text-zinc-500 mt-1">Group multiple products for production</p>
        </div>
        <button
          onClick={() => onNavigate('/manufacturing/schedules/create')}
          className="h-10 px-5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Create Schedule
        </button>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg">
        <div className="p-4 border-b border-zinc-200 flex items-center gap-4">
          <input
            type="text"
            placeholder="Search schedules..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="planned">Planned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Schedule No</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Name</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Schedule Date</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Status</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Created</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-zinc-500 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="h-4 bg-zinc-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : pagedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    No production schedules found. Create your first schedule to get started.
                  </td>
                </tr>
              ) : (
                pagedData.map((schedule) => (
                  <tr
                    key={schedule.id}
                    className="border-b border-zinc-100 hover:bg-zinc-50 cursor-pointer"
                    onClick={() => onNavigate(`/manufacturing/schedules/edit?id=${schedule.id}`)}
                  >
                    <td className="px-6 py-4 font-medium text-zinc-900">{schedule.schedule_no}</td>
                    <td className="px-6 py-4 text-zinc-700">{schedule.schedule_name}</td>
                    <td className="px-6 py-4 text-zinc-700">{new Date(schedule.schedule_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusColors[schedule.status] || 'bg-zinc-100 text-zinc-600'}`}>
                        {schedule.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-500 text-sm">
                      {new Date(schedule.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-block" ref={openMenuId === schedule.id ? menuRef : undefined}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === schedule.id ? null : schedule.id);
                          }}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <circle cx="10" cy="4" r="1.5" />
                            <circle cx="10" cy="10" r="1.5" />
                            <circle cx="10" cy="16" r="1.5" />
                          </svg>
                        </button>
                        {openMenuId === schedule.id && (
                          <div className="absolute right-0 mt-1 w-48 bg-white border border-zinc-200 rounded-lg shadow-lg z-10 py-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                                onNavigate(`/manufacturing/schedules/edit?id=${schedule.id}`);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                            >
                              Edit Schedule
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                                onNavigate(`/manufacturing/schedules/edit?id=${schedule.id}`);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                            >
                              View Details
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {schedules && schedules.length > 0 && (
          <div className="px-6 py-4 border-t border-zinc-200 flex items-center justify-between">
            <span className="text-sm text-zinc-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, schedules.length)} of {schedules.length} schedule{schedules.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 px-3 border border-zinc-200 rounded text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`h-8 w-8 rounded text-sm font-medium ${p === page ? 'bg-blue-600 text-white' : 'text-zinc-700 hover:bg-zinc-50'}`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-8 px-3 border border-zinc-200 rounded text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
