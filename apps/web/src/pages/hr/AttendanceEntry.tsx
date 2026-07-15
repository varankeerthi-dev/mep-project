import React, { useState, useEffect } from 'react'
import { Card, CardContent, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Button } from '@/components/ui'
import { useAttendancePlan, useBulkMutateAttendancePlan, useSites, type AttendancePlan } from '../../hooks/useAttendance'
import { useEmployees } from '../../hooks/useEmployees'
import { format } from 'date-fns'
import { Clock, RefreshCw, CheckCircle2 } from 'lucide-react'

// --- Helper Functions ---
function formatTimeDisplay(time24: string) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const p = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${p}`;
}

function convertShorthand(val: string, period: string) {
  const digits = val.replace(/\D/g, '');
  let h, m;
  if (digits.length === 3) {
    h = parseInt(digits[0]);
    m = parseInt(digits.slice(1));
  } else if (digits.length === 4) {
    h = parseInt(digits.slice(0, 2));
    m = parseInt(digits.slice(2));
  } else if (digits.length === 2) {
    const num = parseInt(digits);
    if (num <= 12) {
      h = num;
      m = 0;
    } else {
      h = new Date().getHours() % 12 || 12;
      m = num > 59 ? 50 : num;
    }
  } else if (digits.length === 1) {
    h = parseInt(digits);
    m = 0;
  } else {
    return null;
  }

  if (h > 12) h = 12;
  if (m > 59) m = 59;

  let h24 = h;
  if (period === 'PM' && h24 !== 12) h24 += 12;
  if (period === 'AM' && h24 === 12) h24 = 0;
  
  return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function calcOT(inTime: string, outTime: string, inDate: string, outDate: string, workHours: number = 8) {
  if (!inTime || !outTime || !inDate || !outDate) return '00:00'

  const [inH, inM] = inTime.split(':').map(Number)
  const [outH, outM] = outTime.split(':').map(Number)

  const inDateTime = new Date(`${inDate}T${String(inH).padStart(2, '0')}:${String(inM).padStart(2, '0')}:00`)
  let outDateTime = new Date(`${outDate}T${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}:00`)
  
  if (outDateTime < inDateTime) {
    outDateTime.setDate(outDateTime.getDate() + 1);
  }

  if (isNaN(inDateTime.getTime()) || isNaN(outDateTime.getTime())) return '00:00'

  const totalMins = Math.floor((outDateTime.getTime() - inDateTime.getTime()) / (1000 * 60))
  if (totalMins <= 0) return '00:00'

  const expectedMins = workHours * 60
  const rawOtMins = Math.max(0, totalMins - expectedMins)
  
  if (rawOtMins <= 30) return '00:00'
  
  const roundedOtMins = Math.round(rawOtMins / 5) * 5
  const otHrs = Math.floor(roundedOtMins / 60)
  const otRemMins = roundedOtMins % 60

  if (isNaN(otHrs) || isNaN(otRemMins)) return '00:00'
  return `${String(otHrs).padStart(2, '0')}:${String(otRemMins).padStart(2, '0')}`
}

// --- Custom Components ---
const TimeEditableCell = ({ value, onChange, disabled, placeholder }: any) => {
  const [tempValue, setTempValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setTempValue(value ? formatTimeDisplay(value) : '');
    }
  }, [value, isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const key = e.key.toLowerCase();
    
    if (e.key === 'Enter') {
      e.preventDefault();
      if (tempValue.includes(':')) {
         onChange(tempValue);
         setIsEditing(false);
      }
      return;
    }
    
    if (key === 'a' || key === 'p') {
      e.preventDefault();
      const period = key === 'a' ? 'AM' : 'PM';
      const time24 = convertShorthand(tempValue, period);
      if (time24) {
        onChange(time24);
        setIsEditing(false);
      }
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      setIsEditing(false);
      if (tempValue && tempValue.includes(':') && tempValue !== formatTimeDisplay(value)) {
        onChange(tempValue);
      }
    }, 200);
  }

  return (
    <div 
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative flex items-center rounded-md border min-h-[32px] transition-all bg-white ${
        isHovered && !isEditing
          ? 'border-indigo-300 shadow-[0_1px_3px_rgba(0,0,0,0.05)]' 
          : isEditing ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-gray-200'
      }`}
    >
      <div className="flex-1 flex flex-col items-center min-w-0 py-0.5 cursor-text">
        <div className="relative group w-full">
          <input
            type="text"
            value={tempValue}
            onChange={(e) => { setTempValue(e.target.value); setIsEditing(true); }}
            onFocus={(e) => { setIsEditing(true); e.target.select(); }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className="w-full bg-transparent border-none outline-none px-2 text-[13px] font-medium text-center text-gray-800 placeholder-gray-400/50 disabled:text-gray-400 h-7"
            placeholder={placeholder || "--:--"}
          />
          <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 bg-gray-800/90 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
            Type '08a' or '05p'
          </span>
        </div>
      </div>
      <div className={`pr-2 transition-colors ${isEditing ? 'text-indigo-600' : 'text-gray-400'}`}>
        <Clock size={14} />
      </div>
    </div>
  );
};

const ShiftToggle = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
  return (
    <div className="flex bg-gray-100 rounded-full p-0.5 w-[140px] relative">
      <div className={`absolute top-0.5 bottom-0.5 w-[33%] rounded-full transition-all duration-300 ease-out shadow-sm ${
        value === 'Day' ? 'left-[2%] bg-amber-400' : 
        value === 'DN' ? 'left-[33%] bg-indigo-500' : 
        'left-[65%] bg-slate-800'
      }`} />
      
      <button 
        onClick={() => onChange('Day')}
        className={`flex-1 text-xs font-semibold z-10 py-1 transition-colors ${value === 'Day' ? 'text-amber-950' : 'text-gray-500 hover:text-gray-700'}`}
      >
        Day
      </button>
      <button 
        onClick={() => onChange('DN')}
        className={`flex-1 text-xs font-semibold z-10 py-1 transition-colors ${value === 'DN' ? 'text-white' : 'text-gray-500 hover:text-gray-700'}`}
      >
        DN
      </button>
      <button 
        onClick={() => onChange('Night')}
        className={`flex-1 text-xs font-semibold z-10 py-1 transition-colors ${value === 'Night' ? 'text-white' : 'text-gray-500 hover:text-gray-700'}`}
      >
        Night
      </button>
    </div>
  )
}

const StatusBadge = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
  const getColors = (status: string) => {
    switch(status) {
      case 'checked_in': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      case 'absent': return 'bg-rose-100 text-rose-800 border-rose-200'
      case 'leave': return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'no_show': return 'bg-purple-100 text-purple-800 border-purple-200'
      default: return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  const getLabel = (status: string) => {
    switch(status) {
      case 'checked_in': return 'Present'
      case 'absent': return 'Absent'
      case 'leave': return 'Leave'
      case 'no_show': return 'No Show'
      default: return 'Planned'
    }
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-8 border font-semibold ${getColors(value)}`}>
        <SelectValue>{getLabel(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="planned">Planned</SelectItem>
        <SelectItem value="checked_in">Present</SelectItem>
        <SelectItem value="absent">Absent</SelectItem>
        <SelectItem value="leave">Leave</SelectItem>
        <SelectItem value="no_show">No Show</SelectItem>
      </SelectContent>
    </Select>
  )
}

export default function AttendanceEntry() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const { data: plan, isLoading: planLoading } = useAttendancePlan(selectedDate)
  const { data: sites } = useSites()
  const { data: employees } = useEmployees()
  const { mutateAsync: saveEntries, isPending: isSaving } = useBulkMutateAttendancePlan()

  // Local state for rows to support strictly submit workflow
  const [rows, setRows] = useState<any[]>([])
  const [hasGenerated, setHasGenerated] = useState(false)

  const activeEmployees = (employees || []).filter(e => e.status?.toLowerCase() === 'active')
  const unassignedSite = sites?.find(s => s.virtual_type === 'unassigned')?.id

  // When date changes or plan loads, synchronize the local state
  useEffect(() => {
    if (planLoading) return;
    
    if (plan && plan.length > 0) {
      // If we already have database entries for this date, load them into state
      setRows(plan)
      setHasGenerated(true)
    } else {
      // Otherwise wait for user to hit Generate Active
      setRows([])
      setHasGenerated(false)
    }
  }, [plan, planLoading, selectedDate])

  const handleGenerate = () => {
    // Generate fresh rows for all active employees
    const newRows = activeEmployees.map(emp => {
      let defaultPlannedSite = unassignedSite
      if (emp.deployment_mode === 'continuous' && emp.default_site_id) {
        defaultPlannedSite = emp.default_site_id
      }
      return {
        employee_id: emp.id,
        plan_date: selectedDate,
        planned_site_id: defaultPlannedSite,
        actual_site_id: defaultPlannedSite,
        status: 'planned',
        shift_type: 'Day',
        in_time: '',
        out_time: '',
        remarks: '',
        source: 'manual_plan',
        employeeName: emp.name || (emp as any).full_name,
        min_daily_hours: emp.min_daily_hours || 8
      }
    })
    
    setRows(newRows)
    setHasGenerated(true)
  }

  const handleUpdateField = (empId: string, field: string, value: any) => {
    setRows(prev => prev.map(row => {
      if (row.employee_id === empId) {
        const updated = { ...row, [field]: value }
        if (field === 'in_time' && value && updated.status === 'planned') {
          updated.status = 'checked_in'
        }
        return updated
      }
      return row
    }))
  }

  const handleSubmit = async () => {
    if (rows.length === 0) return
    
    // Clean up purely UI fields before submitting
    const payload = rows.map(r => {
      const copy = { ...r }
      delete copy.employeeName
      delete copy.min_daily_hours
      // also delete relational nested objects if loaded from DB
      delete copy.employee
      delete copy.planned_site
      delete copy.actual_site
      return copy
    })

    await saveEntries(payload)
  }

  if (planLoading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading attendance...</div>

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] p-4 md:p-8 pt-6 space-y-6 bg-gray-50/30">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Attendance Entry</h2>
          <p className="text-muted-foreground mt-1">Manage daily attendance, shifts, and OT</p>
        </div>
        <div className="flex items-center gap-4">
          <input 
            type="date" 
            className="border-gray-200 border rounded-lg px-4 py-2 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium text-slate-700 bg-white"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          />
          {!hasGenerated && (
            <Button onClick={handleGenerate} className="shadow-sm bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              <RefreshCw className="h-4 w-4" />
              Generate Active
            </Button>
          )}
          {hasGenerated && (
            <Button onClick={handleSubmit} disabled={isSaving} className="shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {isSaving ? 'Submitting...' : 'Submit Attendance'}
            </Button>
          )}
        </div>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col border-gray-200/60 shadow-sm rounded-xl bg-white">
        <CardContent className="flex-1 overflow-auto p-0">
          <table className="w-full text-sm text-left">
            <thead className="sticky top-0 z-10 backdrop-blur-md bg-orange-50/95 border-b border-orange-200/60">
              <tr>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#da7025]">Employee</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#da7025]">Planned Site</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#da7025] w-48">Actual Site</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#da7025] w-[160px]">Shift</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#da7025] w-32 text-center">In Time</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#da7025] w-32 text-center">Out Time</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#da7025] w-24 text-center">OT (Hrs)</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#da7025] w-36">Status</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#da7025]">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 && !hasGenerated && (
                <tr>
                  <td colSpan={9} className="text-center py-20 text-gray-400 font-medium text-lg">
                    Ready to generate attendance. Click "Generate Active" to populate.
                  </td>
                </tr>
              )}
              {rows.length === 0 && hasGenerated && (
                <tr>
                  <td colSpan={9} className="text-center py-20 text-gray-400 font-medium text-lg">
                    No active employees found.
                  </td>
                </tr>
              )}
              
              {rows.map(row => {
                const emp = employees?.find(e => e.id === row.employee_id)
                const empName = row.employeeName || emp?.name || (emp as any)?.full_name || 'Unknown'
                const minHours = row.min_daily_hours || emp?.min_daily_hours || 8
                
                const plannedSiteName = sites?.find(s => s.id === row.planned_site_id)?.site_name || 'Unassigned'
                const otDisplay = calcOT(row.in_time, row.out_time, selectedDate, selectedDate, minHours)
                
                const rowBg = row.status === 'absent' || row.status === 'no_show' ? 'bg-rose-50/40 hover:bg-rose-50/70' : 
                              row.status === 'leave' ? 'bg-amber-50/40 hover:bg-amber-50/70' :
                              row.status === 'checked_in' ? 'bg-white hover:bg-slate-50' : 
                              'bg-gray-50/30 hover:bg-slate-50'

                return (
                  <tr key={row.employee_id} className={`h-[52px] transition-colors ${rowBg}`}>
                    <td className="px-4 py-1.5 font-semibold text-slate-800">{empName}</td>
                    <td className="px-4 py-1.5 text-slate-500 font-medium text-xs">{plannedSiteName}</td>
                    <td className="px-4 py-1.5">
                      <Select 
                        value={row.actual_site_id} 
                        onValueChange={(val) => handleUpdateField(row.employee_id, 'actual_site_id', val)}
                      >
                        <SelectTrigger className="h-8 border-transparent hover:border-gray-200 bg-transparent hover:bg-white shadow-none hover:shadow-sm transition-all text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {sites?.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.site_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-1.5">
                      <ShiftToggle 
                        value={row.shift_type || 'Day'} 
                        onChange={(val) => handleUpdateField(row.employee_id, 'shift_type', val)} 
                      />
                    </td>
                    <td className="px-4 py-1.5">
                      <TimeEditableCell 
                        value={row.in_time} 
                        onChange={(val: string) => handleUpdateField(row.employee_id, 'in_time', val)} 
                        placeholder="In"
                      />
                    </td>
                    <td className="px-4 py-1.5">
                      <TimeEditableCell 
                        value={row.out_time} 
                        onChange={(val: string) => handleUpdateField(row.employee_id, 'out_time', val)} 
                        placeholder="Out"
                      />
                    </td>
                    <td className="px-4 py-1.5 text-center">
                      <span className={`font-mono font-medium ${otDisplay !== '00:00' ? 'text-emerald-600 bg-emerald-50 px-2 py-1 rounded' : 'text-gray-400'}`}>
                        {otDisplay}
                      </span>
                    </td>
                    <td className="px-4 py-1.5">
                      <StatusBadge 
                        value={row.status}
                        onChange={(val) => handleUpdateField(row.employee_id, 'status', val)}
                      />
                    </td>
                    <td className="px-4 py-1.5">
                      <Input 
                        className="h-8 border-transparent hover:border-gray-200 bg-transparent hover:bg-white shadow-none hover:shadow-sm transition-all focus:border-indigo-500 focus:bg-white focus:shadow-sm" 
                        value={row.remarks || ''} 
                        onChange={e => handleUpdateField(row.employee_id, 'remarks', e.target.value)}
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
