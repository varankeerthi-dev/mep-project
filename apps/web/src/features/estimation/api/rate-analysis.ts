import { supabase } from '@/supabase';
import type {
  RateAnalysisInput, RateResourceInput,
  LabourCatalogInput, EquipmentCatalogInput,
  RateTemplateInput, EstimationSettingsInput,
} from '../model';

const ANALYSIS_TABLE = 'est_rate_analysis';
const RESOURCES_TABLE = 'est_rate_resources';
const LABOUR_TABLE = 'est_labour_catalog';
const EQUIPMENT_TABLE = 'est_equipment_catalog';
const TEMPLATES_TABLE = 'est_rate_templates';
const TEMPLATE_RESOURCES_TABLE = 'est_rate_template_resources';
const SETTINGS_TABLE = 'est_settings';

export async function getRateAnalysis(boqItemId: string) {
  const { data, error } = await supabase
    .from(ANALYSIS_TABLE)
    .select('*')
    .eq('boq_item_id', boqItemId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertRateAnalysis(input: RateAnalysisInput) {
  const { data, error } = await supabase
    .from(ANALYSIS_TABLE)
    .upsert(input, { onConflict: 'boq_item_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listRateResources(rateAnalysisId: string) {
  const { data, error } = await supabase
    .from(RESOURCES_TABLE)
    .select('*')
    .eq('rate_analysis_id', rateAnalysisId);
  if (error) throw error;
  return data || [];
}

export async function createRateResource(input: RateResourceInput) {
  const { data, error } = await supabase
    .from(RESOURCES_TABLE)
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateRateResource(id: string, input: Partial<RateResourceInput>) {
  const { data, error } = await supabase
    .from(RESOURCES_TABLE)
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRateResource(id: string) {
  const { error } = await supabase.from(RESOURCES_TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function listLabourCatalog(organisationId: string) {
  const { data, error } = await supabase
    .from(LABOUR_TABLE)
    .select('*')
    .eq('organisation_id', organisationId)
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function upsertLabourCatalog(input: LabourCatalogInput) {
  const { data, error } = await supabase
    .from(LABOUR_TABLE)
    .upsert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listEquipmentCatalog(organisationId: string) {
  const { data, error } = await supabase
    .from(EQUIPMENT_TABLE)
    .select('*')
    .eq('organisation_id', organisationId)
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function upsertEquipmentCatalog(input: EquipmentCatalogInput) {
  const { data, error } = await supabase
    .from(EQUIPMENT_TABLE)
    .upsert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listRateTemplates(organisationId: string) {
  const { data, error } = await supabase
    .from(TEMPLATES_TABLE)
    .select('*')
    .eq('organisation_id', organisationId)
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function createRateTemplate(input: RateTemplateInput) {
  const { data, error } = await supabase
    .from(TEMPLATES_TABLE)
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSettings(organisationId: string) {
  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .select('*')
    .eq('organisation_id', organisationId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertSettings(input: EstimationSettingsInput) {
  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .upsert(input, { onConflict: 'organisation_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}
