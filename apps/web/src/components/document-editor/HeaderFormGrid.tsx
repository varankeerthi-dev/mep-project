import React from 'react';

interface HeaderFormGridProps {
  children: React.ReactNode;
  columns?: 2 | 3;
  gap?: string;
  style?: React.CSSProperties;
}

export function HeaderFormGrid({
  children,
  columns = 3,
  gap = '16px',
  style,
}: HeaderFormGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap,
        marginBottom: '16px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
