import React from 'react';
import { Button, ButtonProps } from '../ui/button';
import { Upload } from 'lucide-react';

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

// --- Helper button components (now wrapping Button v2.1) ---

/**
 * @deprecated Use `<Button variant="default">` directly instead.
 */
export function PrimaryButton({
  onClick,
  disabled,
  children,
  style,
  type = 'button',
}: ButtonProps & { style?: React.CSSProperties }) {
  return (
    <Button
      variant="default"
      onClick={onClick}
      disabled={disabled}
      style={style}
      type={type}
    >
      {children}
    </Button>
  );
}

/**
 * @deprecated Use `<Button variant="secondary">` directly instead.
 */
export function SecondaryButton({
  onClick,
  disabled,
  children,
  style,
  type = 'button',
}: ButtonProps & { style?: React.CSSProperties }) {
  return (
    <Button
      variant="secondary"
      onClick={onClick}
      disabled={disabled}
      style={style}
      type={type}
    >
      {children}
    </Button>
  );
}

/**
 * @deprecated Use `<Button variant="ghost">` directly instead.
 */
export function GhostButton({
  onClick,
  disabled,
  children,
  style,
  type = 'button',
}: ButtonProps & { style?: React.CSSProperties }) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      style={style}
      type={type}
    >
      {children}
    </Button>
  );
}

/**
 * @deprecated Use `<Button variant="outline" leftIcon={<Upload />}>Import PDF/Image</Button>` directly instead.
 */
export function ImportButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      leftIcon={<Upload />}
    >
      Import PDF/Image
    </Button>
  );
}
