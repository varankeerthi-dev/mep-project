import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, ChevronDown, ArrowRight, CheckCircle2, XCircle, Pause, Clock, Ban } from 'lucide-react';
import type { QuotationFollowUp, QuotationResponseOption } from '@/types/followup';
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
  onLogResponse: (id: string, response: QuotationResponseOption, reason: string) => void;
  onAssigneeChange: (id: string, userId: string | null) => void;
  onSelect?: () => void;
};

const QUICK_REASONS: Record<QuotationResponseOption, string[]> = {
  sent: ['Client asked to re-send', 'Resent after the correction'],
  under_review: ['Sent to the client for review', 'Shared with the decision maker'],
  in_negotiation: ['Discussing pricing', 'Scope change requested', 'Client asked for a revision'],
  pending: ['Awaiting client decision', 'Waiting on internal clearance'],
  approved: ['Client confirmed the award', 'Work order to be raised'],
  on_hold: ['Project deferred by the client', 'Budget put on hold'],
  lost_to_competitor: ['Higher competitor quotation', 'Client continued with another vendor'],
  cancelled: ['Requirement withdrawn', 'Duplicate quotation'],
};

// Mirrors STAGE_REASON_REQUIRED in change_quotation_stage; keeps the user from
// discovering the server's minimum by submitting a blank reason.
const MIN_REASON_LENGTH = 3;

const TERMINAL_ICON: Record<string, React.ReactNode> = {
  approved: <CheckCircle2 className="h-3 w-3 text-green-600" />,
  lost_to_competitor: <XCircle className="h-3 w-3 text-red-600" />,
  cancelled: <Ban className="h-3 w-3 text-slate-500" />,
  expired: <Clock className="h-3 w-3 text-blue-600" />,
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
  const [pendingTransition, setPendingTransition] = useState<QuotationResponseOption | null>(null);
  const [reason, setReason] = useState('');
  const reasonInputRef = useRef<HTMLTextAreaElement>(null);
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

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setPendingTransition(null);
    setReason('');
  }, []);

  useEffect(() => {
    if (menuOpen) {
      updatePosition();
      // Reposition instead of closing on scroll: the reason step holds typed input, and the
      // table body is a scroll container, so closing here would discard what the user wrote.
      const onScroll = () => updatePosition();
      const onEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') closeMenu();
      };
      window.addEventListener('scroll', onScroll, true);
      window.addEventListener('resize', updatePosition);
      window.addEventListener('keydown', onEscape);
      return () => {
        window.removeEventListener('scroll', onScroll, true);
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('keydown', onEscape);
      };
    }
  }, [menuOpen, updatePosition, closeMenu]);

  useEffect(() => {
    if (pendingTransition) reasonInputRef.current?.focus();
  }, [pendingTransition]);

  const startTransition = useCallback((opt: QuotationResponseOption) => {
    setPendingTransition(opt);
    setReason('');
  }, []);

  const confirmTransition = useCallback(() => {
    if (!pendingTransition) return;
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON_LENGTH) return;
    onLogResponse(item.id, pendingTransition, trimmed);
    closeMenu();
  }, [closeMenu, item.id, onLogResponse, pendingTransition, reason]);

  const pendingMeta = pendingTransition ? TRANSITION_META[pendingTransition] : null;
  const reasonReady = reason.trim().length >= MIN_REASON_LENGTH;

  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(96px,1fr)_minmax(110px,1.1fr)_minmax(120px,1.2fr)_80px_88px_80px_minmax(108px,120px)_1fr] items-center gap-2 border-b border-slate-200 px-3 py-2 text-xs hover:bg-slate-50 transition duration-150',
        terminal && 'bg-slate-50/40 opacity-80',
        expired && !terminal && 'bg-blue-50/30'
      )}
      onClick={onSelect}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <span className="font-mono font-medium text-blue-700">{item.quotation_no}</span>
      <span className="truncate font-medium text-slate-900" title={item.client_name}>
        {item.client_name}
      </span>
      <span className="truncate text-slate-600" title={item.project_name}>
        {item.project_name}
      </span>
      <span className="tabular-nums font-medium text-slate-900 text-left">
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
      <span className={cn('tabular-nums', expiring && !expired && 'font-semibold text-amber-700', expired && 'font-semibold text-blue-700')}>
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
            className="inline-flex h-7 items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 text-[11px] font-medium text-green-800 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.96] transition duration-150"
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
              onClick={(e) => {
                e.stopPropagation();
                if (menuOpen) closeMenu();
                else setMenuOpen(true);
              }}
              className={cn(
                'inline-flex h-7 items-center gap-0.5 rounded-md border px-2 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.96] transition duration-150',
                item.status === 'in_negotiation'
                  ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              )}
            >
              Update Status
              <ChevronDown className="h-3 w-3" />
            </button>
            {menuOpen && menuPos && createPortal(
              <>
                <div
                  className="fixed inset-0 z-[9998]"
                  onClick={(e) => { e.stopPropagation(); closeMenu(); }}
                />
                <div
                  className={cn(
                    'fixed z-[9999] rounded-lg border border-slate-200 bg-white py-1 shadow-[0_4px_12px_-2px_rgba(15,23,42,0.08),0_2px_6px_-1px_rgba(15,23,42,0.04)]',
                    pendingTransition ? 'w-[320px]' : 'min-w-[260px]'
                  )}
                  style={{
                    top: Math.min(menuPos.top, Math.max(8, window.innerHeight - (pendingTransition ? 330 : 260))),
                    left: Math.min(menuPos.left, window.innerWidth - (pendingTransition ? 336 : 280)),
                  }}
                >
                  {pendingTransition && pendingMeta ? (
                    <div className="p-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 text-sm leading-none">{pendingMeta.icon}</span>
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-slate-900">{pendingMeta.label}</div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                            <span>{formatQuotationStatus(item.status)}</span>
                            <ArrowRight className="h-2.5 w-2.5" />
                            <span className="font-medium text-slate-700">{pendingMeta.label}</span>
                          </div>
                        </div>
                        {pendingMeta.terminal && (
                          <span className="ml-auto rounded bg-slate-100 px-1 py-0.5 text-[9px] text-slate-500">Final</span>
                        )}
                      </div>
                      <label className="mt-3 block text-[10px] font-medium uppercase tracking-wide text-slate-400" htmlFor={`reason-${item.id}`}>
                        Why is it changing? <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id={`reason-${item.id}`}
                        ref={reasonInputRef}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            confirmTransition();
                          }
                        }}
                        rows={3}
                        maxLength={500}
                        placeholder="What the client said, or what happened — this is stored in the audit trail."
                        className="mt-1 w-full resize-none rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200"
                      />
                      <div className="mt-2 flex flex-wrap gap-1">
                        {QUICK_REASONS[pendingTransition].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setReason(preset)}
                            className={cn(
                              'rounded-full border px-2 py-0.5 text-[10px] transition duration-150',
                              reason === preset
                                ? 'border-blue-300 bg-blue-50 text-blue-800'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            )}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setPendingTransition(null); setReason(''); }}
                          className="inline-flex h-7 items-center rounded-md border border-slate-200 px-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          disabled={!reasonReady}
                          onClick={(e) => { e.stopPropagation(); confirmTransition(); }}
                          className={cn(
                            'inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] font-medium text-white transition duration-150',
                            reasonReady ? 'bg-blue-600 hover:bg-blue-700 active:scale-[0.96]' : 'cursor-not-allowed bg-slate-300'
                          )}
                        >
                          Record change
                        </button>
                      </div>
                      {!reasonReady && (
                        <p className="mt-1.5 text-right text-[10px] text-slate-400">
                          A reason is required.
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      {item.previous_status && (
                        <div className="flex items-center gap-1.5 border-b border-slate-100 px-3 py-2 text-[10px] text-slate-500">
                          <span>{formatQuotationStatus(item.previous_status)}</span>
                          <ArrowRight className="h-2.5 w-2.5" />
                          <span className="font-medium text-slate-800">{formatQuotationStatus(item.status)}</span>
                          <span className="ml-auto">(current)</span>
                        </div>
                      )}
                      <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                        Transition to
                      </div>
                      {availableTransitions.map((opt) => {
                        const meta = TRANSITION_META[opt];
                        return (
                          <button
                            key={opt}
                            type="button"
                            className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-slate-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              startTransition(opt);
                            }}
                          >
                            <span className="mt-0.5 text-sm leading-none">{meta.icon}</span>
                            <div className="min-w-0">
                              <div className="text-[11px] font-medium text-slate-900">{meta.label}</div>
                              <div className="text-[10px] text-slate-500">{meta.description}</div>
                            </div>
                            {meta.terminal && (
                              <span className="ml-auto mt-0.5 rounded bg-slate-100 px-1 text-[9px] text-slate-500">Final</span>
                            )}
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              </>,
              document.body
            )}
          </div>
        )}
        {terminal && !hasTransitions && (
          <span className={cn('text-[10px] font-medium italic text-slate-400')}>
            {item.status === 'approved' ? 'Won' : item.status === 'cancelled' ? 'Void' : 'Closed'}
          </span>
        )}
      </div>
    </div>
  );
});

export const quotationTableHeader = (
  <div className="grid grid-cols-[minmax(96px,1fr)_minmax(110px,1.1fr)_minmax(120px,1.2fr)_80px_88px_80px_minmax(108px,120px)_1fr] gap-2 px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 leading-normal select-none">
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