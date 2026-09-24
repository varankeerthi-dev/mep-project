import React, { useState } from 'react';
import {
  Building2,
  Factory,
  Layers,
  Calendar,
  Sparkles,
  ChevronDown,
  Check,
  RotateCcw,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { CeoMode, DateHorizon, DateRangeState } from './hooks/useCeoDashboardData';

interface CeoDashboardHeaderProps {
  orgName?: string;
  currentFy?: string;
  mode: CeoMode;
  onModeChange: (m: CeoMode) => void;
  dateRange: DateRangeState;
  onDateRangeChange: (dr: DateRangeState) => void;
  hasProjects: boolean;
  hasManufacturing: boolean;
}

const PRESET_HORIZONS: { id: DateHorizon; label: string }[] = [
  { id: 'this_month', label: 'This Month' },
  { id: 'this_quarter', label: 'This Quarter' },
  { id: 'fy_current', label: 'FY 24-25' },
  { id: 'all', label: 'All Active' },
];

export const CeoDashboardHeader: React.FC<CeoDashboardHeaderProps> = ({
  orgName = 'Organisation',
  currentFy = 'FY 24-25',
  mode,
  onModeChange,
  dateRange,
  onDateRangeChange,
  hasProjects,
  hasManufacturing,
}) => {
  const [customPopoverOpen, setCustomPopoverOpen] = useState(false);
  const [customStart, setCustomStart] = useState<string>(
    dateRange.startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  );
  const [customEnd, setCustomEnd] = useState<string>(
    dateRange.endDate || new Date().toISOString().slice(0, 10)
  );

  const applyCustomRange = () => {
    if (!customStart || !customEnd) return;
    onDateRangeChange({
      horizon: 'custom',
      startDate: customStart,
      endDate: customEnd,
    });
    setCustomPopoverOpen(false);
  };

  const showModeSwitcher = hasProjects && hasManufacturing;

  return (
    <header className="bg-white border-b border-zinc-200/80 sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      <div className="max-w-[1560px] mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left: Branding & Title */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 text-white flex items-center justify-center shadow-sm shrink-0">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-zinc-900 font-sans">
                  CEO Business Flow
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Synced
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                {orgName} &bull; End-to-end value chain: Quotes to billing & critical escalations
              </p>
            </div>
          </div>

          {/* Right: Controls & Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Industry Mode Switcher (if both projects & manufacturing enabled) */}
            {showModeSwitcher && (
              <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 border border-zinc-200/80 text-xs">
                <button
                  type="button"
                  onClick={() => onModeChange('projects')}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition-all duration-150',
                    mode === 'projects'
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900'
                  )}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Projects</span>
                </button>
                <button
                  type="button"
                  onClick={() => onModeChange('manufacturing')}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition-all duration-150',
                    mode === 'manufacturing'
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900'
                  )}
                >
                  <Factory className="w-3.5 h-3.5" />
                  <span>Manufacturing</span>
                </button>
                <button
                  type="button"
                  onClick={() => onModeChange('combined')}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition-all duration-150',
                    mode === 'combined'
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900'
                  )}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Combined</span>
                </button>
              </div>
            )}

            {/* Fiscal Horizon Filter Pills */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 border border-zinc-200/80 text-xs">
              {PRESET_HORIZONS.map((preset) => {
                const isActive = dateRange.horizon === preset.id;
                const label = preset.id === 'fy_current' ? currentFy : preset.label;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      onDateRangeChange({
                        horizon: preset.id,
                        startDate: null,
                        endDate: null,
                      })
                    }
                    className={cn(
                      'px-2.5 py-1.5 rounded-md font-medium transition-all duration-150',
                      isActive
                        ? 'bg-white text-zinc-900 shadow-sm'
                        : 'text-zinc-600 hover:text-zinc-900'
                    )}
                  >
                    {label}
                  </button>
                );
              })}

              {/* Custom Date Range Popover */}
              <Popover open={customPopoverOpen} onOpenChange={setCustomPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition-all duration-150',
                      dateRange.horizon === 'custom'
                        ? 'bg-white text-zinc-900 shadow-sm'
                        : 'text-zinc-600 hover:text-zinc-900'
                    )}
                  >
                    <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                    <span>
                      {dateRange.horizon === 'custom' && dateRange.startDate && dateRange.endDate
                        ? `${dateRange.startDate.slice(5)} to ${dateRange.endDate.slice(5)}`
                        : 'Custom'}
                    </span>
                    <ChevronDown className="w-3 h-3 text-zinc-400" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-4 bg-white shadow-lg border border-zinc-200 rounded-xl">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                      <span className="text-xs font-semibold text-zinc-900">Custom Date Range</span>
                      <Calendar className="w-4 h-4 text-zinc-400" />
                    </div>
                    <div className="space-y-2">
                      <div>
                        <label className="text-[11px] font-medium text-zinc-600">Start Date</label>
                        <Input
                          type="date"
                          value={customStart}
                          onChange={(e) => setCustomStart(e.target.value)}
                          className="h-8 text-xs mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-zinc-600">End Date</label>
                        <Input
                          type="date"
                          value={customEnd}
                          onChange={(e) => setCustomEnd(e.target.value)}
                          className="h-8 text-xs mt-1"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => setCustomPopoverOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs px-3 bg-zinc-900 text-white hover:bg-zinc-800"
                        onClick={applyCustomRange}
                      >
                        <Check className="w-3 h-3 mr-1" />
                        Apply
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
