import React from 'react';

type SwitchProps = React.InputHTMLAttributes<HTMLInputElement> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export const Switch = ({ checked, onCheckedChange, className, ...props }: SwitchProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={!!checked}
    onClick={() => onCheckedChange?.(!checked)}
    className={`inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-150 ease-in-out focus-visible:outline-none ${
      checked ? 'bg-blue-600' : 'bg-zinc-200'
    } ${className ?? ''}`}
  >
    <span
      className={`inline-flex h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-150 ease-in-out ${
        checked ? 'translate-x-4' : 'translate-x-0.5'
      }`}
    />
    <input
      type="checkbox"
      className="sr-only"
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      {...props}
    />
  </button>
);
