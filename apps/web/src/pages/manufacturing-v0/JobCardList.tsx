import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Trash2, Loader2, Plus } from 'lucide-react';
import { Table, ColumnDef, RowAction } from '../../components/table';

type JobCardListProps = {
  onNavigate: (path: string) => void;
};

type JobCardRow = {
  id: string;
  job_card_no: string;
  product_name: string;
  planned_qty: number;
  output_unit: string;
  status: string;
  created_at: string;
  bom_id: string;
};

const statusColors: Record<string, string> = {
  draft: 'bg-zinc-50 text-zinc-700 border-zinc-200',
  issued: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200'
};

const columns: ColumnDef<JobCardRow>[] = [
  {
    header: 'Job Card No',
    accessorKey: 'job_card_no',
    id: 'job_card_no',
    type: 'id',
  },
  {
    header: 'Product',
    accessorKey: 'product_name',
    id: 'product_name',
    type: 'text',
  },
  {
    header: 'Planned Qty',
    id: 'planned_qty',
    type: 'text',
    align: 'right',
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.planned_qty} <span className="text-zinc-400">{row.output_unit}</span>
      </span>
    ),
  },
  {
    header: 'Status',
    id: 'status',
    type: 'status',
    statusType: (row) => {
      const map: Record<string, 'success' | 'blue' | 'warning' | 'error' | 'neutral'> = {
        draft: 'neutral', issued: 'blue', in_progress: 'warning', completed: 'success', cancelled: 'error'
      };
      return map[row.status] || 'neutral';
    },
    cell: ({ row }) => (
      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${statusColors[row.status] || 'bg-zinc-100 text-zinc-600'}`}>
        {row.status.replace('_', ' ')}
      </span>
    ),
  },
  {
    header: 'Created Date',
    accessorKey: 'created_at',
    id: 'created_at',
    type: 'date',
    cell: ({ row }) => (
      <span className="tabular-nums">
        {new Date(row.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      </span>
    ),
  },
];

export default function JobCardList({ onNavigate }: JobCardListProps) {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const deleteJobCard = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('job_card_materials').delete().eq('job_card_id', id);
      const { error } = await supabase.from('job_cards').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-cards'] });
      setDeleteConfirmId(null);
    }
  });

  const { data: jobCards, isLoading } = useQuery({
    queryKey: ['job-cards', organisation?.id, statusFilter, search],
    queryFn: async () => {
      if (!organisation?.id) return [];
      let query = supabase
        .from('job_cards')
        .select('*')
        .eq('organisation_id', organisation.id);
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (search) query = query.or(`job_card_no.ilike.%${search}%,product_name.ilike.%${search}%`);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as JobCardRow[];
    },
    enabled: !!organisation?.id
  });

  const pagedData = jobCards?.slice((page - 1) * 12, page * 12) || [];

  const getRowActions = (row: JobCardRow): RowAction[] => {
    const actions: RowAction[] = [
      { label: 'View Details', onClick: () => onNavigate(`/manufacturing/job-cards/${row.id}`) },
    ];
    if (row.status === 'draft') {
      actions.push({ label: 'Issue Materials', onClick: () => onNavigate(`/manufacturing/job-cards/${row.id}`) });
      actions.push({ label: 'Create Similar', onClick: () => onNavigate(`/manufacturing/job-cards/create?bom=${row.bom_id}`) });
    }
    if (row.status === 'issued') {
      actions.push({ label: 'Record Production', onClick: () => onNavigate(`/manufacturing/production/create?jobCard=${row.id}`) });
    }
    if (row.status !== 'archived') {
      actions.push({ label: 'Delete Job Card', variant: 'danger', onClick: () => setDeleteConfirmId(row.id) });
    }
    return actions;
  };

  const inputStyle: React.CSSProperties = {
    padding: '4px 12px',
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

  return (
    <div style={{ minHeight: '100%', background: '#fafafa' }}>
      {/* Header Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div>
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Job Cards</h1>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Track material issuance and production</span>
        </div>
        <button
          onClick={() => onNavigate('/manufacturing/job-cards/create')}
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
          <Plus size={14} /> Create Job Card
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: '24px', maxWidth: '1200px' }}>
        {/* Filters Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              type="text"
              placeholder="Search job cards by number or product name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ ...inputStyle, paddingLeft: '30px' }}
            />
          </div>
          <div style={{ width: '160px' }}>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              style={inputStyle}
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <Table<JobCardRow>
          data={pagedData}
          columns={columns}
          loading={isLoading}
          page={page}
          pageSize={12}
          totalRows={jobCards?.length || 0}
          searchable
          sortable
          pagination
          onPageChange={setPage}
          onSearch={(val) => { setSearch(val); setPage(1); }}
          onRowClick={(row) => onNavigate(`/manufacturing/job-cards/${row.id}`)}
          rowActions={getRowActions}
          emptyTitle="No job cards found"
          emptySubtitle="Create your first job card to get started."
        />
      </div>

      {/* Confirmation Modal */}
      {deleteConfirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setDeleteConfirmId(null)}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e11d48' }}>
                <Trash2 size={20} />
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', margin: 0 }}>Delete Job Card?</h3>
            </div>
            
            <p style={{ fontSize: '12px', color: '#4b5563', lineHeight: '18px', margin: '0 0 20px 0' }}>
              Are you sure you want to delete this job card? This will also remove all associated raw materials reservations. This action cannot be undone.
            </p>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', height: '36px' }}>
              <button onClick={() => setDeleteConfirmId(null)}
                style={{
                  height: '36px',
                  padding: '0 16px',
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  color: '#4b5563',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}>
                Cancel
              </button>
              <button onClick={() => deleteJobCard.mutate(deleteConfirmId)} disabled={deleteJobCard.isPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '36px',
                  padding: '0 16px',
                  background: '#e11d48',
                  border: '1px solid #e11d48',
                  color: '#fff',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: deleteJobCard.isPending ? 'not-allowed' : 'pointer',
                  opacity: deleteJobCard.isPending ? 0.6 : 1,
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => { if (!deleteJobCard.isPending) e.currentTarget.style.background = '#be123c'; }}
                onMouseLeave={e => { if (!deleteJobCard.isPending) e.currentTarget.style.background = '#e11d48'; }}>
                {deleteJobCard.isPending && <Loader2 size={14} className="animate-spin" />}
                {deleteJobCard.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
