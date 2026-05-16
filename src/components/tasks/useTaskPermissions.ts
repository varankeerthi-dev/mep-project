// ============================================
// TASK PERMISSIONS HOOK
// ============================================
import { useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { Task, TaskPermission } from './types';
import { ROLE_PERMISSIONS } from './types';

export function useTaskPermissions() {
  const { organisation, user } = useAuth();
  const userRole = (organisation?.role as keyof typeof ROLE_PERMISSIONS) || 'viewer';

  const can = useCallback(
    (permission: TaskPermission, task?: Task) => {
      const permissions = ROLE_PERMISSIONS[userRole] || [];
      if (!permissions.includes(permission)) return false;

      // Scoped permissions
      if (permission === 'tasks.update' && task) {
        if (userRole === 'engineer' || userRole === 'subcontractor') {
          return task.assignee_ids?.includes(user?.id || '') || task.created_by === user?.id;
        }
      }

      if (permission === 'tasks.change_status' && task) {
        if (userRole === 'subcontractor') {
          return task.assignee_ids?.includes(user?.id || '');
        }
      }

      if (permission === 'tasks.delete' && task) {
        if (userRole === 'engineer') return false;
        if (userRole === 'supervisor') return false;
      }

      if (permission === 'tasks.assign' && task) {
        if (userRole === 'engineer') return false;
        if (userRole === 'subcontractor') return false;
      }

      if (permission === 'tasks.manage_dependencies') {
        if (userRole === 'engineer' || userRole === 'supervisor' || userRole === 'subcontractor') return false;
      }

      if (permission === 'tasks.bulk_edit') {
        if (userRole === 'engineer' || userRole === 'viewer' || userRole === 'subcontractor') return false;
      }

      if (permission === 'tasks.manage_custom_fields') {
        if (userRole !== 'admin') return false;
      }

      return true;
    },
    [userRole, user?.id]
  );

  return { can, role: userRole };
}
