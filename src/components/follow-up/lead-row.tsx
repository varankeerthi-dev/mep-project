// LeadRow — pre-quote pipeline row, styled to match QuotationFollowupRow.
// Inline next-action editor + status change.

import { memo, useState } from 'react';
import {
  Calendar,
  ChevronRight,
  MoreHorizontal,
  Phone,
  Mail,
  Building2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { Lead, LeadStatus } from '@/types/leads';
import { formatFollowUpCurrency } from '@/lib/followup/currency-format';
import { formatFollowUpDate } from '@/lib/followup/date-format';
import { cn } from '@/lib/utils';

const STATUS_STYLE: Record<LeadStatus, string> = {
  New: 'bg-blue-50 text-blue-800 ring-blue-200',
  Qualified: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  Converted: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Disqualified: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
  'On Hold': 'bg-amber-50 text-amber-800 ring-amber-200',
};

const STATUS_NEXT: LeadStatus[] = ['New', 'Qualified', 'On Hold', 'Converted', 'Disqualified'];

type LeadRowProps = {
  item: Lead;
  disabled?: boolean;
  onSelect?: (id: string) => void;
  onConvert?: (id: string) => void;
  onDisqualify?: (id: string) => void;
  onSetNextAction?: (id: string, at: string | null, label: string) => void;
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

export const LeadRow = memo(function LeadRow({
  item,
  disabled,
  onSelect,
  onConvert,
  onDisqualify,
  onSetNextAction,
}: LeadRowProps) {
  const [editingAction, setEditingAction] = useState(false);
  const [draftAt, setDraftAt] = useState<string>(() => {
    if (!item.next_action_at) return '';
    const d = new Date(item.next_action_at);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [draftLabel, setDraftLabel] = useState<string>(item.next_action_label || '');

  const overdue = isOverdue(item.next_action_at);
  const isClosed = item.status === 'Converted' || item.status === 'Disqualified';

  const handleSaveAction = () => {
    onSetNextAction?.(item.id, draftAt ? new Date(draftAt).toISOString() : null, draftLabel);
    setEditingAction(false);
  };

  return (
    <div
      className={cn(
        'flex items-center border-b border-zinc-100 bg-white px-4 py-3 transition-colors',
        !isClosed && 'hover:bg-zinc-50'
      )}
    >
      {/* Status pill */}
      <span
        className={cn(
          'inline-flex w-[110px] shrink-0 items-center justify-center rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset',
          STATUS_STYLE[item.status]
        )}
      >
        {item.status}
      </span>

      {/* Contact + company */}
      <div className="w-[260px] shrink-0 px-3">
        <p className="truncate text-sm font-medium text-zinc-900" title={item.contact_name}>
          {item.contact_name}
        </p>
        <p className="flex items-center gap-1 truncate text-xs text-zinc-500" title={item.company_name || '—'}>
          <Building2 className="h-3 w-3 shrink-0 text-zinc-400" />
          {item.company_name || '—'}
        </p>
      </div>

      {/* Project */}
      <div className="w-[200px] shrink-0 px-3">
        <p className="truncate text-sm text-zinc-700" title={item.project_name || '—'}>
          {item.project_name || '—'}
        </p>
        <p className="truncate text-xs text-zinc-500" title={item.requirement_summary || '—'}>
          {item.requirement_summary || 'No summary'}
        </p>
      </div>

      {/* Reach */}
      <div className="w-[180px] shrink-0 space-y-0.5 px-3 text-xs text-zinc-600">
        {item.contact_phone ? (
          <p className="flex items-center gap-1.5">
            <Phone className="h-3 w-3 text-zinc-400" />
            <span className="truncate">{item.contact_phone}</span>
          </p>
        ) : (
          <p className="text-zinc-400">No phone</p>
        )}
        {item.contact_email ? (
          <p className="flex items-center gap-1.5">
            <Mail className="h-3 w-3 text-zinc-400" />
            <span className="truncate">{item.contact_email}</span>
          </p>
        ) : null}
      </div>

      {/* Value */}
      <div className="w-[110px] shrink-0 px-3 text-right">
        <p className="text-sm font-medium tabular-nums text-zinc-900">
          {item.estimated_value > 0 ? formatFollowUpCurrency(item.estimated_value) : '—'}
        </p>
        {item.expected_close_date && (
          <p className="text-[10px] text-zinc-500">close {formatFollowUpDate(item.expected_close_date)}</p>
        )}
      </div>

      {/* Next action */}
      <div className="min-w-[200px] flex-1 px-3">
        {editingAction ? (
          <div className="flex flex-col gap-1.5">
            <input
              type="datetime-local"
              value={draftAt}
              onChange={(e) => setDraftAt(e.target.value)}
              className="h-7 w-full rounded border border-zinc-200 px-2 text-xs"
            />
            <input
              type="text"
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              placeholder="Action label"
              className="h-7 w-full rounded border border-zinc-200 px-2 text-xs"
            />
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSaveAction}
                disabled={disabled}
                className="rounded bg-blue-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingAction(false)}
                className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => !disabled && !isClosed && setEditingAction(true)}
            disabled={disabled || isClosed}
            className={cn(
              'flex w-full items-center gap-1.5 rounded-md border px-2 py-1 text-left text-xs transition-colors',
              overdue
                ? 'border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100'
                : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
              (disabled || isClosed) && 'cursor-not-allowed opacity-60'
            )}
            title="Click to set next action"
          >
            <Calendar className="h-3 w-3 shrink-0" />
            <span className="min-w-0 flex-1 truncate font-medium">
              {item.next_action_label || 'Set next action'}
            </span>
            <span className={cn('shrink-0 text-[10px]', overdue ? 'font-semibold' : 'opacity-70')}>
              {formatDateTime(item.next_action_at)}
            </span>
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex w-[140px] shrink-0 items-center justify-end gap-1.5 px-3" onClick={(e) => e.stopPropagation()}>
        {!isClosed && onConvert && (
          <button
            type="button"
            onClick={() => onConvert(item.id)}
            disabled={disabled}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            title="Mark as converted"
          >
            <CheckCircle2 className="h-3 w-3" />
            Convert
          </button>
        )}
        {!isClosed && onDisqualify && (
          <button
            type="button"
            onClick={() => onDisqualify(item.id)}
            disabled={disabled}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-100 hover:text-red-600 disabled:opacity-50"
            title="Disqualify"
          >
            <XCircle className="h-3.5 w-3.5" />
          </button>
        )}
        {onSelect && (
          <button
            type="button"
            onClick={() => onSelect(item.id)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 hover:bg-indigo-50 hover:text-indigo-700"
            title="View detail"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
});

export const leadTableHeader = (
  <div className="flex h-[36px] items-center px-4 text-[13px] font-semibold tracking-tight text-zinc-700">
    <span className="w-[110px] shrink-0 text-left">Status</span>
    <div className="w-[260px] shrink-0 px-3 text-left">Contact / Company</div>
    <div className="w-[200px] shrink-0 px-3 text-left">Project</div>
    <div className="w-[180px] shrink-0 px-3 text-left">Reach</div>
    <span className="w-[110px] shrink-0 px-3 text-right">Value</span>
    <div className="min-w-[200px] flex-1 px-3 text-left">Next action</div>
    <span className="w-[140px] shrink-0 px-3 text-right">Actions</span>
  </div>
);

// exported for use in metric labels
export const LEAD_STATUSES = STATUS_NEXT;
