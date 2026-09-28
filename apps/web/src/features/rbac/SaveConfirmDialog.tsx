import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { PermissionDiff } from '../../rbac/api';

export function SaveConfirmDialog({
  open,
  roleName,
  diff,
  diffLoading,
  saving,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  roleName: string;
  diff: PermissionDiff | undefined;
  diffLoading: boolean;
  saving: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50/50 px-4 py-2.5">
          <div className="text-xs font-bold text-zinc-900">Confirm permission changes</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-3 px-4 py-3">
          <div className="text-xs text-zinc-600">
            Role <span className="font-semibold text-zinc-900">{roleName}</span>
            {diff && (
              <>
                {' · '}
                <span className="font-semibold text-zinc-900">{diff.affected_employees}</span>{' '}
                employee{diff.affected_employees === 1 ? '' : 's'} affected
              </>
            )}
          </div>

          {diffLoading ? (
            <div className="flex items-center gap-2 py-4 text-xs text-zinc-500">
              <Loader2 size={14} className="animate-spin" /> Computing diff…
            </div>
          ) : diff ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-2.5">
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                  Granted ({diff.added.length})
                </div>
                {diff.added.length === 0 ? (
                  <div className="text-[11px] text-zinc-400">None</div>
                ) : (
                  <ul className="max-h-32 space-y-0.5 overflow-y-auto font-mono text-[11px] text-emerald-800">
                    {diff.added.map((k) => (
                      <li key={k}>+ {k}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-md border border-rose-200 bg-rose-50/50 p-2.5">
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-rose-700">
                  Revoked ({diff.removed.length})
                </div>
                {diff.removed.length === 0 ? (
                  <div className="text-[11px] text-zinc-400">None</div>
                ) : (
                  <ul className="max-h-32 space-y-0.5 overflow-y-auto font-mono text-[11px] text-rose-800">
                    {diff.removed.map((k) => (
                      <li key={k}>− {k}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] text-rose-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 bg-zinc-50/50 px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving || diffLoading}
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Confirm & save
          </button>
        </div>
      </div>
    </div>
  );
}
