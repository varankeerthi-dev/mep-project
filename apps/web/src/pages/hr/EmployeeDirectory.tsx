import React, { useState } from 'react'
import { useEmployees, type Employee } from '../../hooks/useEmployees'
import { Card, CardContent, CardHeader, CardTitle, Input, Button, Badge } from '@/components/ui'
import { Search, UserPlus } from 'lucide-react'
import { EmployeeForm } from './EmployeeForm'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface EmployeeDirectoryProps {
  onSelectEmployee: (employee: Employee) => void
}

export function EmployeeDirectory({ onSelectEmployee }: EmployeeDirectoryProps) {
  const { data: employees, isLoading, error } = useEmployees()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'Active' | 'All'>('Active')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading employees...</div>
  if (error) return <div className="p-8 text-center text-red-500">Error loading employees</div>

  const filtered = (employees || []).filter(e => {
    const matchesStatus = statusFilter === 'All' || e.status === statusFilter
    const matchesSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (e.employee_code && e.employee_code.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesStatus && matchesSearch
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Employees</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Employee
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or code..."
              className="pl-8"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button 
              variant={statusFilter === 'Active' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setStatusFilter('Active')}
            >
              Active
            </Button>
            <Button 
              variant={statusFilter === 'All' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setStatusFilter('All')}
            >
              All
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(employee => (
            <div 
              key={employee.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:border-primary cursor-pointer transition-colors"
              onClick={() => onSelectEmployee(employee)}
            >
              <div className="flex flex-col">
                <span className="font-semibold">{employee.name}</span>
                <span className="text-sm text-muted-foreground">{employee.blood_group ? `${employee.blood_group} • ` : ''}{employee.designation || 'No Designation'}</span>
                {employee.employee_code && <span className="text-xs text-muted-foreground mt-1">Code: {employee.employee_code}</span>}
              </div>
              <Badge variant={employee.status === 'Active' ? 'default' : 'secondary'}>
                {employee.status}
              </Badge>
            </div>
          ))}
          
          {filtered.length === 0 && (
            <div className="col-span-full py-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
              No employees found matching the current filters.
            </div>
          )}
        </div>
      </CardContent>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-4xl h-[90vh] overflow-hidden flex flex-col p-0">
          <div className="px-6 py-4 border-b">
            <DialogTitle>Add New Employee</DialogTitle>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <EmployeeForm onSuccess={() => setIsAddModalOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
