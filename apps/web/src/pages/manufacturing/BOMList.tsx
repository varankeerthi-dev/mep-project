import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import {
  useBomsListQuery,
  useDeleteBOMMutation,
  useCloneBOMMutation
} from '../../features/manufacturing';
import { Table, ColumnDef, RowAction } from '../../components/table';
import { BOMHeader } from '../../features/manufacturing/model/types';

type BOMListProps = {
  onNavigate: (path: string) => void;
};

const PAGE_SIZE = 10;

const FILTER_OPTIONS = [
  { id: 'active', label: 'Active BOMs' },
  { id: 'inactive', label: 'Inactive BOMs' },
  { id: 'all', label: 'All BOMs' },
];

export default function BOMList({ onNavigate }: BOMListProps) {
  const { organisation } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; code: string; name: string } | null>(null);

  const deleteBOM = useDeleteBOMMutation(() => {
    setDeleteTarget(null);
  });

  const cloneBOM = useCloneBOMMutation(() => {
    // list will refresh automatically
  });

  const { data: boms, isLoading } = useBomsListQuery(organisation?.id, statusFilter, search);

  const pagedData = boms?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) || [];

  const columns: ColumnDef<BOMHeader>[] = [
    {
      header: 'BOM Code',
      accessorKey: 'bom_code',
      id: 'bom_code',
      align: 'left',
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-zinc-900 tracking-tight font-['Geist']">
          {row.bom_code}
        </span>
      ),
    },
    {
      header: 'Revision',
      accessorKey: 'revision',
      id: 'revision',
      align: 'left',
      cell: ({ row }) => (
        <span className="text-sm text-zinc-600 tabular-nums">
          {row.revision || '—'}
        </span>
      ),
    },
    {
      header: 'Product Name',
      accessorKey: 'product_name',
      id: 'product_name',
      align: 'left',
    },
    {
      header: 'Type',
      accessorKey: 'bom_type',
      id: 'bom_type',
      align: 'left',
      cell: ({ row }) => (
        <span className="text-xs text-zinc-500 capitalize">
          {row.bom_type || 'assembly'}
        </span>
      ),
    },
    {
      header: 'Output',
      id: 'output',
      align: 'left',
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-zinc-600">
          {row.output_qty} <span className="text-zinc-400">{row.output_unit}</span>
        </span>
      ),
    },
    {
      header: 'Est. Cost',
      id: 'total_estimated_cost',
      align: 'left',
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-zinc-600">
          ₹{(row.total_estimated_cost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Status',
      id: 'status',
      align: 'left',
      type: 'status',
      statusType: (row) => row.is_active ? 'success' : 'neutral',
    },
    {
      header: 'Created',
      id: 'created_at',
      align: 'left',
      cell: ({ row }) => (
        <span className="text-sm text-zinc-400 tabular-nums">
          {row.created_at ? new Date(row.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
        </span>
      ),
    },
  ];

  const getRowActions = (row: BOMHeader): RowAction[] => [
    {
      label: 'Edit BOM',
      onClick: () => onNavigate(`/manufacturing/boms/edit?id=${row.id}`),
    },
    {
      label: 'Clone BOM',
      onClick: () => cloneBOM.mutate({ sourceBomId: row.id!, orgId: row.organisation_id }),
    },
    {
      label: 'Create Job Card',
      onClick: () => onNavigate(`/manufacturing/job-cards/create?bom=${row.id}`),
    },
    {
      label: 'Delete BOM',
      onClick: () => setDeleteTarget({ id: row.id!, code: row.bom_code, name: row.product_name }),
      variant: 'danger',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fb] font-['Inter']">
      {/* ─── Page header ─── */}
      <div className="border-b border-zinc-200/80 bg-white">
        <div className="max-w-[1320px] mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-400">
                Manufacturing
              </span>
              <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900 mt-0.5 font-['Geist']">
                Bills of Materials
              </h1>
              <p className="text-[13px] text-zinc-400 mt-0.5">
                Define product-to-material mappings
              </p>
            </div>
            <Button
              onClick={() => onNavigate('/manufacturing/boms/create')}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              className="h-9 px-4 bg-zinc-900 text-white text-[13px] font-medium hover:bg-zinc-800 border-zinc-950 shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
            >
              Create BOM
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-[1320px] mx-auto px-8 py-6">
        <Table<BOMHeader>
          data={pagedData}
          columns={columns}
          loading={isLoading}
          page={page}
          pageSize={PAGE_SIZE}
          totalRows={boms?.length || 0}
          searchable
          pagination
          onPageChange={setPage}
          onSearch={(val) => { setSearch(val); setPage(1); }}
          filterOptions={FILTER_OPTIONS}
          selectedFilterId={statusFilter}
          onFilterSelect={(id) => { setStatusFilter(id as any); setPage(1); }}
          rowActions={getRowActions}
          onRowClick={(row) => onNavigate(`/manufacturing/boms/edit?id=${row.id}`)}
          emptyTitle="No BOMs yet"
          emptySubtitle="Create your first BOM to get started."
        />
      </div>

      {deleteTarget && (
        <DeleteBOMModal
          target={deleteTarget}
          isPending={deleteBOM.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteBOM.mutate(deleteTarget.id)}
        />
      )}
    </div>
  );
}

/* ─── Delete Confirmation Modal ─── */
function DeleteBOMModal({ target, onCancel, onConfirm, isPending }: {
  target: { id: string; code: string; name: string };
  onCancel: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => !isPending && onCancel()}>
      <div className="bg-white rounded-2xl p-6 max-w-[420px] w-[90%] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-rose-600" />
          </div>
          <h3 className="text-[15px] font-semibold text-zinc-900 m-0">Delete this BOM?</h3>
        </div>
        <p className="text-[13px] text-zinc-700 leading-[18px] mt-0 mb-1">
          <strong>{target.code}</strong> · {target.name}
        </p>
        <p className="text-[12px] text-zinc-500 leading-[18px] mt-0 mb-5">
          This will permanently remove the BOM and all its material rows. Job cards or production schedules that reference this BOM will block the delete. This action cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <Button onClick={onCancel} disabled={isPending} variant="secondary" size="sm">
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending}
            loading={isPending}
            loadingText="Deleting..."
            variant="destructive"
            size="sm"
          >
            Delete BOM
          </Button>
        </div>
      </div>
    </div>
  );
}
