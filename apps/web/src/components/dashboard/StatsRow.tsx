import { Building2, Wrench, AlertTriangle, Clock } from 'lucide-react';
import { colors, shadows, radii } from '../../design-system';

interface ClaimsStats {
  totalActive: number;
  overdueCount: number;
  criticalCount: number;
}

interface StatsRowProps {
  projectsLoading: boolean;
  projectsCount: number;
  claimsLoading: boolean;
  claimsStats: ClaimsStats;
}

export function StatsRow({ projectsLoading, projectsCount, claimsLoading, claimsStats }: StatsRowProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
      
      {/* Stat 1: Active Projects */}
      <div style={{
        background: 'white',
        borderRadius: radii.md,
        padding: '20px',
        border: `1px solid ${colors.gray[200]}`,
        boxShadow: shadows.sm,
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{ background: colors.primary[50], color: colors.primary[600], padding: '12px', borderRadius: radii.DEFAULT }}>
          <Building2 size={24} />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: colors.gray[500], textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Projects</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: colors.gray[900], marginTop: '4px' }}>
            {projectsLoading ? '...' : projectsCount}
          </div>
        </div>
      </div>

      {/* Stat 2: Active Warranty Claims */}
      <div style={{
        background: 'white',
        borderRadius: radii.md,
        padding: '20px',
        border: `1px solid ${colors.gray[200]}`,
        boxShadow: shadows.sm,
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{ background: colors.info.light, color: colors.info.dark, padding: '12px', borderRadius: radii.DEFAULT }}>
          <Wrench size={24} />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: colors.gray[500], textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Claims</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: colors.gray[900], marginTop: '4px' }}>
            {claimsLoading ? '...' : claimsStats.totalActive}
          </div>
        </div>
      </div>

      {/* Stat 3: Overdue SLA Claims */}
      <div style={{
        background: claimsStats.overdueCount > 0 ? '#fff5f5' : 'white',
        borderRadius: radii.md,
        padding: '20px',
        border: `1px solid ${claimsStats.overdueCount > 0 ? '#feb2b2' : colors.gray[200]}`,
        boxShadow: shadows.sm,
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{
          background: claimsStats.overdueCount > 0 ? colors.error.light : colors.gray[100],
          color: claimsStats.overdueCount > 0 ? colors.error.dark : colors.gray[500],
          padding: '12px',
          borderRadius: radii.DEFAULT
        }}>
          <AlertTriangle size={24} />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: colors.gray[500], textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overdue SLA</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: claimsStats.overdueCount > 0 ? colors.error.dark : colors.gray[900], marginTop: '4px' }}>
            {claimsLoading ? '...' : claimsStats.overdueCount}
          </div>
        </div>
      </div>

      {/* Stat 4: Critical SLA (<= 3 Days) */}
      <div style={{
        background: claimsStats.criticalCount > 0 ? '#fffdf5' : 'white',
        borderRadius: radii.md,
        padding: '20px',
        border: `1px solid ${claimsStats.criticalCount > 0 ? '#fef3c7' : colors.gray[200]}`,
        boxShadow: shadows.sm,
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{
          background: claimsStats.criticalCount > 0 ? colors.warning.light : colors.gray[100],
          color: claimsStats.criticalCount > 0 ? colors.warning.dark : colors.gray[500],
          padding: '12px',
          borderRadius: radii.DEFAULT
        }}>
          <Clock size={24} />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: colors.gray[500], textTransform: 'uppercase', letterSpacing: '0.05em' }}>Critical SLA</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: claimsStats.criticalCount > 0 ? colors.warning.dark : colors.gray[900], marginTop: '4px' }}>
            {claimsLoading ? '...' : claimsStats.criticalCount}
          </div>
        </div>
      </div>

    </div>
  );
}
