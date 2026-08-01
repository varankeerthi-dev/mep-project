import React from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus, ArrowRight, ClipboardCheck, Import, Layers } from 'lucide-react';
import { supabase } from '../../../supabase';
import {
  useMaterialRequisitionsListQuery,
  useGoodsReceiptNotesListQuery
} from '../../../features/manufacturing';

type StoresDashboardProps = {
  onNavigate?: (path: string) => void;
};

export default function StoresDashboard({ onNavigate }: StoresDashboardProps) {
  const { organisation } = useAuth();

  // Queries
  const { data: requisitions = [], isLoading: reqLoading } = useMaterialRequisitionsListQuery(organisation?.id);
  const { data: grns = [], isLoading: grnLoading } = useGoodsReceiptNotesListQuery(organisation?.id);

  const pendingReqs = requisitions.filter(r => r.status === 'draft' || r.status === 'submitted');
  const pendingGrns = grns.filter(g => g.status === 'draft' || g.status === 'qc_pending');

  // Today's outward count
  const { data: todayOutwardCount = 0 } = useQuery({
    queryKey: ['today-outward-count', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return 0;
      const today = new Date().toISOString().split('T')[0];
      const { count, error } = await supabase
        .from('material_outward')
        .select('*', { count: 'exact', head: true })
        .eq('organisation_id', organisation.id)
        .eq('outward_date', today);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!organisation?.id
  });

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  };

  const widgetStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px',
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    submitted: 'bg-blue-50 text-blue-700 border-blue-200',
    approved: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    issued: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200',
    qc_pending: 'bg-amber-50 text-amber-700 border-amber-200',
    accepted: 'bg-green-50 text-green-700 border-green-200'
  };

  return (
    <div style={{ minHeight: '100%', background: '#fafafa', paddingBottom: '40px' }}>
      {/* Header Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div>
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Stores & Inventory Console (P1)</h1>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Manage raw material inwards (GRN) and production line requisitions</span>
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* KPI Widgets */}
        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={widgetStyle}>
            <div style={{ background: '#eff6ff', color: '#185FA5', padding: '10px', borderRadius: '8px' }}>
              <Layers size={20} />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '10px', color: '#6b7280', fontWeight: 500, textTransform: 'uppercase' }}>Pending Requisitions</span>
              <span style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>{pendingReqs.length}</span>
            </div>
          </div>

          <div style={widgetStyle}>
            <div style={{ background: '#fef3c7', color: '#d97706', padding: '10px', borderRadius: '8px' }}>
              <Import size={20} />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '10px', color: '#6b7280', fontWeight: 500, textTransform: 'uppercase' }}>Pending Inward GRNs</span>
              <span style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>{pendingGrns.length}</span>
            </div>
          </div>

          <div style={widgetStyle}>
            <div style={{ background: '#ecfdf5', color: '#10b981', padding: '10px', borderRadius: '8px' }}>
              <ClipboardCheck size={20} />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '10px', color: '#6b7280', fontWeight: 500, textTransform: 'uppercase' }}>Today's Material Issues</span>
              <span style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>{todayOutwardCount}</span>
            </div>
          </div>
        </div>

        {/* Splits: Left GRNs, Right Requisitions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* GRN raw materials inward card */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', margin: 0 }}>Raw Goods Receipts (GRN)</h3>
              <button
                onClick={() => onNavigate?.('/manufacturing/stores/grn/create')}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', border: '1px solid #185FA5', borderRadius: '4px', background: '#185FA5', color: '#fff', fontSize: '11px', cursor: 'pointer', fontWeight: 500 }}
              >
                <Plus size={12} /> Log GRN
              </button>
            </div>

            {grnLoading ? (
              <div style={{ padding: '24px', display: 'flex', justifyContent: 'center' }}><Loader2 size={16} className="animate-spin text-zinc-400" /></div>
            ) : grns.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: '11px', color: '#6b7280' }}>No goods receipt notes recorded yet.</div>
            ) : (
              <div className="space-y-3" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {grns.slice(0, 5).map(grn => (
                  <div key={grn.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', border: '1px solid #f3f4f6', borderRadius: '6px' }} className="hover:bg-zinc-50">
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827', display: 'block' }}>{grn.grn_no}</span>
                      <span style={{ fontSize: '10px', color: '#6b7280' }}>Vendor: {grn.vendor_name} | Date: {grn.receipt_date}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${statusColors[grn.status] || ''}`}>
                        {grn.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <button
                        onClick={() => onNavigate?.(`/manufacturing/stores/grn/${grn.id}`)}
                        style={{ border: 'none', background: 'transparent', color: '#185FA5', cursor: 'pointer' }}
                      >
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Requisitions card */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', margin: 0 }}>Production Line Requisitions</h3>
            </div>

            {reqLoading ? (
              <div style={{ padding: '24px', display: 'flex', justifyContent: 'center' }}><Loader2 size={16} className="animate-spin text-zinc-400" /></div>
            ) : requisitions.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: '11px', color: '#6b7280' }}>No requisitions submitted yet.</div>
            ) : (
              <div className="space-y-3" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {requisitions.slice(0, 5).map(req => (
                  <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', border: '1px solid #f3f4f6', borderRadius: '6px' }} className="hover:bg-zinc-50">
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827', display: 'block' }}>{req.requisition_no}</span>
                      <span style={{ fontSize: '10px', color: '#6b7280' }}>Job Card: {req.job_cards?.job_card_no} | Product: {req.job_cards?.bom_headers?.product_name || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${statusColors[req.status] || ''}`}>
                        {req.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <button
                        onClick={() => onNavigate?.(`/manufacturing/stores/requisitions/${req.id}`)}
                        style={{ border: 'none', background: 'transparent', color: '#185FA5', cursor: 'pointer' }}
                      >
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
