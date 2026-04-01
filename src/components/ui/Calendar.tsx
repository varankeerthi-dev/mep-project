import React from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  isToday,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { colors, radii, shadows, transitions } from '../../design-system';
import { IconButton } from './Button';

interface CalendarProps {
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  selectedDate?: Date;
  onSelectDate?: (date: Date) => void;
  events?: { date: Date; count: number }[];
  highlightedDates?: Date[];
}

export function Calendar({
  currentMonth,
  onMonthChange,
  selectedDate,
  onSelectDate,
  events = [],
  highlightedDates = [],
}: CalendarProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const getEventCount = (date: Date) => {
    return events.filter((e) => isSameDay(e.date, date)).reduce((sum, e) => sum + e.count, 0);
  };

  const isHighlighted = (date: Date) => {
    return highlightedDates.some((d) => isSameDay(d, date));
  };

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: radii.lg,
        boxShadow: shadows.DEFAULT,
        border: `1px solid ${colors.gray[200]}`,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: `1px solid ${colors.gray[100]}`,
        }}
      >
        <h3
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: colors.gray[900],
            margin: 0,
          }}
        >
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <div style={{ display: 'flex', gap: '4px' }}>
          <IconButton
            icon={<ChevronLeft size={18} />}
            variant="ghost"
            size="sm"
            onClick={() => onMonthChange(subMonths(currentMonth, 1))}
          />
          <IconButton
            icon={<ChevronRight size={18} />}
            variant="ghost"
            size="sm"
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
          />
        </div>
      </div>

      {/* Weekday headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '1px',
          background: colors.gray[100],
        }}
      >
        {weekDays.map((day) => (
          <div
            key={day}
            style={{
              padding: '10px 0',
              textAlign: 'center',
              fontSize: '12px',
              fontWeight: 600,
              color: colors.gray[500],
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: colors.gray[50],
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '1px',
          background: colors.gray[100],
        }}
      >
        {days.map((day, index) => {
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const dayIsToday = isToday(day);
          const eventCount = getEventCount(day);
          const highlighted = isHighlighted(day);

          return (
            <button
              key={index}
              onClick={() => onSelectDate?.(day)}
              style={{
                position: 'relative',
                aspectRatio: '1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: isSelected
                  ? colors.primary[600]
                  : dayIsToday
                  ? colors.primary[50]
                  : '#ffffff',
                border: 'none',
                cursor: onSelectDate ? 'pointer' : 'default',
                color: isSelected
                  ? '#ffffff'
                  : !isCurrentMonth
                  ? colors.gray[400]
                  : dayIsToday
                  ? colors.primary[600]
                  : colors.gray[700],
                transition: transitions.DEFAULT,
                fontSize: '14px',
                fontWeight: dayIsToday || isSelected ? 600 : 400,
              }}
              onMouseEnter={(e) => {
                if (!isSelected && onSelectDate) {
                  e.currentTarget.style.background = dayIsToday
                    ? colors.primary[100]
                    : colors.gray[50];
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = dayIsToday
                    ? colors.primary[50]
                    : '#ffffff';
                }
              }}
            >
              <span>{format(day, 'd')}</span>
              {eventCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: '6px',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: isSelected ? '#ffffff' : colors.primary[500],
                  }}
                />
              )}
              {highlighted && !eventCount && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: '6px',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    background: isSelected ? 'rgba(255,255,255,0.5)' : colors.gray[400],
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
