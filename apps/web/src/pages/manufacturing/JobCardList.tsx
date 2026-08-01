import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Trash2, Loader2, Plus } from 'lucide-react';
import {
  useJobCardsListQuery,
  useDeleteJobCardMutation
} from '../../features/manufacturing';
import { Table, ColumnDef, RowAction } from '../../components/table';
import { JobCard } from '../../features/manufacturing/model/types';

type JobCardListProps = {
  onNavigate: (path: string) => void;
};

const PAGE_SIZE = 10;

const FILTER_OPTIONS = [
  { id: 'all', label: 'All Status' },
  { id: 'draft', label: 'Draft' },
  { id: 'issued', label: 'Issued' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function JobCardList({ onNavigate }: JobCardListProps) {
  const { organisation } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const deleteJobCard = useDeleteJobCardMutation(() => {
    setDeleteConfirmId(null);
  });

  const filters = statusFilter === 'all' ? undefined : [statusFilter];
  const { data: rawJobCards, isLoading } = useJobCardsListQuery(organisation?.id, filters);

  const jobCards = rawJobCards ? rawJobCards.filter(jc => {
    if (!search) return true;
    const q = search.toLowerCase();
    return jc.job_card_no.toLowerCase().includes(q) || jc.product_name.toLowerCase().includes(q);
  }) : [];

  const pagedData = jobCards?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) || [];

  const columns: ColumnDef<JobCard>[] = [
    {
      header: 'Job Card No',
      accessorKey: 'job_card_no',
      id: 'job_card_no',
      align: 'left',
      cell: ({ row }) => (
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
          {row.job_card_no}
        </span>
      ),
    },
    {
      header: 'Product',
      accessorKey: 'product_name',
      id: 'product_name',
      align: 'left',
    },
    {
      header: 'Planned Qty',
      id: 'planned_qty',
      align: 'left',
      cell: ({ row }) => (
        <span style={{ fontSize: '13px', color: '#374151' }}>
          {row.planned_qty} <span className="text-zinc-400">{row.output_unit}</span>
        </span>
      ),
    },
    {
      header: 'Status',
      id: 'status',
      align: 'left',
      type: 'status',
      statusType: (row) => {
        if (row.status === 'completed') return 'success';
        if (row.status === 'issued' || row.status === 'in_progress') return 'warning';
        if (row.status === 'cancelled') return 'danger';
        return 'neutral';
      },
    },
    {
      header: 'Created Date',
      id: 'created_at',
      align: 'left',
      cell: ({ row }) => (
        <span style={{ fontSize: '13px', color: '#4b5563' }}>
          {row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}
        </span>
      ),
    },
  ];

  const getRowActions = (row: JobCard): RowAction[] => [
    {
      label: 'View Details',
      onClick: () => onNavigate(`/manufacturing/job-cards/${row.id}`),
    },
    {
      label: 'Edit Job Card',
      onClick: () => onNavigate(`/manufacturing/job-cards/edit?id=${row.id}`),
    },
    {
      label: 'Delete Job Card',
      onClick: () => setDeleteConfirmId(row.id!),
      variant: 'danger',
    },
  ];

  return (
    <div style={{ minHeight: '100%', background: '#fafafa' }}>
      {/* Header Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }} className="flex justify-between">
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
      <div style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
        <Table<JobCard>
          data={pagedData}
          columns={columns}
          loading={isLoading}
          page={page}
          pageSize={PAGE_SIZE}
          totalRows={jobCards.length}
          searchable
          pagination
          onPageChange={setPage}
          onSearch={(val) => { setSearch(val); setPage(1); }}
          filterOptions={FILTER_OPTIONS}
          selectedFilterId={statusFilter}
          onFilterSelect={(id) => { setStatusFilter(id); setPage(1); }}
          rowActions={getRowActions}
          onRowClick={(row) => onNavigate(`/manufacturing/job-cards/${row.id}`)}
          onView={(row) => onNavigate(`/manufacturing/job-cards/${row.id}`)}
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
