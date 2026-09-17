import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface KanbanCardRootProps {
  children: ReactNode;
  onClick?: () => void;
  isDragging?: boolean;
  isOverlay?: boolean;
  className?: string;
}

/**
 * Clean card shell with glass/border styling, hover elevation,
 * and drag state indicators. Zero icon dependencies.
 */
export const KanbanCardRoot = memo(function KanbanCardRoot({
  children,
  onClick,
  isDragging = false,
  isOverlay = false,
  className,
}: KanbanCardRootProps) {
  return (
    <div
      onClick={!isDragging && !isOverlay ? onClick : undefined}
      className={cn(
        'group relative flex flex-col gap-2 rounded-xl border bg-white p-3.5 shadow-2xs transition-all duration-150 select-none',
        isOverlay
          ? 'border-blue-400 shadow-xl ring-2 ring-blue-400/20 rotate-1 scale-[1.02]'
          : 'border-slate-200/90 hover:border-slate-300 hover:shadow-xs',
        className
      )}
    >
      {children}
    </div>
  );
});

export interface KanbanCardHeaderProps {
  referenceId: string;
  categoryTag?: string;
  categoryClassName?: string;
  badge?: ReactNode;
  className?: string;
}

/**
 * Top row: Reference ID + Category Tag + Priority/Status Badge
 */
export const KanbanCardHeader = memo(function KanbanCardHeader({
  referenceId,
  categoryTag,
  categoryClassName,
  badge,
  className,
}: KanbanCardHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-2 min-w-0', className)}>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-xs font-black tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors truncate">
          {referenceId}
        </span>
        {categoryTag && (
          <span
            className={cn(
              'inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider border',
              categoryClassName || 'bg-slate-100 text-slate-700 border-slate-200'
            )}
          >
            {categoryTag}
          </span>
        )}
      </div>
      {badge && <div className="shrink-0">{badge}</div>}
    </div>
  );
});

export interface KanbanCardTitleProps {
  primary: string;
  secondary?: string;
  className?: string;
}

/**
 * Party & Project / Entity Titles with strict typography weight hierarchy
 */
export const KanbanCardTitle = memo(function KanbanCardTitle({
  primary,
  secondary,
  className,
}: KanbanCardTitleProps) {
  return (
    <div className={cn('flex flex-col min-w-0', className)}>
      <span className="text-xs font-bold text-slate-900 truncate" title={primary}>
        {primary}
      </span>
      {secondary && (
        <span className="text-[11px] font-medium text-slate-500 truncate" title={secondary}>
          {secondary}
        </span>
      )}
    </div>
  );
});

export interface KanbanCardStatusProps {
  children: ReactNode;
  tone?: 'default' | 'danger' | 'warning' | 'info' | 'success';
  className?: string;
}

const STATUS_TONES: Record<NonNullable<KanbanCardStatusProps['tone']>, string> = {
  default: 'bg-slate-50 text-slate-700 border-slate-200/60',
  danger: 'bg-rose-50/80 text-rose-700 border-rose-200/70',
  warning: 'bg-amber-50/80 text-amber-800 border-amber-200/70',
  info: 'bg-blue-50/80 text-blue-700 border-blue-200/70',
  success: 'bg-emerald-50/80 text-emerald-800 border-emerald-200/70',
};

/**
 * Icon-free Action / Urgency / Next Step status pill
 */
export const KanbanCardStatus = memo(function KanbanCardStatus({
  children,
  tone = 'default',
  className,
}: KanbanCardStatusProps) {
  return (
    <div
      className={cn(
        'rounded-md px-2 py-1 text-[11px] font-semibold truncate border',
        STATUS_TONES[tone],
        className
      )}
    >
      {children}
    </div>
  );
});

export interface KanbanCardFooterProps {
  amount?: string;
  amountLabel?: string;
  tag?: ReactNode;
  avatar?: ReactNode;
  className?: string;
}

/**
 * Bottom metrics row: Amount (strictly left-aligned) + Timeline tag + Initials avatar
 */
export const KanbanCardFooter = memo(function KanbanCardFooter({
  amount,
  amountLabel,
  tag,
  avatar,
  className,
}: KanbanCardFooterProps) {
  return (
    <div
      className={cn(
        'mt-0.5 flex items-center justify-between border-t border-slate-100 pt-2.5 min-w-0',
        className
      )}
    >
      {/* Amount: ALWAYS LEFT-ALIGNED (align: 'left') */}
      <div className="flex items-baseline gap-1 text-left min-w-0">
        {amount && (
          <span className="text-xs font-black tabular-nums text-slate-900 tracking-tight">
            {amount}
          </span>
        )}
        {amountLabel && (
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            {amountLabel}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        {tag}
        {avatar}
      </div>
    </div>
  );
});

export interface KanbanBadgeProps {
  children: ReactNode;
  variant?: 'danger' | 'warning' | 'info' | 'neutral' | 'success';
  className?: string;
}

const BADGE_VARIANTS: Record<NonNullable<KanbanBadgeProps['variant']>, string> = {
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  neutral: 'bg-slate-50 text-slate-600 border-slate-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

/**
 * Reusable icon-free badge pill
 */
export const KanbanBadge = memo(function KanbanBadge({
  children,
  variant = 'neutral',
  className,
}: KanbanBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0',
        BADGE_VARIANTS[variant],
        className
      )}
    >
      {children}
    </span>
  );
});

export interface KanbanAvatarProps {
  initials: string;
  title?: string;
  isUnassigned?: boolean;
  className?: string;
}

/**
 * Reusable typography-only initials avatar badge (no icon)
 */
export const KanbanAvatar = memo(function KanbanAvatar({
  initials,
  title,
  isUnassigned = false,
  className,
}: KanbanAvatarProps) {
  return (
    <div
      title={title}
      className={cn(
        'h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 border select-none',
        isUnassigned
          ? 'bg-slate-100 text-slate-400 border-slate-300'
          : 'bg-blue-50 text-blue-700 border-blue-200',
        className
      )}
    >
      {isUnassigned ? '?' : initials}
    </div>
  );
});
