import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variants = {
  primary: 'bg-indigo-600 text-white border-none hover:bg-indigo-700 shadow-md',
  secondary: 'bg-white text-zinc-700 border border-zinc-300 hover:bg-zinc-50 shadow-sm',
  ghost: 'bg-transparent text-zinc-600 border-none hover:bg-zinc-100',
  danger: 'bg-red-600 text-white border-none hover:bg-red-700 shadow-md',
};

const sizes = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  className,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium rounded-md cursor-pointer transition-all duration-200 outline-none font-[Inter]',
        variants[variant],
        sizes[size],
        (disabled || isLoading) && 'opacity-60 cursor-not-allowed',
        className
      )}
      style={style}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
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

export function IconButton({
  icon,
  variant = 'ghost',
  size = 'md',
  className,
  style,
  ...props
}: Omit<ButtonProps, 'children' | 'leftIcon' | 'rightIcon'> & { icon: React.ReactNode }) {
  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-9 h-9',
    lg: 'w-10 h-10',
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={cn('p-0', iconSizes[size], className)}
      style={{ padding: 0, ...style }}
      {...props}
    >
      {icon}
    </Button>
  );
}
