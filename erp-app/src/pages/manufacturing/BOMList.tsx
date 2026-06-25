import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '../../lib/logger';
import {
  Plus, Search, MoreHorizontal, ChevronLeft, ChevronRight,
  Package, Trash2, Loader2
} from 'lucide-react';

type BOMListProps = {
  onNavigate: (path: string) => void;
};

const PAGE_SIZE = 12;

const statusConfig = {
  active: { label: 'Active', dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  inactive: { label: 'Inactive', dot: 'bg-zinc-300', bg: 'bg-zinc-50', text: 'text-zinc-500' },
} as const;

export default function BOMList({ onNavigate }: BOMListProps) {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; code: string; name: string } | null>(null);

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
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  const totalPages = boms ? Math.ceil(boms.length / PAGE_SIZE) : 1;
  const pagedData = boms?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) || [];

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
        {/* ─── Filter bar ─── */}
        <div className="flex items-center gap-4 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search BOMs..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full h-10 pl-10 pr-4 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-zinc-400"
            />
          </div>
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

        {/* ─── Table card ─── */}
        <div className="bg-white border border-zinc-200/80 rounded-2xl overflow-visible shadow-sm">
          <div className="overflow-visible">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  {['BOM Code', 'Product Name', 'Output', 'Status', 'Created'].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-4 text-left text-[11px] font-semibold tracking-wider uppercase text-zinc-400 bg-zinc-50/80 border-b border-zinc-200/60 first:rounded-tl-2xl last:rounded-tr-2xl"
                    >
                      {h}
                    </th>
                  ))}
                  <th className="px-6 py-4 text-right text-[11px] font-semibold tracking-wider uppercase text-zinc-400 bg-zinc-50/80 border-b border-zinc-200/60 rounded-tr-2xl w-14" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-zinc-100/80 last:border-0">
                      <td colSpan={6} className="px-6 py-5">
                        <div className="h-4 bg-zinc-100 rounded-md animate-pulse w-full" />
                      </td>
                    </tr>
                  ))
                ) : pagedData.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center mb-4">
                          <Package className="w-6 h-6 text-zinc-300" />
                        </div>
                        <p className="text-sm font-medium text-zinc-500">No BOMs yet</p>
                        <p className="text-xs text-zinc-400 mt-1">Create your first BOM to get started.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagedData.map((bom, idx) => {
                    const status = bom.is_active ? statusConfig.active : statusConfig.inactive;
                    return (
                      <tr
                        key={bom.id}
                        className="group border-b border-zinc-100/80 last:border-0 transition-all duration-150 hover:bg-indigo-50/40 cursor-pointer"
                        style={{ animation: `fadeSlideIn 0.35s ease both`, animationDelay: `${Math.min(idx * 30, 250)}ms` }}
                        onClick={() => onNavigate(`/manufacturing/boms/edit?id=${bom.id}`)}
                      >
                        <td className="px-6 py-5 align-middle">
                          <span className="text-sm font-semibold text-zinc-900 tracking-tight font-['Geist']">
                            {bom.bom_code}
                          </span>
                        </td>
                        <td className="px-6 py-5 align-middle">
                          <span className="text-sm text-zinc-700">{bom.product_name}</span>
                        </td>
                        <td className="px-6 py-5 align-middle">
                          <span className="text-sm tabular-nums text-zinc-600">
                            {bom.output_qty} <span className="text-zinc-400">{bom.output_unit}</span>
                          </span>
                        </td>
                        <td className="px-6 py-5 align-middle">
                          <span className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full ${status.bg} ${status.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-5 align-middle">
                          <span className="text-sm text-zinc-400 tabular-nums">
                            {new Date(bom.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </td>
                        <td className="px-6 py-5 align-middle text-right">
                          <div className="relative inline-block opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <div className="relative inline-block">
                              <ActionMenu
                                onEdit={() => onNavigate(`/manufacturing/boms/edit?id=${bom.id}`)}
                                onJobCard={() => onNavigate(`/manufacturing/job-cards/create?bom=${bom.id}`)}
                                onDelete={() => setDeleteTarget({ id: bom.id, code: bom.bom_code, name: bom.product_name })}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ─── Pagination ─── */}
          {boms && boms.length > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200/60 bg-zinc-50/40 rounded-b-2xl">
              <span className="text-xs text-zinc-400 tabular-nums">
                <span className="font-medium text-zinc-500">{(page - 1) * PAGE_SIZE + 1}</span>
                <span className="mx-1">–</span>
                <span className="font-medium text-zinc-500">{Math.min(page * PAGE_SIZE, boms.length)}</span>
                <span className="mx-1.5">of</span>
                <span className="font-medium text-zinc-500">{boms.length}</span>
                <span className="ml-1">BOM{boms.length !== 1 ? 's' : ''}</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 h-8 px-3 text-xs font-medium text-zinc-500 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.97]"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Prev
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 text-xs font-medium rounded-lg transition-all active:scale-[0.97] ${
                        p === page
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 h-8 px-3 text-xs font-medium text-zinc-500 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.97]"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

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

/* ─── Action Menu Dropdown ─── */
function ActionMenu({ onEdit, onJobCard, onDelete }: { onEdit: () => void; onJobCard: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-all active:scale-[0.94]"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-white border border-zinc-200/80 rounded-xl shadow-xl shadow-black/5 p-1.5 overflow-visible">
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-indigo-50 transition-all"
            >
              Edit BOM
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onJobCard(); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-indigo-50 transition-all"
            >
              Create Job Card
            </button>
            <div className="my-1 border-t border-zinc-100" />
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete BOM
            </button>
          </div>
        </>
      )}
    </>
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
