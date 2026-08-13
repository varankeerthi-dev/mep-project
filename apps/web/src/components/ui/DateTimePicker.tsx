import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DateTimePickerProps {
  /** date string in "yyyy-MM-dd" format */
  date: string;
  /** time string in "HH:mm" format */
  time: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  placeholder?: string;
  className?: string;
  /** Earliest selectable date. Defaults to 7 days ago. */
  minDate?: Date;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const MONTH_NAMES = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];
const DAY_NAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export function DateTimePicker({
  date,
  time,
  onDateChange,
  onTimeChange,
  placeholder = "Select date & time",
  className,
  minDate,
}: DateTimePickerProps) {
  // Default: allow 7 days back
  const effectiveMin = React.useMemo(() => {
    if (minDate) return minDate;
    const d = new Date();
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [minDate]);
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Parse incoming date
  const parsedDate = React.useMemo(() => {
    if (!date) return new Date();
    const d = parse(date, "yyyy-MM-dd", new Date());
    return isValid(d) ? d : new Date();
  }, [date]);

  const [calYear, setCalYear] = React.useState(parsedDate.getFullYear());
  const [calMonth, setCalMonth] = React.useState(parsedDate.getMonth());
  const [selectedDay, setSelectedDay] = React.useState<Date | undefined>(
    date ? parsedDate : undefined
  );

  const [hour, setHour] = React.useState<number>(() => {
    if (time) return parseInt(time.split(":")[0]) || 0;
    return new Date().getHours();
  });
  const [minute, setMinute] = React.useState<number>(() => {
    if (time) return parseInt(time.split(":")[1]) || 0;
    return new Date().getMinutes();
  });

  // Scroll refs
  const hourRef = React.useRef<HTMLDivElement>(null);
  const minuteRef = React.useRef<HTMLDivElement>(null);

  function scrollToSelected() {
    setTimeout(() => {
      if (hourRef.current) {
        const item = hourRef.current.children[hour] as HTMLElement;
        if (item) hourRef.current.scrollTop = item.offsetTop - hourRef.current.clientHeight / 2 + item.clientHeight / 2;
      }
      if (minuteRef.current) {
        const item = minuteRef.current.children[minute] as HTMLElement;
        if (item) minuteRef.current.scrollTop = item.offsetTop - minuteRef.current.clientHeight / 2 + item.clientHeight / 2;
      }
    }, 30);
  }

  function handleOpen() {
    setOpen(true);
    scrollToSelected();
  }

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleNow() {
    const now = new Date();
    setSelectedDay(now);
    setCalYear(now.getFullYear());
    setCalMonth(now.getMonth());
    setHour(now.getHours());
    setMinute(now.getMinutes());
    scrollToSelected();
  }

  function handleOk() {
    if (selectedDay) {
      onDateChange(format(selectedDay, "yyyy-MM-dd"));
    }
    onTimeChange(`${pad(hour)}:${pad(minute)}`);
    setOpen(false);
  }

  function isBeforeMin(day: number) {
    const d = new Date(calYear, calMonth, day);
    d.setHours(0, 0, 0, 0);
    return d < effectiveMin;
  }

  function prevMonth() {
    const prevMonthDate = calMonth === 0
      ? new Date(calYear - 1, 11, 1)
      : new Date(calYear, calMonth - 1, 1);
    // Block if entire previous month is before minDate
    const lastDayOfPrevMonth = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0);
    lastDayOfPrevMonth.setHours(23, 59, 59, 999);
    if (lastDayOfPrevMonth < effectiveMin) return;
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  }

  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  }

  function selectDay(day: number) {
    if (isBeforeMin(day)) return; // guard
    setSelectedDay(new Date(calYear, calMonth, day));
  }

  // Build calendar grid
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);
  const calendarCells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === day;
  const isSelected = (day: number) =>
    selectedDay &&
    selectedDay.getFullYear() === calYear &&
    selectedDay.getMonth() === calMonth &&
    selectedDay.getDate() === day;

  // Display value
  const displayValue = React.useMemo(() => {
    if (!selectedDay) return "";
    return `${format(selectedDay, "dd MMM yyyy")}, ${pad(hour)}:${pad(minute)}`;
  }, [selectedDay, hour, minute]);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors text-left",
          "hover:border-ring focus:outline-none focus:ring-1 focus:ring-ring",
          !displayValue && "text-muted-foreground"
        )}
      >
        <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span>{displayValue || placeholder}</span>
      </button>

      {/* Dropdown — absolutely positioned, stays inside modal stacking context */}
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-[99999] flex rounded-xl border border-border bg-card shadow-xl overflow-hidden"
          style={{ minWidth: 360 }}
        >
          {/* Calendar */}
          <div className="border-r border-border p-2 select-none">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={prevMonth}
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-foreground">
                {MONTH_NAMES[calMonth]} {calYear}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-0.5">
              {DAY_NAMES.map((d) => (
                <div key={d} className="w-8 h-6 flex items-center justify-center text-xs font-medium text-muted-foreground">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {calendarCells.map((day, i) => (
                <div key={i} className="w-8 h-8 flex items-center justify-center">
                  {day ? (
                    <button
                      type="button"
                      onClick={() => selectDay(day)}
                      className={cn(
                        "w-8 h-8 rounded-full text-xs flex items-center justify-center transition-colors",
                        isBeforeMin(day)
                          ? "text-muted-foreground opacity-30 cursor-not-allowed"
                          : isSelected(day)
                          ? "bg-primary text-primary-foreground font-semibold"
                          : isToday(day)
                          ? "border border-primary text-primary font-semibold hover:bg-accent"
                          : "hover:bg-accent text-foreground"
                      )}
                    >
                      {day}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* Time picker */}
          <div className="flex flex-col" style={{ width: 112 }}>
            {/* Time display */}
            <div className="px-3 py-2 border-b border-border text-right">
              <span className="text-lg font-semibold text-foreground tabular-nums">
                {pad(hour)}:{pad(minute)}
              </span>
            </div>

            <div className="flex flex-1">
              {/* Hours */}
              <div
                ref={hourRef}
                className="flex-1 overflow-y-auto py-1 border-r border-border"
                style={{ height: 252, scrollbarWidth: "none" }}
              >
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHour(h)}
                    className={cn(
                      "w-full h-9 flex items-center justify-center text-sm tabular-nums transition-colors",
                      h === hour
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-foreground hover:bg-accent"
                    )}
                  >
                    {pad(h)}
                  </button>
                ))}
              </div>

              {/* Minutes */}
              <div
                ref={minuteRef}
                className="flex-1 overflow-y-auto py-1"
                style={{ height: 252, scrollbarWidth: "none" }}
              >
                {MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMinute(m)}
                    className={cn(
                      "w-full h-9 flex items-center justify-center text-sm tabular-nums transition-colors",
                      m === minute
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-foreground hover:bg-accent"
                    )}
                  >
                    {pad(m)}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-2 py-2 border-t border-border bg-muted/30">
              <button
                type="button"
                onClick={handleNow}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Now
              </button>
              <Button size="sm" onClick={handleOk} className="h-7 px-3 text-xs">
                OK
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
