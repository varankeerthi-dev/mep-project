import React, { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'
import { useMutateEmployee } from '../../hooks/useEmployees'
import { Checkbox } from '@/components/ui/checkbox'

const employeeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  employee_code: z.string().optional(),
  designation: z.string().optional(),
  department: z.string().optional(),
  dob: z.string().optional(),
  blood_group: z.string().optional(),
  marital_status: z.string().optional(),
  father_name: z.string().optional(),
  mother_name: z.string().optional(),
  
  employment_type: z.string().optional(),
  joined_date: z.string().optional(),
  shift_id: z.string().optional(),
  min_daily_hours: z.coerce.number().optional(),
  permission_hours: z.coerce.number().optional(),
  hide_in_attendance: z.boolean().optional(),
  include_in_salary: z.boolean().optional(),
  include_in_task: z.boolean().optional(),
  
  mobile_no: z.string().optional(),
  office_no: z.string().optional(),
  personal_no: z.string().optional(),
  emergency_contact: z.string().optional(),
  address: z.string().optional(),
  
  login_enabled: z.boolean().optional(),
  personal_email: z.string().email().optional().or(z.literal('')),
  work_email: z.string().email().optional().or(z.literal('')),
  login_email_type: z.string().optional(),
  role: z.string().optional(),
  
  aadhar_no: z.string().optional(),
  pan_no: z.string().optional(),
  pf_no: z.string().optional(),
  esi_no: z.string().optional(),
  driving_license_no: z.string().optional(),
  has_own_vehicle: z.boolean().optional(),
  
  monthly_salary: z.coerce.number().optional(),
  withdraw_full_salary: z.boolean().optional(),
  status: z.enum(['Active', 'Inactive', 'Rejoined']),
  deployment_mode: z.enum(['continuous', 'project']),
})

type EmployeeFormData = z.infer<typeof employeeSchema>

export function EmployeeForm({ onSuccess }: { onSuccess: () => void }) {
  const mutateEmployee = useMutateEmployee()

  const [bgSearchText, setBgSearchText] = useState('')
  const [isBgDropdownOpen, setIsBgDropdownOpen] = useState(false)
  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.dropdown-container')) {
        setIsBgDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      status: 'Active',
      deployment_mode: 'project',
      permission_hours: 2,
      include_in_salary: true,
      include_in_task: true,
      hide_in_attendance: false,
      login_enabled: false,
      login_email_type: 'work',
      withdraw_full_salary: false,
      has_own_vehicle: false,
      employment_type: 'Full-time'
    }
  })

  const onSubmit = async (data: EmployeeFormData) => {
    try {
      await mutateEmployee.mutateAsync(data)
      onSuccess()
    } catch (err) {
      console.error(err)
    }
  }

  // --- Design System Patterns ---
  const headerFieldStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px' }
  const labelColStyle: React.CSSProperties = { minWidth: '110px', maxWidth: '110px', fontWeight: 600, fontSize: '11px', color: '#374151', textAlign: 'right' }
  const fieldColStyle: React.CSSProperties = { flex: 1 }
  const sectionHeaderStyle: React.CSSProperties = {
    fontWeight: 600, fontSize: '11px', color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px'
  }

  const renderHeaderField = (label: string, field: React.ReactNode, isLast = false, error?: string) => (
    <div style={{ ...headerFieldStyle, marginBottom: isLast ? 0 : '8px' }}>
      <span style={labelColStyle}>{label}</span>
      <div style={fieldColStyle}>
        {field}
        {error && <span style={{ color: 'red', fontSize: '10px', marginTop: '2px', display: 'block' }}>{error}</span>}
      </div>
    </div>
  )

  const inputStyle = { padding: '4px 8px', fontSize: '12px', height: '28px' }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '6px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          {/* Column 1 */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={sectionHeaderStyle}>Basic Info</div>
            {renderHeaderField('Name:', <Input {...register('name')} style={inputStyle} />, false, errors.name?.message)}
            {renderHeaderField('Emp Code:', <Input {...register('employee_code')} style={inputStyle} />)}
            {renderHeaderField('Designation:', <Input {...register('designation')} style={inputStyle} />)}
            {renderHeaderField('Department:', <Input {...register('department')} style={inputStyle} />)}
            {renderHeaderField('Date of Birth:', <Input type="date" {...register('dob')} style={inputStyle} />)}
            {renderHeaderField('Blood Group:', (
              <Controller
                control={control}
                name="blood_group"
                render={({ field }) => (
                  <div className="relative dropdown-container" style={{ width: '100%' }}>
                    <Input
                      value={isBgDropdownOpen ? bgSearchText : (field.value || '')}
                      onChange={e => { setBgSearchText(e.target.value); setIsBgDropdownOpen(true); }}
                      onFocus={() => setIsBgDropdownOpen(true)}
                      placeholder="Search..."
                      style={inputStyle}
                      autoComplete="off"
                    />
                    {isBgDropdownOpen && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0,
                        zIndex: 50, background: 'white', border: '1px solid #d1d5db',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                        maxHeight: '200px', overflowY: 'auto'
                      }}>
                        {bloodGroups
                          .filter(bg => !bgSearchText || bg.toLowerCase().includes(bgSearchText.toLowerCase()))
                          .map(bg => (
                            <div key={bg} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                              onMouseLeave={e => e.currentTarget.style.background = 'white'}
                              onClick={() => { field.onChange(bg); setBgSearchText(''); setIsBgDropdownOpen(false); }}
                            >{bg}</div>
                          ))}
                        {bloodGroups.filter(bg => !bgSearchText || bg.toLowerCase().includes(bgSearchText.toLowerCase())).length === 0 && (
                          <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>No items found</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              />
            ))}
            {renderHeaderField('Marital Status:', (
              <Controller
                control={control}
                name="marital_status"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger style={inputStyle}><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Single">Single</SelectItem>
                      <SelectItem value="Married">Married</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            ))}
            {renderHeaderField('Father Name:', <Input {...register('father_name')} style={inputStyle} />)}
            {renderHeaderField('Mother Name:', <Input {...register('mother_name')} style={inputStyle} />, true)}

            <div style={{ ...sectionHeaderStyle, marginTop: '20px' }}>Work & Attendance</div>
            {renderHeaderField('Status:', (
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger style={inputStyle}><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      <SelectItem value="Rejoined">Rejoined</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            ))}
            {renderHeaderField('Employ Type:', <Input {...register('employment_type')} style={inputStyle} />)}
            {renderHeaderField('Joined Date:', <Input type="date" {...register('joined_date')} style={inputStyle} />)}
            {renderHeaderField('Shift ID:', <Input {...register('shift_id')} style={inputStyle} />)}
            {renderHeaderField('Min Hours:', <Input type="number" step="0.1" {...register('min_daily_hours')} style={inputStyle} />)}
            {renderHeaderField('Permission Hrs:', <Input type="number" step="0.1" {...register('permission_hours')} style={inputStyle} />)}
            
            {renderHeaderField('', (
              <div className="flex items-center space-x-2 mt-2">
                <Controller
                  control={control}
                  name="hide_in_attendance"
                  render={({ field }) => (
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} id="hide_in_attendance" />
                  )}
                />
                <label htmlFor="hide_in_attendance" className="text-xs">Hide in Attendance</label>
              </div>
            ))}
            {renderHeaderField('', (
              <div className="flex items-center space-x-2">
                <Controller
                  control={control}
                  name="include_in_salary"
                  render={({ field }) => (
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} id="include_in_salary" />
                  )}
                />
                <label htmlFor="include_in_salary" className="text-xs">Include in Salary</label>
              </div>
            ))}
            {renderHeaderField('', (
              <div className="flex items-center space-x-2">
                <Controller
                  control={control}
                  name="include_in_task"
                  render={({ field }) => (
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} id="include_in_task" />
                  )}
                />
                <label htmlFor="include_in_task" className="text-xs">Include in Tasks</label>
              </div>
            ), true)}
          </div>

          {/* Column 2 */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={sectionHeaderStyle}>Contact Details</div>
            {renderHeaderField('Mobile No:', <Input {...register('mobile_no')} style={inputStyle} />)}
            {renderHeaderField('Office No:', <Input {...register('office_no')} style={inputStyle} />)}
            {renderHeaderField('Personal No:', <Input {...register('personal_no')} style={inputStyle} />)}
            {renderHeaderField('Emergency:', <Input {...register('emergency_contact')} style={inputStyle} />)}
            {renderHeaderField('Address:', <Input {...register('address')} style={inputStyle} />, true)}

            <div style={{ ...sectionHeaderStyle, marginTop: '20px' }}>Login & Access</div>
            {renderHeaderField('', (
              <div className="flex items-center space-x-2 mb-2">
                <Controller
                  control={control}
                  name="login_enabled"
                  render={({ field }) => (
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} id="login_enabled" />
                  )}
                />
                <label htmlFor="login_enabled" className="text-xs font-semibold text-blue-600">Enable App Login</label>
              </div>
            ))}
            {renderHeaderField('Personal Email:', <Input type="email" {...register('personal_email')} style={inputStyle} />)}
            {renderHeaderField('Work Email:', <Input type="email" {...register('work_email')} style={inputStyle} />)}
            {renderHeaderField('Login Email:', (
              <Controller
                control={control}
                name="login_email_type"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger style={inputStyle}><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="work">Work Email</SelectItem>
                      <SelectItem value="personal">Personal Email</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            ))}
            {renderHeaderField('System Role:', <Input {...register('role')} style={inputStyle} />, true)}

            <div style={{ ...sectionHeaderStyle, marginTop: '20px' }}>Identity / KYC</div>
            {renderHeaderField('Aadhar No:', <Input {...register('aadhar_no')} style={inputStyle} />)}
            {renderHeaderField('PAN No:', <Input {...register('pan_no')} style={inputStyle} />)}
            {renderHeaderField('PF No:', <Input {...register('pf_no')} style={inputStyle} />)}
            {renderHeaderField('ESI No:', <Input {...register('esi_no')} style={inputStyle} />)}
            {renderHeaderField('License No:', <Input {...register('driving_license_no')} style={inputStyle} />)}
            {renderHeaderField('', (
              <div className="flex items-center space-x-2 mt-1">
                <Controller
                  control={control}
                  name="has_own_vehicle"
                  render={({ field }) => (
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} id="has_own_vehicle" />
                  )}
                />
                <label htmlFor="has_own_vehicle" className="text-xs">Has Own Vehicle</label>
              </div>
            ), true)}

            <div style={{ ...sectionHeaderStyle, marginTop: '20px' }}>Payroll</div>
            {renderHeaderField('Monthly Salary:', <Input type="number" {...register('monthly_salary')} style={inputStyle} />)}
            {renderHeaderField('', (
              <div className="flex items-center space-x-2 mt-1">
                <Controller
                  control={control}
                  name="withdraw_full_salary"
                  render={({ field }) => (
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} id="withdraw_full_salary" />
                  )}
                />
                <label htmlFor="withdraw_full_salary" className="text-xs">Withdraw Full Salary</label>
              </div>
            ), true)}

          </div>
        </div>
      </div>
      
      <div className="flex justify-end gap-2 pt-2">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => onSuccess()}
          style={{ padding: '6px 14px', height: 'auto', fontSize: '12px' }}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isSubmitting}
          style={{ padding: '6px 14px', height: 'auto', fontSize: '12px', background: '#185FA5' }}
        >
          {isSubmitting ? 'Saving...' : 'Save Employee'}
        </Button>
      </div>
    </form>
  )
}
