import { supabase } from '../../../supabase';
import { IPQCCheckpoint, IPQCInspection } from '../model/types';

export async function fetchIPQCCheckpoints(bomId: string) {
  const { data, error } = await supabase
    .from('ipqc_checkpoints')
    .select('*')
    .eq('bom_id', bomId)
    .order('sequence', { ascending: true });

  if (error) throw error;
  return data as IPQCCheckpoint[];
}

export async function insertIPQCCheckpoint(checkpoint: Omit<IPQCCheckpoint, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('ipqc_checkpoints')
    .insert([checkpoint])
    .select()
    .single();

  if (error) throw error;
  return data as IPQCCheckpoint;
}

export async function updateIPQCCheckpoint(id: string, updates: Partial<IPQCCheckpoint>) {
  const { data, error } = await supabase
    .from('ipqc_checkpoints')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as IPQCCheckpoint;
}

export async function deleteIPQCCheckpoint(id: string) {
  const { error } = await supabase
    .from('ipqc_checkpoints')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function fetchIPQCInspections(jobCardId: string) {
  const { data, error } = await supabase
    .from('ipqc_inspections')
    .select(`
      *,
      checkpoint:checkpoint_id (
        checkpoint_name,
        sequence,
        checkpoint_type
      )
    `)
    .eq('job_card_id', jobCardId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as (IPQCInspection & { checkpoint?: { checkpoint_name: string; sequence: number; checkpoint_type: string } | null })[];
}

export async function insertIPQCInspection(inspection: Omit<IPQCInspection, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('ipqc_inspections')
    .insert([inspection])
    .select()
    .single();

  if (error) throw error;
  return data as IPQCInspection;
}

export async function updateIPQCInspection(id: string, result: 'passed' | 'failed' | 'conditional', remarks?: string) {
  const { data, error } = await supabase
    .from('ipqc_inspections')
    .update({ result, remarks })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as IPQCInspection;
}
