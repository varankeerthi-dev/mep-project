import * as P from '../persistence';
import { JobCardMaterial, Warehouse, JobCard } from '../model/types';
import { supabase } from '../../../supabase';

export async function issueJobCardMaterials(
  jobCardId: string,
  orgId: string,
  userId: string,
  jobCardNo: string
) {
  const { data, error } = await supabase.rpc('issue_job_card_materials', {
    p_job_card_id: jobCardId,
    p_org_id: orgId,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || 'Failed to issue materials');
}

export async function returnJobCardMaterials(
  jobCardId: string,
  orgId: string,
  returnQuantities: Record<string, number>
) {
  const { data, error } = await supabase.rpc('return_job_card_materials', {
    p_job_card_id: jobCardId,
    p_org_id: orgId,
    p_return_quantities: returnQuantities,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || 'Failed to return materials');
}

export async function generateNextJobCardNumber(orgId: string): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('generate_job_card_no', { org_id: orgId });
    if (error || !data) throw error;
    return data as string;
  } catch {
    const { data } = await supabase
      .from('job_cards')
      .select('job_card_no')
      .eq('organisation_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const last = data?.job_card_no;
    const next = last ? parseInt(last.replace('JC-', '')) + 1 : 1;
    return `JC-${String(next).padStart(4, '0')}`;
  }
}

export async function createJobCardAggregate(
  jobCard: Partial<JobCard>,
  materials: Partial<JobCardMaterial>[]
) {
  const jobCardNo = jobCard.job_card_no || await generateNextJobCardNumber(jobCard.organisation_id!);

  const jobCardPayload = {
    ...jobCard,
    job_card_no: jobCardNo,
    status: 'draft',
  };

  const inserted = await P.insertJobCard(jobCardPayload);
  
  if (materials.length > 0) {
    const materialsPayload = materials.map((m) => ({
      job_card_id: inserted.id!,
      material_id: m.material_id,
      planned_qty: m.planned_qty,
      unit: m.unit || 'kg',
      is_additional: m.is_additional || false,
      status: 'reserved',
    }));
    await P.insertJobCardMaterials(materialsPayload);
  }

  return inserted;
}

export async function releaseJobCard(jobCardId: string, orgId: string) {
  const { data, error } = await supabase.rpc('release_job_card', {
    p_job_card_id: jobCardId,
    p_org_id: orgId,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || 'Failed to release job card');
  return data;
}

export async function calculateJobCardVariances(jobCardId: string, orgId: string) {
  const { data, error } = await supabase.rpc('calculate_job_card_variances', {
    p_job_card_id: jobCardId,
    p_org_id: orgId,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || 'Failed to calculate job card variances');
  return data;
}

