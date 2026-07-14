import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'sonner'

export interface LeaveRequest {
  id: string
  organisation_id: string
  employee_id: string
  from_date: string
  to_date: string
  leave_type: string
  status: 'Pending' | 'Approved' | 'Rejected'
  created_at?: string
  updated_at?: string
}

export function useLeaveRequests(employeeId: string) {
  const { organisation } = useAuth()

  return useQuery({
    queryKey: ['leave-requests', employeeId, organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('organisation_id', organisation?.id)
        .order('from_date', { ascending: false })
      
      if (error) throw error
      return (data || []) as LeaveRequest[]
    },
    enabled: !!organisation?.id && !!employeeId
  })
}

export function useMutateLeaveRequest() {
  const queryClient = useQueryClient()
  const { organisation } = useAuth()

  return useMutation({
    mutationFn: async (leave: Partial<LeaveRequest>) => {
      if (!organisation?.id) throw new Error('No organisation selected')
      
      const payload = { 
        ...leave, 
        organisation_id: organisation.id,
        // Default to Approved as per PRD unless specified
        status: leave.status || 'Approved'
      }
      
      let query
      if (leave.id) {
        query = supabase.from('leave_requests').update(payload).eq('id', leave.id)
      } else {
        query = supabase.from('leave_requests').insert(payload)
      }

      const { data, error } = await query.select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] })
      queryClient.invalidateQueries({ queryKey: ['employee-attendance-summary'] })
      toast.success('Leave request saved successfully')
    },
    onError: (error) => {
      toast.error('Failed to save leave request: ' + error.message)
    }
  })
}
