/**
 * Shared UI style tokens for the item editor — enterprise ERP look.
 * 8px spacing system. Softer borders. ERP density (high info, comfortable spacing).
 * UI-ONLY: no logic, no data — just reusable Tailwind class strings.
 */

// ─── Inputs ──────────────────────────────────────────────────

/** 46px tall text input, 10px radius, softer border */
export const inputField =
  'h-[46px] w-full min-w-0 !rounded-[10px] !border !border-[#E2E5EB] bg-white !px-5 !py-0 text-[14px] font-normal text-[#111827] transition-[border-color,box-shadow] outline-none placeholder:text-[#9CA3AF] hover:border-[#C7D2FE] focus-visible:border-[#6366F1] focus-visible:shadow-[0_0_0_4px_rgba(99,102,241,0.10)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]';

/** Compact input for table cells (40px height, softer border, more padding) */
export const inputFieldSm =
  'h-10 w-full min-w-0 !rounded-lg !border !border-[#E2E5EB] bg-white !px-4 !py-0 text-[14px] font-normal text-[#111827] transition-[border-color,box-shadow] outline-none placeholder:text-[#9CA3AF] hover:border-[#C7D2FE] focus-visible:border-[#6366F1] focus-visible:shadow-[0_0_0_4px_rgba(99,102,241,0.10)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]';

/** 46px select matching input styling */
export const selectField =
  'h-[46px] w-full min-w-0 cursor-pointer appearance-none !rounded-[10px] !border !border-[#E2E5EB] bg-white !pl-5 !pr-10 !py-0 text-[14px] font-normal text-[#111827] transition-[border-color,box-shadow] outline-none hover:border-[#C7D2FE] focus-visible:border-[#6366F1] focus-visible:shadow-[0_0_0_4px_rgba(99,102,241,0.10)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]';

/** Compact select for table cells (40px height, softer border, more padding) */
export const selectFieldSm =
  'h-10 w-full min-w-0 cursor-pointer appearance-none !rounded-lg !border !border-[#E2E5EB] bg-white !pl-4 !pr-9 !py-0 text-[14px] font-normal text-[#111827] transition-[border-color,box-shadow] outline-none hover:border-[#C7D2FE] focus-visible:border-[#6366F1] focus-visible:shadow-[0_0_0_4px_rgba(99,102,241,0.10)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]';

// ─── Labels ──────────────────────────────────────────────────

/** Form field label: 13px / 500 / #475467 */
export const fieldLabel = 'text-[13px] font-medium text-[#475467]';

// ─── Buttons ─────────────────────────────────────────────────

/** Square 42x42 add (+) button */
export const addButton =
  'inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] border border-[#E5E7EB] bg-white text-[#6B7280] transition-colors duration-180 hover:border-[#6366F1] hover:bg-[#F5F7FF] hover:text-[#4F46E5] disabled:pointer-events-none disabled:opacity-50';

/** Ghost button for section actions (Add Row / Add Vendor) — 44px height for accessibility */
export const addLink =
  'inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-[#E2E5EB] bg-white px-4 text-[13px] font-medium text-[#344054] transition-all duration-150 hover:border-[#6366F1] hover:bg-[#F5F7FF] hover:text-[#4F46E5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]/40 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50';

/** Secondary text button (white, 1px #D1D5DB, hover #F9FAFB) */
export const secondaryButton =
  'inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-[#D1D5DB] bg-white px-[22px] text-sm font-medium text-[#111827] transition-colors duration-200 hover:bg-[#F9FAFB] disabled:pointer-events-none disabled:opacity-50';

/** Ghost button (transparent, hover #F3F4F6) */
export const ghostButton =
  'inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-transparent bg-transparent px-[22px] text-sm font-medium text-[#111827] transition-colors duration-200 hover:bg-[#F3F4F6] disabled:pointer-events-none disabled:opacity-50';

/** Primary indigo button */
export const primaryButton =
  'inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] bg-[#6366F1] px-[22px] text-sm font-medium text-white shadow-[0_8px_18px_rgba(79,70,229,0.18)] transition-colors duration-200 hover:bg-[#4F46E5] active:bg-[#4338CA] disabled:pointer-events-none disabled:opacity-50';

// ─── Delete Button ───────────────────────────────────────────

/** Ghost delete icon button — 36x36 hit area, centered, hover-only emphasis */
export const deleteIconButton =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#9CA3AF] transition-all duration-150 hover:bg-[#FEF2F2] hover:text-[#EF4444] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF4444]/40 active:scale-95';
