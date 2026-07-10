import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, ChevronDown, ArrowRight, CheckCircle2, XCircle, Pause, Clock, Ban } from 'lucide-react';
import type { QuotationFollowUp, QuotationResponseOption } from '@/types/followup';
import { QUOTATION_RESPONSE_OPTIONS } from '@/types/followup';
import { getAvailableTransitions, isTerminalStatus, TRANSITION_META } from '@/lib/followup/quotation-workflow';
import { initiateQuotationRevision } from '@/lib/quotation-workflow';
import { useAuth } from '@/App';
import type { FollowUpAssigneeOption } from '@/hooks/use-followup-assignees';
import { AssigneeSelect } from './assignee-select';
import { formatFollowUpCurrency } from '@/lib/followup/currency-format';
import { formatFollowUpDate, isValidityExpiringSoon, isFollowUpExpired } from '@/lib/followup/date-format';
import { formatQuotationStatus, quotationStatusColor } from '@/lib/followup/followup-formatters';
import { cn } from '@/lib/utils';

type QuotationFollowupRowProps = {
  item: QuotationFollowUp;
  disabled?: boolean;
  assignees: FollowUpAssigneeOption[];
  onReminder: (item: QuotationFollowUp) => void;
  onLogResponse: (id: string, response: QuotationResponseOption) => void;
  onAssigneeChange: (id: string, userId: string | null) => void;
  onSelect?: () => void;
};

const TERMINAL_ICON: Record<string, React.ReactNode> = {
  approved: <CheckCircle2 className="h-3 w-3 text-emerald-600" />,
  lost_to_competitor: <XCircle className="h-3 w-3 text-red-600" />,
  cancelled: <Ban className="h-3 w-3 text-gray-500" />,
  expired: <Clock className="h-3 w-3 text-purple-600" />,
};

export const QuotationFollowupRow = memo(function QuotationFollowupRow({
  item,
  disabled,
  assignees,
  onReminder,
  onLogResponse,
  onAssigneeChange,
  onSelect,
}: QuotationFollowupRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [revisionLoading, setRevisionLoading] = useState(false);
  const { organisation, user } = useAuth();
  const expiring = isValidityExpiringSoon(item.valid_till);
  const expired = isFollowUpExpired(item.valid_till);
  const terminal = isTerminalStatus(item.status);

  const availableTransitions = useMemo(
    () => getAvailableTransitions(item.status),
    [item.status]
  );

  const hasTransitions = availableTransitions.length > 0;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, []);

  useEffect(() => {
    if (menuOpen) {
      updatePosition();
      const onScroll = () => setMenuOpen(false);
      window.addEventListener('scroll', onScroll, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', onScroll, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [menuOpen, updatePosition]);

  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(96px,1fr)_minmax(110px,1.1fr)_minmax(120px,1.2fr)_80px_88px_80px_minmax(108px,120px)_1fr] items-center gap-2 border-b border-zinc-100 px-3 py-[14px] text-xs hover:bg-zinc-50/80',
        terminal && 'bg-zinc-50/40 opacity-80',
        expired && !terminal && 'bg-purple-50/30'
      )}
      onClick={onSelect}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <span className="font-mono font-medium text-indigo-700">{item.quotation_no}</span>
      <span className="truncate font-medium text-zinc-900" title={item.client_name}>
        {item.client_name}
      </span>
      <span className="truncate text-zinc-600" title={item.project_name}>
        {item.project_name}
      </span>
      <span className="tabular-nums font-medium text-zinc-900 text-left">
        {formatFollowUpCurrency(item.total_value)}
      </span>
      <span
        className={cn(
          'inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium',
          quotationStatusColor(item.status)
        )}
      >
        {TERMINAL_ICON[item.status]}
        {formatQuotationStatus(item.status)}
      </span>
      <span className={cn('tabular-nums', expiring && !expired && 'font-semibold text-amber-700', expired && 'font-semibold text-purple-700')}>
        {formatFollowUpDate(item.valid_till)}
        {expiring && !expired && <span className="ml-1 text-[10px]">&#9888;</span>}
        {expired && <span className="ml-1 text-[10px]">&#9208;</span>}
      </span>
      <AssigneeSelect
        value={item.assignee_user_id}
        options={assignees}
        disabled={disabled}
        compact
        onChange={(userId) => onAssigneeChange(item.id, userId)}
      />
      <div className="flex items-center justify-end gap-1">
        {!terminal && (
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => { e.stopPropagation(); onReminder(item); }}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MessageCircle className="h-3 w-3" />
            Remind
          </button>
        )}
        {!terminal && (
          <button
            type="button"
            disabled={disabled || revisionLoading}
            onClick={async (e) => {
              e.stopPropagation();
              setRevisionLoading(true);
              try {
                if (organisation?.id) {
                  await initiateQuotationRevision(organisation.id, item.id);
                }
              } finally {
                setRevisionLoading(false);
              }
            }}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 text-[11px] font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {revisionLoading ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
            ) : (
              <span className="text-amber-600">&#8635;</span>
            )}
            Revise
          </button>
        )}
        {hasTransitions && (
          <div className="relative">
            <button
              ref={triggerRef}
              type="button"
              disabled={disabled}
              onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
              className={cn(
                'inline-flex h-7 items-center gap-0.5 rounded-md border px-2 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-50',
                item.status === 'in_negotiation'
                  ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
              )}
            >
              Update Status
              <ChevronDown className="h-3 w-3" />
            </button>
            {menuOpen && menuPos && createPortal(
              <>
                <div
                  className="fixed inset-0 z-[9998]"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
                />
                <div
                  className="fixed z-[9999] min-w-[260px] rounded-lg border border-zinc-200 bg-white py-1 shadow-xl"
                  style={{ top: menuPos.top, left: Math.min(menuPos.left, window.innerWidth - 280) }}
                >
                  {item.previous_status && (
                    <div className="flex items-center gap-1.5 border-b border-zinc-100 px-3 py-2 text-[10px] text-zinc-500">
                      <span>{formatQuotationStatus(item.previous_status)}</span>
                      <ArrowRight className="h-2.5 w-2.5" />
                      <span className="font-medium text-zinc-800">{formatQuotationStatus(item.status)}</span>
                      <span className="ml-auto">(current)</span>
                    </div>
                  )}
                  <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                    Transition to
                  </div>
                  {availableTransitions.map((opt) => {
                    const meta = TRANSITION_META[opt];
                    return (
                      <button
                        key={opt}
                        type="button"
                        className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-zinc-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          onLogResponse(item.id, opt);
                          setMenuOpen(false);
                        }}
                      >
                        <span className="mt-0.5 text-sm leading-none">{meta.icon}</span>
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium text-zinc-900">{meta.label}</div>
                          <div className="text-[10px] text-zinc-500">{meta.description}</div>
                        </div>
                        {meta.terminal && (
                          <span className="ml-auto mt-0.5 rounded bg-zinc-100 px-1 text-[9px] text-zinc-500">Final</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>,
              document.body
            )}
          </div>
        )}
        {terminal && !hasTransitions && (
          <span className={cn('text-[10px] font-medium italic text-zinc-400')}>
            {item.status === 'approved' ? 'Won' : item.status === 'cancelled' ? 'Void' : 'Closed'}
          </span>
        )}
      </div>
    </div>
  );
});

export const quotationTableHeader = (
  <div className="grid grid-cols-[minmax(96px,1fr)_minmax(110px,1.1fr)_minmax(120px,1.2fr)_80px_88px_80px_minmax(108px,120px)_1fr] gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
    <span>Quote #</span>
    <span>Client</span>
    <span>Project</span>
    <span className="text-left">Value</span>
    <span>Status</span>
    <span>Valid till</span>
    <span>Assignee</span>
    <span className="text-right">Actions</span>
  </div>
);