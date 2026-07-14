import React from 'react';

interface ProgressBarProps {
  progress: number;
  colorClass?: string; // e.g. bg-[var(--brand)] or bg-[var(--info)]
  trackClass?: string; // e.g. bg-[var(--surface-alt)]
  heightClass?: string; // e.g. h-[5px]
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
  progress, 
  colorClass = 'bg-[var(--brand)]', 
  trackClass = 'bg-[var(--surface-alt)]',
  heightClass = 'h-[5px]',
  className = '' 
}) => {
  const safeProgress = Math.max(0, Math.min(100, progress));
  
  return (
    <div className={`w-full rounded-[4px] overflow-hidden ${trackClass} ${heightClass} ${className}`}>
      <div 
        className={`h-full ${colorClass}`} 
        style={{ width: `${safeProgress}%` }}
      />
    </div>
  );
};
