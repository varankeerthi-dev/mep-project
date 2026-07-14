import React, { useState } from 'react'
import { useEmployee, useEmployees, useEmployeeAttendanceSummary } from '../../hooks/useEmployees'
import { useLeaveRequests, useMutateLeaveRequest } from '../../hooks/useLeaveRequests'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui'
import { X, Calendar, Clock, ArrowRight } from 'lucide-react'

interface EmployeeDetailsProps {
  employeeId: string
  onClose: () => void
}

export function EmployeeDetails({ employeeId, onClose }: EmployeeDetailsProps) {
  const { data: employee, isLoading: empLoading } = useEmployee(employeeId)
  const { data: allEmployees, isLoading: listLoading } = useEmployees()
  
  if (empLoading || listLoading) return <div className="p-8 text-center text-muted-foreground">Loading details...</div>
  if (!employee) return <div className="p-8 text-center text-red-500">Employee not found</div>

  return (
    <div className="flex h-[calc(100vh-200px)] gap-4">
      {/* Left Panel: Employee List */}
      <Card className="w-1/4 h-full overflow-y-auto hidden md:block">
        <CardHeader className="sticky top-0 bg-background/95 backdrop-blur z-10 border-b">
          <CardTitle className="text-sm">Team</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(allEmployees || []).map(e => (
            <div 
              key={e.id}
              className={`p-3 border-b cursor-pointer hover:bg-muted transition-colors ${e.id === employeeId ? 'bg-muted border-l-4 border-l-primary' : ''}`}
              onClick={() => {
                // If we were routing, we'd navigate. Here we are lifting state in a real app, 
                // but since this component receives employeeId from parent, clicking here would need to notify parent.
                // For simplicity in this layout, we'll assume the parent handles the layout or we just display the current one.
              }}
            >
              <div className="font-medium text-sm">{e.name}</div>
              <div className="text-xs text-muted-foreground">{e.employee_code || e.department}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Center Panel: Profile & Activity */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{employee.name}</h2>
            <p className="text-muted-foreground">{employee.blood_group ? `${employee.blood_group} • ` : ''}{employee.designation} • {employee.department}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        {/* Attendance Summary */}
        <AttendanceSummary employeeId={employeeId} />

        {/* Leave Section */}
        <LeaveSection employeeId={employeeId} />

        {/* Salary Stubs */}
        <Card>
          <CardHeader>
            <CardTitle>Advances & Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground italic">Salary module deferred to Phase 2</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fines & Deductions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground italic">Salary module deferred to Phase 2</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bonus & Variable Pay</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground italic">Salary module deferred to Phase 2</p>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}

function AttendanceSummary({ employeeId }: { employeeId: string }) {
  const today = new Date()
  const { data: summary, isLoading } = useEmployeeAttendanceSummary(employeeId, today.getFullYear(), today.getMonth() + 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Clock className="h-5 w-5" /> This Month's Attendance</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading summary...</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 bg-primary/10 rounded-lg">
              <div className="text-2xl font-bold text-primary">{summary?.present || 0}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Present</div>
            </div>
            <div className="p-4 bg-destructive/10 rounded-lg">
              <div className="text-2xl font-bold text-destructive">{summary?.absent || 0}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Absent</div>
            </div>
            <div className="p-4 bg-orange-500/10 rounded-lg">
              <div className="text-2xl font-bold text-orange-500">{summary?.halfDay || 0}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Half Day</div>
            </div>
            <div className="p-4 bg-blue-500/10 rounded-lg">
              <div className="text-2xl font-bold text-blue-500">{summary?.otHours?.toFixed(1) || 0}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">OT Hours</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function LeaveSection({ employeeId }: { employeeId: string }) {
  const { data: leaves, isLoading } = useLeaveRequests(employeeId)
  const { mutateAsync: saveLeave } = useMutateLeaveRequest()
  
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [leaveType, setLeaveType] = useState('Sick')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fromDate || !toDate) return
    setIsSubmitting(true)
    try {
      await saveLeave({
        employee_id: employeeId,
        from_date: fromDate,
        to_date: toDate,
        leave_type: leaveType
      })
      setFromDate('')
      setToDate('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Calendar className="h-5 w-5" /> Leave Requests</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end bg-muted/50 p-4 rounded-lg">
          <div className="space-y-2 flex-1 w-full">
            <label className="text-xs font-medium">From Date</label>
            <Input type="date" required value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="space-y-2 flex-1 w-full">
            <label className="text-xs font-medium">To Date</label>
            <Input type="date" required value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div className="space-y-2 flex-1 w-full">
            <label className="text-xs font-medium">Type</label>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Sick">Sick Leave</SelectItem>
                <SelectItem value="Casual">Casual Leave</SelectItem>
                <SelectItem value="Annual">Annual Leave</SelectItem>
                <SelectItem value="Unpaid">Unpaid Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isSubmitting}>Add Leave</Button>
        </form>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Leave History</h4>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading leaves...</p>
          ) : leaves?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leave history.</p>
          ) : (
            <div className="border rounded-md divide-y">
              {leaves?.map(leave => (
                <div key={leave.id} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{leave.leave_type}</span>
                    <span className="text-muted-foreground flex items-center gap-1">
                      {leave.from_date} <ArrowRight className="h-3 w-3" /> {leave.to_date}
                    </span>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    leave.status === 'Approved' ? 'bg-green-100 text-green-700' :
                    leave.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {leave.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
