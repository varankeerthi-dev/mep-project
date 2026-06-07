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
  type Ref,
} from 'react';
import { Check, Loader2, AlertCircle, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// T9 — DESIGN.md focus ring (Phase 5.2)
// ============================================
// DESIGN.md §2 / §4: focus ring 2px Executive Blue (#2563EB, blue-600)
// on keyboard focus only (focus-visible). Mouse clicks stay clean.
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-executive focus-visible:ring-offset-1 focus-visible:ring-offset-pure';

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
  // ============================================
  // T9 — Keyboard nav grid (Phase 5.2)
  // ============================================
  /** Roving tabindex. 0 = currently in tab order, -1 = reachable via arrow keys. */
  tabIndex?: number;
  /** 1-indexed column position inside the row. */
  ariaColIndex?: number;
  /** Called when the user presses arrow keys (Left/Right/Up/Down/Home/End)
   *  on the display layer. The row's keyboard nav decides what to do. */
  onGridKeyDown?: (e: React.KeyboardEvent<HTMLSpanElement>) => void;
  /** Enter/Space on the focused display layer activates editing. Defaults to true. */
  activateOnEnter?: boolean;
  /**
   * Optional ref to the focusable display layer span. Lets the parent
   * grid focus the cell imperatively (arrow-key nav). Accepts both
   * a RefObject and a callback ref.
   */
  cellRef?: Ref<HTMLSpanElement>;
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
  // T9 — grid nav
  tabIndex = 0,
  ariaColIndex,
  onGridKeyDown,
  activateOnEnter = true,
  cellRef,
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
        <span aria-hidden="true" className="ml-1 inline-flex text-steel">
          <Loader2 className="h-3 w-3 animate-spin" />
        </span>
      );
    }
    if (state === 'saved') {
      return (
        <span aria-hidden="true" className="ml-1 inline-flex text-success">
          <Check className="h-3 w-3" />
        </span>
      );
    }
    if (state === 'error') {
      return (
        <span
          aria-hidden="true"
          className="ml-1 inline-flex text-critical"
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
      aria-colindex={ariaColIndex}
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
        // T9 — display layer is now focusable via roving tabindex.
        // The focus ring (2px Executive Blue) only appears on
        // keyboard focus, not on click. Enter/Space activates
        // edit mode; arrow keys bubble to the row for grid nav.
        ref={cellRef}
        tabIndex={disabled ? -1 : tabIndex}
        onKeyDown={(e) => {
          if (onGridKeyDown) onGridKeyDown(e);
          if (e.defaultPrevented) return;
          if (
            activateOnEnter &&
            isInteractive &&
            mode !== 'custom' &&
            (e.key === 'Enter' || e.key === ' ')
          ) {
            e.preventDefault();
            setState('editing');
            requestAnimationFrame(() => inputRef.current?.focus());
          }
        }}
        className={cn(
          'flex min-h-[44px] w-full items-center gap-1 rounded px-1.5 py-1 text-sm transition-colors',
          isInteractive && 'hover:bg-canvas/80',
          state === 'editing' && 'hidden',
          FOCUS_RING
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
          <span className="text-steel">{placeholder || '—'}</span>
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
            className="ml-1 h-3 w-3 text-ink/30 opacity-0 transition-opacity group-hover:opacity-100"
          />
        )}
      </span>

      {/* Edit layer (editing / error) */}
      {state === 'editing' || state === 'error' ? (
        <span className="block w-full">
          {mode === 'textarea' ? (
            <textarea
              ref={(el) => { inputRef.current = el; }}
              value={(draft as string | number | null) ?? ''}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              rows={3}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(
                'w-full resize-none rounded border border-ink/15 bg-pure px-2 py-1.5 text-sm text-ink outline-none',
                FOCUS_RING
              )}
              autoFocus
            />
          ) : mode === 'select' ? (
            <select
              ref={(el) => { inputRef.current = el; }}
              value={(draft as string | number | null) ?? ''}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              className={cn(
                'w-full min-h-[44px] rounded border border-ink/15 bg-pure px-2 py-1.5 text-sm text-ink outline-none',
                FOCUS_RING
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
            <span className="flex w-full min-h-[44px] items-center gap-2">
              <input
                ref={(el) => { inputRef.current = el; }}
                type="range"
                value={(draft as number | null) ?? 0}
                min={min ?? 0}
                max={max ?? 100}
                step={step ?? 1}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                className="h-6 flex-1 accent-executive"
                autoFocus
              />
              <span className="w-9 text-right text-xs font-medium tabular-nums text-ink">
                {String(draft ?? 0)}%
              </span>
            </span>
          ) : (
            <input
              ref={(el) => { inputRef.current = el; }}
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
                'w-full min-h-[44px] rounded border border-ink/15 bg-pure px-2 py-1.5 text-sm text-ink outline-none',
                FOCUS_RING
              )}
              autoFocus
            />
          )}
          {state === 'error' && errorMsg && (
            <span className="mt-0.5 block text-[10px] text-critical">{errorMsg}</span>
          )}
        </span>
      ) : null}
    </span>
  );
}

export default InlineEditableCell;
