import React, { useState, useEffect } from 'react'
import { useEmployees } from '../../hooks/useEmployees'
import type { Employee } from '../../hooks/useEmployees'
import { useOrganisationSettings } from '../../hooks/useOrganisationSettings'
import { useMutateEmployee } from '../../hooks/useEmployees'
import { Card, CardContent, CardHeader, CardTitle, Input, Button, Badge } from '@/components/ui'
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from '@/components/ui/table'
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Search, UserPlus, Settings2, Save, MoreHorizontal, Pencil, Eye, Trash2 } from 'lucide-react'
import { EmployeeForm } from './EmployeeForm'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface EmployeeDirectoryProps {
  onSelectEmployee: (employee: Employee) => void
}

const ALL_COLUMNS = [
  { id: 'code', label: 'Employee Code' },
  { id: 'name', label: 'Name' },
  { id: 'department', label: 'Department' },
  { id: 'designation', label: 'Designation' },
  { id: 'status', label: 'Status' },
  { id: 'blood_group', label: 'Blood Group' },
  { id: 'employment_type', label: 'Employment Type' },
  { id: 'phone', label: 'Phone' },
  { id: 'email', label: 'Email' },
  { id: 'dob', label: 'Date of Birth' },
]

export function EmployeeDirectory({ onSelectEmployee }: EmployeeDirectoryProps) {
  const { data: employees, isLoading, error } = useEmployees()
  const { settings, updateSettings, isUpdating } = useOrganisationSettings()

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'Active' | 'Inactive' | 'All'>('Active')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null)
  const mutateEmployee = useMutateEmployee()
  
  // Organization settings sync
  const [groupBy, setGroupBy] = useState<string>('None')
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    ALL_COLUMNS.map(c => c.id)
  )

  useEffect(() => {
    if (settings?.employeeDirectory) {
      if (settings.employeeDirectory.groupBy) setGroupBy(settings.employeeDirectory.groupBy)
      if (settings.employeeDirectory.visibleColumns) setVisibleColumns(settings.employeeDirectory.visibleColumns)
    }
  }, [settings])

  const handleSaveSettings = async () => {
    await updateSettings({
      employeeDirectory: {
        groupBy,
        visibleColumns
      }
    })
  }

  const handleDelete = async (emp: Employee) => {
    if (!window.confirm(`Delete ${emp.name || 'this employee'}? This cannot be undone.`)) return
    await mutateEmployee.mutateAsync({ id: emp.id, _delete: true } as any)
  }

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading employees...</div>
  if (error) return <div className="p-8 text-center text-red-500">Error loading employees</div>

  const filtered = (employees || []).filter(e => {
    // Handle status case-insensitivity
    const matchesStatus = statusFilter === 'All' || 
      (e.status && e.status.toLowerCase() === statusFilter.toLowerCase());
      
    const empName = e.name || (e as any).full_name || 'Unknown Employee';
    
    const matchesSearch = empName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (e.employee_code && e.employee_code.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesStatus && matchesSearch
  })

  // Grouping logic
  const groupedData: Record<string, Employee[]> = {}
  if (groupBy === 'None') {
    groupedData['All'] = filtered
  } else {
    filtered.forEach(emp => {
      let key = 'Unassigned'
      if (groupBy === 'Department' && emp.department) key = emp.department
      if (groupBy === 'Designation' && emp.designation) key = emp.designation
      if (groupBy === 'Employment Type' && emp.employment_type) key = emp.employment_type
      
      if (!groupedData[key]) groupedData[key] = []
      groupedData[key].push(emp)
    })
  }

  const toggleColumn = (colId: string) => {
    setVisibleColumns(prev => 
      prev.includes(colId) ? prev.filter(c => c !== colId) : [...prev, colId]
    )
  }

  const renderCell = (emp: Employee, colId: string) => {
    switch (colId) {
      case 'code': return emp.employee_code || '-'
      case 'name': return <span className="font-semibold text-slate-800">{emp.name || (emp as any).full_name || 'Unknown'}</span>
      case 'department': return emp.department || '-'
      case 'designation': return emp.designation || '-'
      case 'status': return (
        <Badge variant={emp.status?.toLowerCase() === 'active' ? 'default' : 'secondary'} className="capitalize">
          {emp.status}
        </Badge>
      )
      case 'blood_group': return emp.blood_group || '-'
      case 'employment_type': return emp.employment_type || '-'
      case 'phone': return emp.phone || emp.mobile_no || '-'
      case 'email': return emp.email || (emp as any).personal_email || '-'
      case 'dob': return emp.date_of_birth ? new Date(emp.date_of_birth).toLocaleDateString() : '-'
      default: return null
    }
  }

  const activeCols = ALL_COLUMNS.filter(c => visibleColumns.includes(c.id))

  return (
    <Card className="flex flex-col h-[calc(100vh-140px)] shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
        <div>
          <CardTitle>Employee Directory</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Manage your organisation's workforce</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Add Employee
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col p-0 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b bg-gray-50/50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or code..."
                className="pl-8 bg-white"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex bg-white rounded-md border shadow-sm p-0.5">
              {(['Active', 'Inactive', 'All'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${statusFilter === status ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500">Group by:</span>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger className="w-[160px] bg-white h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="None">None</SelectItem>
                  <SelectItem value="Department">Department</SelectItem>
                  <SelectItem value="Designation">Designation</SelectItem>
                  <SelectItem value="Employment Type">Employment Type</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2 bg-white">
                  <Settings2 className="h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {ALL_COLUMNS.map(col => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={visibleColumns.includes(col.id)}
                    onCheckedChange={() => toggleColumn(col.id)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.preventDefault()
                    if (!isUpdating) handleSaveSettings()
                  }}
                  className={`gap-2 font-medium text-indigo-600 focus:text-indigo-700 focus:bg-indigo-50 justify-center cursor-pointer ${
                    isUpdating ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  <Save className="h-4 w-4" />
                  {isUpdating ? 'Saving...' : 'Save Layout for Org'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <TableRow className="hover:bg-transparent">
                {activeCols.map(col => (
                  <TableHead key={col.id} className="font-semibold text-slate-700 whitespace-nowrap">
                    {col.label}
                  </TableHead>
                ))}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            
            {Object.entries(groupedData).map(([groupKey, groupEmployees]) => (
              <TableBody key={groupKey}>
                {groupBy !== 'None' && (
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableCell colSpan={activeCols.length + 1} className="py-2 px-4 font-semibold text-indigo-900 border-t border-b">
                      {groupKey} ({groupEmployees.length})
                    </TableCell>
                  </TableRow>
                )}
                
                {groupEmployees.map(emp => (
                    <TableRow 
                      key={emp.id} 
                      className="hover:bg-indigo-50/30 transition-colors"
                    >
                      {activeCols.map(col => (
                        <TableCell key={col.id} className="py-3 cursor-pointer" onClick={() => onSelectEmployee(emp)}>
                          {renderCell(emp, col.id)}
                        </TableCell>
                      ))}
                      {/* Action menu cell */}
                      <TableCell className="py-3 w-10 text-right" onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              className="gap-2.5 py-2.5 px-3 text-sm"
                              onClick={() => setEditEmployee(emp)}
                            >
                              <Pencil className="h-4 w-4 text-gray-500" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2.5 py-2.5 px-3 text-sm"
                              onClick={() => onSelectEmployee(emp)}
                            >
                              <Eye className="h-4 w-4 text-gray-500" />
                              Show Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="gap-2.5 py-2.5 px-3 text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => handleDelete(emp)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                
                {groupEmployees.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={activeCols.length + 1} className="h-24 text-center text-muted-foreground">
                      No employees found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            ))}
          </Table>
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

      {/* Edit Employee Modal */}
      <Dialog open={!!editEmployee} onOpenChange={(open) => { if (!open) setEditEmployee(null) }}>
        <DialogContent className="max-w-4xl h-[90vh] overflow-hidden flex flex-col p-0">
          <div className="px-6 py-4 border-b">
            <DialogTitle>Edit Employee — {editEmployee?.name}</DialogTitle>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {editEmployee && (
              <EmployeeForm 
                employee={editEmployee} 
                onSuccess={() => setEditEmployee(null)} 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
