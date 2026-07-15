export interface Slab {
  employeeId: string
  totalSalary: number
  basicPercent: number
  hraPercent: number
  pfPercent?: number
  esiPercent?: number
}

export interface Loan {
  id: string
  employee_id: string
  remaining_amount: number
  emi_amount: number
  status: string
}

export interface AttendanceRecord {
  date: string
  status: string
  sundayWorked?: boolean
  holidayWorked?: boolean
  isHalfDay?: boolean
  isAbsent?: boolean
  otHours?: string
  checkIn?: string
  checkOut?: string
}

export interface PayrollParams {
  employeeId: string
  year: number
  month: number
  totalDays: number
  holidays: Set<string>
  saturdaysHolidayType: 'working' | 'holiday1x' | 'holiday2x' | 'alternative'
  attendance: AttendanceRecord[]
  loans: Loan[]
  slab: Slab
  variablePay: { food: number; convenience: number; bonus: number }
  advances: number
  expenses: number
  fines: number
  otAdjustments: number // hours
  sandwichDeductions: string[] // dates 'YYYY-MM-DD'
  joinedDate?: string
  inactiveDate?: string
  hideInAttendance?: boolean
  minDailyHours?: number
}

export interface DailyBreakdown {
  date: string
  status: string
  worked: number
  otHours: number
  lop: number
  checkIn?: string
  checkOut?: string
  isSunday: boolean
  isHoliday: boolean
}

export function calculateEMI(loan: Loan, month: string): number {
  if (loan.status !== 'Active' || loan.remaining_amount <= 0) return 0
  return Math.min(loan.emi_amount, loan.remaining_amount)
}

export function isWorkedAttendanceRecord(r: AttendanceRecord | undefined): boolean {
  if (!r) return false
  const status = String(r.status || '').toLowerCase()
  return (status === 'worked' || status === 'present' || !!r.checkIn) && !r.isAbsent
}

export function dashIfZero(value: number): string | number {
  return value === 0 ? '-' : Math.round(value).toLocaleString('en-IN')
}

export function calcOT(inTime?: string, outTime?: string, workHours: number = 9): number {
  if (!inTime || !outTime) return 0

  const [inH, inM] = inTime.split(':').map(Number)
  const [outH, outM] = outTime.split(':').map(Number)

  if (isNaN(inH) || isNaN(inM) || isNaN(outH) || isNaN(outM)) return 0

  let totalMins = (outH * 60 + outM) - (inH * 60 + inM)
  
  // Handle cross-midnight shifts (e.g. 22:00 to 06:00)
  if (totalMins < 0) {
    totalMins += 24 * 60
  }

  if (totalMins <= 0) return 0

  const expectedMins = workHours * 60
  const rawOtMins = Math.max(0, totalMins - expectedMins)
  
  // Only count OT if more than 30 minutes over permitted hours
  if (rawOtMins <= 30) {
    return 0
  }
  
  // Round to nearest 5 minutes
  const roundedOtMins = Math.round(rawOtMins / 5) * 5
  return roundedOtMins / 60
}

export function calculatePayroll(params: PayrollParams) {
  const {
    employeeId, year, month, totalDays, holidays, saturdaysHolidayType, attendance, 
    loans, slab, variablePay, advances, expenses, fines, otAdjustments, sandwichDeductions,
    joinedDate, inactiveDate, hideInAttendance, minDailyHours = 9 // Default to 9 hours shift
  } = params

  const attByDate = new Map(attendance.map(a => [a.date, a]))
  
  let worked = 0, sunW = 0, holW = 0, leave = 0, lop = 0, hd = 0, otH = 0
  let sunCount = 0, holCount = 0

  const monthStr = `${year}-${String(month).padStart(2, '0')}`
  const dailyBreakdown: DailyBreakdown[] = []

  for (let i = 1; i <= totalDays; i++) {
    const ds = `${monthStr}-${String(i).padStart(2, '0')}`
    const d = new Date(year, month - 1, i)
    const isS = d.getDay() === 0
    const isSat = d.getDay() === 6
    const isH = holidays.has(ds) && !isS
    
    const r = attByDate.get(ds)
    const status = String(r?.status || '').toLowerCase()
    
    let dayLop = 0
    let dayWorked = 0
    let dayOt = 0
    
    if (joinedDate && ds < joinedDate) {
      lop++
      dayLop = 1
      dailyBreakdown.push({ date: ds, status: 'Not Joined', worked: 0, otHours: 0, lop: 1, isSunday: isS, isHoliday: isH })
      continue
    }
    if (inactiveDate && ds > inactiveDate) {
      lop++
      dayLop = 1
      dailyBreakdown.push({ date: ds, status: 'Inactive', worked: 0, otHours: 0, lop: 1, isSunday: isS, isHoliday: isH })
      continue
    }
    
    if (isS) sunCount++
    if (isH) holCount++

    // Sandwich Rule
    if (!hideInAttendance && (isS || isH || (isSat && saturdaysHolidayType !== 'working'))) {
      if (sandwichDeductions.includes(ds)) {
        lop++
        dailyBreakdown.push({ date: ds, status: 'Sandwich LOP', worked: 0, otHours: 0, lop: 1, isSunday: isS, isHoliday: isH })
        continue
      }
    }
    
    const isPresent = isWorkedAttendanceRecord(r) || r?.sundayWorked || r?.holidayWorked || status === 'sunworked'
    const isHD = status === 'half-day' || r?.isHalfDay

    if (status === 'absent' || r?.isAbsent || status === 'leave') {
      lop++
      dayLop = 1
    } else if (isHD) {
      hd++
      lop += 0.5
      dayLop = 0.5
      dayWorked = 0.5
      if (isS) sunW += 0.5
      else if (isH) holW += 0.5
      else worked += 0.5
    } else if (isS) {
      if (isPresent) {
        sunW++
        dayWorked = 1
      }
    } else if (isH) {
      if (isPresent) {
        holW++
        dayWorked = 1
      }
    } else if (isPresent) {
      worked++
      dayWorked = 1
    } else if (!isS && !isH) {
      lop++
      dayLop = 1
    }

    if (r?.checkIn && r?.checkOut) {
      dayOt = calcOT(r.checkIn, r.checkOut, minDailyHours)
      otH += dayOt
    } else if (r?.otHours) {
      // Fallback for legacy data without checkOut but with otHours string (e.g. "01:30")
      const [h, mi] = r.otHours.split(':').map(Number)
      const totalMins = (h || 0) * 60 + (mi || 0)
      const roundedMins = Math.ceil(totalMins / 5) * 5
      dayOt = roundedMins / 60
      otH += dayOt
    }

    dailyBreakdown.push({
      date: ds,
      status: r?.status || (isS ? 'Sunday' : isH ? 'Holiday' : dayLop === 1 ? 'Absent' : 'Present'),
      worked: dayWorked,
      otHours: dayOt,
      lop: dayLop,
      checkIn: r?.checkIn,
      checkOut: r?.checkOut,
      isSunday: isS,
      isHoliday: isH
    })
  }

  const ts = slab.totalSalary || 0
  const paidDays = totalDays - lop
  const dailyRate = ts / totalDays
  
  const fullBasic = ts * ((slab.basicPercent || 40) / 100)
  const fullHra = ts * ((slab.hraPercent || 20) / 100)
  
  const basic = fullBasic * (paidDays / totalDays)
  const hra = fullHra * (paidDays / totalDays)
  
  const sunPay = sunW * dailyRate
  const holPay = holW * dailyRate
  const otPay = (otH + otAdjustments) * (dailyRate / minDailyHours)
  
  const loanE = loans.reduce((acc, l) => acc + calculateEMI(l, monthStr), 0)
  
  const pf = ts * ((slab.pfPercent || 0) / 100)
  const esi = ts * ((slab.esiPercent || 0) / 100)
  
  const totalEarnings = basic + hra + sunPay + holPay + otPay + variablePay.food + variablePay.convenience + variablePay.bonus
  const totalDeductions = pf + esi + loanE + fines + advances
  
  const netAdvanceExpense = advances - expenses
  const finalNet = totalEarnings - totalDeductions + expenses

  return {
    totalCTC: ts,
    totalDays,
    paidDays,
    lop,
    worked,
    sunW,
    holW,
    ot: otH,
    otAdjustment: otAdjustments,
    sundays: sunCount,
    holidays: holCount,
    
    fullBasic,
    fullHra,
    basic,
    hra,
    sunPay,
    holPay,
    otPay,
    
    totalEarnings,
    pf,
    esi,
    loanE,
    fine: fines,
    advanceAmount: advances,
    expenseAmount: expenses,
    netAdvanceExpense,
    totalDeductions,
    
    salary: { net: finalNet },
    
    food: variablePay.food,
    convenience: variablePay.convenience,
    bonus: variablePay.bonus,

    dailyBreakdown
  }
}
