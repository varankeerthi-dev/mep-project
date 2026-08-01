import { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus } from 'lucide-react';
import { useProductionPlansQuery } from '../../../features/manufacturing';
import { Table, ColumnDef, RowAction } from '../../../components/table';
import { ProductionPlan } from '../../../features/manufacturing/model/types';

type ProductionPlanListProps = {
  onNavigate?: (path: string) => void;
};

const PAGE_SIZE = 10;

const FILTER_OPTIONS = [
  { id: 'all', label: 'All Plans' },
  { id: 'draft', label: 'Draft' },
  { id: 'approved', label: 'Approved' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
];

export default function ProductionPlanList({ onNavigate }: ProductionPlanListProps) {
  const { organisation } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const { data: plans = [], isLoading } = useProductionPlansQuery(
    organisation?.id,
    statusFilter === 'all' ? undefined : statusFilter
  );

  const filteredPlans = plans.filter(plan => {
    if (!search) return true;
    return plan.plan_no.toLowerCase().includes(search.toLowerCase());
  });

  const pagedData = filteredPlans.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: ColumnDef<ProductionPlan>[] = [
    {
      header: 'Plan No',
      accessorKey: 'plan_no',
      id: 'plan_no',
      align: 'left',
      cell: ({ row }) => (
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
          {row.plan_no}
        </span>
      ),
    },
    {
      header: 'Start Date',
      accessorKey: 'plan_period_start',
      id: 'plan_period_start',
      align: 'left',
    },
    {
      header: 'End Date',
      accessorKey: 'plan_period_end',
      id: 'plan_period_end',
      align: 'left',
    },
    {
      header: 'Status',
      id: 'status',
      align: 'left',
      type: 'status',
      statusType: (row) => {
        if (row.status === 'completed') return 'success';
        if (row.status === 'approved' || row.status === 'in_progress') return 'warning';
        return 'neutral';
      },
    },
    {
      header: 'Remarks',
      id: 'remarks',
      align: 'left',
      cell: ({ row }) => (
        <span style={{ fontSize: '13px', color: '#6b7280' }}>
          {row.remarks || '—'}
        </span>
      ),
    },
  ];

  const getRowActions = (row: ProductionPlan): RowAction[] => [
    {
      label: 'View Details',
      onClick: () => onNavigate?.(`/manufacturing/plans/${row.id}`),
    },
  ];

  return (
    <div style={{ minHeight: '100%', background: '#fafafa' }}>
      {/* Header Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div>
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Production Demand Plans</h1>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Net customer sales order requirements against active stocks and WIP</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => onNavigate?.('/manufacturing/work-centers')}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              color: '#374151',
              background: '#fff',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Work Centers Setup
          </button>
          <button
            onClick={() => onNavigate?.('/manufacturing/plans/create')}
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
            <Plus size={14} /> New Demand Plan
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
        <Table<ProductionPlan>
          data={pagedData}
          columns={columns}
          loading={isLoading}
          page={page}
          pageSize={PAGE_SIZE}
          totalRows={filteredPlans.length}
          searchable
          pagination
          onPageChange={setPage}
          onSearch={(val) => { setSearch(val); setPage(1); }}
          filterOptions={FILTER_OPTIONS}
          selectedFilterId={statusFilter}
          onFilterSelect={(id) => { setStatusFilter(id); setPage(1); }}
          rowActions={getRowActions}
          onRowClick={(row) => onNavigate?.(`/manufacturing/plans/${row.id}`)}
          onView={(row) => onNavigate?.(`/manufacturing/plans/${row.id}`)}
          emptyTitle="No production plans found"
          emptySubtitle="Generate a new demand plan to aggregate order items and schedule job runs."
        />
      </div>
    </div>
  );
}
