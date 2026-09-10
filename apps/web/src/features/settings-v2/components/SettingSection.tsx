import React from 'react';

export interface SettingSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const SettingSection: React.FC<SettingSectionProps> = ({
  title,
  description,
  children,
  action,
  className = '',
}) => {
  return (
      <div
        className={`bg-white border border-zinc-300 overflow-hidden mb-3 sv-card ${className}`}
      >
      {(title || description) && (
      <div className="px-3 py-0.5 border-b border-zinc-100 flex items-center justify-between" style={{ paddingTop: 6, paddingBottom: 6 }}>
        <div>
          <h3
            className="font-semibold text-zinc-900"
            style={{ fontSize: '13px', letterSpacing: '-0.01em' }}
          >
            {title}
          </h3>
          {description && (
            <p className="text-[11px] text-zinc-500 mt-0.5">{description}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      )}
      <div className="space-y-2" style={{ padding: '10px 14px 10px 12px' }}>
        {children}
      </div>
    </div>
  );
};
