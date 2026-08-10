/**
 * Central date-display formatting for the app.
 *
 * The display format is chosen per-organisation from Settings → General →
 * Date format. The pure function `formatDateByKey` does the actual work; the
 * module store (`getDateFormat` / `setDateFormat`) lets non-React util files
 * react to the same setting without a hook, and `useAppDateFormat` exposes it
 * to React components with live updates.
 *
 * NOTE: This is for DISPLAY ONLY. Date input values and API payloads keep the
 * ISO `YYYY-MM-DD` shape and must not be routed through here.
 */

export type DateFormatKey = 'DD/MM/YYYY' | 'DD-MM-YYYY' | 'DD-MMM-YYYY' | 'YYYY-MMM-DD';

export const DEFAULT_DATE_FORMAT: DateFormatKey = 'DD-MMM-YYYY';

export const DATE_FORMAT_OPTIONS: { value: DateFormatKey; label: string }[] = [
  { value: 'DD/MM/YYYY', label: 'dd/mm/yyyy' },
  { value: 'DD-MM-YYYY', label: 'dd-mm-yyyy' },
  { value: 'DD-MMM-YYYY', label: 'dd-mmm-yyyy' },
  { value: 'YYYY-MMM-DD', label: 'yyyy-mmm-dd (overseas)' },
];

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Pure formatter. Always uses local timezone components (never toISOString,
 * which shifts by a day). Returns '-' for null/invalid input.
 */
export function formatDateByKey(value: Date | string | null | undefined, formatKey: DateFormatKey): string {
  const d = toDate(value);
  if (!d) return '-';

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const mmm = MONTHS_SHORT[d.getMonth()];
  const yyyy = String(d.getFullYear());

  switch (formatKey) {
    case 'DD/MM/YYYY':
      return `${dd}/${mm}/${yyyy}`;
    case 'DD-MM-YYYY':
      return `${dd}-${mm}-${yyyy}`;
    case 'YYYY-MMM-DD':
      return `${yyyy}-${mmm}-${dd}`;
    case 'DD-MMM-YYYY':
    default:
      return `${dd}-${mmm}-${yyyy}`;
  }
}

/** Validate that a stored/unknown string maps to a known format; else default. */
export function isDateFormatKey(value: unknown): value is DateFormatKey {
  return DATE_FORMAT_OPTIONS.some((o) => o.value === value);
}

// ---------------------------------------------------------------------------
// Module store — lets non-React helpers read the active format synchronously.
// The DateFormatProvider keeps this in sync with the org setting.
// ---------------------------------------------------------------------------

let activeFormat: DateFormatKey = DEFAULT_DATE_FORMAT;

export function getDateFormat(): DateFormatKey {
  return activeFormat;
}

export function setDateFormat(format: DateFormatKey): void {
  activeFormat = format;
}

/** Convenience for non-React util files: format using the active org format. */
export function formatAppDate(value: Date | string | null | undefined): string {
  return formatDateByKey(value, getDateFormat());
}
