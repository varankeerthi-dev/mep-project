import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Calendar } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Table, ColumnDef, RowAction } from '../../components/table';
import { useAppDateFormat } from '../../contexts/DateFormatContext';

type ProductionScheduleListProps = {
  onNavigate: (path: string) => void;
};

export default function ProductionScheduleList({ onNavigate }: ProductionScheduleListProps) {
  const { organisation } = useAuth();
  const { formatDate } = useAppDateFormat();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

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

  const statusColors: Record<string, string> = {
    draft: 'bg-zinc-50 text-zinc-700 border-zinc-200',
    planned: 'bg-blue-50 text-blue-700 border-blue-200',
    in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
    completed: 'bg-green-50 text-green-700 border-green-200',
    cancelled: 'bg-rose-50 text-rose-700 border-rose-200'
  };

  const FILTER_OPTIONS = [
    { id: 'all', label: 'All Schedules' },
    { id: 'draft', label: 'Draft' },
    { id: 'planned', label: 'Planned' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  const columns: ColumnDef<any>[] = [
    {
      header: 'Schedule No',
      id: 'schedule_no',
      type: 'text',
      cell: ({ row }) => (
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
          {row.schedule_no}
        </span>
      ),
    },
    {
      header: 'Name',
      id: 'schedule_name',
      type: 'text',
      cell: ({ row }) => (
        <span style={{ fontSize: '13px', color: '#374151' }}>
          {row.schedule_name}
        </span>
      ),
    },
    {
      header: 'Schedule Date',
      id: 'schedule_date',
      type: 'date',
      cell: ({ row }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#374151' }}>
          <Calendar size={13} style={{ color: '#9ca3af' }} />
          {formatDate(row.schedule_date)}
        </div>
      ),
    },
    {
      header: 'Status',
      id: 'status',
      type: 'badge',
      cell: ({ row }) => (
        <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full border ${statusColors[row.status] || 'bg-zinc-50 text-zinc-700 border-zinc-200'}`}>
          {row.status.replace('_', ' ').toUpperCase()}
        </span>
      ),
    },
    {
      header: 'Created',
      id: 'created_at',
      type: 'date',
      cell: ({ row }) => (
        <span style={{ fontSize: '13px', color: '#6b7280' }}>
          {formatDate(row.created_at)}
        </span>
      ),
    },
  ];

  return (
    <div style={{ minHeight: '100%', background: '#fafafa' }}>
      {/* Header Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div>
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Production Schedules</h1>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Group multiple products for production</span>
        </div>
        <Button onClick={() => onNavigate('/manufacturing/schedules/create')} leftIcon={<Plus size={14} />}>
          Create Schedule
        </Button>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
        <Table<any>
          columns={columns}
          data={schedules || []}
          loading={isLoading}
          page={page}
          pageSize={10}
          totalRows={schedules?.length || 0}
          pagination
          onPageChange={setPage}
          onRowClick={(row) => onNavigate(`/manufacturing/schedules/edit?id=${row.id}`)}
          searchable
          onSearch={(val) => { setSearch(val); setPage(1); }}
          filterOptions={FILTER_OPTIONS}
          selectedFilterId={statusFilter}
          onFilterSelect={(id) => { setStatusFilter(id); setPage(1); }}
          rowActions={(row) => {
            const actions: RowAction[] = [
              {
                label: 'Edit Schedule',
                onClick: () => onNavigate(`/manufacturing/schedules/edit?id=${row.id}`)
              }
            ];
            return actions;
          }}
          emptyTitle="No production schedules found"
          emptySubtitle="Create your first schedule to get started."
        />
      </div>
    </div>
  );
}
