import React, { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { EmployeeDirectory } from './EmployeeDirectory'
import { EmployeeDetails } from './EmployeeDetails'
import { EmployeeBirthday } from './EmployeeBirthday'
import { SalarySlipDashboard } from './salary-slip/SalarySlipDashboard'
import type { Employee } from '../../hooks/useEmployees'

export default function EmployeeTab() {
  const [activeTab, setActiveTab] = useState('directory')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)

  const handleSelectEmployee = (employee: Employee) => {
    setSelectedEmployeeId(employee.id)
    setActiveTab('details')
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Employees</h2>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="directory">Directory</TabsTrigger>
          <TabsTrigger value="details" disabled={!selectedEmployeeId}>
            Details
          </TabsTrigger>
          <TabsTrigger value="birthday">Birthdays</TabsTrigger>
          <TabsTrigger value="salary">Salary Slip</TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="space-y-4">
          <EmployeeDirectory onSelectEmployee={handleSelectEmployee} />
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          {selectedEmployeeId ? (
            <EmployeeDetails 
              employeeId={selectedEmployeeId} 
              onClose={() => {
                setSelectedEmployeeId(null)
                setActiveTab('directory')
              }} 
            />
          ) : (
            <div className="flex h-[400px] items-center justify-center rounded-md border border-dashed">
              <p className="text-sm text-muted-foreground">Select an employee from the directory to view details</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="birthday" className="space-y-4">
          <EmployeeBirthday />
        </TabsContent>

        <TabsContent value="salary" className="space-y-4">
          <SalarySlipDashboard />
        </TabsContent>
      </Tabs>
    </div>
  )
}
