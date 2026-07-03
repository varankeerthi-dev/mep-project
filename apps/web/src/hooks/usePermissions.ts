import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';

export type Permission = {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  conditions?: string[];
};

export type RolePermissions = {
  [roleId: string]: Permission[];
};

export function usePermissions(organisationId?: string) {
  const { user, organisations, selectedOrganisation } = useAuth();
  
  return useQuery({
    queryKey: ['permissions', selectedOrganisation?.id],
    queryFn: async () => {
      if (!selectedOrganisation?.id) return { permissions: [], roles: {} };
      
      // Get user's role in current organization
      const userOrg = organisations.find(org => org.organisation_id === selectedOrganisation?.id);
      const userRole = userOrg?.role || 'member';
      
      // Get role-based permissions
      const { data: roleData } = await fetch('/api/permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: userRole })
      });
      
      if (!roleData?.permissions) return { permissions: [], roles: {} };
      
      return {
        permissions: roleData.permissions,
        roles: roleData.roles
      };
    },
    enabled: !!selectedOrganisation?.id
  });
}

export const useUserPermissions = (resource: string, action: string) => {
  const { permissions } = usePermissions();
  
  return permissions.permissions.some(permission => 
    permission.resource === resource && 
    permission.actions.includes(action) &&
    (!permission.conditions || permission.conditions.every(condition => 
      evaluateCondition(condition, { user, organisations, selectedOrganisation })
    ))
  );
};

function evaluateCondition(condition: string, context: { user: any; organisations: any[]; selectedOrganisation: any }) {
  // Simple condition evaluator - can be extended for complex conditions
  switch (condition) {
    case 'is_admin':
      return context.user?.role === 'admin';
    case 'is_manager':
      return context.user?.role === 'manager';
    case 'is_owner':
      const userOrg = context.organisations.find(org => 
        org.organisation_id === context.selectedOrganisation?.id
      );
      return userOrg?.role === 'admin' || userOrg?.role === 'owner';
    case 'is_self':
      return context.user?.id && context.organisations.some(org => 
        org.organisation_id === context.selectedOrganisation?.id && 
        org.user_id === context.user?.id
      );
    default:
      return false;
  }
}
