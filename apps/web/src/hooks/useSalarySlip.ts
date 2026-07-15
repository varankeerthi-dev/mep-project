import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'sonner'
import { calculatePayroll, PayrollParams, Loan, AttendanceRecord, Slab } from '../utils/payrollCalculations'

export function useSalarySlipData(month: string) {
  const { organisation } = useAuth()

  return useQuery({
    queryKey: ['salary-slip-data', organisation?.id, month],
    queryFn: async () => {
      if (!organisation?.id) return { employees: [], isLocked: false }

      const [y, m] = month.split('-').map(Number)
      const end = new Date(y, m, 0).getDate()
      const startDate = `${month}-01`
      const endDate = `${month}-${String(end).padStart(2, '0')}`

      // Fetch active employees
      const { data: employees } = await supabase
        .from('employees')
        .select('*')
        .eq('organisation_id', organisation.id)
        .eq('include_in_salary', true)

      if (!employees || employees.length === 0) return { employees: [], isLocked: false }

      // Fetch all required data for the month in parallel
      const [
        { data: attendanceData },
        { data: loansData },
        { data: variablesData },
        { data: advancesData },
        { data: finesData },
        { data: orgSettings },
        { data: incrementsData },
        { data: payrollRunData }
      ] = await Promise.all([
        supabase
          .from('attendance')
          .select('*')
          .eq('organisation_id', organisation.id)
          .gte('plan_date', startDate)
          .lte('plan_date', endDate),
        supabase
          .from('loans')
          .select('*')
          .eq('organisation_id', organisation.id)
          .eq('status', 'Active'),
        supabase
          .from('variable_pay_logs')
          .select('*')
          .eq('organisation_id', organisation.id)
          .eq('month', month),
        supabase
          .from('hr_advances_expenses')
          .select('*')
          .eq('organisation_id', organisation.id)
          .gte('date', startDate)
          .lte('date', endDate),
        supabase
          .from('fines')
          .select('*')
          .eq('organisation_id', organisation.id)
          .gte('date', startDate)
          .lte('date', endDate),
        supabase
          .from('organisations')
          .select('saturday_type, holidays')
          .eq('id', organisation.id)
          .single(),
        supabase
          .from('salary_increments')
          .select('*')
          .eq('organisation_id', organisation.id)
          .lte('effective_from', endDate)
          .order('effective_from', { ascending: false }),
        supabase
          .from('payroll_runs')
          .select('status')
          .eq('organisation_id', organisation.id)
          .eq('month', month)
          .maybeSingle()
      ])

      const holidaysSet = new Set<string>((orgSettings?.holidays || []).map((h: any) => h.date))
      const isLocked = payrollRunData?.status === 'finalized'

      // Process each employee
      const processedEmployees = employees.map(emp => {
        const empAttendance = (attendanceData || [])
          .filter(a => a.employee_id === emp.id)
          .map(a => ({
            date: a.plan_date,
            status: a.status,
            sundayWorked: a.sunday_worked,
            holidayWorked: a.holiday_worked,
            isHalfDay: a.is_half_day,
            isAbsent: a.is_absent,
            otHours: a.ot_hours,
            checkIn: a.in_time,
            checkOut: a.out_time
          } as AttendanceRecord))

        const empLoans = (loansData || []).filter(l => l.employee_id === emp.id) as Loan[]
        
        const empVariables = (variablesData || []).filter(v => v.employee_id === emp.id)
        const totalFood = empVariables.reduce((sum, v) => sum + (v.food || 0), 0)
        const totalConv = empVariables.reduce((sum, v) => sum + (v.convenience || 0), 0)
        const totalBonus = empVariables.reduce((sum, v) => sum + (v.bonus || 0), 0)

        const empAdvances = (advancesData || [])
          .filter(a => a.employee_id === emp.id && a.type === 'Advance')
          .reduce((sum, a) => sum + (a.amount || 0), 0)

        const empExpenses = (advancesData || [])
          .filter(a => a.employee_id === emp.id && a.type === 'Expense')
          .reduce((sum, a) => sum + (a.amount || 0), 0)

        const empFines = (finesData || [])
          .filter(f => f.employee_id === emp.id)
          .reduce((sum, f) => sum + (f.amount || 0), 0)

        // Find the active slab for this employee in this month
        const activeIncrement = (incrementsData || []).find(inc => inc.employee_id === emp.id)
        
        const slab: Slab = activeIncrement ? {
          employeeId: emp.id,
          totalSalary: Number(activeIncrement.total_salary) || 0,
          basicPercent: Number(activeIncrement.basic_percent) || 40,
          hraPercent: Number(activeIncrement.hra_percent) || 20,
          pfPercent: Number(activeIncrement.pf_percent) || 0,
          esiPercent: Number(activeIncrement.esi_percent) || 0
        } : {
          // Fallback to employee master if no increment found (legacy fallback)
          employeeId: emp.id,
          totalSalary: Number(emp.monthly_salary) || 0,
          basicPercent: 40,
          hraPercent: 20,
          pfPercent: 0,
          esiPercent: 0
        }

        const payrollParams: PayrollParams = {
          employeeId: emp.id,
          year: y,
          month: m,
          totalDays: end,
          holidays: holidaysSet,
          saturdaysHolidayType: orgSettings?.saturday_type || 'working',
          attendance: empAttendance,
          loans: empLoans,
          slab,
          variablePay: { food: totalFood, convenience: totalConv, bonus: totalBonus },
          advances: empAdvances,
          expenses: empExpenses,
          fines: empFines,
          otAdjustments: 0, // Placeholder
          sandwichDeductions: [], // Placeholder
          joinedDate: emp.joined_date,
          hideInAttendance: emp.hide_in_attendance,
          minDailyHours: Number(emp.min_daily_hours) || 9
        }

        const calculated = calculatePayroll(payrollParams)

        return {
          ...emp,
          payroll: calculated,
          slab
        }
      })

      return { employees: processedEmployees, isLocked }
    },
    enabled: !!organisation?.id && !!month
  })
}
