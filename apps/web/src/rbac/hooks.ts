import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PermissionKey } from './schemas';
import {
  approveAccessRequest,
  assignEmployeeRoleRpc,
  createAccessRequest,
  createRoleWithPermissions,
  createRoleRpc,
  deleteRoleRpc,
  getRolePermissionDiff,
  listEmployees,
  listModuleCatalog,
  listMyAccessRequests,
  listMyPermissions,
  listMyPermissionsRpc,
  listOrgAccessRequests,
  listPublicOrganisations,
  listRoleFieldPermissions,
  listRoleMemberCounts,
  listRolePermissions,
  listRoles,
  listSensitiveFields,
  rejectAccessRequest,
  replaceRolePermissions,
  saveRolePermissionsRpc,
  setRoleActiveRpc,
  updateRoleRpc,
  upsertEmployee,
  type PublicOrganisation,
} from './api';
import type { EmployeeInput, OrgAccessRequestInput, RoleInput } from './schemas';
import { useAuth } from '../contexts/AuthContext';

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

export function useMyPermissions(userId?: string | null, organisationId?: string | null) {
  return useQuery({
    queryKey: ['rbac', 'my-permissions', userId, organisationId],
    queryFn: () => listMyPermissions(userId ?? '', organisationId ?? ''),
    enabled: Boolean(userId && organisationId),
    staleTime: 5 * 60 * 1000,
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

import { useMemo } from 'react';

export function usePermissions() {
  const { user, organisation, selectedOrganisation } = useAuth();
  const orgId = organisation?.id || selectedOrganisation?.id || null;
  const { data: permissions = [], isLoading, error } = useMyPermissions(user?.id, orgId);

  const isAdmin = useMemo(() => {
    return permissions.includes('admin_all_access' as any);
  }, [permissions]);

  const permissionSet = useMemo(() => {
    return new Set<string>(permissions);
  }, [permissions]);

  const hasPermission = useMemo(() => {
    return (key: PermissionKey): boolean => {
      if (isAdmin) return true;
      return permissionSet.has(key);
    };
  }, [isAdmin, permissionSet]);

  const hasAnyPermission = useMemo(() => {
    return (keys: PermissionKey[]): boolean => {
      if (isAdmin) return true;
      return keys.some(key => permissionSet.has(key));
    };
  }, [isAdmin, permissionSet]);

  const hasAllPermissions = useMemo(() => {
    return (keys: PermissionKey[]): boolean => {
      if (isAdmin) return true;
      return keys.every(key => permissionSet.has(key));
    };
  }, [isAdmin, permissionSet]);

  return {
    permissions,
    isAdmin,
    isLoading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };
}

export function useHasPermission(permissionKey: PermissionKey | PermissionKey[]) {
  const { hasPermission, hasAllPermissions, isLoading } = usePermissions();

  const isGranted = useMemo(() => {
    if (Array.isArray(permissionKey)) {
      return hasAllPermissions(permissionKey);
    }
    return hasPermission(permissionKey);
  }, [permissionKey, hasPermission, hasAllPermissions]);

  return {
    data: isGranted,
    isLoading,
  };
}

// ── V1 catalog + RPC-backed administration ──

export function useModuleCatalog() {
  return useQuery({
    queryKey: ['rbac', 'module-catalog'],
    queryFn: listModuleCatalog,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useSensitiveFields() {
  return useQuery({
    queryKey: ['rbac', 'sensitive-fields'],
    queryFn: listSensitiveFields,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useRoleFieldPermissions(roleId?: string | null) {
  return useQuery({
    queryKey: ['rbac', 'role-field-permissions', roleId],
    queryFn: () => listRoleFieldPermissions(roleId ?? ''),
    enabled: Boolean(roleId),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useRoleMemberCounts(organisationId?: string | null) {
  return useQuery({
    queryKey: ['rbac', 'role-member-counts', organisationId],
    queryFn: () => listRoleMemberCounts(organisationId ?? ''),
    enabled: Boolean(organisationId),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useRolePermissionDiff(
  organisationId: string | null | undefined,
  roleId: string | null | undefined,
  grants: Array<{ module: string; action: string }>,
  enabled = false,
) {
  const key = JSON.stringify(grants);
  return useQuery({
    queryKey: ['rbac', 'role-permission-diff', organisationId, roleId, key],
    queryFn: () => getRolePermissionDiff(organisationId ?? '', roleId ?? '', grants),
    enabled: Boolean(enabled && organisationId && roleId),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

function invalidateRoleQueries(qc: ReturnType<typeof useQueryClient>, organisationId?: string | null, roleId?: string | null) {
  qc.invalidateQueries({ queryKey: ['rbac', 'roles', organisationId] });
  if (roleId) {
    qc.invalidateQueries({ queryKey: ['rbac', 'role-permissions', roleId] });
    qc.invalidateQueries({ queryKey: ['rbac', 'role-field-permissions', roleId] });
  }
  qc.invalidateQueries({ queryKey: ['rbac', 'my-permissions'] });
}

export function useSaveRolePermissions(organisationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      roleId: string;
      expectedVersion: number;
      grants: Array<{ module: string; action: string }>;
      fieldGrants?: Array<{ field: string; granted: boolean }>;
    }) =>
      saveRolePermissionsRpc({
        organisationId: organisationId ?? '',
        roleId: input.roleId,
        expectedVersion: input.expectedVersion,
        grants: input.grants,
        fieldGrants: input.fieldGrants ?? [],
      }),
    onSuccess: (_data, variables) => {
      invalidateRoleQueries(qc, organisationId, variables.roleId);
    },
  });
}

export function useCreateRoleV2(organisationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string | null }) =>
      createRoleRpc(organisationId ?? '', input.name, input.description ?? null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rbac', 'roles', organisationId] });
    },
  });
}

export function useUpdateRoleV2(organisationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { roleId: string; name: string; description: string | null; expectedVersion: number }) =>
      updateRoleRpc(organisationId ?? '', input.roleId, input.name, input.description, input.expectedVersion),
    onSuccess: (_data, variables) => {
      invalidateRoleQueries(qc, organisationId, variables.roleId);
    },
  });
}

export function useSetRoleActive(organisationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { roleId: string; active: boolean; expectedVersion: number }) =>
      setRoleActiveRpc(organisationId ?? '', input.roleId, input.active, input.expectedVersion),
    onSuccess: (_data, variables) => {
      invalidateRoleQueries(qc, organisationId, variables.roleId);
    },
  });
}

export function useDeleteRoleV2(organisationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { roleId: string }) => deleteRoleRpc(organisationId ?? '', input.roleId),
    onSuccess: (_data, variables) => {
      invalidateRoleQueries(qc, organisationId, variables.roleId);
    },
  });
}

export function useAssignEmployeeRole(organisationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { employeeId: string; roleId: string }) =>
      assignEmployeeRoleRpc(organisationId ?? '', input.employeeId, input.roleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rbac', 'employees', organisationId] });
      qc.invalidateQueries({ queryKey: ['rbac', 'my-permissions'] });
    },
  });
}

export function useMyPermissionsRpc() {
  const { organisation, selectedOrganisation } = useAuth();
  const orgId = (organisation as any)?.id || (selectedOrganisation as any)?.id || null;
  return useQuery({
    queryKey: ['rbac', 'my-permissions-rpc', orgId],
    queryFn: () => listMyPermissionsRpc(orgId ?? ''),
    enabled: Boolean(orgId),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

