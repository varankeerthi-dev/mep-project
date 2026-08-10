import { supabase } from '../lib/supabase';

export interface ShotCounterResult {
  totalShots: number;
  shotsSinceMaintenance: number;
}

/**
 * Computes live cumulative shots for a given tooling/mould by summing actual_shots from production_entries.
 * Never stores running counts on the tooling record to maintain single-source-of-truth integrity.
 */
export async function getTotalShots(toolingId: string): Promise<number> {
  if (!toolingId) return 0;
  const { data, error } = await supabase
    .from('production_entries')
    .select('actual_shots')
    .eq('tooling_id', toolingId);

  if (error || !data) {
    console.error('Error fetching total shots:', error);
    return 0;
  }

  return data.reduce((sum, row) => sum + (Number(row.actual_shots) || 0), 0);
}

/**
 * Computes shots accumulated since the last maintenance record for a given tooling.
 */
export async function getShotsSinceMaintenance(toolingId: string): Promise<number> {
  if (!toolingId) return 0;

  // 1. Get latest maintenance date
  const { data: maintData } = await supabase
    .from('manufacturing_tooling_maintenance')
    .select('maintenance_date, created_at')
    .eq('tooling_id', toolingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let query = supabase
    .from('production_entries')
    .select('actual_shots')
    .eq('tooling_id', toolingId);

  if (maintData?.created_at) {
    query = query.gt('created_at', maintData.created_at);
  } else if (maintData?.maintenance_date) {
    query = query.gte('created_at', maintData.maintenance_date);
  }

  const { data, error } = await query;
  if (error || !data) return 0;

  return data.reduce((sum, row) => sum + (Number(row.actual_shots) || 0), 0);
}

/**
 * Helper to get combined shot counter stats for a tooling
 */
export async function getToolingShotStats(toolingId: string): Promise<ShotCounterResult> {
  const [totalShots, shotsSinceMaintenance] = await Promise.all([
    getTotalShots(toolingId),
    getShotsSinceMaintenance(toolingId),
  ]);
  return { totalShots, shotsSinceMaintenance };
}
