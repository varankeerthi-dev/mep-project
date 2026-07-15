import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'sonner'

export function useOrganisationSettings() {
  const { organisation } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['organisation-settings', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return null
      
      const { data, error } = await supabase
        .from('organisations')
        .select('settings')
        .eq('id', organisation.id)
        .single()
        
      // If 'settings' column doesn't exist yet (42703), return empty object gracefully
      if (error) {
        if (error.code === 'PGRST204' || error.code === '42703' || error.message?.includes('settings')) {
          return {}
        }
        throw error
      }
      return data?.settings || {}
    },
    enabled: !!organisation?.id,
    retry: false, // Don't retry column-not-found errors
  })

  const mutation = useMutation({
    mutationFn: async (newSettings: any) => {
      if (!organisation?.id) throw new Error('No organisation selected')
      
      // Merge with existing settings
      const currentSettings = query.data || {}
      const mergedSettings = { ...currentSettings, ...newSettings }
      
      const { error } = await supabase
        .from('organisations')
        .update({ settings: mergedSettings })
        .eq('id', organisation.id)
        
      if (error) throw error
      return mergedSettings
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organisation-settings'] })
      toast.success('Organisation settings saved successfully')
    },
    onError: (error) => {
      toast.error('Failed to save settings: ' + error.message)
    }
  })

  return {
    settings: query.data || {},
    isLoading: query.isLoading,
    updateSettings: mutation.mutateAsync,
    isUpdating: mutation.isPending
  }
}
