import React, { useState, useMemo } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent,
  DragEndEvent
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, UserPlus, Check, ChevronsUpDown, Search } from 'lucide-react';
import { useAttendanceBoard, useUpdateAttendancePlan, useBulkUpdateAttendancePlan } from '../../hooks/useAttendancePlanning';
import { AttendanceBoardColumn, BoardItem } from '../../components/attendance/AttendanceBoardColumn';
import { EmployeeChip } from '../../components/attendance/EmployeeChip';
import { useEmployees, Employee } from '../../hooks/useEmployees';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

export default function AttendancePlanning() {
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [activeId, setActiveId] = useState<string | null>(null);

  // Quick Plan Form State
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [isEmployeePopoverOpen, setIsEmployeePopoverOpen] = useState(false);
  const [empSearch, setEmpSearch] = useState('');

  const { data: boardData, isLoading: boardLoading } = useAttendanceBoard(date);
  const { data: allEmployees, isLoading: empLoading } = useEmployees();
  const isLoading = boardLoading || empLoading;

  // Only active employees — filter out explicitly Inactive ones
  const employees = useMemo(() => {
    const all = allEmployees || [];
    const filtered = all.filter(e => {
      if (!e.status) return true; // include if no status set
      const s = e.status.toLowerCase();
      return s !== 'inactive' && s !== 'resigned' && s !== 'terminated';
    });
    return filtered;
  }, [allEmployees]);

  const updatePlanMutation = useUpdateAttendancePlan();
  const bulkUpdateMutation = useBulkUpdateAttendancePlan();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before dragging starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Compute the columns and their items
  const columnsData = useMemo(() => {
    if (!boardData) return { columns: [], unassignedPool: [] };

    const { clients, sites, siteVisits, leaveRequests, manualPlans } = boardData;
    
    // Map to keep track of where each employee is
    // employee_id -> BoardItem
    const employeePlacements = new Map<string, BoardItem & { columnId: string }>();

    // 1. Inherit from leave requests
    leaveRequests.forEach(leave => {
      const emp = employees.find(e => e.id === leave.employee_id);
      if (emp) {
        employeePlacements.set(emp.id, {
          id: emp.id,
          employee: emp,
          source: 'inherited_leave',
          columnId: 'on_leave'
        });
      }
    });

    // 2. Inherit from site visits
    siteVisits.forEach(visit => {
      const empId = visit.employee_id || visit.user_id;
      const emp = employees.find(e => e.id === empId);
      if (emp && !employeePlacements.has(emp.id)) {
        employeePlacements.set(emp.id, {
          id: emp.id,
          employee: emp,
          source: 'inherited_site_visit',
          columnId: `client_${visit.client_id}`,
          needsReschedule: visit.needs_reschedule,
          source_id: visit.id
        });
      }
    });

    // 3. Manual Plans
    manualPlans.forEach(plan => {
      const emp = employees.find(e => e.id === plan.employee_id);
      if (emp && !employeePlacements.has(emp.id)) {
        let colId = 'unassigned';
        if (plan.client_id) colId = `client_${plan.client_id}`;
        else if (plan.site_id) colId = `site_${plan.site_id}`;

        employeePlacements.set(emp.id, {
          id: emp.id,
          employee: emp,
          source: plan.source as any,
          columnId: colId
        });
      }
    });

    // 4. Default Continuous Employees
    employees.forEach(emp => {
      if (emp.deployment_mode === 'continuous' && emp.default_site_id && !employeePlacements.has(emp.id)) {
        employeePlacements.set(emp.id, {
          id: emp.id,
          employee: emp,
          source: 'default_continuous',
          columnId: `site_${emp.default_site_id}`
        });
      }
    });

    // Prepare columns
    const columns = new Map<string, { id: string, title: string, isVirtual?: boolean, items: BoardItem[] }>();
    
    // Add clients as columns
    clients.forEach(client => {
      columns.set(`client_${client.id}`, {
        id: `client_${client.id}`,
        title: client.client_name,
        items: []
      });
    });

    // Add sites as columns
    sites.forEach(site => {
      if (!columns.has(`site_${site.id}`)) {
        columns.set(`site_${site.id}`, {
          id: `site_${site.id}`,
          title: site.site_name,
          items: []
        });
      }
    });

    // Virtual columns
    columns.set('on_leave', {
      id: 'on_leave',
      title: 'On Leave',
      isVirtual: true,
      items: []
    });

    columns.set('unassigned', {
      id: 'unassigned',
      title: 'Unassigned',
      isVirtual: true,
      items: []
    });

    const unassignedPool: Employee[] = [];

    // Distribute employees
    employees.forEach(emp => {
      const placement = employeePlacements.get(emp.id);
      if (placement) {
        const col = columns.get(placement.columnId);
        if (col) {
          col.items.push(placement);
        } else {
          // If column doesn't exist, put in unassigned
          columns.get('unassigned')!.items.push({
            ...placement,
            columnId: 'unassigned'
          });
        }
      } else {
        unassignedPool.push(emp);
      }
    });

    // Convert map to array and sort
    // Only show columns that have items, EXCEPT for On Leave and Unassigned which are always shown
    const colsArray = Array.from(columns.values());
    const visibleCols = colsArray.filter(c => c.items.length > 0 || c.isVirtual);
    
    const regularCols = visibleCols.filter(c => !c.isVirtual);
    const leaveCol = columns.get('on_leave')!;
    const unassignedCol = columns.get('unassigned')!;

    return {
      columns: [...regularCols, leaveCol, unassignedCol],
      unassignedPool
    };

  }, [boardData, employees]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (!over) return;

    const employeeId = active.id as string;
    let overId = over.id as string;

    // over.id can be a columnId or an employeeId (if hovering over another chip)
    let targetColumnId = overId;
    if (!columnsData.columns.find(c => c.id === overId)) {
      const col = columnsData.columns.find(c => c.items.some(item => item.id === overId));
      if (col) targetColumnId = col.id;
    }

    let currentItem: BoardItem | undefined;
    columnsData.columns.forEach(c => {
      const item = c.items.find(i => i.id === employeeId);
      if (item) currentItem = item;
    });

    if (!currentItem || !targetColumnId) return;

    const currentColumnId = columnsData.columns.find(c => c.items.some(i => i.id === employeeId))?.id;
    if (currentColumnId === targetColumnId) return;

    // Parse target column
    let clientId: string | undefined;
    let siteId: string | undefined;

    if (targetColumnId.startsWith('client_')) {
      clientId = targetColumnId.replace('client_', '');
    } else if (targetColumnId.startsWith('site_')) {
      siteId = targetColumnId.replace('site_', '');
    }

    const isMovingFromSiteVisit = currentItem.source === 'inherited_site_visit';

    updatePlanMutation.mutate({
      employeeId,
      clientId,
      siteId,
      date,
      source: 'manual',
      siteVisitId: isMovingFromSiteVisit ? currentItem.source_id : undefined,
      needsReschedule: isMovingFromSiteVisit
    });
  };

  const handleBulkAssign = () => {
    if (!selectedClient || selectedEmployees.length === 0) return;

    bulkUpdateMutation.mutate(
      {
        employeeIds: selectedEmployees,
        clientId: selectedClient,
        date,
      },
      {
        onSuccess: () => {
          setSelectedClient('');
          setSelectedEmployees([]);
        }
      }
    );
  };

  const toggleEmployeeSelect = (empId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  const activeEmployee = useMemo(() => {
    if (!activeId) return null;
    return employees.find(e => e.id === activeId) || null;
  }, [activeId, employees]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      <div className="px-6 py-4 bg-white dark:bg-slate-800 border-b border-border shadow-sm flex items-center justify-between z-10 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-outfit">Attendance Planning</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Assign employees to clients for the day</p>
        </div>
      </div>

      {/* Quick Plan Form */}
      <div className="px-6 py-4 bg-white dark:bg-slate-800 border-b border-border shadow-sm flex items-end gap-4 z-10 shrink-0">
        <div className="w-44 shrink-0">
          <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="pl-9 pr-4 py-2 w-full border border-slate-200 dark:border-slate-700 rounded-md text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 h-10"
            />
          </div>
        </div>

        <div className="flex-1 max-w-xs">
          <label className="block text-xs font-medium text-slate-500 mb-1">Client</label>
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-full h-10">
              <SelectValue placeholder="Select a Client" />
            </SelectTrigger>
            <SelectContent>
              {boardData?.clients.map(client => (
                <SelectItem key={client.id} value={client.id}>
                  {client.client_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 max-w-sm">
          <label className="block text-xs font-medium text-slate-500 mb-1">Employees</label>
          <div className="relative">
            <button
              onClick={() => { setIsEmployeePopoverOpen(!isEmployeePopoverOpen); setEmpSearch(''); }}
              type="button"
              className="w-full flex items-center justify-between font-normal h-10 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-md text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <span className="truncate text-left">
                {selectedEmployees.length > 0 
                  ? `${selectedEmployees.length} employee(s) selected` 
                  : <span className="text-slate-400">Select employees...</span>}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </button>
            
            {isEmployeePopoverOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsEmployeePopoverOpen(false)} 
                />
                <div className="absolute top-full left-0 mt-1 w-[300px] z-50 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-slate-200 dark:border-slate-700">
                  {/* Search box */}
                  <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        autoFocus
                        type="text"
                        placeholder={`Search ${employees.length} employees...`}
                        value={empSearch}
                        onChange={e => setEmpSearch(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        className="w-full pl-7 pr-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="max-h-[250px] overflow-y-auto p-1">
                    {empLoading ? (
                      <div className="py-4 text-center text-sm text-slate-400">Loading...</div>
                    ) : (() => {
                      const filtered = employees.filter(e =>
                        e.name.toLowerCase().includes(empSearch.toLowerCase())
                      );
                      if (filtered.length === 0) return (
                        <div className="py-4 text-center text-sm text-slate-400">No employees found</div>
                      );
                      return filtered.map(emp => (
                        <div
                          key={emp.id}
                          className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 ${selectedEmployees.includes(emp.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleEmployeeSelect(emp.id);
                          }}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedEmployees.includes(emp.id) ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                            {selectedEmployees.includes(emp.id) && <Check className="w-3 h-3" />}
                          </div>
                          <span className="truncate">{emp.name}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <Button 
          onClick={handleBulkAssign} 
          disabled={!selectedClient || selectedEmployees.length === 0 || bulkUpdateMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white h-10"
        >
          {bulkUpdateMutation.isPending ? 'Assigning...' : 'Bulk Assign'}
        </Button>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 custom-scrollbar relative">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-6 h-full items-start">
              {columnsData.columns.map((column) => (
                <AttendanceBoardColumn
                  key={column.id}
                  id={column.id}
                  title={column.title}
                  items={column.items}
                  isVirtual={column.isVirtual}
                />
              ))}
            </div>

            <DragOverlay>
              {activeId && activeEmployee ? (
                <div className="opacity-80 rotate-2 scale-105 transition-transform cursor-grabbing">
                  <EmployeeChip
                    id={activeId}
                    employee={activeEmployee}
                    source="manual"
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Unassigned Pool Grid */}
      <div className="h-48 border-t border-border bg-white dark:bg-slate-800 p-4 shrink-0 overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Available Employees ({columnsData.unassignedPool.length})
          </h3>
          <p className="text-xs text-slate-500">Click to add to Unassigned column</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {columnsData.unassignedPool.map(emp => (
            <button
              key={emp.id}
              onClick={() => {
                updatePlanMutation.mutate({
                  employeeId: emp.id,
                  date,
                  source: 'manual',
                  clientId: null,
                  siteId: null
                });
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors border border-border/50"
            >
              <UserPlus className="w-3 h-3 text-slate-400" />
              {emp.name}
            </button>
          ))}
          {columnsData.unassignedPool.length === 0 && (
            <div className="text-sm text-slate-400 italic">All employees are placed.</div>
          )}
        </div>
      </div>
    </div>
  );
}
