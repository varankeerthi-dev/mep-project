import { supabase } from '../supabase';
import type { Organisation } from '../supabase';
import { hasPermission } from '../rbac/api';
import type { PermissionKey } from '../rbac/schemas';

export interface IntentAssignment {
  id: string;
  organisation_id: string;
  intent_id: string;
  item_id: string;
  variant_id: string | null;
  warehouse_id: string | null;
  assigned_qty: number;
  assigned_by: string | null;
  assigned_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialIntent {
  id: string;
  organisation_id: string;
  project_id: string;
  item_id: string;
  variant_id: string | null;
  item_name: string;
  variant_name: string | null;
  uom: string;
  requested_qty: number;
  received_qty: number;
  pending_qty: number;
  reserved_qty: number;
  in_transit_qty: number;
  required_date: string;
  status: 'Pending' | 'Approved' | 'Partial' | 'Received' | 'Rejected' | 'Assigned' | 'In Transit' | 'Fulfilled';
  priority: 'Low' | 'Normal' | 'High' | 'Emergency';
  notes: string;
  stores_remarks: string | null;
  indent_number: string | null;
  dc_id: string | null;
  created_at: string;
  updated_at: string;
}

// Assign stock to intent (creates reservation)
export async function assignStockToIntent(
  organisationId: string,
  intentId: string,
  itemId: string,
  variantId: string | null,
  warehouseId: string | null,
  assignedQty: number,
  notes: string | null,
  assignedBy: string
): Promise<IntentAssignment> {
  // RBAC check: user must have material_intents.assign permission
  const canAssign = await hasPermission(assignedBy, organisationId, 'material_intents.assign' as PermissionKey);
  if (!canAssign) {
    throw new Error('You do not have permission to assign stock to intents');
  }

  const { data, error } = await supabase
    .from('intent_assignments')
    .insert({
      organisation_id: organisationId,
      intent_id: intentId,
      item_id: itemId,
      variant_id: variantId,
      warehouse_id: warehouseId,
      assigned_qty: assignedQty,
      notes: notes,
      assigned_by: assignedBy,
    })
    .select()
    .single();

  if (error) throw error;

  // Update intent with reserved_qty and stores_remarks
  const { data: intent, error: intentError } = await supabase
    .from('material_intents')
    .select('reserved_qty, stores_remarks')
    .eq('id', intentId)
    .single();

  if (intentError) throw intentError;

  const newReservedQty = (intent.reserved_qty || 0) + assignedQty;
  const warehouseName = warehouseId ? 'Warehouse' : 'Main Stock';
  const newRemarks = notes 
    ? `${intent.stores_remarks || ''}\n${new Date().toLocaleDateString()}: ${assignedQty} assigned from ${warehouseName} - ${notes}`
    : `${intent.stores_remarks || ''}\n${new Date().toLocaleDateString()}: ${assignedQty} assigned from ${warehouseName}`;

  await supabase
    .from('material_intents')
    .update({
      reserved_qty: newReservedQty,
      stores_remarks: newRemarks.trim(),
      status: 'Assigned',
    })
    .eq('id', intentId);

  return data;
}

// Unassign stock from intent (removes reservation)
export async function unassignStockFromIntent(
  assignmentId: string,
  organisationId: string
): Promise<void> {
  // Get assignment details
  const { data: assignment, error: fetchError } = await supabase
    .from('intent_assignments')
    .select('*')
    .eq('id', assignmentId)
    .eq('organisation_id', organisationId)
    .single();

  if (fetchError) throw fetchError;

  // Delete assignment
  const { error: deleteError } = await supabase
    .from('intent_assignments')
    .delete()
    .eq('id', assignmentId)
    .eq('organisation_id', organisationId);

  if (deleteError) throw deleteError;

  // Update intent reserved_qty
  const { data: intent, error: intentError } = await supabase
    .from('material_intents')
    .select('reserved_qty')
    .eq('id', assignment.intent_id)
    .single();

  if (intentError) throw intentError;

  const newReservedQty = Math.max(0, (intent.reserved_qty || 0) - assignment.assigned_qty);

  await supabase
    .from('material_intents')
    .update({
      reserved_qty: newReservedQty,
      status: newReservedQty === 0 ? 'Pending' : 'Assigned',
    })
    .eq('id', assignment.intent_id);
}

// Get all assignments for an intent
export async function getIntentAssignments(
  intentId: string,
  organisationId: string
): Promise<IntentAssignment[]> {
  const { data, error } = await supabase
    .from('intent_assignments')
    .select('*')
    .eq('intent_id', intentId)
    .eq('organisation_id', organisationId)
    .order('assigned_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get all intents across projects for an organisation
export async function getAllIntents(organisationId: string): Promise<MaterialIntent[]> {
  const { data, error } = await supabase
    .from('material_intents')
    .select(`
      *,
      projects!inner(project_name, project_code)
    `)
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get stock breakdown for an item (Total, Available, Reserved, In Transit)
export async function getItemStockBreakdown(
  itemId: string,
  variantId: string | null,
  organisationId: string
): Promise<{
  total: number;
  available: number;
  reserved: number;
  inTransit: number;
  assignments: Array<{ intent_id: string; qty: number; intent_number: string | null }>;
}> {
  // Get total stock from inventory
  const { data: inventory, error: invError } = await supabase
    .from('inventory')
    .select('quantity')
    .eq('item_id', itemId)
    .eq('organisation_id', organisationId)
    .maybeSingle();

  const total = inventory?.quantity || 0;

  // Get reserved qty from intent_assignments
  const { data: assignments, error: assignError } = await supabase
    .from('intent_assignments')
    .select('assigned_qty, intent_id, material_intents!inner(indent_number)')
    .eq('item_id', itemId)
    .eq('organisation_id', organisationId);

  if (assignError) throw assignError;

  const reserved = (assignments || []).reduce((sum, a) => sum + (a.assigned_qty || 0), 0);

  // Get in_transit qty from material_intents
  const { data: inTransitIntents, error: transitError } = await supabase
    .from('material_intents')
    .select('in_transit_qty')
    .eq('item_id', itemId)
    .eq('organisation_id', organisationId)
    .eq('status', 'In Transit');

  if (transitError) throw transitError;

  const inTransit = (inTransitIntents || []).reduce((sum, i) => sum + (i.in_transit_qty || 0), 0);

  const available = Math.max(0, total - reserved);

  return {
    total,
    available,
    reserved,
    inTransit,
    assignments: (assignments || []).map(a => ({
      intent_id: a.intent_id,
      qty: a.assigned_qty,
      intent_number: a.material_intents?.indent_number,
    })),
  };
}

// Update intent status when DC is created
export async function updateIntentOnDCCreated(
  intentId: string,
  dcId: string,
  organisationId: string,
  userId: string
): Promise<void> {
  // RBAC check: user must have material_intents.create_dc permission
  const canCreateDC = await hasPermission(userId, organisationId, 'material_intents.create_dc' as PermissionKey);
  if (!canCreateDC) {
    throw new Error('You do not have permission to create DC for intents');
  }

  const { data: intent, error: fetchError } = await supabase
    .from('material_intents')
    .select('reserved_qty, requested_qty')
    .eq('id', intentId)
    .eq('organisation_id', organisationId)
    .single();

  if (fetchError) throw fetchError;

  await supabase
    .from('material_intents')
    .update({
      status: 'In Transit',
      dc_id: dcId,
      in_transit_qty: intent.reserved_qty || 0,
      reserved_qty: 0,
    })
    .eq('id', intentId)
    .eq('organisation_id', organisationId);
}

// Auto-update intent status to Fulfilled when all items received
export async function checkAndUpdateIntentStatus(intentId: string): Promise<void> {
  const { data: intent, error: fetchError } = await supabase
    .from('material_intents')
    .select('requested_qty, received_qty, in_transit_qty')
    .eq('id', intentId)
    .single();

  if (fetchError) throw fetchError;

  const totalReceived = (intent.received_qty || 0);
  const totalRequested = intent.requested_qty || 0;

  if (totalReceived >= totalRequested && intent.status !== 'Fulfilled') {
    await supabase
      .from('material_intents')
      .update({
        status: 'Fulfilled',
        in_transit_qty: 0,
      })
      .eq('id', intentId);
  }
}
