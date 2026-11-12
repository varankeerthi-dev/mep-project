import React, { useState, useMemo } from 'react';
import { 
  Plus, Calendar as CalendarIcon, Table as TableIcon, 
  Filter, RefreshCw, AlertCircle 
} from 'lucide-react';
import { useSitePlans, useDispatchExecutionVisit, useCreateSitePlan, useUpdateSitePlan } from '../hooks/useSitePlans';
import { SitePlanTable } from './SitePlanTable';
import { SitePlanCalendar } from './SitePlanCalendar';
import { SitePlanDetailPanel } from './SitePlanDetailPanel';
import { SitePlanForm } from './SitePlanForm';
import { ManpowerAllocationEditor } from './ManpowerAllocationEditor';
import { RescheduleModal } from './RescheduleModal';
import { ScheduleHistoryModal } from './ScheduleHistoryModal';
import type { SitePlan } from '../types';

interface SitePlanWorkspaceProps {
  initialDate?: string;
}

type DatePreset = 'all' | 'tomorrow' | 'next7days' | 'this_month';

const formatLocalDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const SitePlanWorkspace: React.FC<SitePlanWorkspaceProps> = ({ initialDate }) => {
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(
    initialDate || formatLocalDate(new Date())
  );

  // Modals and panels state
  const [selectedPlan, setSelectedPlan] = useState<SitePlan | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [formPlan, setFormPlan] = useState<SitePlan | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [allocatingPlan, setAllocatingPlan] = useState<SitePlan | null>(null);
  const [isAllocateOpen, setIsAllocateOpen] = useState(false);

  const [reschedulingPlan, setReschedulingPlan] = useState<SitePlan | null>(null);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);

  const [historyPlan, setHistoryPlan] = useState<SitePlan | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const dispatchMutation = useDispatchExecutionVisit();
  const createMutation = useCreateSitePlan();
  const updateMutation = useUpdateSitePlan();

  const handleFormSubmit = async (data: Partial<SitePlan>) => {
    if (formPlan?.id) {
      await updateMutation.mutateAsync({ id: formPlan.id, updates: data });
    } else {
      await createMutation.mutateAsync(data);
    }
    setIsFormOpen(false);
    setFormPlan(null);
  };

  // Compute date range based on preset
  const dateRange = useMemo(() => {
    const today = new Date();
    if (datePreset === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const str = formatLocalDate(tomorrow);
      return { startDate: str, endDate: str };
    }
    if (datePreset === 'next7days') {
      const strStart = formatLocalDate(today);
      const end = new Date(today);
      end.setDate(end.getDate() + 7);
      const strEnd = formatLocalDate(end);
      return { startDate: strStart, endDate: strEnd };
    }
    if (datePreset === 'this_month') {
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const startStr = `${year}-${month}-01`;
      const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
      const endStr = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
      return { startDate: startStr, endDate: endStr };
    }
    return undefined;
  }, [datePreset]);

  // Query site plans
  const { data: plans = [], isLoading, refetch, isFetching } = useSitePlans(dateRange);

  // Dispatch handler with feedback
  const handleDispatch = async (plan: SitePlan) => {
    try {
      await dispatchMutation.mutateAsync(plan.id);
      // If currently inspecting this plan, update local reference
      if (selectedPlan?.id === plan.id) {
        setSelectedPlan(prev => prev ? { ...prev, execution_status: 'dispatched' } : null);
      }
    } catch (err: any) {
      alert(`Dispatch failed: ${err?.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Calendar View Controls Bar (only shown in calendar mode) */}
      {viewMode === 'calendar' && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-zinc-200 shadow-xs">
          <div className="flex items-center gap-3">
            {/* View mode toggle */}
            <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  viewMode === 'table' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  viewMode === 'calendar' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Calendar</span>
              </button>
            </div>

            {/* Quick Date Presets */}
            <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-lg border border-zinc-200 text-xs">
              <button
                onClick={() => setDatePreset('all')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  datePreset === 'all' ? 'bg-blue-600 text-white font-semibold' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                All Plans
              </button>
              <button
                onClick={() => setDatePreset('tomorrow')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  datePreset === 'tomorrow' ? 'bg-blue-600 text-white font-semibold' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Tomorrow
              </button>
              <button
                onClick={() => setDatePreset('next7days')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  datePreset === 'next7days' ? 'bg-blue-600 text-white font-semibold' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Next 7 Days
              </button>
              <button
                onClick={() => setDatePreset('this_month')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  datePreset === 'this_month' ? 'bg-blue-600 text-white font-semibold' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                This Month
              </button>
            </div>

            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-1.5 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors border border-zinc-200"
              title="Refresh Site Plans"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>

          {/* Create Plan Button */}
          <button
            onClick={() => {
              setFormPlan(null);
              setIsFormOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Site Plan</span>
          </button>
        </div>
      )}

      {/* Main View Area */}
      {viewMode === 'table' ? (
        <SitePlanTable
          plans={plans}
          isLoading={isLoading}
          onSelectPlan={(plan) => {
            setSelectedPlan(plan);
            setIsDetailOpen(true);
          }}
          onEditPlan={(plan) => {
            setFormPlan(plan);
            setIsFormOpen(true);
          }}
          onAllocate={(plan) => {
            setAllocatingPlan(plan);
            setIsAllocateOpen(true);
          }}
          onReschedule={(plan) => {
            setReschedulingPlan(plan);
            setIsRescheduleOpen(true);
          }}
          onViewHistory={(plan) => {
            setHistoryPlan(plan);
            setIsHistoryOpen(true);
          }}
          onDispatch={handleDispatch}
          isDispatching={dispatchMutation.isPending}
          onCreatePlan={() => {
            setFormPlan(null);
            setIsFormOpen(true);
          }}
          datePreset={datePreset}
          onDatePresetChange={setDatePreset}
          onRefresh={refetch}
          isRefreshing={isFetching}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      ) : (
        <SitePlanCalendar
          plans={plans}
          selectedDate={selectedCalendarDate}
          onSelectDate={(dateStr) => {
            setSelectedCalendarDate(dateStr);
          }}
          onSelectPlan={(plan) => {
            setSelectedPlan(plan);
            setIsDetailOpen(true);
          }}
        />
      )}

      {/* Modals and Drawers */}
      <SitePlanDetailPanel
        plan={selectedPlan}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedPlan(null);
        }}
        onEdit={(plan) => {
          setIsDetailOpen(false);
          setFormPlan(plan);
          setIsFormOpen(true);
        }}
        onAllocate={(plan) => {
          setIsDetailOpen(false);
          setAllocatingPlan(plan);
          setIsAllocateOpen(true);
        }}
        onReschedule={(plan) => {
          setIsDetailOpen(false);
          setReschedulingPlan(plan);
          setIsRescheduleOpen(true);
        }}
        onViewHistory={(plan) => {
          setIsDetailOpen(false);
          setHistoryPlan(plan);
          setIsHistoryOpen(true);
        }}
        onDispatch={handleDispatch}
        isDispatching={dispatchMutation.isPending}
      />

      <SitePlanForm
        initialData={formPlan}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setFormPlan(null);
        }}
        onSubmit={handleFormSubmit}
      />

      <ManpowerAllocationEditor
        plan={allocatingPlan}
        isOpen={isAllocateOpen}
        onClose={() => {
          setIsAllocateOpen(false);
          setAllocatingPlan(null);
        }}
      />

      <RescheduleModal
        plan={reschedulingPlan}
        isOpen={isRescheduleOpen}
        onClose={() => {
          setIsRescheduleOpen(false);
          setReschedulingPlan(null);
        }}
      />

      <ScheduleHistoryModal
        plan={historyPlan}
        isOpen={isHistoryOpen}
        onClose={() => {
          setIsHistoryOpen(false);
          setHistoryPlan(null);
        }}
      />
    </div>
  );
};
