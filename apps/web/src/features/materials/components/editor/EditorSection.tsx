import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const COLOR_STYLES = {
  indigo: { title: 'text-[#111827]' },
  blue: { title: 'text-[#111827]' },
  green: { title: 'text-[#111827]' },
  purple: { title: 'text-[#111827]' },
  orange: { title: 'text-[#111827]' },
  teal: { title: 'text-[#111827]' },
  slate: { title: 'text-[#111827]' },
};

interface EditorSectionProps {
  title: string;
  color?: keyof typeof COLOR_STYLES;
  badge?: string;
  description?: string;
  hint?: string;
  expanded?: boolean;
  onToggle?: () => void;
  headerActions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * Shared section card for the item editor — enterprise ERP style.
 * White card, 1px #E2E5EB border, 12px radius, subtle shadow.
 * 8px spacing system throughout.
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
        'overflow-hidden rounded-xl border border-[#E2E5EB] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-[box-shadow] duration-150 hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)]',
        className
      )}
    >
      {/* Header: Title + Actions on opposite sides */}
      <div className="flex items-center justify-between px-6 pb-0 pt-5">
        {/* Left: Title + Badge */}
        <div className="flex min-w-0 items-center gap-2.5">
          <Button variant="default" size="icon-xs" type="button" onClick={onToggle} tabIndex={collapsible ? 0 : -1} aria-expanded={collapsible ? isOpen : undefined} className={cn( 'flex items-center gap-2.5 text-left', collapsible ? 'cursor-pointer rounded-lg px-1 py-0.5 -ml-1 transition-colors hover:bg-[#F3F4F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]/30' : 'cursor-default' )} >
            <span className={cn('text-[17px] font-semibold tracking-tight text-[#111827]', colorStyle.title)}>
              {title}
            </span>
            {badge && (
              <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
                {badge}
              </span>
            )}
          </Button>
          {collapsible && (
            <ChevronDown
              className={cn(
                'h-4 w-4 text-[#9CA3AF] transition-transform duration-200',
                !isOpen && '-rotate-90'
              )}
            />
          )}
        </div>

        {/* Right: Actions + Hint */}
        <span className="flex shrink-0 items-center gap-3">
          {headerActions}
          {hint && <span className="hidden text-[12px] text-[#9CA3AF] sm:inline">{hint}</span>}
        </span>
      </div>

      {/* Description — reduced contrast, clear separation from title */}
      {description && (
        <p className="mt-1 px-6 text-[13px] leading-relaxed text-[#9CA3AF]">{description}</p>
      )}

      {/* Content — 24px padding for ERP density */}
      {isOpen && (
        <div className="px-6 py-5">{children}</div>
      )}
    </section>
  );
}
