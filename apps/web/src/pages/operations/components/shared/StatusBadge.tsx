import React from 'react';

type BadgeType = 'brand' | 'warn' | 'alert' | 'info' | 'ok';

interface StatusBadgeProps {
  type: BadgeType;
  label: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ type, label, className = '' }) => {
  // Map 'ok' to 'brand' color logic if needed, or use specific classes
  const colorClassMap: Record<BadgeType, string> = {
    brand: 'bg-[var(--brand-soft)] text-[var(--brand-dark)]',
    warn: 'bg-[var(--warn-soft)] text-[var(--warn)]',
    alert: 'bg-[var(--alert-soft)] text-[var(--alert)]',
    info: 'bg-[var(--info-soft)] text-[var(--info)]',
    ok: 'bg-[var(--brand-soft)] text-[var(--brand-dark)]',
  };

  return (
    <span className={`inline-block font-mono text-[10px] font-semibold px-[7px] py-[2px] rounded-[20px] whitespace-nowrap ${colorClassMap[type]} ${className}`}>
      {label}
    </span>
  );
};
