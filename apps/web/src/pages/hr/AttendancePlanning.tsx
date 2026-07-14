import React, { useState, useEffect } from 'react'
import { DndContext, useSensor, useSensors, PointerSensor, DragEndEvent } from '@dnd-kit/core'
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@/components/ui'
import { useAttendancePlan, useMutateAttendancePlan, useSites, type AttendancePlan } from '../../hooks/useAttendance'
import { useEmployees } from '../../hooks/useEmployees'
import { format, addDays } from 'date-fns'

export default function AttendancePlanning() {
  const [selectedDate, setSelectedDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'))
  const { data: plan, isLoading: planLoading } = useAttendancePlan(selectedDate)
  const { data: sites, isLoading: sitesLoading } = useSites()
  const { data: employees, isLoading: empLoading } = useEmployees()
  const { mutateAsync: savePlan } = useMutateAttendancePlan()
  
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  if (planLoading || sitesLoading || empLoading) return <div className="p-8 text-center">Loading board...</div>

  // Create virtual sites
  const boardSites = [
    ...(sites || []).filter(s => !s.is_virtual),
    { id: 'on_leave', site_name: 'On Leave', is_virtual: true },
    { id: 'unassigned', site_name: 'Unassigned', is_virtual: true }
  ]

  // Synthesize board state
  const activeEmployees = (employees || []).filter(e => e.status === 'Active')
  
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const employeeId = active.id as string
    const newSiteId = over.id as string

    // Find if plan already exists for this employee
    const existingPlan = plan?.find(p => p.employee_id === employeeId)

    const payload: Partial<AttendancePlan> = {
      id: existingPlan?.id,
      employee_id: employeeId,
      plan_date: selectedDate,
      planned_site_id: newSiteId === 'unassigned' || newSiteId === 'on_leave' ? undefined : newSiteId,
      // Just manually assigning it for now. 'on_leave' and 'unassigned' might map to actual virtual site UUIDs in DB.
      // Wait, the DB actually has 'is_virtual' rows for these in the `sites` table per org!
      // So newSiteId is the UUID of the site, even for virtual ones.
      source: 'manual_plan',
      status: 'planned'
    }

    try {
      await savePlan(payload)
    } catch (err) {
      // toast already handled in hook
    }
  }

  // To properly render the board, we need to map employees to columns.
  // 1. If employee has a plan row for this date, use `planned_site_id`.
  // 2. If no plan row, and deployment_mode === 'continuous', use `default_site_id`.
  // 3. Otherwise, use the UUID of 'Unassigned' virtual site.
  // We'll figure out the virtual site IDs:
  const unassignedSite = sites?.find(s => s.virtual_type === 'unassigned')?.id
  const onLeaveSite = sites?.find(s => s.virtual_type === 'on_leave')?.id

  const getEmployeeColumn = (empId: string) => {
    const p = plan?.find(x => x.employee_id === empId)
    if (p) return p.planned_site_id || unassignedSite
    const emp = employees?.find(e => e.id === empId)
    if (emp?.deployment_mode === 'continuous' && emp.default_site_id) {
      return emp.default_site_id
    }
    return unassignedSite
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] p-4 md:p-8 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Attendance Planning</h2>
        <input 
          type="date" 
          className="border rounded-md px-3 py-2"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
        />
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
          {boardSites.map(site => {
            const siteId = site.is_virtual ? (site.id === 'unassigned' ? unassignedSite : onLeaveSite) : site.id
            if (!siteId) return null // Wait for seed

            const colEmployees = activeEmployees.filter(e => getEmployeeColumn(e.id) === siteId)

            return (
              <Card key={siteId} className="w-80 flex-shrink-0 flex flex-col bg-muted/30">
                <CardHeader className="py-3 px-4 border-b bg-muted/50">
                  <CardTitle className="text-sm font-semibold flex justify-between">
                    {site.site_name}
                    <Badge variant="secondary">{colEmployees.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px]" id={siteId}>
                  {/* DroppableArea implementation would wrap this, simplified here */}
                  {colEmployees.map(emp => {
                    const p = plan?.find(x => x.employee_id === emp.id)
                    return (
                      <div key={emp.id} className="p-3 bg-background border rounded shadow-sm cursor-grab active:cursor-grabbing">
                        <div className="font-medium text-sm">{emp.name}</div>
                        <div className="text-xs text-muted-foreground flex justify-between mt-1">
                          <span>{emp.designation}</span>
                          {p?.source === 'inherited_site_visit' && <Badge variant="outline" className="text-[10px] h-4">Visit</Badge>}
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </DndContext>
    </div>
  )
}
