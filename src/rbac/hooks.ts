import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PermissionKey } from './schemas';
import {
  approveAccessRequest,
  createAccessRequest,
  createRoleWithPermissions,
  listEmployees,
  listMyAccessRequests,
  listOrgAccessRequests,
  listPublicOrganisations,
  listRolePermissions,
  listRoles,
  rejectAccessRequest,
  replaceRolePermissions,
  upsertEmployee,
  type PublicOrganisation,
} from './api';
import type { EmployeeInput, OrgAccessRequestInput, RoleInput } from './schemas';

export function usePublicOrganisations() {
  return useQuery<PublicOrganisation[]>({
    queryKey: ['rbac', 'public-organisations'],
    queryFn: listPublicOrganisations,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useMyAccessRequests(userId?: string | null) {
  return useQuery({
    queryKey: ['rbac', 'my-access-requests', userId],
    queryFn: () => listMyAccessRequests(userId ?? ''),
    enabled: Boolean(userId),
    staleTime: 15 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: OrgAccessRequestInput) => createAccessRequest(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['rbac', 'my-access-requests', variables.user_id] });
    },
  });
}

export function useOrgAccessRequests(organisationId?: string | null) {
  return useQuery({
    queryKey: ['rbac', 'org-access-requests', organisationId],
    queryFn: () => listOrgAccessRequests(organisationId ?? ''),
    enabled: Boolean(organisationId),
    staleTime: 10 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useApproveAccessRequest(organisationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { requestId: string; roleId: string }) => approveAccessRequest(input.requestId, input.roleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rbac', 'org-access-requests', organisationId] });
    },
  });
}

export function useRejectAccessRequest(organisationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { requestId: string; note?: string | null }) => rejectAccessRequest(input.requestId, input.note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rbac', 'org-access-requests', organisationId] });
    },
  });
}

export function useEmployees(organisationId?: string | null) {
  return useQuery({
    queryKey: ['rbac', 'employees', organisationId],
    queryFn: () => listEmployees(organisationId ?? ''),
    enabled: Boolean(organisationId),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useUpsertEmployee(organisationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EmployeeInput) => upsertEmployee(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rbac', 'employees', organisationId] });
    },
  });
}

export function useRoles(organisationId?: string | null) {
  return useQuery({
    queryKey: ['rbac', 'roles', organisationId],
    queryFn: () => listRoles(organisationId ?? ''),
    enabled: Boolean(organisationId),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useRolePermissions(roleId?: string | null) {
  return useQuery<PermissionKey[]>({
    queryKey: ['rbac', 'role-permissions', roleId],
    queryFn: () => listRolePermissions(roleId ?? ''),
    enabled: Boolean(roleId),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateRole(organisationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { role: RoleInput; permissionKeys: PermissionKey[] }) =>
      createRoleWithPermissions(input.role, input.permissionKeys),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rbac', 'roles', organisationId] });
    },
  });
}

export function useReplaceRolePermissions(organisationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { roleId: string; permissionKeys: PermissionKey[] }) =>
      replaceRolePermissions(input.roleId, input.permissionKeys),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['rbac', 'role-permissions', variables.roleId] });
      qc.invalidateQueries({ queryKey: ['rbac', 'roles', organisationId] });
    },
  });
}

export function useHasPermission(permissionKey: PermissionKey | PermissionKey[]) {
  const { user, organisations, selectedOrganisation } = useAuth();
  const qc = useQueryClient();

  return useQuery({
    queryKey: ['rbac', 'has-permission', user?.id, selectedOrganisation?.id, permissionKey],
    queryFn: async () => {
      if (!user?.id || !selectedOrganisation?.id) return false;
      const { hasPermission } = await import('./api');
      const keys = Array.isArray(permissionKey) ? permissionKey : [permissionKey];
      const results = await Promise.all(
        keys.map(key => hasPermission(user.id, selectedOrganisation.id, key))
      );
      return Array.isArray(permissionKey) ? results : results[0];
    },
    enabled: !!user?.id && !!selectedOrganisation?.id,
    staleTime: 5 * 60 * 1000,
  });
}

