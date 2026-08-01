import { RefreshCw, Plus, Building2 } from 'lucide-react';
import { colors, radii, typography } from '../../design-system';

interface DashboardHeaderProps {
  userName?: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  onNavigate?: (path: string) => void;
}

export function DashboardHeader({ userName, isRefreshing, onRefresh, onNavigate }: DashboardHeaderProps) {
  const greeting = getGreeting();

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
      <h1 style={{
        fontSize: '22px',
        fontWeight: 600,
        color: colors.gray[700],
        margin: 0,
        letterSpacing: '-0.01em',
      }}>
        {greeting}{userName ? `, ${userName}` : ''}
      </h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            fontSize: '13px',
            fontWeight: 600,
            color: colors.gray[600],
            background: 'white',
            border: `1px solid ${colors.gray[200]}`,
            borderRadius: radii.DEFAULT,
            cursor: isRefreshing ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
            opacity: isRefreshing ? 0.5 : 1,
          }}
        >
          <RefreshCw size={14} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
        {onNavigate && (
          <>
            <button
              onClick={() => onNavigate('/dc/create')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'white',
                background: colors.primary[600],
                border: 'none',
                borderRadius: radii.DEFAULT,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <Plus size={14} />
              Create DC
            </button>
            <button
              onClick={() => onNavigate('/clients/new')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                color: colors.gray[600],
                background: 'white',
                border: `1px solid ${colors.gray[200]}`,
                borderRadius: radii.DEFAULT,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <Building2 size={14} />
              Add Client
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
