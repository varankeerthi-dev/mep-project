import React from 'react'
import { useEmployees } from '../../hooks/useEmployees'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { Cake } from 'lucide-react'
import { format, isThisMonth, isFuture, parseISO, setYear } from 'date-fns'

export function EmployeeBirthday() {
  const { data: employees, isLoading } = useEmployees()

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading birthdays...</div>

  const today = new Date()
  const currentYear = today.getFullYear()

  // Filter and format employees with DOB
  const withDob = (employees || [])
    .filter(e => e.dob && e.status === 'Active')
    .map(e => {
      const dob = parseISO(e.dob!)
      // Shift birthday to current year for sorting/filtering
      const thisYearBirthday = setYear(dob, currentYear)
      
      // If birthday already passed this year, look at next year's
      const nextBirthday = isFuture(thisYearBirthday) ? thisYearBirthday : setYear(dob, currentYear + 1)
      
      return {
        ...e,
        dobDate: dob,
        thisYearBirthday,
        nextBirthday
      }
    })
    .sort((a, b) => a.nextBirthday.getTime() - b.nextBirthday.getTime())

  const thisMonth = withDob.filter(e => isThisMonth(e.thisYearBirthday))
  const upcoming = withDob.filter(e => !isThisMonth(e.thisYearBirthday)).slice(0, 5)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cake className="h-5 w-5 text-primary" />
            This Month
          </CardTitle>
        </CardHeader>
        <CardContent>
          {thisMonth.length === 0 ? (
            <p className="text-sm text-muted-foreground">No birthdays this month.</p>
          ) : (
            <div className="space-y-4">
              {thisMonth.map(e => (
                <div key={e.id} className="flex justify-between items-center border-b pb-2 last:border-0">
                  <div>
                    <p className="font-medium">{e.name}</p>
                    <p className="text-xs text-muted-foreground">{e.department}</p>
                  </div>
                  <div className="font-semibold text-primary">
                    {format(e.thisYearBirthday, 'MMM do')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cake className="h-5 w-5 text-muted-foreground" />
            Upcoming
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming birthdays found.</p>
          ) : (
            <div className="space-y-4">
              {upcoming.map(e => (
                <div key={e.id} className="flex justify-between items-center border-b pb-2 last:border-0">
                  <div>
                    <p className="font-medium">{e.name}</p>
                    <p className="text-xs text-muted-foreground">{e.department}</p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(e.nextBirthday, 'MMM do')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
