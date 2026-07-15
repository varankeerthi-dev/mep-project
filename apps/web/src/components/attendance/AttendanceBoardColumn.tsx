import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { EmployeeChip } from './EmployeeChip';
import { Employee } from '../../hooks/useEmployees';
import { AttendanceSource } from '../../hooks/useAttendancePlanning';

export interface BoardItem {
  id: string; // employee_id
  employee: Employee;
  source: AttendanceSource;
  needsReschedule?: boolean;
  source_id?: string; // e.g. site_visit_id
}

interface AttendanceBoardColumnProps {
  id: string;
  title: string;
  items: BoardItem[];
  isVirtual?: boolean;
}

export function AttendanceBoardColumn({ id, title, items, isVirtual }: AttendanceBoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  let bgClass = 'bg-slate-50 dark:bg-slate-900/50';
  if (isVirtual) {
    bgClass = id === 'on_leave' 
      ? 'bg-orange-50/50 dark:bg-orange-950/20' 
      : 'bg-slate-100 dark:bg-slate-800/50';
  }

  return (
    <div className={`flex flex-col w-[320px] shrink-0 rounded-xl border border-border/50 ${bgClass} ${isOver ? 'ring-2 ring-blue-500/50' : ''}`}>
      <div className="p-4 border-b border-border/50 flex items-center justify-between sticky top-0 bg-inherit z-10 rounded-t-xl backdrop-blur-sm">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
        <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300">
          {items.length}
        </span>
      </div>
      
      <div 
        ref={setNodeRef}
        className="p-3 flex-1 overflow-y-auto min-h-[150px] custom-scrollbar"
      >
        <SortableContext 
          id={id}
          items={items.map(item => item.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item) => (
            <EmployeeChip
              key={item.id}
              id={item.id}
              employee={item.employee}
              source={item.source}
              needsReschedule={item.needsReschedule}
            />
          ))}
          {items.length === 0 && (
            <div className="h-full flex items-center justify-center text-sm text-slate-400 dark:text-slate-500 border-2 border-dashed border-border/50 rounded-xl p-4 text-center">
              Drop employees here
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}
