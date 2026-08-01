import {
  Activity,
  Calendar,
  BarChart3,
  CheckCircle2,
  Clock,
  MessageSquare,
  MapPin,
  AlertTriangle,
} from 'lucide-react';
import { colors, radii, typography } from '../../design-system';

interface Insight {
  id: string;
  title?: string;
  category?: string;
  status?: string;
  impact_level?: string;
  root_cause?: string;
  created_at?: string;
  assigned_to?: string;
  target_date?: string;
  project_id?: string;
}

interface TopRootCause {
  name: string;
  count: number;
}

interface ContinuousImprovementCenterProps {
  insightsLoading: boolean;
  topRootCauses: TopRootCause[];
  filteredInsightsCount: number;
  nextActionsHistory: any[];
  userMap: Map<string, string>;
  projectMap: Map<string, string>;
}

const ACTIVITY_ICONS: Record<string, any> = {
  communication: MessageSquare,
  visit: MapPin,
  issue: AlertTriangle,
};

const ACTIVITY_COLORS: Record<string, { bg: string; color: string }> = {
  communication: { bg: '#eff6ff', color: '#1d4ed8' },
  visit: { bg: '#ccfbf1', color: '#0f766e' },
  issue: { bg: '#fee2e2', color: '#b91c1c' },
};

export function ContinuousImprovementCenter({
  insightsLoading,
  topRootCauses,
  filteredInsightsCount,
  nextActionsHistory,
  userMap,
  projectMap,
}: ContinuousImprovementCenterProps) {
  const recentActivity = nextActionsHistory.slice(0, 5);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
      {/* Activity Feed */}
      <div style={{
        background: 'linear-gradient(135deg, #fafbff 0%, #f8faff 100%)',
        borderRadius: radii.lg,
        border: `1px solid ${colors.gray[200]}`,
        padding: '14px 16px',
        transition: 'all 0.25s ease',
      }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        <h3 style={{
          fontSize: typography.sizes.lg.size,
          fontWeight: 700,
          color: colors.gray[900],
          margin: '0 0 10px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <Activity size={16} style={{ color: colors.primary[500] }} />
          Activity feed
        </h3>

        {recentActivity.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', marginBottom: '6px' }}>📋</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: colors.gray[600] }}>You're all caught up</div>
            <div style={{ fontSize: '11px', color: colors.gray[400], marginTop: '2px' }}>No recent activity to review.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentActivity.map((item: any, idx: number) => {
              const Icon = ACTIVITY_ICONS[item.source] || Clock;
              const clr = ACTIVITY_COLORS[item.source] || { bg: colors.gray[100], color: colors.gray[500] };
              return (
                <div key={item.id || idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: radii.sm,
                    background: clr.bg,
                    color: clr.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: colors.gray[800], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title || 'Action'}
                    </div>
                    <div style={{ fontSize: '11px', color: colors.gray[400], marginTop: '2px' }}>
                      {item.date ? new Date(item.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upcoming Deadlines */}
      <div style={{
        background: 'linear-gradient(135deg, #fefcf8 0%, #fef9ee 100%)',
        borderRadius: radii.lg,
        border: `1px solid ${colors.gray[200]}`,
        padding: '14px 16px',
        transition: 'all 0.25s ease',
      }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        <h3 style={{
          fontSize: typography.sizes.lg.size,
          fontWeight: 700,
          color: colors.gray[900],
          margin: '0 0 10px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <Calendar size={16} style={{ color: colors.warning.DEFAULT }} />
          Upcoming deadlines
        </h3>

        {insightsLoading ? (
          <div style={{ color: colors.gray[400], fontSize: '12px', padding: '16px 0', textAlign: 'center' }}>Loading...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {topRootCauses.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', marginBottom: '6px' }}>🎉</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: colors.gray[600] }}>No deadlines this week</div>
                <div style={{ fontSize: '11px', color: colors.gray[400], marginTop: '2px' }}>Everything is on track.</div>
              </div>
            ) : (
              topRootCauses.slice(0, 4).map((rc) => (
                <div key={rc.name} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  borderRadius: radii.DEFAULT,
                  background: colors.gray[50],
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: colors.gray[700], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rc.name}
                  </span>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: radii.full,
                    fontSize: '11px',
                    fontWeight: 600,
                    background: colors.primary[50],
                    color: colors.primary[700],
                    flexShrink: 0,
                    marginLeft: '8px',
                  }}>
                    {rc.count}x
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Root Cause Breakdown (Bar Chart) */}
      <div style={{
        background: 'linear-gradient(135deg, #fef5f5 0%, #fef2f2 100%)',
        borderRadius: radii.lg,
        border: `1px solid ${colors.gray[200]}`,
        padding: '14px 16px',
        transition: 'all 0.25s ease',
      }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        <h3 style={{
          fontSize: typography.sizes.lg.size,
          fontWeight: 700,
          color: colors.gray[900],
          margin: '0 0 10px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <BarChart3 size={16} style={{ color: colors.error.DEFAULT }} />
          Root cause breakdown
        </h3>

        {insightsLoading ? (
          <div style={{ color: colors.gray[400], fontSize: '12px', padding: '16px 0', textAlign: 'center' }}>Loading...</div>
        ) : topRootCauses.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', marginBottom: '6px' }}>🔍</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: colors.gray[600] }}>No root causes detected</div>
            <div style={{ fontSize: '11px', color: colors.gray[400], marginTop: '2px' }}>Keep monitoring project quality.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topRootCauses.slice(0, 4).map((rc) => {
              const maxCount = Math.max(...topRootCauses.map(r => r.count), 1);
              const pct = Math.round((rc.count / maxCount) * 100);
              return (
                <div key={rc.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: colors.gray[700], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                      {rc.name}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: colors.gray[500] }}>
                      {rc.count}
                    </span>
                  </div>
                  <div style={{ height: '6px', background: colors.gray[100], borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      borderRadius: '3px',
                      background: `linear-gradient(90deg, ${colors.error.DEFAULT}, ${colors.error.light})`,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
