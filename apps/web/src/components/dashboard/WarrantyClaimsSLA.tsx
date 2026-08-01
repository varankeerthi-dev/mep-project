import { Calendar, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { colors, shadows, radii, typography } from '../../design-system';

interface Claim {
  id: string;
  equipment?: {
    equipment_name?: string;
    project?: { project_name?: string };
  };
  vendor_name?: string;
  status?: string;
  sla_due_date?: string;
  daysRemaining: number | null;
  slaStatus: string;
}

interface WarrantyClaimsSLAProps {
  claimsLoading: boolean;
  claimsStats: {
    claims: Claim[];
  };
  onNavigate?: (path: string) => void;
}

function getCountdownColor(days: number | null): { bg: string; text: string; dot: string } {
  if (days === null) return { bg: colors.gray[100], text: colors.gray[500], dot: colors.gray[400] };
  if (days < 0) return { bg: colors.error.light, text: colors.error.dark, dot: colors.error.DEFAULT };
  if (days <= 3) return { bg: colors.error.light, text: colors.error.dark, dot: colors.error.DEFAULT };
  if (days <= 7) return { bg: colors.warning.light, text: colors.warning.dark, dot: colors.warning.DEFAULT };
  return { bg: colors.success.light, text: colors.success.dark, dot: colors.success.DEFAULT };
}

export function WarrantyClaimsSLA({ claimsLoading, claimsStats, onNavigate }: WarrantyClaimsSLAProps) {
  const topClaims = claimsStats.claims.slice(0, 5);

  return (
    <div>
      {/* Section Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <h2 style={{
          fontSize: typography.sizes['2xl'].size,
          fontWeight: 700,
          color: colors.gray[900],
          margin: 0,
        }}>
          Upcoming deadlines
        </h2>
      </div>

      {claimsLoading ? (
        <div style={{ textAlign: 'center', padding: '32px', color: colors.gray[400], fontSize: '14px' }}>
          Loading deadlines...
        </div>
      ) : topClaims.length === 0 ? (
        <div style={{
          padding: '32px',
          textAlign: 'center',
          borderRadius: radii.lg,
          border: `1px dashed ${colors.gray[200]}`,
          background: 'white',
          color: colors.gray[500],
        }}>
          <CheckCircle2 size={32} style={{ color: colors.success.DEFAULT, marginBottom: '8px' }} />
          <div style={{ fontSize: '15px', fontWeight: 600, color: colors.gray[700] }}>No deadlines</div>
          <div style={{ fontSize: '13px', color: colors.gray[400], marginTop: '4px' }}>All claims cleared.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {topClaims.map((claim: Claim) => {
            const countdown = getCountdownColor(claim.daysRemaining);
            return (
              <div
                key={claim.id}
                onClick={() => onNavigate?.('/projects')}
                style={{
                  background: 'white',
                  borderRadius: radii.lg,
                  border: `1px solid ${colors.gray[200]}`,
                  padding: '10px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = shadows.elevated;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: radii.md,
                  background: colors.primary[50],
                  color: colors.primary[600],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {claim.vendor_name?.charAt(0) || 'V'}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{                     fontSize: '13px', fontWeight: 600, color: colors.gray[900], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {claim.equipment?.equipment_name || 'Equipment Claim'}
                  </div>
                  <div style={{ fontSize: '11px', color: colors.gray[500], marginTop: '1px' }}>
                    {claim.equipment?.project?.project_name || 'MEP Project'}
                  </div>
                </div>

                {/* Countdown badge */}
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 10px',
                  borderRadius: radii.full,
                  fontSize: '12px',
                  fontWeight: 600,
                  background: countdown.bg,
                  color: countdown.text,
                  flexShrink: 0,
                }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: countdown.dot }} />
                  {claim.daysRemaining !== null ? (
                    claim.daysRemaining < 0 ? `${Math.abs(claim.daysRemaining)}d overdue` : `${claim.daysRemaining}d left`
                  ) : 'No SLA'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
