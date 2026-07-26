import React from 'react';

interface HeaderFieldProps {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  last?: boolean;
  labelWidth?: string;
}

const headerFieldStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const getLabelStyle = (width: string): React.CSSProperties => ({
  minWidth: width,
  maxWidth: width,
  fontWeight: 600,
  fontSize: '11px',
  color: '#374151',
  flexShrink: 0,
});

const fieldColStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

export function HeaderField({
  label,
  children,
  required,
  last,
  labelWidth = '70px',
}: HeaderFieldProps) {
  return (
    <div style={{ ...headerFieldStyle, marginBottom: last ? 0 : '8px' }}>
      <span style={getLabelStyle(labelWidth)}>
        {label}
        {required && <span style={{ color: '#dc2626', marginLeft: '2px' }}>*</span>}
      </span>
      <div style={fieldColStyle}>{children}</div>
    </div>
  );
}

// Convenience style constants for reuse
export const sharedStyles = {
  inputStyle: {
    padding: '4px 8px',
    fontSize: '12px',
  } as React.CSSProperties,
  staticFieldStyle: {
    padding: '4px 8px',
    fontSize: '12px',
    background: '#f3f4f6',
    border: '1px solid transparent',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
  } as React.CSSProperties,
  staticMultilineStyle: {
    padding: '4px 8px',
    fontSize: '12px',
    background: '#f3f4f6',
    border: '1px solid transparent',
    whiteSpace: 'pre-wrap' as const,
    minHeight: '32px',
    lineHeight: '1.4',
  } as React.CSSProperties,
  labelColStyle: (width = '95px'): React.CSSProperties => ({
    minWidth: width,
    maxWidth: width,
    fontWeight: 600,
    fontSize: '11px',
    color: '#374151',
  }),
  headerFieldStyle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,
  fieldColStyle: {
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,
};
