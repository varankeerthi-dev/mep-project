import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useMyPermissions } from '../../rbac/hooks';

type ActivityLogProps = {
  onNavigate: (path: string) => void;
};

type LogEntry = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  action_details: Record<string, unknown> | null;
  user_id: string;
  user_name: string;
  organisation_id: string;
  created_at: string;
};

const PAGE_SIZE = 20;

const ENTITY_LABELS: Record<string, string> = {
  production_schedule: 'Production Schedule',
  job_card: 'Job Card',
  production_entry: 'Production Entry',
  stock_movement: 'Stock Movement',
  bom: 'BOM',
  material_return: 'Material Return'
};

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-green-100 text-green-700',
  updated: 'bg-blue-100 text-blue-700',
  deleted: 'bg-red-100 text-red-700',
  issued: 'bg-purple-100 text-purple-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
  returned: 'bg-orange-100 text-orange-700',
  stock_updated: 'bg-cyan-100 text-cyan-700',
  finished_goods_added: 'bg-teal-100 text-teal-700',
  material_returned: 'bg-amber-100 text-amber-700'
};

export default function ActivityLog({ onNavigate }: ActivityLogProps) {
  const { organisation, user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmClear, setConfirmClear] = useState(false);
  const orgId = (organisation as any)?.id ?? null;
  const { data: permissions } = useMyPermissions(user?.id, orgId);
  const canClear = permissions?.includes('manufacturing.clear_activity_log' as any) || permissions?.includes('admin_all_access' as any);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['activity-log', organisation?.id, entityFilter, actionFilter],
    queryFn: async () => {
      if (!organisation?.id) return [];
      let query = supabase
        .from('manufacturing_activity_log')
        .select('*')
        .eq('organisation_id', organisation.id);
      if (entityFilter !== 'all') query = query.eq('entity_type', entityFilter);
      if (actionFilter !== 'all') query = query.eq('action', actionFilter);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as LogEntry[];
    },
    enabled: !!organisation?.id
  });

  const { mutate: clearSelected, isPending: isClearing } = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('manufacturing_activity_log').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-log'] });
      setSelectedIds(new Set());
      setConfirmClear(false);
    },
  });

  const totalPages = logs ? Math.ceil(logs.length / PAGE_SIZE) : 1;
  const pagedData = logs?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) || [];

  const allPagedIds = pagedData.map(l => l.id);
  const allSelectedOnPage = allPagedIds.length > 0 && allPagedIds.every(id => selectedIds.has(id));
  const someSelectedOnPage = allPagedIds.some(id => selectedIds.has(id));

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allSelectedOnPage) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        allPagedIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        allPagedIds.forEach(id => next.add(id));
        return next;
      });
    }
  }, [allPagedIds, allSelectedOnPage]);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatDetails = (details: Record<string, unknown> | null) => {
    if (!details) return null;
    return Object.entries(details).map(([k, v]) => (
      <span key={k} className="inline-flex items-center gap-1 text-xs bg-zinc-100 px-2 py-0.5 rounded mr-1 mb-1">
        <span className="text-zinc-500">{k}:</span>
        <span className="text-zinc-700 font-medium">{String(v)}</span>
      </span>
    ));
  };

  const getEntityLink = (entry: LogEntry) => {
    switch (entry.entity_type) {
      case 'job_card': return `/manufacturing/job-cards/${entry.entity_id}`;
      case 'bom': return `/manufacturing/boms/edit?id=${entry.entity_id}`;
      case 'production_schedule': return `/manufacturing/schedules/edit?id=${entry.entity_id}`;
      case 'production_entry': return `/manufacturing/production`;
      default: return null;
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Activity Log</h1>
          <p className="text-zinc-500 mt-1">Track all manufacturing actions and changes</p>
        </div>
        <div className="flex items-center gap-3">
          {canClear && selectedIds.size > 0 && (
            !confirmClear ? (
              <button onClick={() => setConfirmClear(true)}
                className="h-10 px-4 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700">
                Clear Selected ({selectedIds.size})
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-600">
                  Delete {selectedIds.size} log{selectedIds.size !== 1 ? 's' : ''}?
                </span>
                <button onClick={() => clearSelected(Array.from(selectedIds))} disabled={isClearing}
                  className="h-10 px-4 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">
                  {isClearing ? 'Deleting...' : 'Confirm'}
                </button>
                <button onClick={() => { setConfirmClear(false); setSelectedIds(new Set()); }}
                  className="h-10 px-4 border border-zinc-200 text-sm font-medium text-zinc-700 rounded-lg hover:bg-zinc-50">
                  Cancel
                </button>
              </div>
            )
          )}
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg">
        <div className="p-4 border-b border-zinc-200 flex items-center gap-4">
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
            className="h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Entities</option>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Actions</option>
            {Object.keys(ACTION_COLORS).map(a => (
              <option key={a} value={a}>{a.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="w-10 px-2 py-4 text-center">
                      <input type="checkbox"
                        checked={allSelectedOnPage}
                        ref={(el) => { if (el) el.indeterminate = someSelectedOnPage && !allSelectedOnPage; }}
                        onChange={toggleSelectAll}
                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500" />
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Time</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Entity</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Action</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">User</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Details</th>
                  </tr>
                </thead>
            <tbody>
              {isLoading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="h-4 bg-zinc-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : pagedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    No activity found.
                  </td>
                </tr>
              ) : (
                pagedData.map((log) => {
                  const entityLink = getEntityLink(log);
                  return (
                    <tr key={log.id} className={`border-b border-zinc-100 hover:bg-zinc-50 ${selectedIds.has(log.id) ? 'bg-blue-50' : ''}`}>
                      <td className="w-10 px-2 py-4 text-center">
                        <input type="checkbox"
                          checked={selectedIds.has(log.id)}
                          onChange={() => toggleSelect(log.id)}
                          className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500" />
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-500 whitespace-nowrap">
                        {formatTime(log.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        {entityLink ? (
                          <button onClick={() => onNavigate(entityLink)}
                            className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                            {ENTITY_LABELS[log.entity_type] || log.entity_type}
                          </button>
                        ) : (
                          <span className="font-medium text-zinc-900 text-sm">
                            {ENTITY_LABELS[log.entity_type] || log.entity_type}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${ACTION_COLORS[log.action] || 'bg-zinc-100 text-zinc-600'}`}>
                          {log.action.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-700">
                        {log.user_name || 'System'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap">
                          {formatDetails(log.action_details)}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {logs && logs.length > 0 && (
          <div className="px-6 py-4 border-t border-zinc-200 flex items-center justify-between">
            <span className="text-sm text-zinc-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, logs.length)} of {logs.length} log{logs.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="h-8 px-3 border border-zinc-200 rounded text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed">Prev</button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 3, totalPages - 6));
                return start + i;
              }).filter(p => p <= totalPages).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`h-8 w-8 rounded text-sm font-medium ${p === page ? 'bg-blue-600 text-white' : 'text-zinc-700 hover:bg-zinc-50'}`}>{p}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="h-8 px-3 border border-zinc-200 rounded text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
