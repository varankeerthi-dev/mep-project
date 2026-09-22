import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabase';
import { useAuth } from '@/App';
import { purchaseReturnService } from '../services/purchaseReturnService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, RefreshCcw, Eye, Trash2, ArrowRight } from 'lucide-react';

type StatusFilter = 'all' | 'draft' | 'approved' | 'rejected' | 'converted';

export function PurchaseReturnList({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data: purchaseReturns = [], isLoading, refetch } = useQuery({
    queryKey: ['purchase-returns', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      return purchaseReturnService.getPurchaseReturns(organisation.id);
    },
    enabled: !!organisation?.id,
    staleTime: 2 * 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!organisation?.id) throw new Error('No organisation');
      const { error } = await supabase.from('purchase_returns').delete().eq('id', id).eq('organisation_id', organisation.id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-returns'] });
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!organisation?.id) throw new Error('No organisation');
      return purchaseReturnService.convertToDebitNote(id, organisation.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-returns'] });
      queryClient.invalidateQueries({ queryKey: ['debit-notes'] });
    },
  });

  const filteredReturns = useMemo(() => {
    if (!searchQuery.trim()) return purchaseReturns;
    const q = searchQuery.toLowerCase();
    return purchaseReturns.filter((pr: any) =>
      pr.return_number?.toLowerCase().includes(q) ||
      pr.reason?.toLowerCase().includes(q) ||
      pr.vendor?.company_name?.toLowerCase().includes(q)
    );
  }, [purchaseReturns, searchQuery]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: purchaseReturns.length };
    purchaseReturns.forEach((pr: any) => {
      counts[pr.status] = (counts[pr.status] || 0) + 1;
    });
    return counts;
  }, [purchaseReturns]);

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; color: string }> = {
      draft: { bg: '#f3f4f6', color: '#374151' },
      approved: { bg: '#dcfce7', color: '#166534' },
      rejected: { bg: '#fee2e2', color: '#991b1b' },
      converted: { bg: '#dbeafe', color: '#1e40af' },
    };
    const c = config[status] || config.draft;
    return (
      <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: c.bg, color: c.color }}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  return (
    <div style={{ padding: '24px', background: '#fafafa', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Purchase Returns</h1>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Manage returns to suppliers before converting to Debit Note</p>
          </div>
          <Button onClick={() => onNavigate?.('/purchase-returns/create')} leftIcon={<Plus size={14} />}>
            New Purchase Return
          </Button>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search purchase returns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px 8px 36px', border: '1px solid #d1d5db', borderRadius: '6px',
                  fontSize: '13px', outline: 'none'
                }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
            >
              <option value="all">All Status ({statusCounts.all || 0})</option>
              <option value="draft">Draft ({statusCounts.draft || 0})</option>
              <option value="approved">Approved ({statusCounts.approved || 0})</option>
              <option value="converted">Converted ({statusCounts.converted || 0})</option>
            </select>
          </div>
          <Button variant="secondary" size="sm" onClick={() => refetch()} leftIcon={<RefreshCcw size={14} />}>
            Refresh
          </Button>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                {['Return #', 'Vendor', 'GRN', 'Return Date', 'Type', 'Status', 'Reason', 'Actions'].map((header) => (
                  <th key={header} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>Loading purchase returns...</td></tr>
              ) : filteredReturns.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>No purchase returns found</td></tr>
              ) : (
                filteredReturns.map((pr: any) => (
                  <tr key={pr.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#111827' }}>{pr.return_number}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#334155' }}>{pr.vendor?.company_name || '-'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>{pr.grn?.grn_no || '-'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>{pr.return_date}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>
                      {pr.return_type === 'credit_note' ? 'Credit Note' : 'Delivery Challan'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>{getStatusBadge(pr.status)}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#334155', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pr.reason}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Button variant="ghost" size="icon-xs" onClick={() => onNavigate?.(`/purchase-returns/${pr.id}`)}>
                          <Eye size={14} />
                        </Button>
                        {pr.status === 'approved' && (
                          <Button variant="ghost" size="icon-xs" onClick={() => convertMutation.mutate(pr.id)} title="Convert to Debit Note">
                            <ArrowRight size={14} />
                          </Button>
                        )}
                        {pr.status === 'draft' && (
                          <Button variant="ghost" size="icon-xs" onClick={() => deleteMutation.mutate(pr.id)} className="text-red-500 hover:text-red-600">
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
