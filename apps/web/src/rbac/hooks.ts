import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PermissionKey } from './schemas';
import {
  approveAccessRequest,
  createAccessRequest,
  createRoleWithPermissions,
  listEmployees,
  listMyAccessRequests,
  listMyPermissions,
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

