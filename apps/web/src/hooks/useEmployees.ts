import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'sonner'

export interface Employee {
  id: string
  organisation_id: string
  name: string
  employee_code?: string
  designation?: string
  department?: string
  dob?: string
  blood_group?: string
  marital_status?: string
  father_name?: string
  mother_name?: string
  
  // Work Settings
  employment_type?: string
  joined_date?: string
  shift_id?: string
  min_daily_hours?: number
  reporting_manager_id?: string
  permission_hours?: number
  hide_in_attendance?: boolean
  include_in_salary?: boolean
  include_in_task?: boolean
  
  // Contact
  phone?: string
  mobile_no?: string
  office_no?: string
  personal_no?: string
  emergency_contact?: string
  address?: string
  email?: string
  personal_email?: string
  work_email?: string
  login_email_type?: string
  
  // Identity & Status
  status: 'Active' | 'Inactive' | 'Rejoined'
  deployment_mode: 'continuous' | 'project'
  default_site_id?: string
  login_enabled?: boolean
  role?: string
  
  // KYC
  aadhar_no?: string
  pan_no?: string
  pf_no?: string
  esi_no?: string
  driving_license_no?: string
  has_own_vehicle?: boolean
  
  // Payroll
  monthly_salary?: number
  withdraw_full_salary?: boolean
  personal_bank?: {
    accountNo?: string
    ifsc?: string
    bankName?: string
    holderName?: string
  }
  company_bank?: {
    accountNo?: string
    ifsc?: string
    bankName?: string
    holderName?: string
  }

  created_at?: string
  updated_at?: string
}

export function useEmployees() {
  const { organisation } = useAuth()

  return useQuery({
    queryKey: ['employees', organisation?.id],
    queryFn: async () => {
      let query = supabase
        .from('employees')
        .select('*, default_site:sites(site_name)')
      
      if (organisation?.id) {
        query = query.eq('organisation_id', organisation?.id)
      }

      const { data, error } = await query.order('name', { ascending: true })
      
      if (error) throw error
      return (data || []) as Employee[]
    },
    enabled: !!organisation?.id
  })
}

export function useEmployee(employeeId: string) {
  const { organisation } = useAuth()

  return useQuery({
    queryKey: ['employee', employeeId, organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*, default_site:sites(*)')
        .eq('id', employeeId)
        .eq('organisation_id', organisation?.id)
        .single()
      
      if (error) throw error
      return data as Employee
    },
    enabled: !!organisation?.id && !!employeeId
  })
}

export function useEmployeeAttendanceSummary(employeeId: string, year: number, month: number) {
  const { organisation } = useAuth()

  return useQuery({
    queryKey: ['employee-attendance-summary', employeeId, year, month, organisation?.id],
    queryFn: async () => {
      // Create start and end date for the month
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0]
      const endDate = new Date(year, month, 0).toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('organisation_id', organisation?.id)
        .gte('plan_date', startDate)
        .lte('plan_date', endDate)

      if (error) throw error

      let present = 0
      let absent = 0
      let halfDay = 0
      let late = 0 // late needs actual in_time logic, skipping for now
      let otHours = 0

      data?.forEach(record => {
        if (record.status === 'checked_in' || (record.in_time && record.out_time)) {
          // If shift is DN, might count differently, but assume standard day is present
          if (record.shift_type === 'DN') {
            present += 1 // or 1.5/2 depending on rules
          } else {
            present += 1
          }

          // OT logic (simplified)
          if (record.in_time && record.out_time) {
            const [inH, inM] = record.in_time.split(':').map(Number)
            const [outH, outM] = record.out_time.split(':').map(Number)
            const hours = (outH + outM/60) - (inH + inM/60)
            if (hours > 9) { // assuming 9 hours is standard shift
              otHours += (hours - 9)
            }
          }
        } else if (record.status === 'absent') {
          absent += 1
        }
      })

      return { present, absent, halfDay, late, otHours, records: data }
    },
    enabled: !!organisation?.id && !!employeeId
  })
}

export function useMutateEmployee() {
  const queryClient = useQueryClient()
  const { organisation } = useAuth()

  return useMutation({
    mutationFn: async (employee: Partial<Employee>) => {
      if (!organisation?.id) throw new Error('No organisation selected')
      
      const payload = { ...employee, organisation_id: organisation.id }
      
      let query
      if (employee.id) {
        query = supabase.from('employees').update(payload).eq('id', employee.id)
      } else {
        query = supabase.from('employees').insert(payload)
      }

      const { data, error } = await query.select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Employee saved successfully')
    },
    onError: (error) => {
      toast.error('Failed to save employee: ' + error.message)
    }
  })
}
