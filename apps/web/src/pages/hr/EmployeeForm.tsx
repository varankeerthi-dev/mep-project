import React, { useState, useEffect, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'
import { useMutateEmployee } from '../../hooks/useEmployees'
import { Checkbox } from '@/components/ui/checkbox'
import { X } from 'lucide-react'

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
  min_daily_hours: z.coerce.number().min(0, 'Must be positive').max(24, 'Cannot exceed 24 hours').optional(),
  permission_hours: z.coerce.number().min(0, 'Must be positive').max(24, 'Cannot exceed 24 hours').optional(),
  hide_in_attendance: z.boolean().optional(),
  include_in_salary: z.boolean().optional(),
  include_in_task: z.boolean().optional(),
  
  mobile_no: z.string().regex(/^\d*$/, 'Must be numbers only').optional(),
  office_no: z.string().regex(/^\d*$/, 'Must be numbers only').optional(),
  personal_no: z.string().regex(/^\d*$/, 'Must be numbers only').optional(),
  emergency_contact: z.string().regex(/^\d*$/, 'Must be numbers only').optional(),
  address: z.string().optional(),
  
  login_enabled: z.boolean().optional(),
  personal_email: z.string().email('Invalid email').optional().or(z.literal('')),
  work_email: z.string().email('Invalid email').optional().or(z.literal('')),
  login_email_type: z.string().optional(),
  role: z.string().optional(),
  
  aadhar_no: z.string().regex(/^\d{12}$/, 'Aadhar must be exactly 12 digits').optional().or(z.literal('')),
  pan_no: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format').optional().or(z.literal('')),
  pf_no: z.string().regex(/^[a-zA-Z0-9-]*$/, 'Invalid PF format').optional().or(z.literal('')),
  esi_no: z.string().regex(/^[a-zA-Z0-9-]*$/, 'Invalid ESI format').optional().or(z.literal('')),
  driving_license_no: z.string().regex(/^[a-zA-Z0-9-]*$/, 'Invalid License format').optional().or(z.literal('')),
  has_own_vehicle: z.boolean().optional(),
  
  monthly_salary: z.coerce.number().optional(),
  withdraw_full_salary: z.boolean().optional(),
  status: z.enum(['Active', 'Inactive', 'Rejoined']),
  deployment_mode: z.enum(['continuous', 'project']),
})

type EmployeeFormData = z.infer<typeof employeeSchema>

function SearchableDropdown({ options, value, onChange, placeholder = "Search..." }: { options: string[], value: string, onChange: (val: string) => void, placeholder?: string }) {
  const [searchText, setSearchText] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={containerRef} className="relative dropdown-container" style={{ width: '100%' }}>
      <Input
        value={isOpen ? searchText : (value || '')}
        onChange={e => { setSearchText(e.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        style={{ padding: '4px 8px', fontSize: '12px', height: '28px' }}
        autoComplete="off"
      />
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          zIndex: 50, background: 'white', border: '1px solid #d1d5db',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          maxHeight: '200px', overflowY: 'auto'
        }}>
          {options
            .filter(opt => !searchText || opt.toLowerCase().includes(searchText.toLowerCase()))
            .map(opt => (
              <div key={opt} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }}
                onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}
                onClick={() => { onChange(opt); setSearchText(''); setIsOpen(false); }}
              >{opt}</div>
            ))}
          {options.filter(opt => !searchText || opt.toLowerCase().includes(searchText.toLowerCase())).length === 0 && (
            <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>No items found</div>
          )}
        </div>
      )}
    </div>
  )
}

export function EmployeeForm({ onSuccess, employee }: { onSuccess: () => void; employee?: any }) {
  const mutateEmployee = useMutateEmployee()
  const isEditing = !!employee?.id

  const { register, handleSubmit, control, watch, reset, formState: { errors, isSubmitting } } = useForm<EmployeeFormData>({
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

  const DRAFT_KEY = 'employee_form_draft'
  
  useEffect(() => {
    if (isEditing && employee) {
      // Pre-fill from existing employee — skip draft restore
      reset({
        name: employee.name || employee.full_name || '',
        employee_code: employee.employee_code || '',
        designation: employee.designation || '',
        department: employee.department || '',
        dob: employee.date_of_birth || employee.dob || '',
        blood_group: employee.blood_group || '',
        marital_status: employee.marital_status || '',
        father_name: employee.father_name || '',
        mother_name: employee.mother_name || '',
        employment_type: employee.employment_type || 'Full-time',
        joined_date: employee.joined_date || '',
        mobile_no: employee.mobile_no || employee.phone || '',
        emergency_contact: employee.emergency_contact || '',
        personal_email: employee.personal_email || employee.email || '',
        status: employee.status || 'Active',
        include_in_salary: employee.include_in_salary ?? true,
        include_in_task: employee.include_in_task ?? true,
        hide_in_attendance: employee.hide_in_attendance ?? false,
        login_enabled: employee.login_enabled ?? false,
        withdraw_full_salary: employee.withdraw_full_salary ?? false,
        has_own_vehicle: employee.has_own_vehicle ?? false,
      })
      return
    }
    const savedDraft = sessionStorage.getItem(DRAFT_KEY)
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft)
        if (Object.keys(parsed).length > 0) {
          reset(parsed)
        }
      } catch (e) {
        console.error('Failed to parse draft', e)
      }
    }
  }, [reset, isEditing, employee])

  const formValues = watch()
  
  useEffect(() => {
    const timeout = setTimeout(() => {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(formValues))
    }, 500)
    return () => clearTimeout(timeout)
  }, [formValues])

  const registerNumeric = (name: keyof EmployeeFormData) => {
    const { onChange, ...rest } = register(name);
    return {
      ...rest,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        e.target.value = e.target.value.replace(/\D/g, '');
        onChange(e);
      }
    };
  };

  const registerAlphanumeric = (name: keyof EmployeeFormData, uppercase = false) => {
    const { onChange, ...rest } = register(name);
    return {
      ...rest,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/[^a-zA-Z0-9-]/g, '');
        if (uppercase) val = val.toUpperCase();
        e.target.value = val;
        onChange(e);
      }
    };
  };

  const onSubmit = async (data: EmployeeFormData) => {
    try {
      const payload = isEditing ? { ...data, id: employee.id } : data
      await mutateEmployee.mutateAsync(payload)
      if (!isEditing) sessionStorage.removeItem(DRAFT_KEY)
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
    <form onSubmit={handleSubmit(onSubmit)} className="relative flex flex-col h-full">
      <div className="absolute top-0 right-0 z-50 -mt-2 -mr-2">
        <Button variant="ghost" size="icon" onClick={() => onSuccess()} type="button" className="h-8 w-8 rounded-full">
          <X className="h-4 w-4 text-gray-500" />
        </Button>
      </div>

      <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '6px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          {/* Column 1 */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={sectionHeaderStyle}>Basic Info</div>
            {renderHeaderField('Name:', <Input {...register('name')} style={inputStyle} />, false, errors.name?.message)}
            {renderHeaderField('Emp Code:', <Input {...register('employee_code')} style={inputStyle} />, false, errors.employee_code?.message)}
            {renderHeaderField('Designation:', <Input {...register('designation')} style={inputStyle} />, false, errors.designation?.message)}
            {renderHeaderField('Department:', <Input {...register('department')} style={inputStyle} />, false, errors.department?.message)}
            {renderHeaderField('Date of Birth:', <Input type="date" {...register('dob')} style={inputStyle} />, false, errors.dob?.message)}
            {renderHeaderField('Blood Group:', (
              <Controller
                control={control}
                name="blood_group"
                render={({ field }) => (
                  <SearchableDropdown 
                    options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']} 
                    value={field.value || ''} 
                    onChange={field.onChange} 
                  />
                )}
              />
            ), false, errors.blood_group?.message)}
            {renderHeaderField('Marital Status:', (
              <Controller
                control={control}
                name="marital_status"
                render={({ field }) => (
                  <SearchableDropdown 
                    options={['Single', 'Married']} 
                    value={field.value || ''} 
                    onChange={field.onChange} 
                  />
                )}
              />
            ), false, errors.marital_status?.message)}
            {renderHeaderField('Father Name:', <Input {...register('father_name')} style={inputStyle} />, false, errors.father_name?.message)}
            {renderHeaderField('Mother Name:', <Input {...register('mother_name')} style={inputStyle} />, true, errors.mother_name?.message)}

            <div style={{ ...sectionHeaderStyle, marginTop: '20px' }}>Work & Attendance</div>
            {renderHeaderField('Status:', (
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <SearchableDropdown 
                    options={['Active', 'Inactive', 'Rejoined']} 
                    value={field.value || ''} 
                    onChange={field.onChange} 
                  />
                )}
              />
            ), false, errors.status?.message)}
            {renderHeaderField('Employ Type:', <Input {...register('employment_type')} style={inputStyle} />, false, errors.employment_type?.message)}
            {renderHeaderField('Joined Date:', <Input type="date" {...register('joined_date')} style={inputStyle} />, false, errors.joined_date?.message)}
            {renderHeaderField('Shift ID:', <Input {...register('shift_id')} style={inputStyle} />, false, errors.shift_id?.message)}
            {renderHeaderField('Min Hours:', <Input type="number" step="0.1" {...register('min_daily_hours')} style={inputStyle} />, false, errors.min_daily_hours?.message)}
            {renderHeaderField('Permission Hrs:', <Input type="number" step="0.1" {...register('permission_hours')} style={inputStyle} />, false, errors.permission_hours?.message)}
            
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
            {renderHeaderField('Mobile No:', <Input {...registerNumeric('mobile_no')} style={inputStyle} />, false, errors.mobile_no?.message)}
            {renderHeaderField('Office No:', <Input {...registerNumeric('office_no')} style={inputStyle} />, false, errors.office_no?.message)}
            {renderHeaderField('Personal No:', <Input {...registerNumeric('personal_no')} style={inputStyle} />, false, errors.personal_no?.message)}
            {renderHeaderField('Emergency:', <Input {...registerNumeric('emergency_contact')} style={inputStyle} />, false, errors.emergency_contact?.message)}
            {renderHeaderField('Address:', <Input {...register('address')} style={inputStyle} />, true, errors.address?.message)}

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
            {renderHeaderField('Personal Email:', <Input type="email" {...register('personal_email')} style={inputStyle} />, false, errors.personal_email?.message)}
            {renderHeaderField('Work Email:', <Input type="email" {...register('work_email')} style={inputStyle} />, false, errors.work_email?.message)}
            {renderHeaderField('Login Email:', (
              <Controller
                control={control}
                name="login_email_type"
                render={({ field }) => (
                  <SearchableDropdown 
                    options={['work', 'personal']} 
                    value={field.value || ''} 
                    onChange={field.onChange} 
                  />
                )}
              />
            ), false, errors.login_email_type?.message)}
            {renderHeaderField('System Role:', <Input {...register('role')} style={inputStyle} />, true, errors.role?.message)}

            <div style={{ ...sectionHeaderStyle, marginTop: '20px' }}>Identity / KYC</div>
            {renderHeaderField('Aadhar No:', <Input {...registerNumeric('aadhar_no')} maxLength={12} style={inputStyle} />, false, errors.aadhar_no?.message)}
            {renderHeaderField('PAN No:', <Input {...registerAlphanumeric('pan_no', true)} maxLength={10} style={inputStyle} />, false, errors.pan_no?.message)}
            {renderHeaderField('PF No:', <Input {...registerAlphanumeric('pf_no', true)} style={inputStyle} />, false, errors.pf_no?.message)}
            {renderHeaderField('ESI No:', <Input {...registerAlphanumeric('esi_no', true)} style={inputStyle} />, false, errors.esi_no?.message)}
            {renderHeaderField('License No:', <Input {...registerAlphanumeric('driving_license_no', true)} style={inputStyle} />, false, errors.driving_license_no?.message)}
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
            {renderHeaderField('Monthly Salary:', <Input type="number" {...register('monthly_salary')} style={inputStyle} />, false, errors.monthly_salary?.message)}
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
      
      <div 
        className="flex justify-end gap-2 bg-white border-t z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
        style={{ position: 'sticky', bottom: '-24px', margin: '16px -24px -24px -24px', padding: '16px 24px' }}
      >
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
