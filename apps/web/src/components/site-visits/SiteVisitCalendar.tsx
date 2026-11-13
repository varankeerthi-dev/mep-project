import React, { useState, useMemo } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay,
  isToday, 
  addMonths, 
  subMonths, 
  parseISO 
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SiteVisitMobileCard } from './SiteVisitMobileCard';

export interface SiteVisitCalendarProps {
  visits: any[];
  onDateClick: (day: Date) => void;
  onVisitClick: (visit: any) => void;
  onEditVisit?: (visit: any) => void;
  onDeleteVisit?: (visit: any) => void;
  onDownloadPdf?: (visit: any) => void;
  onQuickUpdate?: (visit: any) => void;
  onCheckOut?: (visit: any) => void;
}

export const SiteVisitCalendar: React.FC<SiteVisitCalendarProps> = ({ 
  visits, 
  onDateClick, 
  onVisitClick,
  onEditVisit,
  onDeleteVisit,
  onDownloadPdf,
  onQuickUpdate,
  onCheckOut,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const visitsByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    visits.forEach((visit: any) => {
      if (!visit.visit_date) return;
      let dateKey = '';
      try {
        const parts = visit.visit_date.split('-');
        if (parts.length === 3) {
          dateKey = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else {
          dateKey = format(parseISO(visit.visit_date), 'yyyy-MM-dd');
        }
      } catch {
        dateKey = visit.visit_date;
      }
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(visit);
    });
    return map;
  }, [visits]);

  const getVisitsForDay = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    return visitsByDay.get(dateKey) || [];
  };

  const selectedDayKey = format(selectedDate, 'yyyy-MM-dd');
  const selectedDayVisits = visitsByDay.get(selectedDayKey) || [];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      {/* ─── Desktop Calendar View (md and above) ─────────────────────────── */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-white">
          <h2 className="text-2xl font-bold text-slate-900">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors active:scale-[0.96]"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <button
              onClick={() => {
                const today = new Date();
                setCurrentMonth(today);
                setSelectedDate(today);
              }}
              className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors active:scale-[0.96] border border-slate-200"
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors active:scale-[0.96]"
              aria-label="Next month"
            >
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-7 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day) => {
              const dayVisits = getVisitsForDay(day);
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isTodayDay = isToday(day);
              return (
                <div 
                  key={day.toString()} 
                  className={cn(
                    "min-h-[105px] p-2 rounded-xl border cursor-pointer hover:bg-slate-50/80 transition-all",
                    !isCurrentMonth ? "bg-slate-50/50 border-slate-100 opacity-40" : "bg-white border-slate-200",
                    isTodayDay ? "border-blue-500 ring-2 ring-blue-100 shadow-xs" : ""
                  )}
                  onClick={() => onDateClick(day)}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <span className={cn(
                      "text-xs font-bold",
                      isTodayDay ? "text-blue-600" : isCurrentMonth ? "text-slate-800" : "text-slate-400"
                    )}>
                      {format(day, 'd')}
                    </span>
                    <Plus className="w-3.5 h-3.5 text-slate-400 opacity-60 hover:opacity-100" />
                  </div>

                  <div className="space-y-1">
                    {dayVisits.map((visit: any) => (
                      <div 
                        key={visit.id}
                        className={cn(
                          "px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer truncate transition-transform active:scale-95 shadow-2xs",
                          visit.status === 'completed' ? "bg-emerald-50 text-emerald-800 border border-emerald-200" :
                          visit.status === 'scheduled' ? "bg-blue-50 text-blue-800 border border-blue-200" :
                          visit.status === 'in_progress' ? "bg-amber-50 text-amber-800 border border-amber-200" :
                          visit.status === 'cancelled' ? "bg-rose-50 text-rose-800 border border-rose-200" :
                          "bg-slate-100 text-slate-800 border border-slate-200"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onVisitClick(visit);
                        }}
                      >
                        {visit.clients?.client_name || visit.client_name || 'Unknown'}
                        {visit.engineer || visit.visited_by ? ` · ${visit.engineer || visit.visited_by}` : ''}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Mobile Touch Calendar View (below md) ───────────────────────── */}
      <div className="block md:hidden">
        {/* Month Navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 bg-white">
          <h2 className="text-base font-bold text-slate-900">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                setCurrentMonth(today);
                setSelectedDate(today);
              }}
              className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all"
            >
              Today
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Day-of-week header */}
        <div className="grid grid-cols-7 px-2 pt-2 border-b border-slate-100 bg-slate-50/50 text-center">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <div key={i} className="py-1 text-[11px] font-semibold text-slate-400">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days grid (touchable date bubbles) */}
        <div className="grid grid-cols-7 gap-1 p-2 bg-white">
          {calendarDays.map((day) => {
            const dayVisits = getVisitsForDay(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isTodayDay = isToday(day);
            const isSelected = isSameDay(day, selectedDate);

            return (
              <button
                key={day.toString()}
                type="button"
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "relative flex flex-col items-center justify-center py-2 rounded-xl transition-all active:scale-95 min-h-[46px]",
                  isSelected
                    ? "bg-blue-600 text-white font-bold shadow-sm"
                    : isTodayDay
                    ? "bg-blue-50 text-blue-700 font-bold ring-1 ring-blue-500/50"
                    : isCurrentMonth
                    ? "text-slate-800 hover:bg-slate-100"
                    : "text-slate-300"
                )}
              >
                <span className="text-xs sm:text-sm leading-none">{format(day, 'd')}</span>

                {/* Visit indicator dots */}
                <div className="flex items-center gap-0.5 mt-1 h-1.5">
                  {dayVisits.length > 0 && (
                    <>
                      {dayVisits.slice(0, 3).map((v: any, i: number) => (
                        <span
                          key={i}
                          className={cn(
                            "h-1.5 w-1.5 rounded-full shrink-0",
                            isSelected
                              ? "bg-white"
                              : v.status === 'completed'
                              ? "bg-emerald-500"
                              : v.status === 'in_progress'
                              ? "bg-amber-500"
                              : v.status === 'scheduled'
                              ? "bg-blue-600"
                              : "bg-slate-400"
                          )}
                        />
                      ))}
                      {dayVisits.length > 3 && (
                        <span className={cn(
                          "text-[8px] font-bold leading-none",
                          isSelected ? "text-white" : "text-slate-400"
                        )}>
                          +
                        </span>
                      )}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Date Agenda Details */}
        <div className="border-t border-slate-200/80 p-3.5 space-y-3 bg-slate-50/60">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {format(selectedDate, 'EEEE, d MMMM yyyy')}
              </h3>
              <p className="text-xs font-semibold text-slate-800 mt-0.5">
                {selectedDayVisits.length === 1
                  ? '1 visit scheduled'
                  : `${selectedDayVisits.length} visits scheduled`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onDateClick(selectedDate)}
              className="flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 active:scale-95 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Schedule</span>
            </button>
          </div>

          {selectedDayVisits.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
                <CalendarDays className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-slate-700">No visits scheduled for this date</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Tap '+ Schedule' to plan a visit</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDayVisits.map((visit: any) => (
                <SiteVisitMobileCard
                  key={visit.id}
                  visit={visit}
                  onView={onVisitClick}
                  onEdit={onEditVisit || (() => {})}
                  onDelete={onDeleteVisit || (() => {})}
                  onDownloadPdf={onDownloadPdf || (() => {})}
                  onQuickUpdate={onQuickUpdate}
                  onCheckOut={onCheckOut}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
