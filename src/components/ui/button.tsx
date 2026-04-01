import React from 'react';
import { colors, shadows, radii, transitions } from '../../design-system';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variants = {
  primary: {
    background: colors.primary[600],
    color: '#ffffff',
    border: 'none',
    hoverBackground: colors.primary[700],
    shadow: shadows.md,
  },
  secondary: {
    background: '#ffffff',
    color: colors.gray[700],
    border: `1px solid ${colors.gray[300]}`,
    hoverBackground: colors.gray[50],
    shadow: shadows.sm,
  },
  ghost: {
    background: 'transparent',
    color: colors.gray[600],
    border: 'none',
    hoverBackground: colors.gray[100],
    shadow: 'none',
  },
  danger: {
    background: colors.error.DEFAULT,
    color: '#ffffff',
    border: 'none',
    hoverBackground: colors.error.dark,
    shadow: shadows.md,
  },
};

const sizes = {
  sm: { padding: '8px 12px', fontSize: '13px', height: '32px' },
  md: { padding: '10px 16px', fontSize: '14px', height: '40px' },
  lg: { padding: '12px 20px', fontSize: '15px', height: '44px' },
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const theme = variants[variant] || variants.primary;
  const sizeStyles = sizes[size] || sizes.md;
  
  return (
    <button
      disabled={disabled || isLoading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontWeight: 500,
        borderRadius: radii.md,
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        opacity: disabled || isLoading ? 0.6 : 1,
        transition: transitions.DEFAULT,
        outline: 'none',
        ...sizeStyles,
        background: theme.background,
        color: theme.color,
        border: theme.border,
        boxShadow: theme.shadow,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.background = theme.hoverBackground;
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.background = theme.background;
        }
      }}
      {...props}
    >
      {isLoading ? (
        <LoadingSpinner size={size} />
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </button>
  );
}

function LoadingSpinner({ size }: { size: string }) {
  const spinnerSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 16;
  return (
    <svg
      width={spinnerSize}
      height={spinnerSize}
      viewBox="0 0 24 24"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeDasharray="31.416"
        strokeDashoffset="10"
      />
    </svg>
  );
}

export function IconButton({
  icon,
  variant = 'ghost',
  size = 'md',
  ...props
}: Omit<ButtonProps, 'children' | 'leftIcon' | 'rightIcon'> & { icon: React.ReactNode }) {
  const sizeStyles = {
    sm: { width: '32px', height: '32px' },
    md: { width: '40px', height: '40px' },
    lg: { width: '44px', height: '44px' },
  };
  
  const currentSize = sizeStyles[size] || sizeStyles.md;
  
  return (
    <Button
      variant={variant}
      size={size}
      style={{
        ...currentSize,
        padding: 0,
        borderRadius: radii.md,
      }}
      {...props}
    >
      {icon}
    </Button>
  );
}
