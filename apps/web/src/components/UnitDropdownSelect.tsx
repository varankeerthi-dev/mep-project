import React, { useState, useRef, useEffect } from 'react';

interface UnitDropdownSelectProps {
  value: string;
  materialId: string;
  materials: any[];
  onChange: (val: string) => void;
  disabled?: boolean;
}

export const UnitDropdownSelect: React.FC<UnitDropdownSelectProps> = ({
  value,
  materialId,
  materials,
  onChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [isOpen]);

  const mat = materials.find(m => m.id === materialId);
  const primaryUnit = mat?.unit || 'Nos';
  const altUnits = mat?.material_units || [];

  const allUnits = [
    primaryUnit,
    ...altUnits.map((u: any) => u.unit_name)
  ].filter((v, i, a) => a.indexOf(v) === i && !!v);

  if (allUnits.length <= 1) {
    return (
      <input
        type="text"
        className="cell-input text-center font-medium"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', width: '100%', border: 'none', background: 'transparent' }}
      />
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
      <input
        type="text"
        className="cell-input text-center font-medium"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', width: '100%', border: 'none', background: 'transparent', paddingRight: '12px' }}
      />
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        style={{
          position: 'absolute',
          right: '2px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: '#94a3b8',
          fontSize: '8px',
          display: 'flex',
          alignItems: 'center',
          userSelect: 'none',
        }}
      >
        ▼
      </button>
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          zIndex: 9999,
          background: '#fff',
          border: '1px solid #cbd5e1',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          borderRadius: '4px',
          minWidth: '130px',
          marginTop: '2px',
          maxHeight: '120px',
          overflowY: 'auto',
        }}>
          {allUnits.map(unit => {
            const isSelected = value?.toLowerCase() === unit.toLowerCase();
            const altInfo = altUnits.find((u: any) => u.unit_name.toLowerCase() === unit.toLowerCase());
            const label = altInfo ? `${unit} (1 ${primaryUnit} = ${altInfo.conversion_factor} ${unit})` : unit;

            return (
              <div
                key={unit}
                onClick={() => {
                  onChange(unit);
                  setIsOpen(false);
                }}
                style={{
                  padding: '6px 8px',
                  fontSize: '10px',
                  color: isSelected ? '#1e293b' : '#64748b',
                  fontWeight: isSelected ? 600 : 400,
                  cursor: 'pointer',
                  borderBottom: '1px solid #f1f5f9',
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                {label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
