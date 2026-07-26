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
    style={{
      borderRadius: '9999px',
      width: '44px',
      height: '24px',
      padding: '2px',
      display: 'inline-flex',
      alignItems: 'center',
      cursor: 'pointer',
      border: 'none',
      background: checked ? '#09090b' : '#e4e4e7',
      transition: 'background-color 0.2s ease',
      boxSizing: 'border-box'
    }}
    className={className}
  >
    <span
      style={{
        borderRadius: '50%',
        width: '20px',
        height: '20px',
        background: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transform: checked ? 'translateX(20px)' : 'translateX(0px)',
        transition: 'transform 0.2s ease',
        display: 'inline-block'
      }}
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
