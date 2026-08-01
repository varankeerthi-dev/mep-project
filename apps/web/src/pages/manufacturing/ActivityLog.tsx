import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useMyPermissions } from '../../rbac/hooks';
import { Table, ColumnDef } from '../../components/table';

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

const columns: ColumnDef<LogEntry>[] = [
  {
    header: 'Time',
    id: 'created_at',
    type: 'date',
    cell: ({ row }) => (
      <span className="text-sm text-zinc-500 whitespace-nowrap tabular-nums">
        {formatTime(row.created_at)}
      </span>
    ),
  },
  {
    header: 'Entity',
    id: 'entity_type',
    type: 'text',
    cell: ({ row }) => {
      const entityLink = getEntityLink(row);
      return entityLink ? (
        <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
          {ENTITY_LABELS[row.entity_type] || row.entity_type}
        </button>
      ) : (
        <span className="font-medium text-zinc-900 text-sm">
          {ENTITY_LABELS[row.entity_type] || row.entity_type}
        </span>
      );
    },
  },
  {
    header: 'Action',
    id: 'action',
    type: 'status',
    statusType: (row) => {
      const map: Record<string, 'success' | 'blue' | 'error' | 'warning' | 'neutral'> = {
        created: 'success', updated: 'blue', deleted: 'error', issued: 'blue',
        in_progress: 'warning', completed: 'success', cancelled: 'error',
        returned: 'warning', stock_updated: 'blue', finished_goods_added: 'success', material_returned: 'warning'
      };
      return map[row.action] || 'neutral';
    },
    cell: ({ row }) => (
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${ACTION_COLORS[row.action] || 'bg-zinc-100 text-zinc-600'}`}>
        {row.action.replace('_', ' ')}
      </span>
    ),
  },
  {
    header: 'User',
    id: 'user_name',
    type: 'text',
    cell: ({ row }) => (
      <span className="text-sm text-zinc-700">{row.user_name || 'System'}</span>
    ),
  },
  {
    header: 'Details',
    id: 'action_details',
    type: 'text',
    cell: ({ row }) => (
      <div className="flex flex-wrap">
        {formatDetails(row.action_details)}
      </div>
    ),
  },
];

export default function ActivityLog({ onNavigate }: ActivityLogProps) {
  const { organisation, user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
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

  const pagedData = logs?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) || [];

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
                <button onClick={() => clearSelected(Array.from(selectedIds).map(String))} disabled={isClearing}
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
        {/* Filters */}
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

        {/* Table */}
        <Table<LogEntry>
          data={pagedData}
          columns={columns}
          loading={isLoading}
          page={page}
          pageSize={PAGE_SIZE}
          totalRows={logs?.length || 0}
          pagination
          onPageChange={setPage}
          selectable
          selectedRowIds={selectedIds}
          onRowSelectChange={(row, checked) => {
            setSelectedIds(prev => {
              const next = new Set(prev);
              if (checked) next.add(row.id); else next.delete(row.id);
              return next;
            });
          }}
          onSelectAllChange={(checked) => {
            if (checked) {
              setSelectedIds(new Set(pagedData.map(r => r.id)));
            } else {
              setSelectedIds(new Set());
            }
          }}
          emptyTitle="No activity found"
          emptySubtitle="No manufacturing activity has been recorded yet."
        />
      </div>
    </div>
  );
}
