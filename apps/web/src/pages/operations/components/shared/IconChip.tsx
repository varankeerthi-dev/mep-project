import React from 'react';

type ChipType = 'brand' | 'warn' | 'alert' | 'info' | 'purple' | 'success';

interface IconChipProps {
  icon: React.ReactNode;
  type?: ChipType;
  className?: string;
  size?: 'sm' | 'md';
}

export const IconChip: React.FC<IconChipProps> = ({ icon, type = 'info', className = '', size = 'sm' }) => {
  const colorClassMap: Record<ChipType, string> = {
    brand: 'bg-[var(--brand-soft)] text-[var(--brand-dark)]',
    warn: 'bg-[var(--warn-soft)] text-[var(--warn)]',
    alert: 'bg-[var(--alert-soft)] text-[var(--alert)]',
    info: 'bg-[var(--info-soft)] text-[var(--info)]',
    purple: 'bg-[var(--purple-soft)] text-[var(--purple)]',
    success: 'bg-[var(--success-soft)] text-[var(--success)]',
  };

  const sizeClass = size === 'sm'
    ? 'w-[34px] h-[34px] rounded-[10px] [&>svg]:w-[18px] [&>svg]:h-[18px]'
    : 'w-[34px] h-[34px] rounded-[10px] [&>svg]:w-[18px] [&>svg]:h-[18px]';

  return (
    <div className={`flex items-center justify-center shrink-0 ${sizeClass} ${colorClassMap[type]} ${className}`}>
      {icon}
    </div>
  );
};
