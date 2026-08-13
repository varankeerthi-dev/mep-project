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

  // Single unit — show static text, no editing
  if (allUnits.length <= 1) {
    return (
      <div style={{
        fontSize: '11px',
        color: '#64748b',
        textAlign: 'center',
        width: '100%',
        padding: '4px 6px',
        fontWeight: 500,
      }}>
        {value || primaryUnit}
      </div>
    );
  }

  // Multiple units — dropdown select only, no free text
  const altInfo = altUnits.find((u: any) => u.unit_name.toLowerCase() === (value || '').toLowerCase());
  const label = altInfo ? `${value} (1 ${primaryUnit} = ${altInfo.conversion_factor} ${value})` : value;

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          padding: '4px 16px 4px 6px',
          fontSize: '11px',
          color: '#64748b',
          fontWeight: 500,
          background: 'transparent',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'center',
          position: 'relative',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || primaryUnit}</span>
        <span style={{
          position: 'absolute',
          right: '4px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '7px',
          color: '#94a3b8',
          pointerEvents: 'none',
        }}>▼</span>
      </button>
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
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
            const aInfo = altUnits.find((u: any) => u.unit_name.toLowerCase() === unit.toLowerCase());
            const unitLabel = aInfo ? `${unit} (1 ${primaryUnit} = ${aInfo.conversion_factor} ${unit})` : unit;

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
                  background: isSelected ? '#f1f5f9' : '#fff',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                onMouseLeave={e => e.currentTarget.style.background = isSelected ? '#f1f5f9' : '#fff'}
              >
                {unitLabel}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
