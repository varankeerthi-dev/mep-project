import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type ScopeItem = {
  id: string;
  project_id: string;
  scope_type: 'contractor_scope' | 'client_scope' | 'excluded_scope' | 'pending_approval' | 'site_instructions';
  description: string;
  sort_order: number;
  version: number;
  created_by: string;
  created_at: string;
  superseded_at: string | null;
};

export type ScopeItemVersion = {
  id: string;
  scope_item_id: string;
  project_id: string;
  scope_type: string;
  description: string;
  version: number;
  change_summary: string | null;
  changed_by: string;
  changed_at: string;
};

export function useProjectScopeItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-scope', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_scope_items')
        .select('*')
        .eq('project_id', projectId)
        .is('superseded_at', null)
        .order('scope_type')
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as ScopeItem[];
    },
    enabled: !!projectId,
  });
}

export function useUpsertScopeItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      project_id: string;
      scope_type: ScopeItem['scope_type'];
      description: string;
      item_id?: string;
      user_id?: string;
    }) => {
      if (input.item_id) {
        const { data: existing } = await supabase
          .from('project_scope_items')
          .select('*')
          .eq('id', input.item_id)
          .single();

        if (!existing) throw new Error('Scope item not found');

        const newVersion = (existing.version ?? 0) + 1;

        const { error: vErr } = await supabase.from('project_scope_item_versions').insert({
          scope_item_id: input.item_id,
          project_id: input.project_id,
          scope_type: input.scope_type,
          description: existing.description,
          version: existing.version,
          change_summary: `Updated to v${newVersion}`,
          changed_by: input.user_id ?? null,
        });
        if (vErr) throw vErr;

        const { error } = await supabase
          .from('project_scope_items')
          .update({ description: input.description, version: newVersion })
          .eq('id', input.item_id);
        if (error) throw error;
      } else {
        const { data: maxOrder } = await supabase
          .from('project_scope_items')
          .select('sort_order')
          .eq('project_id', input.project_id)
          .eq('scope_type', input.scope_type)
          .order('sort_order', { ascending: false })
          .limit(1);
        const nextOrder = ((maxOrder?.[0]?.sort_order as number) ?? -1) + 1;
        const { error } = await supabase.from('project_scope_items').insert({
          project_id: input.project_id,
          scope_type: input.scope_type,
          description: input.description,
          sort_order: nextOrder,
          version: 1,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['project-scope', variables.project_id] });
    },
  });
}

export function useDeleteScopeItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; project_id: string; user_id?: string }) => {
      const { data: existing } = await supabase
        .from('project_scope_items')
        .select('*')
        .eq('id', input.id)
        .single();

      if (!existing) throw new Error('Scope item not found');

      const { error: vErr } = await supabase.from('project_scope_item_versions').insert({
        scope_item_id: input.id,
        project_id: input.project_id,
        scope_type: existing.scope_type,
        description: existing.description,
        version: existing.version,
        change_summary: 'Deleted',
        changed_by: input.user_id ?? null,
      });
      if (vErr) throw vErr;

      const { error } = await supabase
        .from('project_scope_items')
        .update({ superseded_at: new Date().toISOString() })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['project-scope', variables.project_id] });
    },
  });
}

export function useScopeItemVersions(scopeItemId: string | undefined) {
  return useQuery({
    queryKey: ['scope-item-versions', scopeItemId],
    queryFn: async () => {
      if (!scopeItemId) return [];
      const { data, error } = await supabase
        .from('project_scope_item_versions')
        .select('*')
        .eq('scope_item_id', scopeItemId)
        .order('version', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ScopeItemVersion[];
    },
    enabled: !!scopeItemId,
  });
}
