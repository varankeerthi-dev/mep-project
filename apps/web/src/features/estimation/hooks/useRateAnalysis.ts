import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../App';
import { withSessionCheck } from '../../../queryClient';
import { QUERY_KEYS } from '../constants';
import {
  getRateAnalysis, upsertRateAnalysis,
  listRateResources, createRateResource, updateRateResource, deleteRateResource,
  listLabourCatalog, upsertLabourCatalog,
  listEquipmentCatalog, upsertEquipmentCatalog,
  listRateTemplates, createRateTemplate,
  getSettings, upsertSettings,
} from '../api/rate-analysis';
import type { RateAnalysisInput, RateResourceInput, LabourCatalogInput, EquipmentCatalogInput, RateTemplateInput, EstimationSettingsInput } from '../model';

export const rateKeys = {
  all: [QUERY_KEYS.rateAnalyses] as const,
  analysis: (boqItemId: string) => [...rateKeys.all, 'analysis', boqItemId] as const,
  resources: (rateAnalysisId: string) => [...rateKeys.all, 'resources', rateAnalysisId] as const,
};

export function useRateAnalysis(boqItemId: string | null) {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: rateKeys.analysis(boqItemId || ''),
    queryFn: withSessionCheck(() => getRateAnalysis(boqItemId!)),
    enabled: !!boqItemId && !!organisation?.id,
  });
}

export function useUpsertRateAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck((input: RateAnalysisInput) => upsertRateAnalysis(input)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: rateKeys.analysis(data.boq_item_id) });
    },
  });
}

export function useRateResources(rateAnalysisId: string | null) {
  return useQuery({
    queryKey: rateKeys.resources(rateAnalysisId || ''),
    queryFn: withSessionCheck(() => listRateResources(rateAnalysisId!)),
    enabled: !!rateAnalysisId,
  });
}

export function useCreateRateResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck((input: RateResourceInput) => createRateResource(input)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: rateKeys.resources(data.rate_analysis_id) });
    },
  });
}

export function useUpdateRateResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck(({ id, input }: { id: string; input: Partial<RateResourceInput> }) => updateRateResource(id, input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rateKeys.all });
    },
  });
}

export function useDeleteRateResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck(({ id, rateAnalysisId }: { id: string; rateAnalysisId: string }) => deleteRateResource(id)),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: rateKeys.resources(variables.rateAnalysisId) });
    },
  });
}

export function useLabourCatalog() {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: [QUERY_KEYS.labourCatalog, organisation?.id],
    queryFn: withSessionCheck(() => {
      if (!organisation?.id) return [];
      return listLabourCatalog(organisation.id);
    }),
    enabled: !!organisation?.id,
  });
}

export function useUpsertLabourCatalog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck((input: LabourCatalogInput) => upsertLabourCatalog(input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.labourCatalog] });
    },
  });
}

export function useEquipmentCatalog() {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: [QUERY_KEYS.equipmentCatalog, organisation?.id],
    queryFn: withSessionCheck(() => {
      if (!organisation?.id) return [];
      return listEquipmentCatalog(organisation.id);
    }),
    enabled: !!organisation?.id,
  });
}

export function useUpsertEquipmentCatalog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck((input: EquipmentCatalogInput) => upsertEquipmentCatalog(input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.equipmentCatalog] });
    },
  });
}

export function useRateTemplates() {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: [QUERY_KEYS.rateTemplates, organisation?.id],
    queryFn: withSessionCheck(() => {
      if (!organisation?.id) return [];
      return listRateTemplates(organisation.id);
    }),
    enabled: !!organisation?.id,
  });
}

export function useCreateRateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck((input: RateTemplateInput) => createRateTemplate(input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.rateTemplates] });
    },
  });
}

export function useSettings() {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: [QUERY_KEYS.settings, organisation?.id],
    queryFn: withSessionCheck(() => {
      if (!organisation?.id) return null;
      return getSettings(organisation.id);
    }),
    enabled: !!organisation?.id,
  });
}

export function useUpsertSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck((input: EstimationSettingsInput) => upsertSettings(input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.settings] });
    },
  });
}
