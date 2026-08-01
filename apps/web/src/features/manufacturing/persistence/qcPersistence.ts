import { supabase } from '../../../supabase';
import { QCParameter, FGQCInspection, QCParameterResult } from '../model/types';

export async function fetchQCInspections(orgId: string, result?: string) {
  let query = supabase
    .from('fg_qc_inspections')
    .select(`
      *,
      materials:product_id (
        name,
        unit
      )
    `)
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false });

  if (result) {
    query = query.eq('inspection_result', result);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as (FGQCInspection & { materials?: { name: string; unit: string } | null })[];
}

export async function fetchQCInspectionById(id: string) {
  const { data, error } = await supabase
    .from('fg_qc_inspections')
    .select(`
      *,
      materials:product_id (
        name,
        unit
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as (FGQCInspection & { materials?: { name: string; unit: string } | null });
}

export async function fetchQCParameters(orgId: string, productId?: string, bomId?: string) {
  let query = supabase
    .from('qc_parameters')
    .select('*')
    .eq('organisation_id', orgId)
    .eq('is_active', true);

  if (productId) {
    query = query.eq('product_id', productId);
  }
  if (bomId) {
    query = query.eq('bom_id', bomId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as QCParameter[];
}

export async function insertQCParameter(param: Omit<QCParameter, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('qc_parameters')
    .insert([param])
    .select()
    .single();

  if (error) throw error;
  return data as QCParameter;
}

export async function updateQCParameter(id: string, updates: Partial<QCParameter>) {
  const { data, error } = await supabase
    .from('qc_parameters')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as QCParameter;
}

export async function insertFGQCInspection(inspection: Omit<FGQCInspection, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('fg_qc_inspections')
    .insert([inspection])
    .select()
    .single();

  if (error) throw error;
  return data as FGQCInspection;
}

export async function updateFGQCInspection(id: string, updates: Partial<FGQCInspection>) {
  const { data, error } = await supabase
    .from('fg_qc_inspections')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as FGQCInspection;
}

export async function insertQCParameterResults(results: Omit<QCParameterResult, 'id' | 'created_at'>[]) {
  const { data, error } = await supabase
    .from('qc_parameter_results')
    .insert(results)
    .select();

  if (error) throw error;
  return data as QCParameterResult[];
}

export async function fetchQCParameterResults(inspectionId: string) {
  const { data, error } = await supabase
    .from('qc_parameter_results')
    .select(`
      *,
      parameter:parameter_id (
        parameter_name,
        specification,
        measurement_unit,
        severity
      )
    `)
    .eq('inspection_id', inspectionId);

  if (error) throw error;
  return data as (QCParameterResult & { parameter?: { parameter_name: string; specification: string; measurement_unit?: string; severity: string } | null })[];
}
