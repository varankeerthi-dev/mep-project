import { ShieldAlert, Calendar, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { colors, shadows, radii } from '../../design-system';

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

export function WarrantyClaimsSLA({ claimsLoading, claimsStats, onNavigate }: WarrantyClaimsSLAProps) {
  return (
    <div style={{ background: 'white', borderRadius: radii.md, padding: '24px', border: `1px solid ${colors.gray[200]}`, boxShadow: shadows.sm }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <ShieldAlert size={20} style={{ color: claimsStats.claims.some(c => c.slaStatus === 'overdue') ? colors.error.DEFAULT : colors.info.DEFAULT }} />
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: colors.gray[900], margin: 0 }}>Warranty Claims SLA</h2>
      </div>
      <p style={{ fontSize: '14px', color: colors.gray[500], margin: '0 0 20px 0' }}>
        Active notifications and response-time tracking for vendor replacement claims.
      </p>

      {claimsLoading ? (
        <div style={{ textAlign: 'center', padding: '24px', color: colors.gray[400], fontSize: '14px' }}>
          Loading active claims...
        </div>
      ) : claimsStats.claims.length === 0 ? (
        <div style={{
          padding: '32px 16px',
          textAlign: 'center',
          borderRadius: radii.md,
          border: `2px dashed ${colors.gray[200]}`,
          background: '#fafafa',
          color: colors.gray[500],
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={32} style={{ color: colors.success.DEFAULT }} />
          <div style={{ fontSize: '15px', fontWeight: 600 }}>All Claims Cleared</div>
          <div style={{ fontSize: '13px', color: colors.gray[400] }}>No active warranty claims pending vendor resolution.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
          {claimsStats.claims.map((claim: Claim) => {
            let cardBorder = `1px solid ${colors.gray[200]}`;
            let leftStripColor = colors.gray[300];
            let badgeBg = colors.gray[100];
            let badgeText = colors.gray[700];
            let BadgeIcon = Calendar;
            let label = 'Active';

            if (claim.slaStatus === 'overdue') {
              cardBorder = `1px solid #fec5c5`;
              leftStripColor = colors.error.DEFAULT;
              badgeBg = colors.error.light;
              badgeText = colors.error.dark;
              BadgeIcon = AlertTriangle;
              label = `Overdue by ${Math.abs(claim.daysRemaining!)}d`;
            } else if (claim.slaStatus === 'critical') {
              cardBorder = `1px solid #fef3c7`;
              leftStripColor = colors.warning.DEFAULT;
              badgeBg = colors.warning.light;
              badgeText = colors.warning.dark;
              BadgeIcon = Clock;
              label = `${claim.daysRemaining} days left`;
            } else if (claim.daysRemaining !== null) {
              leftStripColor = colors.primary[500];
              badgeBg = colors.primary[100];
              badgeText = colors.primary[700];
              BadgeIcon = Calendar;
              label = `${claim.daysRemaining} days left`;
            } else {
              label = 'Awaiting SLA';
            }

            return (
              <div 
                key={claim.id}
                onClick={() => onNavigate?.('/projects')}
                style={{
                  background: 'white',
                  borderRadius: radii.DEFAULT,
                  border: cardBorder,
                  boxShadow: shadows.sm,
                  padding: '14px 16px',
                  position: 'relative',
                  overflow: 'hidden',
                  paddingLeft: '22px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = shadows.DEFAULT;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = shadows.sm;
                }}
              >
                {/* Status Left Strip */}
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: '5px',
                  background: leftStripColor
                }} />

                {/* Card Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ minWidth: 0 }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: colors.gray[900], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {claim.equipment?.equipment_name || 'Equipment Claim'}
                    </h4>
                    <div style={{ fontSize: '12px', color: colors.gray[500], marginTop: '2px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Project: {claim.equipment?.project?.project_name || 'MEP Project'}
                    </div>
                  </div>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: badgeBg,
                    color: badgeText,
                    whiteSpace: 'nowrap'
                  }}>
                    <BadgeIcon size={12} />
                    {label}
                  </span>
                </div>

                {/* Claim Sub-details */}
                <div style={{ fontSize: '12px', color: colors.gray[500], display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${colors.gray[100]}`, paddingTop: '6px' }}>
                  <div>
                    Vendor: <span style={{ fontWeight: 600, color: colors.gray[700] }}>{claim.vendor_name}</span>
                  </div>
                  <div>
                    Status: <span style={{
                      fontWeight: 700,
                      color: claim.status === 'Resolved' ? colors.success.dark :
                             claim.status === 'Pending Response' ? colors.warning.dark :
                             claim.status === 'Draft' ? colors.gray[700] : colors.error.dark
                    }}>{claim.status}</span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
