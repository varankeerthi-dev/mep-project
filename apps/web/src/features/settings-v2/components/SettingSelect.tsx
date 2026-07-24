import React from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SettingSelectProps {
  options: SelectOption[] | string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const SettingSelect: React.FC<SettingSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = '-- Select --',
  disabled = false,
  className = '',
}) => {
  const normalizedOptions: SelectOption[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  return (
    <div className="w-full max-w-sm">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full rounded-md border border-zinc-200 bg-white text-zinc-900 outline-none cursor-pointer transition-all hover:border-zinc-300 focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/20 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:cursor-not-allowed ${className}`}
        style={{
          fontSize: '12px',
          padding: '4px 8px',
          borderColor: '#e5e5e5',
        }}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {normalizedOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};
