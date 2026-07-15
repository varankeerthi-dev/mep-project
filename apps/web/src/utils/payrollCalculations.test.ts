import { describe, it, expect } from 'vitest'
import { calcOT } from './payrollCalculations'

describe('calcOT', () => {
  it('returns 0 when inTime or outTime is missing', () => {
    expect(calcOT(undefined, '18:00')).toBe(0)
    expect(calcOT('09:00', undefined)).toBe(0)
  })

  it('returns 0 when exactly minimum daily hours are worked', () => {
    expect(calcOT('09:00', '18:00', 9)).toBe(0) // exactly 9 hours
  })

  it('returns 0 for up to 30 minutes of grace period', () => {
    expect(calcOT('09:00', '18:30', 9)).toBe(0) // exactly 30 minutes over
    expect(calcOT('09:00', '18:15', 9)).toBe(0) // 15 minutes over
  })

  it('counts OT when exceeding 30 minutes, rounded to nearest 5', () => {
    // 31 mins over -> raw=31 -> rounds to 30 -> 0.5 hours
    expect(calcOT('09:00', '18:31', 9)).toBe(0.5) 
    
    // 45 mins over -> raw=45 -> rounds to 45 -> 0.75 hours
    expect(calcOT('09:00', '18:45', 9)).toBe(0.75)

    // 1 hr 15 mins over -> raw=75 -> rounds to 75 -> 1.25 hours
    expect(calcOT('09:00', '19:15', 9)).toBe(1.25)
  })

  it('handles cross-midnight shifts correctly', () => {
    // 22:00 to 08:00 -> 10 hours total. Expected 9. Over by 60 mins -> 1 hour OT.
    expect(calcOT('22:00', '08:00', 9)).toBe(1)
  })
})
