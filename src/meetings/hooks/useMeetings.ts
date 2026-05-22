import { useCallback, useMemo } from 'react';
import {
  getMeetings,
  getMeetingById,
  createMeeting,
  updateMeeting,
  archiveMeeting,
  restoreMeeting,
  deleteMeeting,
  duplicateMeeting,
  getMeetingStats,
  searchClients,
  searchProjects,
  getMeetingTemplates,
  createMeetingFromTemplate,
  createRecurringMeetings,
  getMeetingActionItems,
  getMeetingAttachments,
  getMeetingMinutesItems,
  getMeetingAttendees,
  saveMeetingMinutesItems,
  saveMeetingAttendees,
  saveMeetingActionItems,
  saveMeetingAttachments,
  uploadMeetingAttachment,
  deleteMeetingAttachment,
  finalizeMinutes,
  reopenMinutes,
  syncActionItemsWithTasks,
  updateActionItemStatus,
  exportMinutesToPDF,
} from '../api/meetings';
import type {
  Meeting,
  MeetingFilter,
  CreateMeetingInput,
  UpdateMeetingInput,
  MeetingMinutesItem,
  MeetingAttendee,
  MeetingActionItem,
  MeetingAttachment,
  Client,
  Project,
  MeetingStats,
  MeetingFormData,
  LocalMinutesItem,
  LocalAttendee,
  LocalActionItem,
  ActionItemStatus,
  MeetingTemplate,
} from '../types';
import { useAuth } from '../../App';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Query keys for cache management
export const meetingKeys = {
  all: ['meetings'] as const,
  lists: () => [...meetingKeys.all, 'list'] as const,
  list: (filters: MeetingFilter) => [...meetingKeys.lists(), filters] as const,
  details: () => [...meetingKeys.all, 'detail'] as const,
  detail: (id: string) => [...meetingKeys.details(), id] as const,
  stats: (orgId: string) => [...meetingKeys.all, 'stats', orgId] as const,
  templates: (orgId: string) => [...meetingKeys.all, 'templates', orgId] as const,
  attachments: (meetingId: string) => [...meetingKeys.all, 'attachments', meetingId] as const,
  actionItems: (meetingId: string) => [...meetingKeys.all, 'action-items', meetingId] as const,
};

// Fetch all meetings for organisation
export function useMeetings(filters?: MeetingFilter) {
  const { organisation } = useAuth();
  
  return useQuery({
    queryKey: meetingKeys.list(filters || {}),
    queryFn: () => {
      if (!organisation?.id) throw new Error('No organisation');
      return getMeetings(organisation.id, filters);
    },
    enabled: !!organisation?.id,
  });
}

// Fetch single meeting
export function useMeeting(meetingId: string) {
  return useQuery({
    queryKey: meetingKeys.detail(meetingId),
    queryFn: () => getMeetingById(meetingId),
    enabled: !!meetingId,
  });
}

// Fetch meeting stats
export function useMeetingStats() {
  const { organisation } = useAuth();
  
  return useQuery({
    queryKey: meetingKeys.stats(organisation?.id || ''),
    queryFn: () => {
      if (!organisation?.id) throw new Error('No organisation');
      return getMeetingStats(organisation.id);
    },
    enabled: !!organisation?.id,
  });
}

// Fetch meeting templates
export function useMeetingTemplates() {
  const { organisation } = useAuth();
  
  return useQuery({
    queryKey: meetingKeys.templates(organisation?.id || ''),
    queryFn: () => {
      if (!organisation?.id) throw new Error('No organisation');
      return getMeetingTemplates(organisation.id);
    },
    enabled: !!organisation?.id,
  });
}

// Create meeting mutation
export function useCreateMeeting() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateMeetingInput) => {
      return createMeeting(input);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: meetingKeys.lists() });
      queryClient.setQueryData(meetingKeys.detail(data.id), data);
      toast.success('Meeting created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create meeting: ${error.message}`);
    },
  });
}

// Update meeting mutation
export function useUpdateMeeting() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ meetingId, updates }: { meetingId: string; updates: UpdateMeetingInput }) => {
      return updateMeeting(meetingId, updates);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(meetingKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: meetingKeys.lists() });
      toast.success('Meeting updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update meeting: ${error.message}`);
    },
  });
}

// Archive meeting mutation
export function useArchiveMeeting() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: archiveMeeting,
    onSuccess: (data) => {
      queryClient.setQueryData(meetingKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: meetingKeys.lists() });
      toast.success('Meeting archived');
    },
    onError: (error: Error) => {
      toast.error(`Failed to archive meeting: ${error.message}`);
    },
  });
}

// Restore meeting mutation
export function useRestoreMeeting() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: restoreMeeting,
    onSuccess: (data) => {
      queryClient.setQueryData(meetingKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: meetingKeys.lists() });
      toast.success('Meeting restored');
    },
    onError: (error: Error) => {
      toast.error(`Failed to restore meeting: ${error.message}`);
    },
  });
}

// Delete meeting mutation
export function useDeleteMeeting() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteMeeting,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meetingKeys.lists() });
      toast.success('Meeting deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete meeting: ${error.message}`);
    },
  });
}

// Duplicate meeting mutation
export function useDuplicateMeeting() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ meetingId, newDate }: { meetingId: string; newDate?: string }) => {
      return duplicateMeeting(meetingId, newDate);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: meetingKeys.lists() });
      queryClient.setQueryData(meetingKeys.detail(data.id), data);
      toast.success('Meeting duplicated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to duplicate meeting: ${error.message}`);
    },
  });
}

// Finalize minutes mutation
export function useFinalizeMinutes() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ meetingId, userId }: { meetingId: string; userId: string }) => {
      return finalizeMinutes(meetingId, userId);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(meetingKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: meetingKeys.lists() });
      toast.success('Minutes finalized successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to finalize minutes: ${error.message}`);
    },
  });
}

// Reopen minutes mutation
export function useReopenMinutes() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (meetingId: string) => {
      return reopenMinutes(meetingId);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(meetingKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: meetingKeys.lists() });
      toast.success('Minutes reopened for editing');
    },
    onError: (error: Error) => {
      toast.error(`Failed to reopen minutes: ${error.message}`);
    },
  });
}

// Sync action items with tasks
export function useSyncActionItems() {
  return useMutation({
    mutationFn: syncActionItemsWithTasks,
    onError: (error: Error) => {
      toast.warning(`Some action items could not be synced: ${error.message}`);
    },
  });
}

// Update action item status
export function useUpdateActionItemStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ actionItemId, status }: { actionItemId: string; status: ActionItemStatus }) => {
      return updateActionItemStatus(actionItemId, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings', 'action-items'] });
    },
  });
}

// Create recurring meetings
export function useCreateRecurringMeetings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ baseMeeting, recurrence }: { baseMeeting: CreateMeetingInput; recurrence: { frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly'; count: number; endDate?: string } }) => {
      return createRecurringMeetings(baseMeeting, recurrence);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meetingKeys.lists() });
      toast.success('Recurring meetings created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create recurring meetings: ${error.message}`);
    },
  });
}

// Create from template
export function useCreateFromTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ templateId, meetingDate }: { templateId: string; meetingDate: string }) => {
      const { organisation } = useAuth();
      if (!organisation?.id) throw new Error('No organisation');
      return createMeetingFromTemplate(templateId, organisation.id, meetingDate);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: meetingKeys.lists() });
      queryClient.setQueryData(meetingKeys.detail(data.id), data);
      toast.success('Meeting created from template');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create meeting from template: ${error.message}`);
    },
  });
}

// Export minutes to PDF
export function useExportMinutesPDF() {
  return useMutation({
    mutationFn: exportMinutesToPDF,
    onSuccess: () => {
      toast.success('PDF exported successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to export PDF: ${error.message}`);
    },
  });
}

// Search clients hook
export function useSearchClients(search: string) {
  const { organisation } = useAuth();
  
  return useQuery({
    queryKey: ['clients', 'search', search],
    queryFn: () => {
      if (!organisation?.id) return [];
      return searchClients(organisation.id, search || '');
    },
    enabled: !!organisation?.id,
    staleTime: 30000,
  });
}

// Search projects hook
export function useSearchProjects(search: string) {
  const { organisation } = useAuth();
  
  return useQuery({
    queryKey: ['projects', 'search', search],
    queryFn: () => {
      if (!organisation?.id) return [];
      return searchProjects(organisation.id, search || '');
    },
    enabled: !!organisation?.id,
    staleTime: 30000,
  });
}

// Hook for managing meeting relations (minutes, attendees, attachments)
export function useMeetingRelations(meetingId: string) {
  const queryClient = useQueryClient();
  
  const minutesItems = useQuery({
    queryKey: [...meetingKeys.all, 'minutes', meetingId],
    queryFn: () => getMeetingMinutesItems(meetingId),
    enabled: !!meetingId,
  });
  
  const attendees = useQuery({
    queryKey: [...meetingKeys.all, 'attendees', meetingId],
    queryFn: () => getMeetingAttendees(meetingId),
    enabled: !!meetingId,
  });
  
  const actionItems = useQuery({
    queryKey: meetingKeys.actionItems(meetingId),
    queryFn: () => getMeetingActionItems(meetingId),
    enabled: !!meetingId,
  });
  
  const attachments = useQuery({
    queryKey: meetingKeys.attachments(meetingId),
    queryFn: () => getMeetingAttachments(meetingId),
    enabled: !!meetingId,
  });
  
  return {
    minutesItems,
    attendees,
    actionItems,
    attachments,
  };
}

// Save minutes mutation
export function useSaveMinutes() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ meetingId, items }: { meetingId: string; items: MeetingMinutesItem[] }) => {
      await saveMeetingMinutesItems(meetingId, items);
    },
    onSuccess: (_, { meetingId }) => {
      queryClient.invalidateQueries({ queryKey: [...meetingKeys.all, 'minutes', meetingId] });
    },
  });
}

// Save attendees mutation
export function useSaveAttendees() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ meetingId, attendees }: { meetingId: string; attendees: MeetingAttendee[] }) => {
      await saveMeetingAttendees(meetingId, attendees);
    },
    onSuccess: (_, { meetingId }) => {
      queryClient.invalidateQueries({ queryKey: [...meetingKeys.all, 'attendees', meetingId] });
    },
  });
}

// Save action items mutation
export function useSaveActionItems() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ meetingId, items }: { meetingId: string; items: MeetingActionItem[] }) => {
      await saveMeetingActionItems(meetingId, items);
    },
    onSuccess: (_, { meetingId }) => {
      queryClient.invalidateQueries({ queryKey: meetingKeys.actionItems(meetingId) });
    },
  });
}

// Upload attachment mutation
export function useUploadAttachment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ meetingId, file, userId }: { meetingId: string; file: File; userId: string }) => {
      return uploadMeetingAttachment(meetingId, file, userId);
    },
    onSuccess: (_, { meetingId }) => {
      queryClient.invalidateQueries({ queryKey: meetingKeys.attachments(meetingId) });
      toast.success('File uploaded successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload file: ${error.message}`);
    },
  });
}

// Delete attachment mutation
export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteMeetingAttachment,
    onSuccess: () => {
      toast.success('Attachment deleted');
    },
  });
}

// Custom hook for form validation and submission
export function useMeetingForm(onSuccess?: (meeting: Meeting) => void) {
  const createMeetingMutation = useCreateMeeting();
  const updateMeetingMutation = useUpdateMeeting();
  
  const validateForm = useCallback((data: MeetingFormData): string | null => {
    if (!data.client_name.trim()) {
      return 'Client name is required';
    }
    if (!data.meeting_date) {
      return 'Meeting date is required';
    }
    const meetingDate = new Date(data.meeting_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (meetingDate < today) {
      return 'Meeting date cannot be in the past';
    }
    return null;
  }, []);
  
  const submitForm = useCallback(async (
    data: MeetingFormData,
    isEditMode: boolean,
    meetingId?: string
  ) => {
    const validationError = validateForm(data);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    
    const { organisation } = useAuth();
    if (!organisation?.id) {
      toast.error('No organisation found');
      return;
    }
    
    try {
      if (isEditMode && meetingId) {
        const updates: UpdateMeetingInput = {
          client_name: data.client_name,
          vendor_name: data.vendor_name,
          project_id: data.project_id || undefined,
          meeting_date: data.meeting_date,
          meeting_time: data.meeting_time || undefined,
          duration_minutes: data.duration_minutes || undefined,
          location: data.location || undefined,
          location_type: data.location_type || undefined,
          meeting_link: data.meeting_link || undefined,
          description: data.description || undefined,
          meeting_type: data.meeting_type,
          tags: data.tags,
          is_site_visit_meeting: data.is_site_visit_meeting,
          site_visit_id: data.site_visit_id || undefined,
        };
        
        const result = await updateMeetingMutation.mutateAsync({ meetingId, updates });
        onSuccess?.(result);
      } else {
        const input: CreateMeetingInput = {
          organisation_id: organisation.id,
          client_name: data.client_name,
          vendor_name: data.vendor_name,
          project_id: data.project_id || undefined,
          meeting_date: data.meeting_date,
          meeting_time: data.meeting_time || undefined,
          duration_minutes: data.duration_minutes || undefined,
          location: data.location || undefined,
          location_type: data.location_type || undefined,
          meeting_link: data.meeting_link || undefined,
          description: data.description || undefined,
          meeting_type: data.meeting_type,
          tags: data.tags,
          is_site_visit_meeting: data.is_site_visit_meeting,
          site_visit_id: data.site_visit_id || undefined,
          status: 'upcoming',
          minutes_status: 'pending',
        };
        
        const result = await createMeetingMutation.mutateAsync(input);
        onSuccess?.(result);
      }
    } catch (error) {
      // Error handled by mutation
    }
  }, [validateForm, createMeetingMutation, updateMeetingMutation, onSuccess]);
  
  return {
    submitForm,
    isSubmitting: createMeetingMutation.isPending || updateMeetingMutation.isPending,
    validateForm,
  };
}

// Filter hook with memoization
export function useMeetingFilters() {
  const [filters, setFilters] = useState<MeetingFilter>({});
  
  const updateFilter = useCallback(<K extends keyof MeetingFilter>(
    key: K,
    value: MeetingFilter[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);
  
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);
  
  return {
    filters,
    updateFilter,
    clearFilters,
  };
}

// Optimistic update helpers
export function useOptimisticMeeting(onMutate?: () => void) {
  const queryClient = useQueryClient();
  
  const getOptimisticUpdate = useCallback((
    meetingId: string,
    updates: Partial<Meeting>
  ) => {
    const previousMeeting = queryClient.getQueryData(meetingKeys.detail(meetingId));
    
    // Optimistically update the cache
    queryClient.setQueryData(meetingKeys.detail(meetingId), (old: Meeting | undefined) => {
      if (!old) return old;
      return { ...old, ...updates };
    });
    
    return { previousMeeting };
  }, [queryClient]);
  
  const rollback = useCallback((
    meetingId: string,
    previousMeeting: Meeting | undefined
  ) => {
    if (previousMeeting) {
      queryClient.setQueryData(meetingKeys.detail(meetingId), previousMeeting);
    }
  }, [queryClient]);
  
  return { getOptimisticUpdate, rollback };
}

// Import useState
import { useState } from 'react';