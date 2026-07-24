import React from 'react';

export interface SettingInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string | number;
  onChange: (value: string) => void;
  suffix?: string;
  prefix?: string;
  error?: string;
}

export const SettingInput: React.FC<SettingInputProps> = ({
  value,
  onChange,
  suffix,
  prefix,
  error,
  type = 'text',
  className = '',
  disabled,
  ...props
}) => {
  return (
    <div className="flex flex-col w-full max-w-sm">
      <div className="relative flex items-center w-full">
        {prefix && (
          <span className="absolute left-2.5 text-xs text-zinc-400 font-medium">
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full rounded-md border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 outline-none transition-all hover:border-zinc-300 focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/20 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:cursor-not-allowed ${
            prefix ? 'pl-7' : ''
          } ${suffix ? 'pr-7' : ''} ${className}`}
          style={{
            fontSize: '12px',
            padding: '4px 8px',
            borderColor: error ? '#ef4444' : '#e5e5e5',
          }}
          {...props}
        />
        {suffix && (
          <span className="absolute right-2.5 text-xs text-zinc-400 font-medium">
            {suffix}
          </span>
        )}
      </div>
      {error && <span className="text-[10px] text-red-500 mt-1">{error}</span>}
    </div>
  );
};
