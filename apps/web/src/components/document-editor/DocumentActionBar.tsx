import React from 'react';

interface ActionButton {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  icon?: React.ReactNode;
  loading?: boolean;
}

interface DocumentActionBarProps {
  title: string;
  subtitle?: string;
  /** Status badge to show next to title (e.g. "Rev. 2", "Draft") */
  statusBadge?: React.ReactNode;
  /** Buttons displayed on the left side of the action bar */
  leftActions?: React.ReactNode;
  rightActions: React.ReactNode;
  /** Whether the bar is sticky at the top (default true). Set to false for normal flow. */
  sticky?: boolean;
  /**
   * When 'fixed', uses position: fixed with offsets.
   * Use for pages with sidebar and quick-access bar.
   */
  fixed?: boolean | { top?: number; left?: number; right?: number; zIndex?: number };
  /** Show "unsaved changes" indicator */
  isDirty?: boolean;
}

const baseBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 24px',
  marginBottom: '24px',
  borderBottom: '1px solid #e5e7eb',
  backgroundColor: '#ffffff',
};

const titleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#18181b',
  letterSpacing: '-0.01em',
  margin: 0,
};

export function DocumentActionBar({
  title,
  subtitle,
  statusBadge,
  leftActions,
  rightActions,
  sticky = true,
  fixed,
  isDirty,
}: DocumentActionBarProps) {
  const computeStyle = (): React.CSSProperties => {
    if (fixed) {
      const opts = typeof fixed === 'object' ? fixed : {};
      return {
        ...baseBarStyle,
        position: 'fixed',
        top: opts.top ?? 32,
        left: opts.left ?? 220,
        right: opts.right ?? 0,
        zIndex: opts.zIndex ?? 100,
      };
    }
    if (sticky) {
      return {
        ...baseBarStyle,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      };
    }
    return baseBarStyle;
  };

  return (
    <div style={computeStyle()}>
      <div style={titleRowStyle}>
        {leftActions}
        <h1 style={titleStyle}>{title}</h1>
        {statusBadge && <span>{statusBadge}</span>}
        {isDirty && (
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '9999px',
              background: '#fef3c7',
              color: '#b45309',
              border: '1px solid #fde68a',
              lineHeight: '18px',
            }}
          >
            Unsaved changes
          </span>
        )}
        {subtitle && (
          <span
            style={{
              fontSize: '12px',
              color: '#71717a',
              fontWeight: 400,
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {rightActions}
      </div>
    </div>
  );
}

// --- Helper button components for consistent action bar buttons ---

const baseBtnStyle: React.CSSProperties = {
  height: '36px',
  padding: '0 16px',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 500,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  cursor: 'pointer',
  transition: 'all 0.15s',
  border: 'none',
  lineHeight: '36px',
  whiteSpace: 'nowrap',
};

interface BtnProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
  type?: 'button' | 'submit';
}

export function PrimaryButton({ onClick, disabled, children, style }: BtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...baseBtnStyle,
        background: '#185FA5',
        border: '1px solid #185FA5',
        color: '#fff',
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = '#0C447C';
          e.currentTarget.style.borderColor = '#0C447C';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#185FA5';
        e.currentTarget.style.borderColor = '#185FA5';
      }}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ onClick, disabled, children, style }: BtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...baseBtnStyle,
        background: '#fff',
        border: '1px solid #d4d4d4',
        color: '#525252',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = '#f5f5f5';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#fff';
      }}
    >
      {children}
    </button>
  );
}

export function GhostButton({ onClick, disabled, children, style }: BtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...baseBtnStyle,
        background: 'transparent',
        border: 'none',
        color: '#525252',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.color = '#18181b';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = '#525252';
      }}
    >
      {children}
    </button>
  );
}

export function ImportButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: '36px',
        padding: '0 12px',
        background: '#eef2ff',
        border: '1px solid #c7d2fe',
        color: '#4338ca',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        lineHeight: '36px',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#e0e7ff';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#eef2ff';
      }}
    >
      Import PDF/Image
    </button>
  );
}
