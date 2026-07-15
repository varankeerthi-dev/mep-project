import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type ClosureTemplate = {
  id: string;
  organisation_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type ClosureGate = {
  id: string;
  template_id: string;
  gate_key: string;
  label: string;
  description: string | null;
  sort_order: number;
  is_required: boolean;
  gate_type: 'manual' | 'auto_invoices' | 'auto_material' | 'auto_handover' | 'auto_warranty';
  created_at: string;
};

export type ClosureChecklist = {
  id: string;
  project_id: string;
  gate_id: string;
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  gate?: ClosureGate;
};

export function useClosureTemplates(organisationId: string | undefined) {
  return useQuery({
    queryKey: ['closure-templates', organisationId],
    queryFn: async () => {
      if (!organisationId) return [];
      const { data, error } = await supabase
        .from('project_closure_templates')
        .select('*')
        .eq('organisation_id', organisationId)
        .order('is_default', { ascending: false })
        .order('name');
      if (error) throw error;
      return (data ?? []) as ClosureTemplate[];
    },
    enabled: !!organisationId,
  });
}

export function useClosureGates(templateId: string | undefined) {
  return useQuery({
    queryKey: ['closure-gates', templateId],
    queryFn: async () => {
      if (!templateId) return [];
      const { data, error } = await supabase
        .from('project_closure_gates')
        .select('*')
        .eq('template_id', templateId)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as ClosureGate[];
    },
    enabled: !!templateId,
  });
}

export function useProjectClosureChecklist(projectId: string | undefined) {
  return useQuery({
    queryKey: ['closure-checklist', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_closure_checklists')
        .select('*, gate:gate_id(*)')
        .eq('project_id', projectId);
      if (error) throw error;
      return (data ?? []) as ClosureChecklist[];
    },
    enabled: !!projectId,
  });
}

export function useUpsertClosureTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      organisation_id: string;
      name: string;
      is_default?: boolean;
      gates?: Array<{ gate_key: string; label: string; description?: string; is_required?: boolean; gate_type?: string }>;
    }) => {
      const { data: template, error: tErr } = await supabase
        .from('project_closure_templates')
        .insert({
          organisation_id: input.organisation_id,
          name: input.name,
          is_default: input.is_default ?? false,
        })
        .select()
        .single();
      if (tErr) throw tErr;
      if (input.gates && input.gates.length > 0) {
        const { error: gErr } = await supabase.from('project_closure_gates').insert(
          input.gates.map((g, i) => ({
            template_id: template.id,
            gate_key: g.gate_key,
            label: g.label,
            description: g.description ?? null,
            sort_order: i,
            is_required: g.is_required ?? true,
            gate_type: g.gate_type ?? 'manual',
          }))
        );
        if (gErr) throw gErr;
      }
      return template as ClosureTemplate;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['closure-templates'] });
    },
  });
}

export function useUpdateChecklistGate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      project_id: string;
      gate_id: string;
      status: ClosureChecklist['status'];
      notes?: string;
    }) => {
      const { data: existing } = await supabase
        .from('project_closure_checklists')
        .select('id')
        .eq('project_id', input.project_id)
        .eq('gate_id', input.gate_id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('project_closure_checklists')
          .update({
            status: input.status,
            notes: input.notes ?? null,
            verified_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('project_closure_checklists')
          .insert({
            project_id: input.project_id,
            gate_id: input.gate_id,
            status: input.status,
            notes: input.notes ?? null,
            verified_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['closure-checklist', variables.project_id] });
    },
  });
}

export function useInitializeClosureChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { project_id: string; organisation_id: string }) => {
      const { data: templates } = await supabase
        .from('project_closure_templates')
        .select('id')
        .eq('organisation_id', input.organisation_id)
        .eq('is_default', true)
        .limit(1);

      const templateId = templates?.[0]?.id;
      if (!templateId) return;

      const { data: gates } = await supabase
        .from('project_closure_gates')
        .select('*')
        .eq('template_id', templateId);

      if (!gates || gates.length === 0) return;

      const { error } = await supabase.from('project_closure_checklists').upsert(
        gates.map((gate) => ({
          project_id: input.project_id,
          gate_id: gate.id,
          status: 'pending',
        })),
        { onConflict: 'project_id,gate_id' }
      );
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['closure-checklist', variables.project_id] });
    },
  });
}
