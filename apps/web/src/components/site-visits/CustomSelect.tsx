import React, { useState, useEffect, useRef } from 'react';

export interface CustomSelectProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  options,
  onChange,
  placeholder,
  style,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: '8px 12px',
          border: '1px solid #d4d4d4',
          borderRadius: '4px',
          fontSize: '14px',
          color: value ? '#171717' : '#999',
          background: '#fff',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          userSelect: 'none',
        }}
      >
        {selectedLabel || placeholder || 'Select...'}
        <span style={{ marginLeft: '8px', fontSize: '10px', color: '#999' }}>▾</span>
      </div>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            maxHeight: '200px',
            overflowY: 'auto',
            border: '1px solid #d4d4d4',
            borderRadius: '4px',
            background: '#fff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            marginTop: '2px',
          }}
        >
          {options.length === 0 && (
            <div style={{ padding: '8px 12px', color: '#999', fontSize: '13px' }}>No options</div>
          )}
          {options.map((option) => (
            <div
              key={option.value}
              onClick={() => { onChange(option.value); setOpen(false); }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = option.value === value ? '#f0f7ff' : '#fff'}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                background: option.value === value ? '#f0f7ff' : '#fff',
                color: '#171717',
                fontSize: '14px',
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
