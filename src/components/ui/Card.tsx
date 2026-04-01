import React from 'react';
import { shadows, radii, colors, transitions } from '../../design-system';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingMap = {
  none: '0',
  sm: '12px',
  md: '16px',
  lg: '24px',
};

export function Card({ children, className, hover = false, onClick, padding = 'md' }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: '#ffffff',
        borderRadius: radii.lg,
        boxShadow: shadows.DEFAULT,
        padding: paddingMap[padding],
        transition: transitions.DEFAULT,
        cursor: onClick ? 'pointer' : 'default',
        border: '1px solid ' + colors.gray[200],
        ...(hover && {
          ':hover': {
            boxShadow: shadows.md,
            transform: 'translateY(-2px)',
          },
        }),
      }}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: { value: number; label: string };
  color?: 'blue' | 'green' | 'amber' | 'red' | 'gray';
}

const colorMap = {
  blue: { bg: colors.primary[50], text: colors.primary[600] },
  green: { bg: colors.success.light, text: colors.success.DEFAULT },
  amber: { bg: colors.warning.light, text: colors.warning.DEFAULT },
  red: { bg: colors.error.light, text: colors.error.DEFAULT },
  gray: { bg: colors.gray[100], text: colors.gray[600] },
};

export function StatCard({ icon, label, value, trend, color = 'blue' }: StatCardProps) {
  const theme = colorMap[color];
  
  return (
    <Card hover padding="lg">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ 
            fontSize: '13px', 
            color: colors.gray[500], 
            margin: 0,
            fontWeight: 500,
            letterSpacing: '0.025em',
            textTransform: 'uppercase',
          }}>
            {label}
          </p>
          <p style={{ 
            fontSize: '28px', 
            fontWeight: 700, 
            color: colors.gray[900], 
            margin: '8px 0 0',
            lineHeight: 1,
          }}>
            {value}
          </p>
          {trend && (
            <p style={{ 
              fontSize: '13px', 
              color: trend.value >= 0 ? colors.success.DEFAULT : colors.error.DEFAULT,
              margin: '8px 0 0',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: radii.md,
          background: theme.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.text,
        }}>
          {icon}
        </div>
      </div>
    </Card>
  );
}
