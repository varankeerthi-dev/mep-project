import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';

export function useTrialRestrictions() {
  const { user, selectedOrganisation } = useAuth();
  
  return useQuery({
    queryKey: ['trialRestrictions', selectedOrganisation?.id],
    queryFn: async () => {
      if (!selectedOrganisation?.id) return { hasTrial: false, daysRemaining: 0, canAccess: true };
      
      // Check if user has trial access
      const { data: org } = await fetch('/api/organisations/' + selectedOrganisation.id);
      
      if (!org?.is_trial) {
        return { hasTrial: false, daysRemaining: 0, canAccess: true };
      }
      
      // Calculate days remaining in trial
      const trialEndsAt = new Date(org.trial_ends_at || '');
      const now = new Date();
      const daysRemaining = Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      
      return {
        hasTrial: org.is_trial || false,
        daysRemaining,
        canAccess: daysRemaining > 0 || !org.is_trial
      };
    },
    enabled: !!selectedOrganisation?.id
  });
}
