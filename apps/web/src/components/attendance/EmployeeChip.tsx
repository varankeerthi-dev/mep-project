import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { User, AlertCircle, PlaneTakeoff, Clock, Anchor } from 'lucide-react';
import { Employee } from '../../hooks/useEmployees';
import { AttendanceSource } from '../../hooks/useAttendancePlanning';

interface EmployeeChipProps {
  id: string;
  employee: Employee;
  source: AttendanceSource;
  needsReschedule?: boolean;
}

export function EmployeeChip({ id, employee, source, needsReschedule }: EmployeeChipProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Visual distinction based on source
  let borderClass = 'border-border/50';
  let bgClass = 'bg-white dark:bg-slate-800';
  let icon = <User className="w-4 h-4 text-slate-500" />;

  if (source === 'inherited_site_visit') {
    borderClass = 'border-blue-300 dark:border-blue-700';
    bgClass = 'bg-blue-50 dark:bg-blue-900/20';
    icon = <Clock className="w-4 h-4 text-blue-500" />;
  } else if (source === 'inherited_leave') {
    borderClass = 'border-orange-300 dark:border-orange-700';
    bgClass = 'bg-orange-50 dark:bg-orange-900/20';
    icon = <PlaneTakeoff className="w-4 h-4 text-orange-500" />;
  } else if (source === 'default_continuous') {
    borderClass = 'border-teal-300 dark:border-teal-700';
    bgClass = 'bg-teal-50 dark:bg-teal-900/20';
    icon = <Anchor className="w-4 h-4 text-teal-500" />;
  }

  if (needsReschedule) {
    borderClass = 'border-red-400 dark:border-red-600';
    bgClass = 'bg-red-50 dark:bg-red-900/20';
    icon = <AlertCircle className="w-4 h-4 text-red-500" />;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-3 mb-2 rounded-xl border shadow-sm flex items-center gap-3 cursor-grab active:cursor-grabbing ${borderClass} ${bgClass}`}
    >
      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
        {employee.avatar_url ? (
          <img src={employee.avatar_url} alt={employee.name} className="w-full h-full rounded-full object-cover" />
        ) : (
          icon
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
          {employee.name}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
          {employee.designation || employee.role || 'Employee'}
        </p>
      </div>
    </div>
  );
}
