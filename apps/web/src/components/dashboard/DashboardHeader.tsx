import { RefreshCw, Plus, Building2 } from 'lucide-react';
import { colors, shadows, radii, transitions, typography } from '../../design-system';

interface DashboardHeaderProps {
  isRefreshing: boolean;
  onRefresh: () => void;
  onNavigate?: (path: string) => void;
}

export function DashboardHeader({ isRefreshing, onRefresh, onNavigate }: DashboardHeaderProps) {
  return (
    <div style={{
      background: 'white',
      borderBottom: `1px solid ${colors.gray[200]}`,
      position: 'sticky',
      top: 0,
      zIndex: 30,
      boxShadow: shadows.sm,
    }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: colors.gray[900], margin: 0, letterSpacing: '-0.02em', fontFamily: typography.fontFamily.sans }}>
              Dashboard
            </h1>
            <p style={{ fontSize: '14px', color: colors.gray[500], margin: '4px 0 0', fontWeight: 500 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: 600,
                color: colors.gray[700],
                background: 'white',
                border: `1px solid ${colors.gray[300]}`,
                borderRadius: radii.md,
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                transition: transitions.DEFAULT,
                opacity: isRefreshing ? 0.5 : 1,
                boxShadow: shadows.sm,
              }}
              onMouseEnter={(e) => {
                if (!isRefreshing) {
                  e.currentTarget.style.background = colors.gray[50];
                  e.currentTarget.style.borderColor = colors.gray[400];
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
                e.currentTarget.style.borderColor = colors.gray[300];
              }}
            >
              <RefreshCw size={16} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
              Refresh
            </button>
            {onNavigate && (
              <>
                <button
                  onClick={() => onNavigate('/dc/create')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'white',
                    background: colors.gray[900],
                    border: 'none',
                    borderRadius: radii.md,
                    cursor: 'pointer',
                    transition: transitions.DEFAULT,
                    boxShadow: shadows.md,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.gray[800];
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = colors.gray[900];
                  }}
                >
                  <Plus size={16} />
                  Create DC
                </button>
                <button
                  onClick={() => onNavigate('/clients/new')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: colors.gray[700],
                    background: 'white',
                    border: `2px solid ${colors.gray[200]}`,
                    borderRadius: radii.md,
                    cursor: 'pointer',
                    transition: transitions.DEFAULT,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = colors.gray[300];
                    e.currentTarget.style.background = colors.gray[50];
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = colors.gray[200];
                    e.currentTarget.style.background = 'white';
                  }}
                >
                  <Building2 size={16} />
                  Add Client
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
