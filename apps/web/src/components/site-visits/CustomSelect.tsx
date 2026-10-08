import React, { useState, useEffect, useRef, useMemo } from 'react';

export interface CustomSelectProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
  hasError?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  options,
  onChange,
  placeholder,
  style,
  className,
  hasError,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  // Shortlist options as the user types (case-insensitive substring match)
  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  useEffect(() => {
    if (open) {
      setSearch('');
      const idx = options.findIndex((o) => o.value === value);
      setHighlighted(idx >= 0 ? idx : 0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    setHighlighted(0);
  }, [search]);

  useEffect(() => {
    itemRefs.current[highlighted]?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  const commitSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch('');
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlighted((h) => Math.min(h + 1, Math.max(filteredOptions.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filteredOptions[highlighted]) {
        commitSelect(filteredOptions[highlighted].value);
      } else if (!open) {
        setOpen(true);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setSearch('');
    } else if (e.key === 'Tab') {
      setOpen(false);
      setSearch('');
    }
  };

  return (
    <div ref={ref} className={className} style={{ position: 'relative', ...style }}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        value={open ? search : selectedLabel || ''}
        placeholder={selectedLabel ? undefined : placeholder || 'Select...'}
        onChange={(e) => {
          setSearch(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          if (!open) setOpen(true);
        }}
        onClick={() => {
          if (!open) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          padding: '8px 28px 8px 12px',
          border: hasError ? '1px solid #ef4444' : '1px solid #d4d4d4',
          borderRadius: '6px',
          fontSize: 'inherit',
          fontFamily: 'inherit',
          lineHeight: 1.4,
          color: '#171717',
          background: '#fff',
          outline: 'none',
          cursor: open ? 'text' : 'pointer',
          boxShadow: hasError ? '0 0 0 1px rgba(239, 68, 68, 0.3)' : undefined,
        }}
      />
      <span
        style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '10px',
          color: '#999',
          pointerEvents: 'none',
        }}
      >
        ▾
      </span>
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
          {filteredOptions.length === 0 && (
            <div style={{ padding: '8px 12px', color: '#999', fontSize: '13px' }}>
              {options.length === 0 ? 'No options' : 'No matching options'}
            </div>
          )}
          {filteredOptions.map((option, idx) => (
            <div
              key={option.value}
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              onClick={() => commitSelect(option.value)}
              onMouseEnter={() => setHighlighted(idx)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                background:
                  option.value === value
                    ? '#f0f7ff'
                    : idx === highlighted
                    ? '#f5f5f5'
                    : '#fff',
                color: '#171717',
                fontSize: '13px',
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
