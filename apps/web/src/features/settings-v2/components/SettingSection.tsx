import React from 'react';

export interface SettingSectionProps {
  title: string;
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
      className={`bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-2xs mb-6 ${className}`}
      style={{
        borderRadius: '8px',
        borderColor: '#e5e5e5',
      }}
    >
      <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
        <div>
          <h3
            className="font-semibold text-zinc-900"
            style={{ fontSize: '15px', letterSpacing: '-0.01em' }}
          >
            {title}
          </h3>
          {description && (
            <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="p-6 space-y-5" style={{ padding: '24px' }}>
        {children}
      </div>
    </div>
  );
};
