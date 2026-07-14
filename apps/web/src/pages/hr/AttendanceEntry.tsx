import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Button } from '@/components/ui'
import { useAttendancePlan, useMutateAttendancePlan, useSites, type AttendancePlan } from '../../hooks/useAttendance'
import { useEmployees } from '../../hooks/useEmployees'
import { format } from 'date-fns'

export default function AttendanceEntry() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const { data: plan, isLoading: planLoading } = useAttendancePlan(selectedDate)
  const { data: sites } = useSites()
  const { data: employees } = useEmployees()
  const { mutateAsync: saveEntry } = useMutateAttendancePlan()

  if (planLoading) return <div className="p-8 text-center">Loading roster...</div>

  // We show a list of all active employees and their planned/actual attendance for today
  const activeEmployees = (employees || []).filter(e => e.status === 'Active')
  const unassignedSite = sites?.find(s => s.virtual_type === 'unassigned')?.id

  const getRowState = (empId: string) => {
    const p = plan?.find(x => x.employee_id === empId)
    const emp = employees?.find(e => e.id === empId)
    
    let defaultPlannedSite = unassignedSite
    if (emp?.deployment_mode === 'continuous' && emp.default_site_id) {
      defaultPlannedSite = emp.default_site_id
    }

    return {
      id: p?.id,
      planned_site_id: p?.planned_site_id || defaultPlannedSite,
      actual_site_id: p?.actual_site_id || p?.planned_site_id || defaultPlannedSite,
      status: p?.status || 'planned',
      shift_type: p?.shift_type || 'Day',
      in_time: p?.in_time || '',
      out_time: p?.out_time || '',
      remarks: p?.remarks || '',
      source: p?.source || 'manual_plan'
    }
  }

  const handleUpdateField = async (empId: string, field: keyof AttendancePlan, value: any) => {
    const currentState = getRowState(empId)
    const payload: Partial<AttendancePlan> = {
      id: currentState.id,
      employee_id: empId,
      plan_date: selectedDate,
      [field]: value,
      // If saving actual data, make sure actual_site_id is captured if not already
      actual_site_id: currentState.actual_site_id
    }
    
    // Auto-update status based on in/out times if not explicitly set
    if (field === 'in_time' && value && currentState.status === 'planned') {
      payload.status = 'checked_in'
    }

    await saveEntry(payload)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] p-4 md:p-8 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Attendance Entry</h2>
        <div className="flex gap-4">
          <input 
            type="date" 
            className="border rounded-md px-3 py-2"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          />
          <Button variant="outline">Export Report</Button>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardContent className="flex-1 overflow-auto p-0">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Planned Site</th>
                <th className="px-4 py-3 w-48">Actual Site</th>
                <th className="px-4 py-3 w-32">Shift</th>
                <th className="px-4 py-3 w-32">In Time</th>
                <th className="px-4 py-3 w-32">Out Time</th>
                <th className="px-4 py-3 w-32">Status</th>
                <th className="px-4 py-3">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {activeEmployees.map(emp => {
                const state = getRowState(emp.id)
                const plannedSiteName = sites?.find(s => s.id === state.planned_site_id)?.site_name || 'Unassigned'
                
                return (
                  <tr key={emp.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{emp.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{plannedSiteName}</td>
                    <td className="px-4 py-2">
                      <Select 
                        value={state.actual_site_id} 
                        onValueChange={(val) => handleUpdateField(emp.id, 'actual_site_id', val)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {sites?.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.site_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2">
                      <Select 
                        value={state.shift_type} 
                        onValueChange={(val) => handleUpdateField(emp.id, 'shift_type', val)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Day">Day</SelectItem>
                          <SelectItem value="Night">Night</SelectItem>
                          <SelectItem value="DN">DN</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2">
                      <Input 
                        type="time" 
                        className="h-8" 
                        value={state.in_time} 
                        onChange={e => handleUpdateField(emp.id, 'in_time', e.target.value)}
                        onBlur={e => handleUpdateField(emp.id, 'in_time', e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input 
                        type="time" 
                        className="h-8" 
                        value={state.out_time} 
                        onBlur={e => handleUpdateField(emp.id, 'out_time', e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Select 
                        value={state.status} 
                        onValueChange={(val) => handleUpdateField(emp.id, 'status', val)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="checked_in">Present</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2">
                      <Input 
                        className="h-8" 
                        value={state.remarks} 
                        onChange={e => handleUpdateField(emp.id, 'remarks', e.target.value)}
                        onBlur={e => handleUpdateField(emp.id, 'remarks', e.target.value)}
                        placeholder="Add remark..."
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
