import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Trash2, AlertCircle, Loader2, Plus, Search } from 'lucide-react';

type JobCardListProps = {
  onNavigate: (path: string) => void;
};

const PAGE_SIZE = 10;

export default function JobCardList({ onNavigate }: JobCardListProps) {
  const { organisation } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

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

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('.menu-trigger')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
      return data || [];
    },
    enabled: !!organisation?.id
  });

  const totalPages = jobCards ? Math.ceil(jobCards.length / PAGE_SIZE) : 1;
  const pagedData = jobCards?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) || [];

  const statusColors: Record<string, string> = {
    draft: 'bg-zinc-50 text-zinc-700 border-zinc-200',
    issued: 'bg-blue-50 text-blue-700 border-blue-200',
    in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
    completed: 'bg-green-50 text-green-700 border-green-200',
    cancelled: 'bg-rose-50 text-rose-700 border-rose-200'
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
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          
          {/* Filters Bar */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
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

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '10px 24px', fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>Job Card No</th>
                  <th style={{ padding: '10px 24px', fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>Product</th>
                  <th style={{ padding: '10px 24px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textAlign: 'right' }}>Planned Qty</th>
                  <th style={{ padding: '10px 24px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '10px 24px', fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>Created Date</th>
                  <th style={{ padding: '10px 24px', fontSize: '11px', fontWeight: 600, color: '#4b5563', width: '50px' }}></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td colSpan={6} style={{ padding: '16px 24px' }}>
                        <div className="h-4 bg-zinc-150 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : pagedData.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px 24px', textAlign: 'center', fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>
                      No job cards found. Create your first job card to get started.
                    </td>
                  </tr>
                ) : (
                  pagedData.map((jc) => (
                    <tr
                      key={jc.id}
                      style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', transition: 'background 0.15s' }}
                      onClick={() => onNavigate(`/manufacturing/job-cards/${jc.id}`)}
                      onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#111827' }}>{jc.job_card_no}</td>
                      <td style={{ padding: '12px 24px', fontSize: '12px', color: '#374151' }}>{jc.product_name}</td>
                      <td style={{ padding: '12px 24px', fontSize: '12px', color: '#374151', textAlign: 'right' }}>{jc.planned_qty} {jc.output_unit}</td>
                      <td style={{ padding: '12px 24px', textAlign: 'center' }}>
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${statusColors[jc.status] || 'bg-zinc-100 text-zinc-600'}`}>
                          {jc.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 24px', fontSize: '12px', color: '#6b7280' }}>
                        {new Date(jc.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 24px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            const rect = (e.target as HTMLElement).closest('button')!.getBoundingClientRect();
                            setMenuPosition({ top: rect.bottom + 4, right: document.documentElement.clientWidth - rect.right });
                            setOpenMenuId(openMenuId === jc.id ? null : jc.id);
                          }}
                          className="menu-trigger h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <circle cx="10" cy="4" r="1.5" />
                            <circle cx="10" cy="10" r="1.5" />
                            <circle cx="10" cy="16" r="1.5" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {jobCards && jobCards.length > 0 && (
            <div style={{ padding: '12px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, jobCards.length)} of {jobCards.length} job card{jobCards.length !== 1 ? 's' : ''}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    padding: '4px 10px',
                    background: '#fff',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#374151',
                    cursor: page === 1 ? 'not-allowed' : 'pointer',
                    opacity: page === 1 ? 0.5 : 1,
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { if (page !== 1) e.currentTarget.style.background = '#f3f4f6'; }}
                  onMouseLeave={e => { if (page !== 1) e.currentTarget.style.background = '#fff'; }}
                >
                  Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      border: 'none',
                      background: p === page ? '#185FA5' : 'transparent',
                      color: p === page ? '#fff' : '#374151',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => { if (p !== page) e.currentTarget.style.background = '#f3f4f6'; }}
                    onMouseLeave={e => { if (p !== page) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    padding: '4px 10px',
                    background: '#fff',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#374151',
                    cursor: page === totalPages ? 'not-allowed' : 'pointer',
                    opacity: page === totalPages ? 0.5 : 1,
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { if (page !== totalPages) e.currentTarget.style.background = '#f3f4f6'; }}
                  onMouseLeave={e => { if (page !== totalPages) e.currentTarget.style.background = '#fff'; }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Menu dropdown */}
      {openMenuId && menuPosition && (() => {
        const jc = jobCards?.find(c => c.id === openMenuId);
        if (!jc) return null;
        return (
          <div ref={menuRef}
            style={{ position: 'fixed', top: menuPosition.top, right: menuPosition.right, zIndex: 9999, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '4px', width: '180px', display: 'flex', flexDirection: 'column', gap: '2px' }}
          >
            <button
              onClick={() => { setOpenMenuId(null); onNavigate(`/manufacturing/job-cards/${jc.id}`); }}
              style={{ padding: '6px 12px', background: 'transparent', border: 'none', textAlign: 'left', fontSize: '12px', color: '#374151', cursor: 'pointer', borderRadius: '6px', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#111827'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#374151'; }}
            >
              View Details
            </button>
            {jc.status === 'draft' && (
              <button
                onClick={() => { setOpenMenuId(null); onNavigate(`/manufacturing/job-cards/${jc.id}`); }}
                style={{ padding: '6px 12px', background: 'transparent', border: 'none', textAlign: 'left', fontSize: '12px', color: '#374151', cursor: 'pointer', borderRadius: '6px', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#111827'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#374151'; }}
              >
                Issue Materials
              </button>
            )}
            {jc.status === 'issued' && (
              <button
                onClick={() => { setOpenMenuId(null); onNavigate(`/manufacturing/production/create?jobCard=${jc.id}`); }}
                style={{ padding: '6px 12px', background: 'transparent', border: 'none', textAlign: 'left', fontSize: '12px', color: '#374151', cursor: 'pointer', borderRadius: '6px', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#111827'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#374151'; }}
              >
                Record Production
              </button>
            )}
            {jc.status === 'draft' && (
              <button
                onClick={() => { setOpenMenuId(null); onNavigate(`/manufacturing/job-cards/create?bom=${jc.bom_id}`); }}
                style={{ padding: '6px 12px', background: 'transparent', border: 'none', textAlign: 'left', fontSize: '12px', color: '#374151', cursor: 'pointer', borderRadius: '6px', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#111827'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#374151'; }}
              >
                Create Similar
              </button>
            )}
            {(jc.status === 'draft' || jc.status === 'cancelled') && (
              <button
                onClick={() => { setOpenMenuId(null); setDeleteConfirmId(jc.id); }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderTop: '1px solid #f3f4f6', marginTop: '4px', paddingTop: '8px', background: 'transparent', borderLeft: 'none', borderRight: 'none', borderBottom: 'none', textAlign: 'left', fontSize: '12px', color: '#3f3f46', cursor: 'pointer', borderRadius: '0 0 6px 6px', transition: 'all 0.15s', width: '100%' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#fafafa'; e.currentTarget.style.color = '#18181b'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#3f3f46'; }}
              >
                <Trash2 size={13} /> Delete Job Card
              </button>
            )}
          </div>
        );
      })()}

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
