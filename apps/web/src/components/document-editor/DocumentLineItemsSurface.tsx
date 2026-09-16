import React from 'react';

interface DocumentLineItemsSurfaceProps {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function DocumentLineItemsSurface({
  title,
  actions,
  children,
  className,
  style,
}: DocumentLineItemsSurfaceProps) {
  return (
    <section
      className={className}
      style={{
        marginTop: '24px',
        marginBottom: '24px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '52px',
          padding: '12px 16px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '12px',
            fontWeight: 700,
            color: '#1e3a8a',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {title}
        </h2>
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{actions}</div>}
      </div>
      {children}
    </section>
  );
}

