import {
  TrendingDown,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { colors, radii } from '../../design-system';

interface Insight {
  id: string;
  title?: string;
  category?: string;
  status?: string;
  impact_level?: string;
  impact_type?: string;
  root_cause?: string;
  is_repeat_issue?: boolean;
  repeat_issue_count?: number;
  estimated_loss_amount?: string;
  assigned_to?: string;
  target_date?: string;
  project_id?: string;
  resolved_at?: string;
}

interface CostLossItem {
  name: string;
  amount: number;
}

interface TopRootCause {
  name: string;
  count: number;
}

interface ContinuousImprovementCenterProps {
  insightsLoading: boolean;
  openOpportunitiesCount: number;
  criticalCoordinationCount: number;
  bestPracticesCount: number;
  costSavingsSum: number;
  resolvedThisMonthCount: number;
  topRepeatedIssues: Insight[];
  topRootCauses: TopRootCause[];
  filteredInsightsCount: number;
  lossByImpactType: CostLossItem[];
  isPrivileged: boolean;
  openActionItems: Insight[];
  projectMap: Map<string, string>;
  userMap: Map<string, string>;
  onNavigate?: (path: string) => void;
}

export function ContinuousImprovementCenter({
  insightsLoading,
  openOpportunitiesCount,
  criticalCoordinationCount,
  bestPracticesCount,
  costSavingsSum,
  resolvedThisMonthCount,
  topRepeatedIssues,
  topRootCauses,
  filteredInsightsCount,
  lossByImpactType,
  isPrivileged,
  openActionItems,
  projectMap,
  userMap,
  onNavigate,
}: ContinuousImprovementCenterProps) {
  return (
    <div style={{
      background: 'white',
      borderRadius: radii.md,
      padding: '24px',
      border: `1px solid ${colors.gray[200]}`,
      boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      marginTop: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
    }}>
      {/* Section Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${colors.gray[100]}`, paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#f5f3ff', color: '#7c3aed', padding: '10px', borderRadius: radii.DEFAULT }}>
            <TrendingDown size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: colors.gray[900], margin: 0 }}>Continuous Improvement Center</h2>
            <p style={{ fontSize: '14px', color: colors.gray[500], margin: '4px 0 0 0' }}>Operational learning, repeated issue tracking, and cross-project action items</p>
          </div>
        </div>
        {onNavigate && (
          <button
            onClick={() => onNavigate('/projects')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#7c3aed',
              background: '#f5f3ff',
              border: 'none',
              borderRadius: radii.DEFAULT,
              cursor: 'pointer',
              transition: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#ede9fe'}
            onMouseLeave={e => e.currentTarget.style.background = '#f5f3ff'}
          >
            Manage Log <ExternalLink size={14} />
          </button>
        )}
      </div>

      {/* Summary KPIs Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ borderLeft: '4px solid #ef4444', padding: '16px', background: '#fafafa', borderRadius: radii.DEFAULT, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: colors.gray[500], fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Open Opportunities</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: colors.gray[900] }}>
            {insightsLoading ? '...' : openOpportunitiesCount}
          </span>
        </div>

        <div style={{ borderLeft: '4px solid #f59e0b', padding: '16px', background: '#fafafa', borderRadius: radii.DEFAULT, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: colors.gray[500], fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Critical Coordination</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b' }}>
            {insightsLoading ? '...' : criticalCoordinationCount}
          </span>
        </div>

        <div style={{ borderLeft: '4px solid #10b981', padding: '16px', background: '#fafafa', borderRadius: radii.DEFAULT, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: colors.gray[500], fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Best Practices Logged</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: '#10b981' }}>
            {insightsLoading ? '...' : bestPracticesCount}
          </span>
        </div>

        <div style={{ borderLeft: '4px solid #6366f1', padding: '16px', background: '#fafafa', borderRadius: radii.DEFAULT, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: colors.gray[500], fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cost Savings Identified</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: '#6366f1' }}>
            {insightsLoading ? '...' : isPrivileged ? `₹${costSavingsSum.toLocaleString('en-IN')}` : '🔒 Restricted'}
          </span>
        </div>

        <div style={{ borderLeft: '4px solid #3b82f6', padding: '16px', background: '#fafafa', borderRadius: radii.DEFAULT, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: colors.gray[500], fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resolved This Month</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: '#3b82f6' }}>
            {insightsLoading ? '...' : resolvedThisMonthCount}
          </span>
        </div>
      </div>

      {/* Executive Analysis Panels (2-Column Grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '24px' }}>
        {/* Column 1: Top Repeated Issues & Top Root Causes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Repeated Issues */}
          <div style={{ border: `1px solid ${colors.gray[200]}`, borderRadius: radii.DEFAULT, padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: colors.gray[900], margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} style={{ color: '#ef4444' }} /> Top Repeated Issues
            </h3>
            {insightsLoading ? (
              <div style={{ color: colors.gray[400], fontSize: '13px', padding: '12px 0' }}>Loading repeated issues...</div>
            ) : topRepeatedIssues.length === 0 ? (
              <div style={{ color: colors.gray[500], fontSize: '13px', padding: '16px 0', textAlign: 'center', background: '#fafafa', borderRadius: radii.DEFAULT, border: `1px dashed ${colors.gray[200]}` }}>
                No repeated issues flagged yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {topRepeatedIssues.map((issue: Insight) => (
                  <div key={issue.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#fafafa', borderRadius: radii.DEFAULT }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: colors.gray[900], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.title}</div>
                      <div style={{ fontSize: '11px', color: colors.gray[500], marginTop: '2px' }}>
                        {projectMap.get(issue.project_id || '') || 'Unknown Project'} · <span style={{ color: '#ef4444', fontWeight: 600 }}>{issue.category}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '9999px', background: '#fee2e2', color: '#ef4444', marginLeft: '12px', whiteSpace: 'nowrap' }}>
                      Repeated {issue.repeat_issue_count}x
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Root Causes */}
          <div style={{ border: `1px solid ${colors.gray[200]}`, borderRadius: radii.DEFAULT, padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: colors.gray[900], margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={18} style={{ color: '#3b82f6' }} /> Top Root Causes
            </h3>
            {insightsLoading ? (
              <div style={{ color: colors.gray[400], fontSize: '13px', padding: '12px 0' }}>Loading root causes...</div>
            ) : topRootCauses.length === 0 ? (
              <div style={{ color: colors.gray[500], fontSize: '13px', padding: '16px 0', textAlign: 'center', background: '#fafafa', borderRadius: radii.DEFAULT, border: `1px dashed ${colors.gray[200]}` }}>
                No root cause data available.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {topRootCauses.map((rc: TopRootCause) => {
                  const totalWithRootCause = filteredInsightsCount || 1;
                  const percentage = Math.round((rc.count / totalWithRootCause) * 100);
                  return (
                    <div key={rc.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span style={{ fontWeight: 600, color: colors.gray[800] }}>{rc.name}</span>
                        <span style={{ fontWeight: 700, color: colors.gray[500] }}>{rc.count} logs ({percentage}%)</span>
                      </div>
                      <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${percentage}%`, height: '100%', background: '#3b82f6', borderRadius: '3px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Top Cost Loss Categories (gated/restricted fallback) */}
        <div style={{ border: `1px solid ${colors.gray[200]}`, borderRadius: radii.DEFAULT, padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: colors.gray[900], margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingDown size={18} style={{ color: '#6366f1' }} /> Top Cost Loss Categories
          </h3>
          {!isPrivileged ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '80%',
              gap: '12px',
              textAlign: 'center',
              padding: '24px',
              color: colors.gray[500],
              background: '#fafafa',
              borderRadius: radii.DEFAULT,
              border: `1px dashed ${colors.gray[200]}`
            }}>
              <Lock size={32} style={{ color: colors.gray[400] }} />
              <div style={{ fontSize: '15px', fontWeight: 600, color: colors.gray[700] }}>Financial View Restricted</div>
              <p style={{ fontSize: '13px', color: colors.gray[400], margin: 0 }}>Estimated loss amounts and category leakages are only visible to Project Managers and Administrators.</p>
            </div>
          ) : insightsLoading ? (
            <div style={{ color: colors.gray[400], fontSize: '13px', padding: '12px 0' }}>Loading financial leaks...</div>
          ) : lossByImpactType.length === 0 ? (
            <div style={{ color: colors.gray[500], fontSize: '13px', padding: '16px 0', textAlign: 'center', background: '#fafafa', borderRadius: radii.DEFAULT, border: `1px dashed ${colors.gray[200]}` }}>
              No cost leakages recorded.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {lossByImpactType.map((item: CostLossItem) => {
                const maxLoss = Math.max(...lossByImpactType.map(i => i.amount)) || 1;
                const barWidth = Math.round((item.amount / maxLoss) * 100);
                return (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '120px', fontSize: '13px', fontWeight: 600, color: colors.gray[700], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.name}
                    </div>
                    <div style={{ flex: 1, height: '16px', background: '#e5e7eb', borderRadius: radii.sm, overflow: 'hidden', position: 'relative' }}>
                      <div style={{ width: `${barWidth}%`, height: '100%', background: '#6366f1', borderRadius: radii.sm }} />
                    </div>
                    <div style={{ width: '100px', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: '#ef4444' }}>
                      ₹{item.amount.toLocaleString('en-IN')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Open Action Items Grid (Full Width Table) */}
      <div style={{ border: `1px solid ${colors.gray[200]}`, borderRadius: radii.DEFAULT, padding: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: colors.gray[900], margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={18} style={{ color: '#10b981' }} /> Cross-Project Action Items
        </h3>
        {insightsLoading ? (
          <div style={{ color: colors.gray[400], fontSize: '13px', padding: '12px 0' }}>Loading action items...</div>
        ) : openActionItems.length === 0 ? (
          <div style={{ color: colors.gray[500], fontSize: '13px', padding: '24px 0', textAlign: 'center', background: '#fafafa', borderRadius: radii.DEFAULT, border: `1px dashed ${colors.gray[200]}` }}>
            No open action items pending.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', margin: '0 -20px -20px -20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: `1px solid ${colors.gray[200]}` }}>
                  <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: colors.gray[500] }}>Project</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: colors.gray[500] }}>Category</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: colors.gray[500] }}>Title</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: colors.gray[500] }}>Assigned To</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: colors.gray[500] }}>Target Date</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: colors.gray[500] }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {openActionItems.map((item: Insight) => (
                  <tr key={item.id} style={{ borderBottom: `1px solid ${colors.gray[100]}`, fontSize: '13px' }}>
                    <td style={{ padding: '12px 20px', fontWeight: 600, color: colors.gray[700] }}>
                      {projectMap.get(item.project_id || '') || 'Unknown Project'}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span style={{
                        display: 'inline-flex',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: item.category === 'Improvement Opportunity' ? '#fee2e2' :
                                    item.category === 'Best Practice' ? '#dcfce7' :
                                    item.category === 'Coordination Issue' ? '#ffedd5' :
                                    item.category === 'Client Feedback' ? '#eff6ff' :
                                    item.category === 'Safety Observation' ? '#fef3c7' :
                                    item.category === 'Cost Saving Idea' ? '#ccfbf1' : '#f4f4f5',
                        color: item.category === 'Improvement Opportunity' ? '#b91c1c' :
                               item.category === 'Best Practice' ? '#15803d' :
                               item.category === 'Coordination Issue' ? '#c2410c' :
                               item.category === 'Client Feedback' ? '#1d4ed8' :
                               item.category === 'Safety Observation' ? '#b45309' :
                               item.category === 'Cost Saving Idea' ? '#0f766e' : '#3f3f46'
                      }}>
                        {item.category}
                      </span>
                    </td>
                    <td style={{ padding: '12px 20px', color: colors.gray[900], fontWeight: 500 }}>
                      {item.title}
                    </td>
                    <td style={{ padding: '12px 20px', color: colors.gray[600] }}>
                      {userMap.get(item.assigned_to || '') || 'Unassigned'}
                    </td>
                    <td style={{ padding: '12px 20px', color: colors.gray[500] }}>
                      {item.target_date ? new Date(item.target_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span style={{
                        display: 'inline-flex',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: item.status === 'Closed' ? '#d1fae5' :
                                    item.status === 'In Progress' ? '#fef3c7' : '#fee2e2',
                        color: item.status === 'Closed' ? '#065f46' :
                               item.status === 'In Progress' ? '#92400e' : '#991b1b'
                      }}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
