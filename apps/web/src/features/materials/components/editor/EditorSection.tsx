import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const COLOR_STYLES = {
  indigo: {
    title: 'text-[#111827]',
  },
  blue: {
    title: 'text-[#111827]',
  },
  green: {
    title: 'text-[#111827]',
  },
  purple: {
    title: 'text-[#111827]',
  },
  orange: {
    title: 'text-[#111827]',
  },
  teal: {
    title: 'text-[#111827]',
  },
  slate: {
    title: 'text-[#111827]',
  },
};

interface EditorSectionProps {
  title: string;
  /** Color accent for visual hierarchy */
  color?: keyof typeof COLOR_STYLES;
  /** Small pill shown next to the title, e.g. "Required" */
  badge?: string;
  /** Muted helper line under the title */
  description?: string;
  /** Muted hint text shown on the right of the header */
  hint?: string;
  /** When onToggle is provided the header becomes a collapsible trigger */
  expanded?: boolean;
  onToggle?: () => void;
  /** Optional action buttons rendered in the header right side */
  headerActions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * Shared section card for the item editor — premium SaaS style.
 * White card, 1px #E7EAF1 border, 16px radius, soft shadow that lifts on hover.
 * Internal padding increased to 32px to prevent inputs touching card borders.
 */
export function EditorSection({
  title,
  color = 'indigo',
  badge,
  description,
  hint,
  expanded = true,
  onToggle,
  headerActions,
  children,
  className,
}: EditorSectionProps) {
  const collapsible = typeof onToggle === 'function';
  const isOpen = collapsible ? expanded : true;
  const colorStyle = COLOR_STYLES[color] || COLOR_STYLES.indigo;

  return (
    <section
      data-slot="editor-section"
      className={cn(
        'overflow-hidden rounded-2xl border border-[#E7EAF1] bg-white shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition-[box-shadow,transform] duration-180 hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]',
        className
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        tabIndex={collapsible ? 0 : -1}
        aria-expanded={collapsible ? isOpen : undefined}
        className={cn(
          'flex w-full items-center justify-between gap-3 px-8 pb-0 pt-6 text-left',
          collapsible
            ? 'cursor-pointer transition-colors hover:bg-[#FAFBFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#6366F1]/30'
            : 'cursor-default'
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className={cn('text-lg font-semibold tracking-tight', colorStyle.title)}>{title}</span>
          {badge && (
            <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
              {badge}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {headerActions}
          {hint && <span className="hidden text-xs text-[#6B7280] sm:inline">{hint}</span>}
          {collapsible && (
            <ChevronDown
              className={cn(
                'h-4 w-4 text-[#6B7280] transition-transform duration-200',
                !isOpen && '-rotate-90'
              )}
            />
          )}
        </span>
      </button>

      {description && (
        <p className="mt-1 px-8 text-[13px] text-[#6B7280]">{description}</p>
      )}

      {isOpen && (
        <div className="px-8 py-6">{children}</div>
      )}
    </section>
  );
}
