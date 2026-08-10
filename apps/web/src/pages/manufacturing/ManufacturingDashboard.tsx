import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Layers, 
  Settings, 
  Calendar, 
  ClipboardCheck, 
  ArrowRight, 
  Play, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Plus, 
  Zap, 
  AlertTriangle,
  FileText
} from 'lucide-react';
import '../operations/operations.css';
import { useAppDateFormat } from '../../contexts/DateFormatContext';

type DashboardProps = {
  onNavigate: (path: string) => void;
};

export default function ManufacturingDashboard({ onNavigate }: DashboardProps) {
  const { organisation } = useAuth();
  const { formatDate } = useAppDateFormat();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['manufacturing-dashboard', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return null;

      const [boms, jobCards, productionEntries, schedules, qcInspections] = await Promise.all([
        supabase
          .from('bom_headers')
          .select('id', { count: 'exact', head: true })
          .eq('organisation_id', organisation.id)
          .eq('is_active', true),
        supabase
          .from('job_cards')
          .select('id, job_card_no, status, product_name, planned_qty')
          .eq('organisation_id', organisation.id),
        supabase
          .from('production_entries')
          .select('id', { count: 'exact', head: true })
          .eq('organisation_id', organisation.id)
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from('production_schedules')
          .select('id, schedule_no, schedule_name, schedule_date, status')
          .eq('organisation_id', organisation.id),
        supabase
          .from('fg_qc_inspections')
          .select('id, inspection_no, inspection_result, product_id, materials:product_id (name)')
          .eq('organisation_id', organisation.id)
      ]);

      const jobCardsList = jobCards.data || [];
      const schedulesList = schedules.data || [];
      const qcInspectionsList = qcInspections.data || [];

      const activeJobCards = jobCardsList.filter(jc => jc.status === 'in_progress' || jc.status === 'issued').length;
      const activeSchedules = schedulesList.filter(s => s.status === 'in_progress' || s.status === 'planned').length;
      const pendingQCs = qcInspectionsList.filter(qc => qc.inspection_result === 'pending').length;

      const jobCardsByStatus = jobCardsList.reduce((acc, jc) => {
        acc[jc.status] = (acc[jc.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Recent 3 in progress job cards
      const liveJobs = jobCardsList
        .filter(jc => jc.status === 'in_progress')
        .slice(0, 3);

      // Pending action lists
      const pendingAttention = [];
      
      // 1. Job cards in draft state
      jobCardsList.filter(jc => jc.status === 'draft').forEach(jc => {
        pendingAttention.push({
          type: 'job_card_draft',
          title: `Approve and Issue Job Card ${jc.job_card_no || jc.id.slice(0, 8)}`,
          desc: `Ready for product ${jc.product_name || 'N/A'} (Qty: ${jc.planned_qty || 0})`,
          path: '/manufacturing/job-cards',
          badge: 'Draft',
          badgeColor: 'var(--ink-soft)',
          badgeBg: 'var(--surface-alt)'
        });
      });

      // 2. Pending QC Inspections
      qcInspectionsList.filter(qc => qc.inspection_result === 'pending').forEach(qc => {
        pendingAttention.push({
          type: 'qc_pending',
          title: `Inspect Material: ${(qc as any).materials?.name || qc.inspection_no || 'N/A'}`,
          desc: `QC request ${qc.inspection_no || (qc.id || '').slice(0, 8)} waiting for inspection`,
          path: '/manufacturing/qc',
          badge: 'QC Pending',
          badgeColor: 'var(--alert)',
          badgeBg: 'var(--alert-soft)'
        });
      });

      // 3. Draft schedules
      schedulesList.filter(s => s.status === 'draft').forEach(s => {
        pendingAttention.push({
          type: 'schedule_draft',
          title: `Finalise Production Schedule: ${s.schedule_name || s.schedule_no || s.id.slice(0, 8)}`,
          desc: `Draft schedule starting on ${s.schedule_date ? formatDate(s.schedule_date) : 'N/A'}`,
          path: '/manufacturing/schedules',
          badge: 'Planned',
          badgeColor: 'var(--purple)',
          badgeBg: 'var(--purple-soft)'
        });
      });

      return {
        activeBOMs: boms.count || 0,
        activeJobCards,
        activeSchedules,
        pendingQCs,
        jobCardsByStatus,
        recentEntries: productionEntries.count || 0,
        liveJobs,
        pendingAttention: pendingAttention.slice(0, 4)
      };
    },
    enabled: !!organisation?.id
  });

  if (isLoading) {
    return (
      <div style={{ padding: '24px', maxWidth: 1500, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ height: 40, width: 300, background: '#e2e8f0', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ height: 120, background: '#e2e8f0', borderRadius: 16, animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="operations-theme" style={{ maxWidth: 1500, margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 28, boxSizing: 'border-box' }}>
      
      {/* 4-Stat Overview Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
        <div className="ops-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active BOMs</span>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--ink)', marginTop: 8 }}>{stats?.activeBOMs || 0}</div>
            </div>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--brand-soft)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={20} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontWeight: 600, color: 'var(--success)' }}>100%</span> active and ready for jobs
          </div>
        </div>

        <div className="ops-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Job Cards</span>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--ink)', marginTop: 8 }}>{stats?.activeJobCards || 0}</div>
            </div>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#fef3c7', color: 'var(--warn)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Settings size={20} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            In Progress & Issued status
          </div>
        </div>

        <div className="ops-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Running Schedules</span>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--ink)', marginTop: 8 }}>{stats?.activeSchedules || 0}</div>
            </div>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--purple-soft)', color: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={20} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            Active production calendars
          </div>
        </div>

        <div className="ops-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending QC Inspects</span>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--ink)', marginTop: 8 }}>{stats?.pendingQCs || 0}</div>
            </div>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--alert-soft)', color: 'var(--alert)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardCheck size={20} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            Quality control items waiting
          </div>
        </div>
      </div>

      {/* Main Grid: Needs Attention & Live Now */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        
        {/* Needs Attention Column */}
        <div className="ops-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={20} style={{ color: 'var(--alert)' }} />
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Needs Attention</h2>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--alert)', background: 'var(--alert-soft)', padding: '3px 8px', borderRadius: 12 }}>
              {stats?.pendingAttention?.length || 0} Tasks
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {stats?.pendingAttention && stats.pendingAttention.length > 0 ? (
              stats.pendingAttention.map((task, i) => (
                <div 
                  key={i} 
                  onClick={() => onNavigate(task.path)}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '14px 18px', 
                    borderRadius: 'var(--radius-sm)', 
                    border: '1px solid var(--border)', 
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  className="ops-card"
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{task.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{task.desc}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: task.badgeColor, background: task.badgeBg, padding: '4px 10px', borderRadius: 8 }}>
                      {task.badge}
                    </span>
                    <ArrowRight size={16} style={{ color: 'var(--ink-faint)' }} />
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '40px 24px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
                <CheckCircle size={32} style={{ color: 'var(--success)', margin: '0 auto 12px' }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>All clear!</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>No pending actions or draft schedules.</div>
              </div>
            )}
          </div>
        </div>

        {/* Live Operations Panel */}
        <div className="ops-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', animation: 'pulse 2s infinite' }}></span>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Live Shopfloor</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
            {stats?.liveJobs && stats.liveJobs.length > 0 ? (
              stats.liveJobs.map((job) => (
                <div 
                  key={job.id} 
                  onClick={() => onNavigate(`/manufacturing/job-cards/${job.id}`)}
                  style={{ padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                  className="ops-card"
                >
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand-soft)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Play size={14} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {job.job_card_no || `JC-${job.id.slice(0, 6).toUpperCase()}`}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Product: {job.product_name}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand)', background: 'var(--brand-soft)', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
                    In Progress
                  </span>
                </div>
              ))
            ) : (
              <div style={{ padding: '40px 16px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                <Clock size={28} style={{ color: 'var(--ink-faint)', marginBottom: 8 }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>No jobs running</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>Shopfloor is currently idle.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid 2: Quick Actions & Job Card status tracker */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        
        {/* Quick Actions Panel */}
        <div className="ops-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={20} style={{ color: 'var(--brand)' }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Quick Actions</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div 
              onClick={() => onNavigate('/manufacturing/boms/create')}
              className="ops-card"
              style={{ padding: 16, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--brand-soft)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={16} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Create BOM</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>Define new bill of materials</div>
              </div>
            </div>

            <div 
              onClick={() => onNavigate('/manufacturing/job-cards/create')}
              className="ops-card"
              style={{ padding: 16, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fef3c7', color: 'var(--warn)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Settings size={16} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Create Job Card</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>Issue production run</div>
              </div>
            </div>

            <div 
              onClick={() => onNavigate('/manufacturing/schedules/create')}
              className="ops-card"
              style={{ padding: 16, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--purple-soft)', color: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={16} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Create Schedule</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>Plan production timings</div>
              </div>
            </div>

            <div 
              onClick={() => onNavigate('/manufacturing/production/create')}
              className="ops-card"
              style={{ padding: 16, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--success-soft)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle size={16} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Record Output</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>Log output and consumption</div>
              </div>
            </div>
          </div>
        </div>

        {/* Job Card Status tracker */}
        <div className="ops-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={20} style={{ color: 'var(--ink-soft)' }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Job Card Status</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { status: 'draft', label: 'Draft', color: 'var(--ink-soft)', bg: 'var(--surface-alt)' },
              { status: 'issued', label: 'Issued', color: 'var(--warn)', bg: '#fef3c7' },
              { status: 'in_progress', label: 'In Progress', color: 'var(--brand)', bg: 'var(--brand-soft)' }
            ].map((item) => {
              const val = stats?.jobCardsByStatus?.[item.status] || 0;
              const total = Object.values(stats?.jobCardsByStatus || {}).reduce((a, b) => a + b, 0) || 1;
              const pct = Math.round((val / total) * 100);

              return (
                <div key={item.status} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.color }}></span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{item.label}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{val}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--surface-alt)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: item.color, borderRadius: 3, transition: 'width 0.3s ease' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}
