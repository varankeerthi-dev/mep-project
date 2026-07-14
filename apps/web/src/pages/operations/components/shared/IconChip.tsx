import React from 'react';

type ChipType = 'brand' | 'warn' | 'alert' | 'info';

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
  };

  const sizeClass = size === 'sm' ? 'w-[26px] h-[26px] rounded-[7px] [&>svg]:w-[15px] [&>svg]:h-[15px]' : 'w-[30px] h-[30px] rounded-[7px] [&>svg]:w-[15px] [&>svg]:h-[15px]';

  return (
    <div className={`flex items-center justify-center shrink-0 ${sizeClass} ${colorClassMap[type]} ${className}`}>
      {icon}
    </div>
  );
};
