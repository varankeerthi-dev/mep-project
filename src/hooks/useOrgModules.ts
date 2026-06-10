import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { MODULE_REGISTRY } from '../config/module-registry';

export type OrgModuleState = {
  moduleId: string;
  enabled: boolean;
};

const ALL_MODULE_IDS = MODULE_REGISTRY.map((m) => m.id);

export function useOrgModules() {
  const { organisation } = useAuth();
  const orgId = organisation?.id;

  return useQuery<OrgModuleState[]>({
    queryKey: ['org-modules', orgId],
    queryFn: async () => {
      if (!orgId) return ALL_MODULE_IDS.map((id) => ({ moduleId: id, enabled: false }));

      const { data, error } = await supabase.rpc('get_org_modules', { p_org_id: orgId });

      if (error) {
        console.warn('org_modules table may not exist yet, defaulting all enabled');
        return ALL_MODULE_IDS.map((id) => ({ moduleId: id, enabled: true }));
      }

      const enabledMap = new Map<string, boolean>();
      if (data) {
        for (const row of data as any[]) {
          enabledMap.set(row.module_id, row.enabled);
        }
      }

      // Merge registry with DB state — new modules default to enabled
      return ALL_MODULE_IDS.map((id) => ({
        moduleId: id,
        enabled: enabledMap.has(id) ? enabledMap.get(id)! : true,
      }));
    },
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useIsModuleEnabled(moduleId: string) {
  const { data: modules } = useOrgModules();
  if (!modules) return true; // Default to enabled while loading
  const mod = modules.find((m) => m.moduleId === moduleId);
  return mod?.enabled ?? true;
}

export function useSaveOrgModules() {
  const { organisation } = useAuth();
  const qc = useQueryClient();
  const orgId = organisation?.id;

  return useMutation({
    mutationFn: async (states: OrgModuleState[]) => {
      if (!orgId) throw new Error('No organisation selected');

      // For each module, upsert the state
      const enabledIds = states.filter((s) => s.enabled).map((s) => s.moduleId);
      const disabledIds = states.filter((s) => !s.enabled).map((s) => s.moduleId);

      // Bulk set enabled
      if (enabledIds.length > 0) {
        const { error } = await supabase.rpc('set_org_modules_bulk', {
          p_org_id: orgId,
          p_module_ids: enabledIds,
          p_enabled: true,
        });
        if (error) throw error;
      }

      // Bulk set disabled
      if (disabledIds.length > 0) {
        const { error } = await supabase.rpc('set_org_modules_bulk', {
          p_org_id: orgId,
          p_module_ids: disabledIds,
          p_enabled: false,
        });
        if (error) throw error;
      }

      return states;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-modules', orgId] });
    },
  });
}
