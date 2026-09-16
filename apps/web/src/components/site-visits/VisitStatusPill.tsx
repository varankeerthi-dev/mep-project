import React from 'react';
import {
  SITE_VISIT_LABELS,
  VISIT_STATUS_PALETTE,
  FALLBACK_STATUS,
} from './siteVisitLabels';

/**
 * Status micro-pill: 6px semantic dot + label in a soft container
 * (reference design system §1–2). Copy resolved from SITE_VISIT_LABELS.
 */
export const VisitStatusPill: React.FC<{ status: string }> = ({ status }) => {
  const palette = VISIT_STATUS_PALETTE[status] ?? FALLBACK_STATUS;
  const label =
    (SITE_VISIT_LABELS.status as Record<string, string>)[status] ??
    status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full text-[11px] font-semibold tracking-[0.02em]"
      style={{ backgroundColor: palette.bg, color: palette.text, padding: '3px 10px', lineHeight: '14px' }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: palette.dot }} />
      {label}
    </span>
  );
};
