import { supabase } from '../lib/supabase';

export interface MachineMotor {
  name: string;
  kw: number;
  amps: number;
  rpm: number;
}

export interface CustomAttribute {
  id: string;
  label: string;
  dataType: 'text' | 'number' | 'date' | 'boolean' | 'select';
  value: string;
  options?: string[];
}

export interface WorkCenterMachine {
  id: string;
  name: string;
  code: string;
  machine_type: 'general' | 'injection_moulding' | 'blow_moulding' | 'press' | 'extruder' | 'assembly';
  make?: string;
  model_number?: string;
  serial_number?: string;
  location_in_plant?: string;
  machine_incharge?: string;
  machine_status: 'idle' | 'running' | 'breakdown' | 'maintenance' | 'setup';
  
  // Dimensions & Weight
  length_mm?: number;
  width_mm?: number;
  height_mm?: number;
  machine_weight_kg?: number;

  // Asset & Warranty
  manufacture_year?: number;
  purchase_date?: string;
  supplier_name?: string;
  purchase_order_ref?: string;
  purchase_cost?: number;
  warranty_expiry_date?: string;
  warranty_type?: 'comprehensive' | 'parts_only' | 'labour_only' | 'expired';

  // Electrical
  connected_load_kw?: number;
  motor_current_amps?: number;
  supply_voltage_v?: number;
  power_factor?: number;
  motors_json?: MachineMotor[];

  // Production Capacity
  clamping_force_tonnes?: number;
  max_shot_weight_grams?: number;
  max_shot_volume_cc?: number;
  plasticising_cap_kg_hr?: number;
  tie_bar_h_mm?: number;
  tie_bar_v_mm?: number;
  min_mould_height_mm?: number;
  max_mould_height_mm?: number;

  // Maintenance
  last_maintenance_date?: string;
  maintenance_interval_days?: number;
  maintenance_notes?: string;

  // Custom User Attributes
  custom_attributes?: CustomAttribute[];

  current_tooling_id?: string;
  organisation_id: string;
}

export interface ManufacturingTooling {
  id: string;
  tooling_name: string;
  tooling_number?: string;
  tooling_type: 'mould' | 'die' | 'jig' | 'fixture';
  no_of_cavities?: number;
  compatible_machine_type?: string;
  compatible_min_tonnage?: number;
  compatible_max_tonnage?: number;
  material_type?: string;
  cycle_time_seconds?: number;
  maintenance_interval_shots?: number;
  status: 'available' | 'mounted' | 'under_maintenance' | 'retired';
  current_machine_id?: string;
  notes?: string;
  organisation_id: string;
  created_at?: string;
  // Computed fields
  total_shots?: number;
  shots_since_maintenance?: number;
  is_reserved?: boolean;
}

export interface MachineDowntime {
  id: string;
  machine_id: string;
  downtime_start: string;
  downtime_end?: string | null;
  reason_category: 'breakdown' | 'planned_maintenance' | 'changeover' | 'setup_trial' | 'no_order' | 'power_cut';
  reason_detail?: string;
  raised_by?: string;
  resolved_by?: string;
  organisation_id: string;
  created_at?: string;
}

export interface MachineBoardCardData {
  machine: WorkCenterMachine;
  currentTooling?: ManufacturingTooling | null;
  activeJobCard?: {
    id: string;
    job_card_number: string;
    product_name?: string;
    planned_qty?: number;
    completed_qty?: number;
    running_cavities?: number;
    planned_shots?: number;
    status: string;
  } | null;
  activeDowntime?: MachineDowntime | null;
  toolingReserved?: boolean;
  shotsSinceMaintenance?: number;
  isMaintenanceDue?: boolean;
  isWarrantyExpired?: boolean;
}

/**
 * Fetch all machines with complete board stats including mounted tooling, active job card, and active downtime.
 */
export async function getMachineBoardCards(orgId: string): Promise<MachineBoardCardData[]> {
  // 1. Fetch machines
  const { data: machines, error: mError } = await supabase
    .from('work_centers')
    .select('*')
    .eq('organisation_id', orgId);

  if (mError || !machines) return [];

  // 2. Fetch toolings
  const { data: toolings } = await supabase
    .from('manufacturing_tooling')
    .select('*')
    .eq('organisation_id', orgId);

  // 3. Fetch active job cards
  const { data: activeJobs } = await supabase
    .from('job_cards')
    .select('*')
    .eq('organisation_id', orgId)
    .not('status', 'in', '("completed","cancelled")');

  // 4. Fetch open downtimes
  const { data: openDowntimes } = await supabase
    .from('machine_downtime')
    .select('*')
    .eq('organisation_id', orgId)
    .is('downtime_end', null);

  const toolingMap = new Map((toolings || []).map(t => [t.id, t]));

  const cards: MachineBoardCardData[] = await Promise.all(
    machines.map(async (m) => {
      const activeJob = (activeJobs || []).find(j => j.machine_id === m.id || j.work_center_id === m.id);
      const activeDowntime = (openDowntimes || []).find(d => d.machine_id === m.id);
      const mountedToolingId = m.current_tooling_id || activeJob?.tooling_id;
      const currentTooling = mountedToolingId ? toolingMap.get(mountedToolingId) : null;

      let shotsSinceMaint = 0;
      let toolingReserved = false;
      if (currentTooling) {
        // check if reserved
        toolingReserved = (activeJobs || []).some(j => j.tooling_id === currentTooling.id);

        // compute shot stats
        const { getShotsSinceMaintenance } = await import('../queries/shotCounters');
        shotsSinceMaint = await getShotsSinceMaintenance(currentTooling.id);
      }

      // Check warranty status
      const isWarrantyExpired = m.warranty_expiry_date
        ? new Date(m.warranty_expiry_date) < new Date()
        : false;

      // Check PM maintenance status
      let isMaintenanceDue = false;
      if (m.last_maintenance_date && m.maintenance_interval_days) {
        const nextDue = new Date(m.last_maintenance_date);
        nextDue.setDate(nextDue.getDate() + m.maintenance_interval_days);
        isMaintenanceDue = nextDue < new Date();
      }

      return {
        machine: m,
        currentTooling: currentTooling || null,
        activeJobCard: activeJob
          ? {
              id: activeJob.id,
              job_card_number: activeJob.job_card_number || activeJob.job_number || 'JC-Active',
              product_name: activeJob.product_name || 'Product',
              planned_qty: activeJob.planned_qty || activeJob.target_qty,
              completed_qty: activeJob.completed_qty || activeJob.produced_qty || 0,
              running_cavities: activeJob.running_cavities || currentTooling?.no_of_cavities || 1,
              planned_shots: activeJob.planned_shots,
              status: activeJob.status,
            }
          : null,
        activeDowntime: activeDowntime || null,
        toolingReserved,
        shotsSinceMaintenance: shotsSinceMaint,
        isMaintenanceDue,
        isWarrantyExpired,
      };
    })
  );

  return cards;
}

/**
 * Log new machine downtime
 */
export async function logMachineDowntime(params: {
  machine_id: string;
  reason_category: MachineDowntime['reason_category'];
  reason_detail?: string;
  organisation_id: string;
  raised_by?: string;
}): Promise<boolean> {
  const { error } = await supabase.from('machine_downtime').insert({
    machine_id: params.machine_id,
    reason_category: params.reason_category,
    reason_detail: params.reason_detail,
    organisation_id: params.organisation_id,
    raised_by: params.raised_by,
    downtime_start: new Date().toISOString(),
  });

  if (error) {
    console.error('Error logging downtime:', error);
    return false;
  }

  // Update machine status to breakdown/maintenance
  const newStatus = params.reason_category === 'planned_maintenance' ? 'maintenance' : 'breakdown';
  await supabase
    .from('work_centers')
    .update({ machine_status: newStatus })
    .eq('id', params.machine_id);

  return true;
}

/**
 * Resolve/Clear open machine downtime
 */
export async function resolveMachineDowntime(
  downtimeId: string,
  machineId: string,
  resolvedBy?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('machine_downtime')
    .update({
      downtime_end: new Date().toISOString(),
      resolved_by: resolvedBy,
    })
    .eq('id', downtimeId);

  if (error) {
    console.error('Error resolving downtime:', error);
    return false;
  }

  // Reset machine status to idle or running if active job exists
  const { data: activeJob } = await supabase
    .from('job_cards')
    .select('id')
    .eq('machine_id', machineId)
    .not('status', 'in', '("completed","cancelled")')
    .maybeSingle();

  const resetStatus = activeJob ? 'running' : 'idle';
  await supabase
    .from('work_centers')
    .update({ machine_status: resetStatus })
    .eq('id', machineId);

  return true;
}

/**
 * Check compatibility between a Mould/Tooling and a Machine
 */
export function checkToolingMachineCompatibility(
  tooling: ManufacturingTooling,
  machine: WorkCenterMachine,
  partWeightGrams?: number
): { isCompatible: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Tonnage check
  if (tooling.compatible_min_tonnage && machine.clamping_force_tonnes) {
    if (machine.clamping_force_tonnes < tooling.compatible_min_tonnage) {
      warnings.push(
        `Machine clamping force (${machine.clamping_force_tonnes}T) is below tooling min required (${tooling.compatible_min_tonnage}T)`
      );
    }
  }
  if (tooling.compatible_max_tonnage && machine.clamping_force_tonnes) {
    if (machine.clamping_force_tonnes > tooling.compatible_max_tonnage) {
      warnings.push(
        `Machine clamping force (${machine.clamping_force_tonnes}T) exceeds tooling max limit (${tooling.compatible_max_tonnage}T)`
      );
    }
  }

  // Max Shot weight check
  if (partWeightGrams && tooling.no_of_cavities && machine.max_shot_weight_grams) {
    const totalShotWeight = partWeightGrams * tooling.no_of_cavities;
    if (totalShotWeight > machine.max_shot_weight_grams) {
      warnings.push(
        `Total shot weight (${totalShotWeight}g = ${partWeightGrams}g × ${tooling.no_of_cavities} cavities) exceeds machine max shot weight capacity (${machine.max_shot_weight_grams}g)`
      );
    }
  }

  return {
    isCompatible: warnings.length === 0,
    warnings,
  };
}
