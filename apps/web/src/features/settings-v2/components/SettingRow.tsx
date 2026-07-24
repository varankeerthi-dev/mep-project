import React from 'react';

export interface SettingRowProps {
  label: string;
  description?: string;
  required?: boolean;
  children: React.ReactNode;
  alignTop?: boolean;
}

export const SettingRow: React.FC<SettingRowProps> = ({
  label,
  description,
  required,
  children,
  alignTop = false,
}) => {
  return (
    <div
      className={`flex flex-col sm:flex-row gap-4 ${
        alignTop ? 'sm:items-start' : 'sm:items-center'
      } justify-between border-b border-zinc-100 py-4 first:pt-0 last:border-b-0 last:pb-0`}
      style={{ gap: '16px' }}
    >
      <div className="sm:max-w-sm flex-1">
        <label
          className="block font-semibold text-zinc-800 leading-snug"
          style={{ fontSize: '13px', color: '#1f2937' }}
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {description && (
          <p className="text-xs text-zinc-500 leading-relaxed mt-1">
            {description}
          </p>
        )}
      </div>
      <div className="flex-1 w-full sm:w-auto flex items-center justify-end">
        {children}
      </div>
    </div>
  );
};
