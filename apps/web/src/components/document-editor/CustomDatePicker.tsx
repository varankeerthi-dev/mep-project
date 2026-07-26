import React, { useState, useRef, useEffect } from 'react';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from 'date-fns';

interface CustomDatePickerProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  inputStyle?: React.CSSProperties;
  minDate?: string;
  disabled?: boolean;
}

export function CustomDatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  inputStyle,
  minDate,
  disabled,
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => {
    return value ? new Date(value) : new Date();
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentDate((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentDate((prev) => addMonths(prev, 1));
  };

  const handleSelectDay = (day: Date, e: React.MouseEvent) => {
    e.stopPropagation();
    const formatted = format(day, 'yyyy-MM-dd');
    onChange(formatted);
    setIsOpen(false);
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  const getFormattedValue = () => {
    if (!value) return '';
    try {
      return format(new Date(value), 'dd MMM yyyy');
    } catch {
      return value;
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        className="cq-datepicker-input"
        style={{
          ...inputStyle,
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: disabled ? '#f3f4f6' : undefined,
        }}
      >
        <span
          style={{
            color: value ? '#1f2937' : '#9ca3af',
            fontWeight: value ? 500 : 400,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {getFormattedValue() || placeholder}
        </span>
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            zIndex: 100,
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
            padding: '12px',
            width: '250px',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
            }}
          >
            <button
              type="button"
              onClick={handlePrevMonth}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#4b5563',
                padding: '2px 6px',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
            >
              &lt;
            </button>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#1f2937' }}>
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#4b5563',
                padding: '2px 6px',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
            >
              &gt;
            </button>
          </div>

          {/* Weekday headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '4px',
              textAlign: 'center',
              marginBottom: '4px',
            }}
          >
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((wd) => (
              <span
                key={wd}
                style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3af' }}
              >
                {wd}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '4px',
            }}
          >
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <span key={`empty-${i}`} />
            ))}
            {daysInMonth.map((day) => {
              const isSelected = value && isSameDay(day, new Date(value));
              const isToday = isSameDay(day, new Date());
              const dayStr = format(day, 'yyyy-MM-dd');
              const isDisabled = minDate ? dayStr <= minDate : false;
              return (
                <button
                  key={day.toString()}
                  type="button"
                  onClick={(e) => !isDisabled && handleSelectDay(day, e)}
                  disabled={isDisabled}
                  style={{
                    background: isSelected ? '#2563eb' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: isSelected || isToday ? 'bold' : 'normal',
                    color: isDisabled
                      ? '#cbd5e1'
                      : isSelected
                        ? 'white'
                        : isToday
                          ? '#2563eb'
                          : '#374151',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    height: '24px',
                    width: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected && !isDisabled)
                      e.currentTarget.style.background = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected && !isDisabled)
                      e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
