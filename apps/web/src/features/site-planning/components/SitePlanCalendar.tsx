import React, { useState, useMemo } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday, 
  isSameDay,
  addMonths, 
  subMonths, 
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  parseISO 
} from 'date-fns';
import { 
  ChevronLeft, ChevronRight, Users, Clock, 
  Calendar as CalendarIcon, HardHat, CheckCircle2, AlertTriangle, Send 
} from 'lucide-react';
import type { SitePlan } from '../types';

interface SitePlanCalendarProps {
  plans: SitePlan[];
  selectedDate?: string;
  onSelectDate: (dateStr: string) => void;
  onSelectPlan: (plan: SitePlan) => void;
}

type ViewMode = 'month' | 'week' | 'day';

export const SitePlanCalendar: React.FC<SitePlanCalendarProps> = ({
  plans,
  selectedDate,
  onSelectDate,
  onSelectPlan,
}) => {
  const [currentDate, setCurrentDate] = useState(() => 
    selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date()
  );
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  // Month intervals
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Week intervals
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Map plans by YYYY-MM-DD
  const plansByDate = useMemo(() => {
    const map = new Map<string, SitePlan[]>();
    plans.forEach(plan => {
      if (!plan.plan_date) return;
      const key = plan.plan_date.slice(0, 10);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(plan);
    });
    return map;
  }, [plans]);

  const handlePrev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  const handleNext = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    onSelectDate(format(today, 'yyyy-MM-dd'));
  };

  const getPlansForDate = (date: Date) => {
    const key = format(date, 'yyyy-MM-dd');
    return plansByDate.get(key) || [];
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Calendar Header Controls */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-slate-900 min-w-[160px]">
            {viewMode === 'day' 
              ? format(currentDate, 'EEEE, d MMMM yyyy')
              : format(currentDate, 'MMMM yyyy')}
          </h2>

          <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden shadow-xs">
            <button
              onClick={handlePrev}
              className="p-1.5 hover:bg-slate-100 text-slate-600 transition-colors"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 border-x border-slate-200 transition-colors"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 hover:bg-slate-100 text-slate-600 transition-colors"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Mode Selector */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setViewMode('month')}
            className={`px-3 py-1 rounded-md transition-colors ${
              viewMode === 'month' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1 rounded-md transition-colors ${
              viewMode === 'week' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setViewMode('day')}
            className={`px-3 py-1 rounded-md transition-colors ${
              viewMode === 'day' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Day
          </button>
        </div>
      </div>

      {/* MONTH VIEW */}
      {viewMode === 'month' && (
        <div className="flex-1 p-3">
          {/* Days of week header */}
          <div className="grid grid-cols-7 mb-1 text-center">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayPlans = getPlansForDate(day);
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isTodayDay = isToday(day);
              const isSelected = selectedDate === dateStr;

              const totalRequired = dayPlans.reduce((sum, p) => sum + (Number(p.headcount_required) || 1), 0);
              const totalAllocated = dayPlans.reduce((sum, p) => sum + (Number(p.allocated_headcount) || 0), 0);

              return (
                <div
                  key={dateStr}
                  onClick={() => onSelectDate(dateStr)}
                  className={`min-h-[110px] p-2 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                    !isCurrentMonth 
                      ? 'bg-slate-50/50 border-slate-100 opacity-40' 
                      : isSelected
                      ? 'bg-blue-50/30 border-blue-400 ring-2 ring-blue-100'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Date top row */}
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${
                      isTodayDay 
                        ? 'w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center'
                        : isCurrentMonth ? 'text-slate-900' : 'text-slate-400'
                    }`}>
                      {format(day, 'd')}
                    </span>

                    {dayPlans.length > 0 && (
                      <span className="text-[10px] font-semibold text-slate-500">
                        {totalAllocated}/{totalRequired} heads
                      </span>
                    )}
                  </div>

                  {/* Day Plan Pills */}
                  <div className="space-y-1 overflow-y-auto max-h-[72px] pr-0.5">
                    {dayPlans.slice(0, 3).map((plan) => {
                      const isConfirmed = plan.client_confirmation_status === 'confirmed';
                      const isPostponed = plan.client_confirmation_status === 'postponement_requested';

                      return (
                        <div
                          key={plan.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPlan(plan);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border truncate transition-transform hover:scale-[1.02] ${
                            isConfirmed 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                              : isPostponed
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-800 border-slate-200'
                          }`}
                          title={`${plan.plan_name} (${plan.trade || 'General'}): ${plan.allocated_headcount || 0}/${plan.headcount_required} heads`}
                        >
                          <span className="font-semibold">{plan.trade ? `[${plan.trade}] ` : ''}</span>
                          {plan.plan_name}
                        </div>
                      );
                    })}
                    {dayPlans.length > 3 && (
                      <div className="text-[9px] font-bold text-slate-400 text-center">
                        +{dayPlans.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WEEK VIEW */}
      {viewMode === 'week' && (
        <div className="flex-1 p-3">
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayPlans = getPlansForDate(day);
              const isTodayDay = isToday(day);
              const isSelected = selectedDate === dateStr;

              return (
                <div
                  key={dateStr}
                  onClick={() => onSelectDate(dateStr)}
                  className={`min-h-[360px] p-2.5 rounded-lg border flex flex-col cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-blue-50/40 border-blue-400 ring-2 ring-blue-100'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-center pb-2 border-b border-slate-100 mb-2">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase">
                      {format(day, 'EEE')}
                    </div>
                    <div className={`text-base font-bold inline-block px-2 py-0.5 rounded-full mt-0.5 ${
                      isTodayDay ? 'bg-blue-600 text-white' : 'text-slate-900'
                    }`}>
                      {format(day, 'd MMM')}
                    </div>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto">
                    {dayPlans.length === 0 ? (
                      <div className="text-center py-8 text-[11px] text-slate-400">
                        No plans
                      </div>
                    ) : (
                      dayPlans.map(plan => (
                        <div
                          key={plan.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPlan(plan);
                          }}
                          className="p-2 rounded-lg bg-slate-50 border border-slate-200 hover:border-blue-300 hover:shadow-xs transition-all text-xs"
                        >
                          <div className="font-semibold text-slate-900 truncate">{plan.plan_name}</div>
                          <div className="text-[11px] text-slate-500 truncate">{plan.client?.company_name || 'No client'}</div>
                          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-600">
                            <span className="font-bold text-blue-700">
                              {plan.allocated_headcount || 0}/{plan.headcount_required} heads
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200">
                              {plan.trade || 'General'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DAY VIEW */}
      {viewMode === 'day' && (
        <div className="flex-1 p-4 max-w-4xl mx-auto w-full">
          {(() => {
            const dayPlans = getPlansForDate(currentDate);
            const totalRequired = dayPlans.reduce((sum, p) => sum + (Number(p.headcount_required) || 1), 0);
            const totalAllocated = dayPlans.reduce((sum, p) => sum + (Number(p.allocated_headcount) || 0), 0);

            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Day Overview: {format(currentDate, 'EEEE, d MMMM yyyy')}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {dayPlans.length} site {dayPlans.length === 1 ? 'plan' : 'plans'} scheduled
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-slate-900">{totalAllocated}</span>
                    <span className="text-xs text-slate-500"> / {totalRequired} Crew Required</span>
                  </div>
                </div>

                {dayPlans.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    No site plans scheduled for this day.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {dayPlans.map(plan => (
                      <div
                        key={plan.id}
                        onClick={() => onSelectPlan(plan)}
                        className="p-3.5 rounded-lg bg-white border border-slate-200 hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{plan.plan_name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                              {plan.trade || 'General'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            Client: <strong>{plan.client?.company_name || 'None'}</strong> • Project: {plan.project?.title || 'None'}
                          </p>
                          {(plan.start_time || plan.end_time) && (
                            <div className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{plan.start_time?.slice(0, 5)} - {plan.end_time?.slice(0, 5)}</span>
                            </div>
                          )}
                        </div>

                        <div className="text-right whitespace-nowrap">
                          <div className="text-xs font-bold text-slate-900">
                            {plan.allocated_headcount || 0} / {plan.headcount_required} Heads
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block mt-1 ${
                            plan.client_confirmation_status === 'confirmed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {plan.client_confirmation_status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
