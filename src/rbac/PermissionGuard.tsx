import { type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMyPermissions } from './hooks';
import type { PermissionKey } from './schemas';

export type PermissionGuardProps = {
  permission: PermissionKey;
  children: ReactNode;
  fallback?: ReactNode;
};

export function PermissionGuard({ permission, children, fallback = null }: PermissionGuardProps) {
  const { user, organisation } = useAuth();
  const orgId = (organisation as any)?.id ?? null;
  const { data: permissions, isLoading } = useMyPermissions(user?.id, orgId);

  // Still loading -> return null (or spinner, but null prevents flickering if used inline)
  if (isLoading) return null;

  // Not logged in or no org -> deny
  if (!user || !orgId) return fallback;

  // Has admin override
  if (permissions?.includes('admin_all_access' as any)) {
    return <>{children}</>;
  }

  // Has exact permission
  if (permissions?.includes(permission)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
