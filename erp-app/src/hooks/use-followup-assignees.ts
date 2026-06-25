import { useQuery } from '@tanstack/react-query';
import { getOrganisationMembers } from '../supabase';
import { useAuth } from '../contexts/AuthContext';

export type FollowUpAssigneeOption = {
  userId: string;
  label: string;
  email?: string;
  role?: string;
};

export function useFollowupAssignees() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  return useQuery({
    queryKey: ['follow-up', 'assignees', orgId],
    queryFn: async (): Promise<FollowUpAssigneeOption[]> => {
      if (!orgId) return [];
      const { data, error } = await getOrganisationMembers(orgId);
      if (error) throw error;

      return (data || []).map((m) => {
        const profile = (m as { user?: { full_name?: string; email?: string } }).user;
        const userId = String(m.user_id || '');
        return {
          userId,
          label: profile?.full_name || profile?.email || userId.slice(0, 8) || 'Member',
          email: profile?.email,
          role: m.role,
        };
      });
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}

export function resolveAssigneeLabel(
  assignees: FollowUpAssigneeOption[],
  assigneeUserId?: string | null,
  fallbackName?: string | null
): string {
  if (!assigneeUserId) return fallbackName || 'Unassigned';
  const found = assignees.find((a) => a.userId === assigneeUserId);
  return found?.label || fallbackName || 'Assigned';
}
