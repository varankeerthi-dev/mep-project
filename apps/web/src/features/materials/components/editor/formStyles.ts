/**
 * Shared UI style tokens for the item editor — premium SaaS ERP look.
 * Values follow the approved visual spec (indigo primary, calm borders).
 * UI-ONLY: no logic, no data — just reusable Tailwind class strings.
 */

/** 46px tall text input, 10px radius, 1px #DCE3ED border */
export const inputField =
  'h-[46px] w-full min-w-0 !rounded-[10px] !border !border-[#DCE3ED] bg-white !px-4 !py-0 text-sm font-medium text-[#111827] transition-[border-color,box-shadow] outline-none placeholder:text-[#9CA3AF] hover:border-[#C7D2FE] focus-visible:border-[#6366F1] focus-visible:shadow-[0_0_0_4px_rgba(99,102,241,0.10)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]';

/** Smaller variant for table cells / compact rows (h-9, 8px radius) */
export const inputFieldSm =
  'h-9 w-full min-w-0 !rounded-lg !border !border-[#DCE3ED] bg-white !px-3 !py-0 text-[13px] font-medium text-[#111827] transition-[border-color,box-shadow] outline-none placeholder:text-[#9CA3AF] hover:border-[#C7D2FE] focus-visible:border-[#6366F1] focus-visible:shadow-[0_0_0_4px_rgba(99,102,241,0.10)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]';

/** 46px select matching input styling */
export const selectField =
  'h-[46px] w-full min-w-0 cursor-pointer appearance-none !rounded-[10px] !border !border-[#DCE3ED] bg-white !pl-4 !pr-9 !py-0 text-sm font-medium text-[#111827] transition-[border-color,box-shadow] outline-none hover:border-[#C7D2FE] focus-visible:border-[#6366F1] focus-visible:shadow-[0_0_0_4px_rgba(99,102,241,0.10)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]';

/** 9-row / compact select for tables */
export const selectFieldSm =
  'h-9 w-full min-w-0 cursor-pointer appearance-none !rounded-lg !border !border-[#DCE3ED] bg-white !pl-3 !pr-8 !py-0 text-[13px] font-medium text-[#111827] transition-[border-color,box-shadow] outline-none hover:border-[#C7D2FE] focus-visible:border-[#6366F1] focus-visible:shadow-[0_0_0_4px_rgba(99,102,241,0.10)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]';

/** Form field label: 13px / 600 / #374151 */
export const fieldLabel = 'text-[13px] font-semibold text-[#374151]';

/** Square 42x42 add (+) button */
export const addButton =
  'inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] border border-[#E5E7EB] bg-white text-[#6B7280] transition-colors duration-180 hover:border-[#6366F1] hover:bg-[#F5F7FF] hover:text-[#4F46E5] disabled:pointer-events-none disabled:opacity-50';

/** Inline "add row / link" action */
export const addLink =
  'inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#4F46E5] transition-colors hover:text-[#4338CA]';

/** Secondary text button (white, 1px #D1D5DB, hover #F9FAFB) */
export const secondaryButton =
  'inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-[#D1D5DB] bg-white px-[22px] text-sm font-medium text-[#111827] transition-colors duration-200 hover:bg-[#F9FAFB] disabled:pointer-events-none disabled:opacity-50';

/** Ghost button (transparent, hover #F3F4F6) */
export const ghostButton =
  'inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-transparent bg-transparent px-[22px] text-sm font-medium text-[#111827] transition-colors duration-200 hover:bg-[#F3F4F6] disabled:pointer-events-none disabled:opacity-50';

/** Primary indigo button */
export const primaryButton =
  'inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] bg-[#6366F1] px-[22px] text-sm font-medium text-white shadow-[0_8px_18px_rgba(79,70,229,0.18)] transition-colors duration-200 hover:bg-[#4F46E5] active:bg-[#4338CA] disabled:pointer-events-none disabled:opacity-50';
