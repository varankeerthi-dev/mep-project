import React from 'react';

interface DocumentEditorShellProps {
  actionBar: React.ReactNode;
  beforeContent?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
  contentStyle?: React.CSSProperties;
}

export function DocumentEditorShell({
  actionBar,
  beforeContent,
  children,
  maxWidth = '1400px',
  contentStyle,
}: DocumentEditorShellProps) {
  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
      {actionBar}
      {beforeContent}
      <div
        style={{
          paddingTop: '84px',
          paddingLeft: '16px',
          paddingRight: '16px',
          paddingBottom: '32px',
          maxWidth,
          margin: '0 auto',
          ...contentStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}
