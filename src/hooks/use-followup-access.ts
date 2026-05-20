import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

const MANAGE_ROLES = new Set(['admin', 'owner', 'manager']);

/**
 * Phase 10 RBAC: org role gate for follow-up write actions.
 * Fine-grained follow_up.manage permission can be wired when RBAC API is live.
 */
export function useFollowupAccess() {
  const { user, organisation, organisations } = useAuth();

  return useMemo(() => {
    const membership = organisations.find(
      (m) =>
        m.organisation_id === organisation?.id ||
        (m.organisation as { id?: string } | undefined)?.id === organisation?.id
    );
    const role = String(membership?.role || 'member').toLowerCase();
    const canManage = MANAGE_ROLES.has(role);
    return {
      role,
      canView: !!user && !!organisation?.id,
      canManage,
      isReadOnly: !canManage,
    };
  }, [user, organisation?.id, organisations]);
}
