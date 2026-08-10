import React from 'react';
import { Button } from '@/components/ui/button';

export interface SettingToggleProps {
  label?: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const SettingToggle: React.FC<SettingToggleProps> = ({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="flex items-center justify-between gap-4 w-full">
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span
              className="font-semibold text-zinc-800"
              style={{ fontSize: '11px', color: '#374151' }}
            >
              {label}
            </span>
          )}
          {description && (
            <span className="text-[11px] text-zinc-500 mt-0.5">
              {description}
            </span>
          )}
        </div>
      )}
      <Button variant="ghost" size="default" type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        style={{
          backgroundColor: checked ? '#16a34a' : '#d4d4d8',
        }}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
          style={{ marginTop: '2px' }}
        />
      </Button>
    </div>
  );
};
