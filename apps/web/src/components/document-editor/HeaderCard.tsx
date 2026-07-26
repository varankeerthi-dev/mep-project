import React from 'react';

interface HeaderCardProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const titleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '12px',
  fontWeight: 700,
  color: '#1e3a8a',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '1px solid #f3f4f6',
  paddingBottom: '8px',
  marginBottom: '4px',
};

export function HeaderCard({ icon, title, children, className }: HeaderCardProps) {
  return (
    <div className={className || 'cq-card-elevated'} style={cardStyle}>
      <div style={titleStyle}>
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}
