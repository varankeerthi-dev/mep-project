import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';

type BOMListProps = {
  onNavigate: (path: string) => void;
};

const PAGE_SIZE = 10;

export default function BOMList({ onNavigate }: BOMListProps) {
  const { organisation } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
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
    enabled: !!organisation?.id
  });

  const totalPages = boms ? Math.ceil(boms.length / PAGE_SIZE) : 1;
  const pagedData = boms?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) || [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Bills of Materials</h1>
          <p className="text-zinc-500 mt-1">Define product-to-material mappings</p>
        </div>
        <button
          onClick={() => onNavigate('/manufacturing/boms/create')}
          className="h-10 px-5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Create BOM
        </button>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg">
        <div className="p-4 border-b border-zinc-200 flex items-center gap-4">
          <input
            type="text"
            placeholder="Search BOMs..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
            className="h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">BOM Code</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Product Name</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Output</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Status</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Date</th>
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
                    No BOMs found. Create your first BOM to get started.
                  </td>
                </tr>
              ) : (
                pagedData.map((bom) => (
                  <tr
                    key={bom.id}
                    className="border-b border-zinc-100 hover:bg-zinc-50 cursor-pointer"
                    onClick={() => onNavigate(`/manufacturing/boms/edit?id=${bom.id}`)}
                  >
                    <td className="px-6 py-4 font-medium text-zinc-900">{bom.bom_code}</td>
                    <td className="px-6 py-4 text-zinc-700">{bom.product_name}</td>
                    <td className="px-6 py-4 text-zinc-700">{bom.output_qty} {bom.output_unit}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        bom.is_active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'
                      }`}>
                        {bom.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-500 text-sm">
                      {new Date(bom.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-block" ref={openMenuId === bom.id ? menuRef : undefined}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === bom.id ? null : bom.id);
                          }}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <circle cx="10" cy="4" r="1.5" />
                            <circle cx="10" cy="10" r="1.5" />
                            <circle cx="10" cy="16" r="1.5" />
                          </svg>
                        </button>
                        {openMenuId === bom.id && (
                          <div className="absolute right-0 mt-1 w-48 bg-white border border-zinc-200 rounded-lg shadow-lg z-10 py-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                                onNavigate(`/manufacturing/boms/edit?id=${bom.id}`);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                            >
                              Edit BOM
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                                onNavigate(`/manufacturing/job-cards/create?bom=${bom.id}`);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                            >
                              Create Job Card
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

        {boms && boms.length > 0 && (
          <div className="px-6 py-4 border-t border-zinc-200 flex items-center justify-between">
            <span className="text-sm text-zinc-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, boms.length)} of {boms.length} BOM{boms.length !== 1 ? 's' : ''}
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
