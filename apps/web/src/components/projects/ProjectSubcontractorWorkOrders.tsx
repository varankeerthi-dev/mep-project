import { useState } from 'react';
import { supabase } from '../../supabase';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Folder } from 'lucide-react';

export function ProjectSubcontractorWorkOrders({
  projectId,
  fmt,
  fmtD,
}: {
  projectId: string;
  fmt: (n: any) => string;
  fmtD: (d?: string | null) => string;
}) {
  const [expandedWoId, setExpandedWoId] = useState<string | null>(null);

  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ['project-subcontractor-work-orders', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subcontractor_work_orders')
        .select('*, subcontractor:subcontractors(company_name, pan_number, gstin)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });

  if (isLoading) {
    return <div className="pl-empty">Loading work orders…</div>;
  }

  const statusColors: Record<string, string> = {
    'Draft': '#94a3b8',
    'Pending Approval': '#f59e0b',
    'Approved': '#10b981',
    'Issued': '#3b82f6',
    'Completed': '#8b5cf6',
    'Cancelled': '#ef4444',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0 8px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
            Subcontractor Work Orders
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            Terms &amp; conditions for on-site reference — read only
          </p>
        </div>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: '#f1f5f9', padding: '4px 10px', borderRadius: '12px', fontWeight: '600' }}>
          {workOrders.length} work order{workOrders.length !== 1 ? 's' : ''}
        </span>
      </div>

      {workOrders.length === 0 ? (
        <div className="pl-empty">
          <Folder className="pl-empty-icon" />
          <p className="pl-empty-text">No subcontractor work orders linked to this project yet.</p>
        </div>
      ) : (
        workOrders.map((wo: any) => {
          const isExpanded = expandedWoId === wo.id;
          const statusColor = statusColors[wo.status] || '#94a3b8';
          const subName = wo.subcontractor?.company_name || 'Unknown';
          const taxBadge = wo.tax_type === 'TDS'
            ? { label: `TDS ${wo.tds_percent || 0}%`, bg: '#fffbeb', color: '#92400e', border: '#f59e0b' }
            : wo.tax_type === 'GST'
            ? { label: 'GST', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }
            : { label: 'Exempt', bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' };

          return (
            <div
              key={wo.id}
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px',
                  padding: '16px 20px', cursor: 'pointer',
                  background: isExpanded ? '#f8fafc' : '#fff',
                  borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                  transition: 'background 0.15s',
                }}
                onClick={() => setExpandedWoId(isExpanded ? null : wo.id)}
              >
                <div style={{ minWidth: '120px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#1a202c' }}>{wo.work_order_no}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{fmtD(wo.issue_date)}</div>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#2d3748' }}>{subName}</div>
                  {wo.work_description && (
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
                      {wo.work_description}
                    </div>
                  )}
                </div>

                <div style={{
                  padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700',
                  background: taxBadge.bg, color: taxBadge.color, border: `1px solid ${taxBadge.border}`,
                }}>
                  {taxBadge.label}
                </div>

                {wo.retention_held && (
                  <div style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                    Retention {wo.retention_percent || 0}%
                  </div>
                )}

                <div style={{ textAlign: 'right', minWidth: '100px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#1a202c' }}>{fmt(wo.total_amount)}</div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>contract value</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '100px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', color: '#4a5568', fontWeight: '500' }}>{wo.status || 'Draft'}</span>
                </div>

                <div style={{ color: '#94a3b8', marginLeft: '8px' }}>
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {isExpanded && (
                <div style={{ padding: '20px 24px', background: '#f8fafc' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8', marginBottom: '12px' }}>Contract Details</div>
                      {[
                        ['Start Date', fmtD(wo.start_date)],
                        ['End Date', fmtD(wo.end_date)],
                        ['Payment Terms', wo.payment_terms || '-'],
                        ['Delivery Terms', wo.delivery_terms || '-'],
                        wo.tax_type === 'TDS' && wo.subcontractor?.pan_number ? ['PAN', wo.subcontractor.pan_number] : null,
                        wo.tax_type === 'GST' && wo.subcontractor?.gstin ? ['GSTIN', wo.subcontractor.gstin] : null,
                      ].filter(Boolean).map(([k, v]: any) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                          <span style={{ color: '#64748b' }}>{k}</span>
                          <span style={{ fontWeight: '600', color: '#1a202c', textAlign: 'right', maxWidth: '60%' }}>{v}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8', marginBottom: '12px' }}>Tax & Retention</div>
                      {wo.retention_held ? (
                        <>
                          <div style={{ marginBottom: '10px', padding: '10px 12px', background: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8', marginBottom: '4px' }}>Retention Terms</div>
                            <div style={{ fontSize: '12px', color: '#1e40af' }}>Hold {wo.retention_percent || 0}% for {wo.retention_duration_months || '-'} months</div>
                            {wo.retention_conditions && (
                              <div style={{ fontSize: '11px', color: '#3b82f6', marginTop: '4px', fontStyle: 'italic' }}>{wo.retention_conditions}</div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', marginBottom: '10px' }}>No retention configured</div>
                      )}

                      {wo.tax_type === 'TDS' && (
                        <div style={{ padding: '10px 12px', background: '#fffbeb', borderRadius: '6px', border: '1px solid #f59e0b' }}>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: '#92400e', marginBottom: '2px' }}>⚠️ TDS Applicable</div>
                          <div style={{ fontSize: '12px', color: '#92400e' }}>Deduct {wo.tds_percent || 0}% TDS before payment</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {wo.terms_conditions && wo.terms_conditions.length > 0 && (
                    <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8', marginBottom: '12px' }}>Terms &amp; Conditions</div>
                      <ol style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {wo.terms_conditions.map((term: any, idx: number) => (
                          <li key={term.id || idx} style={{ fontSize: '13px', color: '#374151', lineHeight: '1.5' }}>
                            {term.text}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
