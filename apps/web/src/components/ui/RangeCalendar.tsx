import React, { useState, useMemo } from 'react';

interface RangeCalendarProps {
  value?: { startDate: Date | null; endDate: Date | null };
  onChange?: (range: { startDate: Date | null; endDate: Date | null }) => void;
  style?: React.CSSProperties;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const isSameDay = (d1: Date | null, d2: Date | null): boolean => {
  if (!d1 || !d2) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

const isDateBetween = (date: Date, start: Date | null, end: Date | null): boolean => {
  if (!start || !end) return false;
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return d > s && d < e;
};

export const RangeCalendar: React.FC<RangeCalendarProps> = ({
  value,
  onChange,
  style,
}) => {
  // Local state if uncontrolled
  const [internalRange, setInternalRange] = useState<{ startDate: Date | null; endDate: Date | null }>({
    startDate: null,
    endDate: null,
  });

  const range = value || internalRange;
  const startDate = range.startDate;
  const endDate = range.endDate;

  // Base month date representing the left calendar
  const [baseMonth, setBaseMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  // Hover state to preview selection range
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  // Compute the right calendar base month (left month + 1)
  const rightMonth = useMemo(() => {
    return new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, 1);
  }, [baseMonth]);

  const handlePrevMonth = () => {
    setBaseMonth(new Date(baseMonth.getFullYear(), baseMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setBaseMonth(new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, 1));
  };

  // Get date matrix (chunked in 7-day rows) for a given month
  const getMonthWeeks = (monthDate: Date) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay(); // 0 (Sun) to 6 (Sat)
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthTotalDays = new Date(year, month, 0).getDate();

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Prev month trailing days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthTotalDays - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month leading days to fill up a consistent grid size
    // Calculate total slots needed (either 35 or 42 depending on layout, standard is 42 to prevent row size jitter)
    const totalSlots = 42;
    const nextMonthNeeded = totalSlots - days.length;
    for (let i = 1; i <= nextMonthNeeded; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    // Split into weeks
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  };

  const handleDateClick = (dayDate: Date) => {
    let nextRange;
    if (!startDate || (startDate && endDate)) {
      nextRange = { startDate: dayDate, endDate: null };
      setHoverDate(null);
    } else {
      if (dayDate < startDate) {
        nextRange = { startDate: dayDate, endDate: null };
        setHoverDate(null);
      } else {
        nextRange = { startDate, endDate: dayDate };
      }
    }

    if (!value) {
      setInternalRange(nextRange);
    }
    onChange?.(nextRange);
  };

  const leftWeeks = useMemo(() => getMonthWeeks(baseMonth), [baseMonth]);
  const rightWeeks = useMemo(() => getMonthWeeks(rightMonth), [rightMonth]);

  const renderMonth = (monthDate: Date, weeks: typeof leftWeeks) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const monthLabel = monthDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    return (
      <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative', width: '100%' }}>
        {/* Month Title */}
        <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', flexShrink: '0', height: '22px', justifyContent: 'center', paddingInline: '24px', width: '100%' }}>
          <div style={{ boxSizing: 'border-box', color: '#0A0A0A', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 500, lineHeight: '142.857%' }}>
            {monthLabel}
          </div>
        </div>

        {/* Calendar Header & Body Table */}
        <div style={{ borderCollapse: 'collapse', boxSizing: 'border-box', display: 'table', width: '100%' }}>
          {/* Weekday headers */}
          <div style={{ boxSizing: 'border-box', display: 'table-header-group' }}>
            <div style={{ boxSizing: 'border-box', display: 'flex' }}>
              {WEEKDAYS.map((day) => (
                <div key={day} style={{ borderRadius: '6px', boxSizing: 'border-box', flexBasis: '0%', flexGrow: '1' }}>
                  <div style={{ boxSizing: 'border-box', color: '#737373', display: 'flex', flexWrap: 'wrap', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', justifyContent: 'center', lineHeight: '142.857%', textAlign: 'center' }}>
                    {day}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Weeks */}
          <div style={{ boxSizing: 'border-box', display: 'table-row-group' }}>
            {weeks.map((week, wIdx) => (
              <div key={wIdx} style={{ boxSizing: 'border-box', display: 'flex', marginTop: '4px', width: '100%' }}>
                {week.map((item, dIdx) => {
                  const dayDate = item.date;
                  const isCurrentMonth = item.isCurrentMonth;

                  const isRangeComplete = !!(startDate && endDate);
                  const isStart = isCurrentMonth && isRangeComplete && isSameDay(dayDate, startDate);
                  const isEnd = isCurrentMonth && isRangeComplete && isSameDay(dayDate, endDate);
                  const isSingleDaySelect = isStart && isEnd;
                  
                  // Compute if cell is currently in selection range
                  const isBetween = isCurrentMonth && isRangeComplete && isDateBetween(dayDate, startDate, endDate);

                  const isHoverEnd = false;

                  // Rounded edges styling for in-between ranges at week start/end boundaries
                  const isWeekStart = dIdx === 0;
                  const isWeekEnd = dIdx === 6;

                  let cellStyle: React.CSSProperties = {
                    aspectRatio: '1 / 1',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                    height: '100%',
                    width: '100%',
                    position: 'relative',
                    cursor: isCurrentMonth ? 'pointer' : 'default',
                    userSelect: 'none',
                  };

                  if (isBetween) {
                    cellStyle = {
                      ...cellStyle,
                      backgroundColor: '#F5F5F5',
                      borderRadius: '0px',
                      ...(isWeekStart && { borderTopLeftRadius: '6px', borderBottomLeftRadius: '6px' }),
                      ...(isWeekEnd && { borderTopRightRadius: '6px', borderBottomRightRadius: '6px' }),
                    };
                  }

                  const dateNumberColor = isStart || isEnd
                    ? '#FAFAFA'
                    : isCurrentMonth
                      ? '#0A0A0A'
                      : '#737373';

                  return (
                    <div
                      key={dIdx}
                      onClick={() => isCurrentMonth && handleDateClick(dayDate)}
                      style={cellStyle}
                      className={isCurrentMonth ? "range-cal-cell" : ""}
                    >
                      {isSingleDaySelect ? (
                        /* Single Day Selection: Dark circle, no extending range bars */
                        <div style={{ alignItems: 'center', aspectRatio: '1 / 1', backgroundColor: '#171717', borderRadius: '6px', boxShadow: '#A1A1A180 0px 0px 0px 2.5px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '2px', isolation: 'isolate', justifyContent: 'center', minWidth: '22px', position: 'relative', width: '100%', zIndex: 1 }}>
                          <div style={{ boxSizing: 'border-box', color: dateNumberColor, display: 'flex', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', lineHeight: '100%', textAlign: 'center', width: 'max-content' }}>
                            {dayDate.getDate()}
                          </div>
                        </div>
                      ) : isStart ? (
                        /* Start Day Selection: Dark circle, range bar extends right */
                        <>
                          <div style={{ backgroundColor: '#F5F5F5', bottom: '0px', boxSizing: 'border-box', height: '22px', left: '11px', position: 'absolute', right: '0px', top: '0px', zIndex: 0 }} />
                          <div style={{ alignItems: 'center', aspectRatio: '1 / 1', backgroundColor: '#171717', borderRadius: '6px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '2px', isolation: 'isolate', justifyContent: 'center', minWidth: '22px', position: 'relative', width: '100%', zIndex: 1 }}>
                            <div style={{ boxSizing: 'border-box', color: dateNumberColor, display: 'flex', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', lineHeight: '100%', textAlign: 'center', width: 'max-content' }}>
                              {dayDate.getDate()}
                            </div>
                          </div>
                        </>
                      ) : isEnd ? (
                        /* End Day Selection: Dark circle with shadow ring, range bar extends left */
                        <>
                          <div style={{ backgroundColor: '#F5F5F5', bottom: '0px', boxSizing: 'border-box', height: '22px', left: '0px', position: 'absolute', right: '11px', top: '0px', zIndex: 0 }} />
                          <div style={{ alignItems: 'center', aspectRatio: '1 / 1', backgroundColor: '#171717', borderRadius: '6px', boxShadow: '#A1A1A180 0px 0px 0px 2.5px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '2px', isolation: 'isolate', justifyContent: 'center', minWidth: '22px', position: 'relative', width: '100%', zIndex: 1 }}>
                            <div style={{ boxSizing: 'border-box', color: dateNumberColor, display: 'flex', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', lineHeight: '100%', textAlign: 'center', width: 'max-content' }}>
                              {dayDate.getDate()}
                            </div>
                          </div>
                        </>
                      ) : (
                        /* Regular / In-Between Day selection styling */
                        <div style={{ alignItems: 'center', aspectRatio: '1 / 1', borderRadius: '8px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '2px', isolation: 'isolate', justifyContent: 'center', minWidth: '22px', width: '100%' }}>
                          <div style={{ boxSizing: 'border-box', color: dateNumberColor, display: 'flex', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', lineHeight: '100%', textAlign: 'center', width: 'max-content' }}>
                            {dayDate.getDate()}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        boxSizing: 'border-box',
        display: 'flex',
        fontSynthesis: 'none',
        gap: '12px',
        MozOsxFontSmoothing: 'grayscale',
        position: 'relative',
        WebkitFontSmoothing: 'antialiased',
        backgroundColor: '#FFFFFF',
        padding: '8px',
        borderRadius: '12px',
        border: '1px solid #EAEAEA',
        userSelect: 'none',
        ...style,
      }}
      onMouseLeave={() => setHoverDate(null)}
      className="range-calendar-container"
    >
      {/* Navigation absolute row overlays the month titles */}
      <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '4px', justifyContent: 'space-between', left: '8px', position: 'absolute', right: '8px', top: '8px', pointerEvents: 'none', zIndex: 10 }}>
        <button
          onClick={handlePrevMonth}
          style={{
            alignItems: 'center',
            borderColor: '#ECECEC',
            borderRadius: '8px',
            borderStyle: 'solid',
            borderWidth: '1px',
            boxSizing: 'border-box',
            display: 'flex',
            flexShrink: '0',
            gap: '6px',
            height: '24px',
            justifyContent: 'center',
            width: '24px',
            backgroundColor: '#FFFFFF',
            cursor: 'pointer',
            pointerEvents: 'auto',
            outline: 'none',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
          className="range-cal-nav-btn"
          title="Previous month"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" style={{ height: '14px', flexShrink: '0', width: '14px', overflow: 'clip' }}>
            <path d="m15 18-6-6 6-6" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={handleNextMonth}
          style={{
            alignItems: 'center',
            borderColor: '#ECECEC',
            borderRadius: '8px',
            borderStyle: 'solid',
            borderWidth: '1px',
            boxSizing: 'border-box',
            display: 'flex',
            flexShrink: '0',
            gap: '6px',
            height: '24px',
            justifyContent: 'center',
            width: '24px',
            backgroundColor: '#FFFFFF',
            cursor: 'pointer',
            pointerEvents: 'auto',
            outline: 'none',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
          className="range-cal-nav-btn"
          title="Next month"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" style={{ height: '14px', flexShrink: '0', width: '14px', overflow: 'clip' }}>
            <path d="m9 18 6-6-6-6" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Render left and right calendars */}
      {renderMonth(baseMonth, leftWeeks)}
      {renderMonth(rightMonth, rightWeeks)}

      <style>{`
        .range-cal-cell:hover:not(.is-range-selected) {
          background-color: #F9FAFB;
        }
        .range-cal-nav-btn:hover {
          background-color: #FAFAFA !important;
          border-color: #D1D5DB !important;
        }
      `}</style>
    </div>
  );
};
