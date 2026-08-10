import React from 'react';
import { Button } from '@/components/ui/button';

export interface RadioOption<T = any> {
  label: string;
  value: T;
  description?: string;
}

export interface SettingRadioGroupProps<T = any> {
  options: RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  name?: string;
  variant?: 'radio' | 'segmented';
}

export function SettingRadioGroup<T = any>({
  options,
  value,
  onChange,
  disabled = false,
  name,
  variant = 'radio',
}: SettingRadioGroupProps<T>) {
  const generatedName = React.useId();
  const groupName = name || generatedName;

  if (variant === 'segmented') {
    return (
      <div className="inline-flex items-center p-1 bg-zinc-100/90 rounded-lg border border-zinc-200/80">
        {options.map((opt, idx) => {
          const isSelected = opt.value === value;
          return (
            <Button variant="ghost" size="default" key={idx} type="button" disabled={disabled} onClick={() => !disabled && onChange(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-white text-zinc-900 shadow-2xs border border-zinc-200/60'
                  : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/40'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{ fontSize: '12px' }}
            >
              {opt.label}
            </Button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-5">
      {options.map((opt, idx) => {
        const isSelected = opt.value === value;
        return (
          <label
            key={idx}
            className={`flex items-center gap-2.5 cursor-pointer select-none py-1 ${
              disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <div className="relative flex items-center justify-center">
              <input
                type="radio"
                name={groupName}
                checked={isSelected}
                disabled={disabled}
                onChange={() => !disabled && onChange(opt.value)}
                className="sr-only"
              />
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                  isSelected
                    ? 'border-[#185FA5] bg-white ring-2 ring-[#185FA5]/20'
                    : 'border-zinc-300 bg-white hover:border-zinc-400'
                }`}
              >
                {isSelected && (
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: '#185FA5' }}
                  />
                )}
              </div>
            </div>
            <div className="flex flex-col">
              <span
                className={`text-xs font-semibold transition-colors ${
                  isSelected ? 'text-zinc-900' : 'text-zinc-600'
                }`}
                style={{ fontSize: '12px' }}
              >
                {opt.label}
              </span>
              {opt.description && (
                <span className="text-[11px] text-zinc-400">
                  {opt.description}
                </span>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
}
