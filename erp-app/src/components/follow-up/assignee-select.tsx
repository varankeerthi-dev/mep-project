import { cn } from '@/lib/utils';
import type { FollowUpAssigneeOption } from '@/hooks/use-followup-assignees';

type AssigneeSelectProps = {
  value: string | null | undefined;
  options: FollowUpAssigneeOption[];
  disabled?: boolean;
  compact?: boolean;
  onChange: (userId: string | null) => void;
};

export function AssigneeSelect({
  value,
  options,
  disabled,
  compact,
  onChange,
}: AssigneeSelectProps) {
  return (
    <select
      value={value || ''}
      disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value || null)}
      className={cn(
        'max-w-full truncate rounded-md border border-zinc-200 bg-white text-zinc-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50',
        compact ? 'h-7 min-w-[120px] px-1.5 text-[11px]' : 'h-8 min-w-[140px] px-2 text-xs'
      )}
      title="Assign follow-up owner"
    >
      <option value="">Unassigned</option>
      {options.map((o) => (
        <option key={o.userId} value={o.userId}>
          {o.label}
          {o.role ? ` (${o.role})` : ''}
        </option>
      ))}
    </select>
  );
}

export function AssigneeBadge({
  name,
  unassigned,
}: {
  name: string;
  unassigned?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-block max-w-[120px] truncate rounded px-1.5 py-0.5 text-[10px] font-medium',
        unassigned ? 'bg-zinc-100 text-zinc-500 italic' : 'bg-violet-50 text-violet-800'
      )}
      title={name}
    >
      {name}
    </span>
  );
}
