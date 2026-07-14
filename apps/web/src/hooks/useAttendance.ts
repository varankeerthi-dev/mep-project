import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'sonner'

export interface AttendancePlan {
  id: string
  organisation_id: string
  employee_id: string
  plan_date: string
  planned_site_id?: string
  actual_site_id?: string
  source: 'manual_plan' | 'inherited_site_visit' | 'default_continuous' | 'inherited_leave'
  status: 'planned' | 'checked_in' | 'absent'
  shift_type?: 'Day' | 'Night' | 'DN'
  in_time?: string
  out_time?: string
  remarks?: string
  check_in_payload?: any
  updated_by?: string
  employee?: any
  planned_site?: any
  actual_site?: any
}

export function useAttendancePlan(planDate: string) {
  const { organisation } = useAuth()

  return useQuery({
    queryKey: ['attendance-plan', planDate, organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return []

      const { data, error } = await supabase
        .from('attendance')
        .select(`
          *,
          employee:employees(*),
          planned_site:sites!attendance_planned_site_id_fkey(*),
          actual_site:sites!attendance_actual_site_id_fkey(*)
        `)
        .eq('organisation_id', organisation.id)
        .eq('plan_date', planDate)
      
      if (error) throw error
      return (data || []) as AttendancePlan[]
    },
    enabled: !!organisation?.id && !!planDate
  })
}

export function useMutateAttendancePlan() {
  const queryClient = useQueryClient()
  const { organisation, user } = useAuth()

  return useMutation({
    mutationFn: async (plan: Partial<AttendancePlan>) => {
      if (!organisation?.id) throw new Error('No organisation selected')
      
      const payload = { 
        ...plan, 
        organisation_id: organisation.id,
        updated_by: user?.id
      }
      
      let query
      if (plan.id) {
        query = supabase.from('attendance').update(payload).eq('id', plan.id)
      } else {
        query = supabase.from('attendance').insert(payload)
      }

      const { data, error } = await query.select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-plan'] })
      queryClient.invalidateQueries({ queryKey: ['employee-attendance-summary'] })
      if (!variables.id) { // Only show toast on creation/major updates to avoid noise on drag drop
         toast.success('Attendance plan updated')
      }
    },
    onError: (error) => {
      toast.error('Failed to update attendance plan: ' + error.message)
    }
  })
}

export function useSites() {
  const { organisation } = useAuth()

  return useQuery({
    queryKey: ['sites', organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .eq('is_active', true)
        // Note: some sites might not have organisation_id if they are global or from old schema, 
        // but we'll try to fetch all active sites for this org or global ones. 
        // In this project schema, sites is currently RLS protected.
      
      if (error) throw error
      return data || []
    }
  })
}
