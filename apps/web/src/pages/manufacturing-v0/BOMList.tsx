import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '../../lib/logger';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { Table, ColumnDef, RowAction } from '../../components/table';

type BOMListProps = {
  onNavigate: (path: string) => void;
};

type BOMRow = {
  id: string;
  bom_code: string;
  product_name: string;
  output_qty: number;
  output_unit: string;
  is_active: boolean;
  created_at: string;
};

const statusConfig = {
  active: { label: 'Active', dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  inactive: { label: 'Inactive', dot: 'bg-zinc-300', bg: 'bg-zinc-50', text: 'text-zinc-500' },
} as const;

const columns: ColumnDef<BOMRow>[] = [
  {
    header: 'BOM Code',
    accessorKey: 'bom_code',
    id: 'bom_code',
    type: 'id',
  },
  {
    header: 'Product Name',
    accessorKey: 'product_name',
    id: 'product_name',
    type: 'text',
  },
  {
    header: 'Output',
    id: 'output',
    type: 'text',
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.output_qty} <span className="text-zinc-400">{row.output_unit}</span>
      </span>
    ),
  },
  {
    header: 'Status',
    id: 'status',
    type: 'status',
    statusType: (row) => (row.is_active ? 'success' : 'neutral'),
    cell: ({ row }) => {
      const status = row.is_active ? statusConfig.active : statusConfig.inactive;
      return (
        <span className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full ${status.bg} ${status.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      );
    },
  },
  {
    header: 'Created',
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

export default function BOMList({ onNavigate }: BOMListProps) {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; code: string; name: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  const deleteBOM = useMutation({
    mutationFn: async (bomId: string) => {
      const [jobCards, schedules] = await Promise.all([
        supabase.from('job_cards').select('id', { count: 'exact', head: true }).eq('bom_id', bomId),
        supabase.from('production_schedule_items').select('id', { count: 'exact', head: true }).eq('bom_id', bomId),
      ]);
      const jcCount = jobCards.count ?? 0;
      const psCount = schedules.count ?? 0;
      if (jcCount > 0 || psCount > 0) {
        const parts: string[] = [];
        if (jcCount > 0) parts.push(`${jcCount} job card${jcCount !== 1 ? 's' : ''}`);
        if (psCount > 0) parts.push(`${psCount} production schedule${psCount !== 1 ? 's' : ''}`);
        throw new Error(`Cannot delete: this BOM is used by ${parts.join(' and ')}. Remove them first.`);
      }
      const { error } = await supabase.from('bom_headers').delete().eq('id', bomId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boms'] });
      toast.success('BOM deleted');
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete BOM');
    }
  });

  const { data: boms, isLoading } = useQuery({
    queryKey: ['boms', organisation?.id, statusFilter, search],
    queryFn: async () => {
      if (!organisation?.id) return [];
      let query = supabase
        .from('bom_headers')
        .select('*')
        .eq('organisation_id', organisation.id);
      if (statusFilter === 'active') query = query.eq('is_active', true);
      else if (statusFilter === 'inactive') query = query.eq('is_active', false);
      if (search) query = query.or(`bom_code.ilike.%${search}%,product_name.ilike.%${search}%`);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as BOMRow[];
    },
    enabled: !!organisation?.id,
  });

  const pagedData = boms?.slice((page - 1) * 12, page * 12) || [];

  const getRowActions = (row: BOMRow): RowAction[] => [
    { label: 'Edit BOM', onClick: () => onNavigate(`/manufacturing/boms/edit?id=${row.id}`) },
    { label: 'Create Job Card', onClick: () => onNavigate(`/manufacturing/job-cards/create?bom=${row.id}`) },
    { label: 'Delete BOM', variant: 'danger', onClick: () => setDeleteTarget({ id: row.id, code: row.bom_code, name: row.product_name }) },
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fb] font-['Inter']">
      {/* Page header */}
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
            <button
              onClick={() => onNavigate('/manufacturing/boms/create')}
              className="inline-flex items-center gap-2 h-10 px-5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.97]"
            >
              <Plus className="w-4 h-4" />
              Create BOM
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1320px] mx-auto px-8 py-6">
        {/* Filter bar */}
        <div className="flex items-center gap-4 mb-5">
          <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl p-1">
            {(['active', 'inactive', 'all'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => { setStatusFilter(opt); setPage(1); }}
                className={`px-4 h-8 text-xs font-medium rounded-lg transition-all ${
                  statusFilter === opt
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <Table<BOMRow>
          data={pagedData}
          columns={columns}
          loading={isLoading}
          page={page}
          pageSize={12}
          totalRows={boms?.length || 0}
          searchable
          sortable
          pagination
          onPageChange={setPage}
          onSearch={(val) => { setSearch(val); setPage(1); }}
          onRowClick={(row) => onNavigate(`/manufacturing/boms/edit?id=${row.id}`)}
          rowActions={getRowActions}
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

/* Delete Confirmation Modal */
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
          <button onClick={onCancel} disabled={isPending}
            className="px-4 h-9 text-[12px] font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50 transition-all">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isPending}
            className="inline-flex items-center gap-1.5 px-4 h-9 text-[12px] font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-60 transition-all">
            {isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting...</> : 'Delete BOM'}
          </button>
        </div>
      </div>
    </div>
  );
}
