import { useState, useEffect, useRef } from 'react';
import { Building2, Wrench, AlertTriangle, Clock } from 'lucide-react';
import { colors, radii } from '../../design-system';

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

function useCountUp(target: number, duration = 600) {
  const [count, setCount] = useState(0);
  const hasAnimated = useRef(false);
  const prevTarget = useRef(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (typeof target !== 'number' || isNaN(target)) return;

    // On first load: animate from 0
    // On subsequent updates: snap directly to new value (no re-animation)
    if (!hasAnimated.current) {
      hasAnimated.current = true;
      const start = performance.now();
      const from = 0;

      const tick = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.round(from + (target - from) * eased));
        if (progress < 1) raf.current = requestAnimationFrame(tick);
      };

      raf.current = requestAnimationFrame(tick);
    } else {
      // Snap to new value on refetch
      setCount(target);
    }

    prevTarget.current = target;
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);

  return count;
}

function Shimmer() {
  return (
    <div style={{
      height: '100%',
      width: '100%',
      background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      borderRadius: '4px',
    }} />
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '28px' }}>
      {data.map((val, i) => (
        <div
          key={i}
          style={{
            width: '3px',
            height: `${Math.max((val / max) * 100, 8)}%`,
            borderRadius: '2px',
            background: color,
            opacity: 0.2 + (i / data.length) * 0.8,
            transition: 'height 0.3s ease',
          }}
        />
      ))}
    </div>
  );
}

function AnimatedCounter({ value, loading }: { value: number | string; loading: boolean }) {
  const numericValue = typeof value === 'number' ? value : parseInt(String(value), 10);
  const animated = useCountUp(loading ? 0 : numericValue);

  if (loading) {
    return (
      <div style={{ width: '48px', height: '36px' }}>
        <Shimmer />
      </div>
    );
  }

  return <span>{animated}</span>;
}

export function StatsRow({ projectsLoading, projectsCount, claimsLoading, claimsStats }: StatsRowProps) {
  const stats = [
    {
      label: 'Active Projects',
      value: projectsCount,
      loading: projectsLoading,
      icon: Building2,
      iconBg: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
      iconColor: '#2563eb',
      gradient: 'linear-gradient(135deg, #f8faff 0%, #eef2ff 100%)',
      sparkData: [3, 5, 4, 6, 5, 7, 4, 8, 6, projectsCount],
      sparkColor: '#3b82f6',
      subText: `${projectsCount} active`,
      subColor: '#64748b',
    },
    {
      label: 'Active Claims',
      value: claimsStats.totalActive,
      loading: claimsLoading,
      icon: Wrench,
      iconBg: 'linear-gradient(135deg, #ccfbf1, #99f6e4)',
      iconColor: '#0d9488',
      gradient: 'linear-gradient(135deg, #f0fdfa 0%, #e6fffa 100%)',
      sparkData: [2, 4, 3, 5, 4, 6, 3, claimsStats.totalActive],
      sparkColor: '#14b8a6',
      subText: `${claimsStats.totalActive} pending`,
      subColor: '#64748b',
    },
    {
      label: 'Overdue SLA',
      value: claimsStats.overdueCount,
      loading: claimsLoading,
      icon: AlertTriangle,
      iconBg: claimsStats.overdueCount > 0 ? 'linear-gradient(135deg, #fee2e2, #fecaca)' : 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
      iconColor: claimsStats.overdueCount > 0 ? '#dc2626' : '#94a3b8',
      gradient: claimsStats.overdueCount > 0 ? 'linear-gradient(135deg, #fff5f5 0%, #fef2f2 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      sparkData: [1, 0, 2, 1, 0, 1, claimsStats.overdueCount],
      sparkColor: '#ef4444',
      subText: claimsStats.overdueCount > 0 ? 'act now' : 'all clear',
      subColor: claimsStats.overdueCount > 0 ? '#dc2626' : '#16a34a',
    },
    {
      label: 'Critical SLA',
      value: claimsStats.criticalCount,
      loading: claimsLoading,
      icon: Clock,
      iconBg: claimsStats.criticalCount > 0 ? 'linear-gradient(135deg, #fef3c7, #fde68a)' : 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
      iconColor: claimsStats.criticalCount > 0 ? '#d97706' : '#94a3b8',
      gradient: claimsStats.criticalCount > 0 ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      sparkData: [0, 1, 0, 2, 1, 0, claimsStats.criticalCount],
      sparkColor: '#f59e0b',
      subText: claimsStats.criticalCount > 0 ? `${claimsStats.criticalCount} expiring soon` : 'none expiring',
      subColor: claimsStats.criticalCount > 0 ? '#d97706' : '#16a34a',
    },
  ];

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              style={{
                background: stat.gradient,
                borderRadius: radii.lg,
                padding: '16px',
                border: `1px solid ${colors.gray[200]}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                position: 'relative',
                overflow: 'hidden',
                transition: 'box-shadow 0.25s ease, transform 0.25s ease',
                cursor: 'default',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Header: icon + label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '10px',
                  background: stat.iconBg,
                  color: stat.iconColor,
                }}>
                  <Icon size={17} strokeWidth={2.2} />
                </div>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#64748b',
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                }}>{stat.label}</span>
              </div>

              {/* Value + Sparkline */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div style={{
                  fontSize: '34px',
                  fontWeight: 800,
                  color: '#0f172a',
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  <AnimatedCounter value={stat.value} loading={stat.loading} />
                </div>
                {!stat.loading && <Sparkline data={stat.sparkData} color={stat.sparkColor} />}
              </div>

              {/* Sub-text */}
              <div style={{
                fontSize: '12px',
                fontWeight: 500,
                color: stat.subColor,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                {stat.subText}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
