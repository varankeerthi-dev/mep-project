import { supabase } from '../../../supabase';
import { fetchJobCardMaterials } from './jobCardPersistence';

export interface WIPValuationItem {
  job_card_id: string;
  job_card_no: string;
  product_name: string;
  material_id: string;
  material_name: string;
  wip_qty: number;
  unit_cost: number;
  total_value: number;
  days_in_wip: number;
  unit: string;
}

export async function calculateActiveWIPValuation(orgId: string): Promise<WIPValuationItem[]> {
  // 1. Fetch active Job Cards (issued or in_progress)
  const { data: jobCards, error: jcErr } = await supabase
    .from('job_cards')
    .select(`
      id,
      job_card_no,
      created_at,
      status,
      bom_headers (
        product_name
      )
    `)
    .eq('organisation_id', orgId)
    .in('status', ['issued', 'in_progress']);

  if (jcErr) throw jcErr;
  if (!jobCards || jobCards.length === 0) return [];

  const jobCardIds = jobCards.map(jc => jc.id);

  // 2. Fetch all materials linked to these Job Cards
  const { data: jcMaterials, error: jcmErr } = await supabase
    .from('job_card_materials')
    .select(`
      *,
      materials:material_id (
        name,
        unit
      )
    `)
    .in('job_card_id', jobCardIds);

  if (jcmErr) throw jcmErr;
  if (!jcMaterials || jcMaterials.length === 0) return [];

  // 3. Fetch current material cost estimates (using standard pricing columns or purchase price column from materials)
  const materialIds = Array.from(new Set(jcMaterials.map(m => m.material_id)));
  const { data: materials, error: matErr } = await supabase
    .from('materials')
    .select('id, cost_price')
    .in('id', materialIds);

  if (matErr) throw matErr;
  const costMap: Record<string, number> = {};
  materials?.forEach(m => {
    costMap[m.id] = m.cost_price || 0.0;
  });

  const results: WIPValuationItem[] = [];

  for (const jcm of jcMaterials) {
    const issued = jcm.issued_qty || 0;
    const consumed = jcm.consumed_qty || 0;
    const wastage = jcm.wastage_qty || 0;
    const returned = jcm.return_qty || 0;

    const wipQty = issued - consumed - wastage - returned;

    if (wipQty > 0) {
      const parentJc = jobCards.find(jc => jc.id === jcm.job_card_id);
      const cost = costMap[jcm.material_id] || 0.0;
      
      // Calculate aging: days since Job Card was created
      const createdDate = new Date(parentJc?.created_at || new Date());
      const diffTime = Math.abs(new Date().getTime() - createdDate.getTime());
      const daysInWip = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      results.push({
        job_card_id: jcm.job_card_id,
        job_card_no: parentJc?.job_card_no || 'Unknown',
        product_name: parentJc?.bom_headers?.product_name || 'Unknown Product',
        material_id: jcm.material_id,
        material_name: jcm.materials?.name || 'Unknown Material',
        wip_qty: wipQty,
        unit_cost: cost,
        total_value: wipQty * cost,
        days_in_wip: daysInWip,
        unit: jcm.materials?.unit || 'Nos'
      });
    }
  }

  return results;
}
