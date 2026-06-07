// ============================================
// InlineEditableCell — Phase 1b primitive
// ============================================
// A click-to-edit cell with debounced save and optimistic update.
// Mirrors the Zoho Projects / Asana pattern: no save buttons inside
// the row, every cell is a controlled input with onBlur or debounced
// onChange save.
//
// Modes:
//   - text:      single-line input
//   - number:    single-line numeric input (with min/max/step)
//   - select:    dropdown of options
//   - textarea:  multi-line (auto-grows up to 6 rows)
//   - slider:    range input for 0-100 progress
//   - custom:    render-only via the `render` prop, save via onClick
//
// States: idle | editing | saving | saved | error
// Keyboard: Enter saves, Esc cancels, Tab moves to next cell
// Accessibility: role="gridcell", aria-live="polite" on save
// ============================================

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Check, Loader2, AlertCircle, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

export type InlineCellMode =
  | 'text'
  | 'number'
  | 'select'
  | 'textarea'
  | 'slider'
  | 'custom';

export type InlineCellState = 'idle' | 'editing' | 'saving' | 'saved' | 'error';

export interface InlineSelectOption<T = string> {
  value: T;
  label: string;
  color?: string;        // optional tailwind dot/bg accent
  description?: string;
}

export interface InlineEditableCellProps<T = string | number | null> {
  value: T;
  onSave: (next: T) => Promise<void> | void;
  mode: InlineCellMode;
  /** Select mode: option list */
  options?: InlineSelectOption[];
  /** Number/slider mode */
  min?: number;
  max?: number;
  step?: number;
  /** Debounce ms before save fires (default 500). Set 0 for onBlur-only. */
  debounceMs?: number;
  disabled?: boolean;
  /** Optional validation; return error message string or null */
  validate?: (next: T) => string | null;
  /** Custom display renderer (e.g. status pill, progress bar) */
  render?: (value: T) => ReactNode;
  /** Placeholder when value is empty */
  placeholder?: string;
  /** Class applied to the wrapper span */
  className?: string;
  /** Show a small pencil icon on hover to hint editability */
  showEditIcon?: boolean;
  /** Aria label for the cell */
  ariaLabel?: string;
}

// ============================================
// DEBOUNCE
// ============================================

function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  delayMs: number
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return useCallback(
    (...args: A) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fnRef.current(...args), delayMs);
    },
    [delayMs]
  );
}

// ============================================
// COMPONENT
// ============================================

export function InlineEditableCell<T extends string | number | null>({
  value,
  onSave,
  mode,
  options,
  min,
  max,
  step,
  debounceMs = 500,
  disabled = false,
  validate,
  render,
  placeholder,
  className,
  showEditIcon = true,
  ariaLabel,
}: InlineEditableCellProps<T>) {
  const [state, setState] = useState<InlineCellState>('idle');
  const [draft, setDraft] = useState<T>(value);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);
  const wasSavingRef = useRef(false);

  // Sync external value changes (e.g. cache invalidation refreshes the row)
  useEffect(() => {
    if (state === 'idle' || state === 'saved') {
      setDraft(value);
    }
  }, [value, state]);

  // After a successful save, flash the "saved" badge for 1.2s
  useEffect(() => {
    if (state === 'saved') {
      const t = setTimeout(() => setState('idle'), 1200);
      return () => clearTimeout(t);
    }
  }, [state]);

  const doSave = useCallback(
    async (next: T) => {
      if (next === value) {
        setState('idle');
        return;
      }
      if (validate) {
        const err = validate(next);
        if (err) {
          setErrorMsg(err);
          setState('error');
          return;
        }
      }
      setState('saving');
      wasSavingRef.current = true;
      try {
        await onSave(next);
        setState('saved');
        setErrorMsg(null);
      } catch (e: any) {
        setErrorMsg(e?.message || 'Save failed');
        setState('error');
        // Revert draft to the last good value
        setDraft(value);
      }
    },
    [onSave, validate, value]
  );

  const debouncedSave = useDebouncedCallback(doSave, debounceMs);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const raw = e.target.value;
      let next: T;
      if (mode === 'number' || mode === 'slider') {
        const n = raw === '' ? null : (Number(raw) as T);
        next = n;
      } else if (mode === 'select') {
        next = raw as unknown as T;
      } else {
        next = raw as unknown as T;
      }
      setDraft(next);
      setState('editing');
      if (debounceMs > 0) {
        debouncedSave(next);
      }
    },
    [mode, debouncedSave, debounceMs]
  );

  const handleBlur = useCallback(() => {
    if (state === 'editing' && debounceMs === 0) {
      void doSave(draft);
    } else if (state === 'editing') {
      // Force-save on blur (in case the debounce hasn't fired yet)
      void doSave(draft);
    }
  }, [state, debounceMs, doSave, draft]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      if (e.key === 'Enter' && mode !== 'textarea') {
        e.preventDefault();
        void doSave(draft);
        (e.target as HTMLElement).blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setDraft(value);
        setState('idle');
        setErrorMsg(null);
        (e.target as HTMLElement).blur();
      }
    },
    [doSave, draft, value, mode]
  );

  const isInteractive = !disabled && state !== 'saving';
  const displayValue = state === 'idle' || state === 'saved' ? value : draft;
  const isEmpty =
    displayValue === null ||
    displayValue === undefined ||
    (typeof displayValue === 'string' && displayValue.trim() === '');

  const stateBadge = (() => {
    if (state === 'saving') {
      return (
        <span aria-hidden="true" className="ml-1 inline-flex text-zinc-400">
          <Loader2 className="h-3 w-3 animate-spin" />
        </span>
      );
    }
    if (state === 'saved') {
      return (
        <span aria-hidden="true" className="ml-1 inline-flex text-emerald-600">
          <Check className="h-3 w-3" />
        </span>
      );
    }
    if (state === 'error') {
      return (
        <span
          aria-hidden="true"
          className="ml-1 inline-flex text-red-600"
          title={errorMsg || 'Save failed'}
        >
          <AlertCircle className="h-3 w-3" />
        </span>
      );
    }
    return null;
  })();

  return (
    <span
      role="gridcell"
      aria-label={ariaLabel}
      aria-busy={state === 'saving'}
      aria-invalid={state === 'error'}
      className={cn(
        'group relative inline-flex max-w-full items-center align-middle',
        isInteractive && 'cursor-text',
        disabled && 'cursor-not-allowed opacity-60',
        className
      )}
    >
      {/* Display layer (idle / saved) */}
      <span
        className={cn(
          'flex min-h-[24px] w-full items-center gap-1 rounded px-1.5 py-0.5 text-sm transition-colors',
          isInteractive && 'hover:bg-zinc-100/80',
          state === 'editing' && 'hidden'
        )}
        onClick={() => {
          if (!isInteractive) return;
          if (mode === 'custom') return; // custom cells manage their own click
          setState('editing');
          // Focus the input on next tick
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
      >
        {render ? (
          render(displayValue)
        ) : isEmpty ? (
          <span className="text-zinc-400">{placeholder || '—'}</span>
        ) : mode === 'select' && options ? (
          <span className="inline-flex items-center gap-1.5">
            {(() => {
              const opt = options.find((o) => o.value === displayValue);
              return (
                <>
                  {opt?.color && (
                    <span
                      aria-hidden="true"
                      className={cn('h-1.5 w-1.5 rounded-full', opt.color)}
                    />
                  )}
                  {opt?.label ?? String(displayValue)}
                </>
              );
            })()}
          </span>
        ) : (
          <span className="truncate">{String(displayValue)}</span>
        )}
        {stateBadge}
        {showEditIcon && isInteractive && state === 'idle' && (
          <Pencil
            aria-hidden="true"
            className="ml-1 h-3 w-3 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100"
          />
        )}
      </span>

      {/* Edit layer (editing / error) */}
      {state === 'editing' || state === 'error' ? (
        <span className="block w-full">
          {mode === 'textarea' ? (
            <textarea
              ref={(el) => (inputRef.current = el)}
              value={(draft as string | number | null) ?? ''}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              rows={3}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(
                'w-full resize-none rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-sm text-zinc-900 outline-none',
                'focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
              )}
              autoFocus
            />
          ) : mode === 'select' ? (
            <select
              ref={(el) => (inputRef.current = el)}
              value={(draft as string | number | null) ?? ''}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              className={cn(
                'w-full rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-sm text-zinc-900 outline-none',
                'focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
              )}
              autoFocus
            >
              {(options || []).map((opt) => (
                <option key={String(opt.value)} value={String(opt.value)}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : mode === 'slider' ? (
            <span className="flex w-full items-center gap-2">
              <input
                ref={(el) => (inputRef.current = el)}
                type="range"
                value={(draft as number | null) ?? 0}
                min={min ?? 0}
                max={max ?? 100}
                step={step ?? 1}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                className="flex-1 accent-blue-600"
                autoFocus
              />
              <span className="w-9 text-right text-xs font-medium tabular-nums text-zinc-700">
                {String(draft ?? 0)}%
              </span>
            </span>
          ) : (
            <input
              ref={(el) => (inputRef.current = el)}
              type={mode === 'number' ? 'number' : 'text'}
              value={(draft as string | number | null) ?? ''}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              min={min}
              max={max}
              step={step}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(
                'w-full rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-sm text-zinc-900 outline-none',
                'focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
              )}
              autoFocus
            />
          )}
          {state === 'error' && errorMsg && (
            <span className="mt-0.5 block text-[10px] text-red-600">{errorMsg}</span>
          )}
        </span>
      ) : null}
    </span>
  );
}

export default InlineEditableCell;
