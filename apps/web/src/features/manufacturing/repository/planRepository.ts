import * as P from '../persistence';
import { supabase } from '../../../supabase';
import { ProductionPlan, ProductionPlanItem, JobCard } from '../model/types';
import { generateNextJobCardNumber } from './jobCardRepository';

export async function generateNextPlanNumber(orgId: string): Promise<string> {
  const { data, error } = await supabase
    .from('production_plans')
    .select('plan_no')
    .eq('organisation_id', orgId)
    .order('plan_no', { ascending: false })
    .limit(1);

  if (error) throw error;
  const last = data?.[0]?.plan_no;
  const next = last ? parseInt(last.replace('PP-', '')) + 1 : 1;
  return `PP-${String(next).padStart(4, '0')}`;
}

export interface DemandRequirement {
  product_id: string;
  product_name: string;
  bom_id: string | null;
  demand_qty: number;
  current_fg_stock: number;
  wip_qty: number;
  net_to_produce: number;
  linked_sales_orders: Array<{ order_id: string; order_no: string; qty: number; due_date: string }>;
}

export async function fetchDemandRequirements(orgId: string): Promise<DemandRequirement[]> {
  // 1. Fetch open sales orders
  const openOrders = await P.fetchOpenSalesOrders(orgId);

  // 2. Fetch warehouses to identify FG Store
  const warehouses = await P.fetchWarehouses(orgId);
  const fgWh = warehouses.find(w => w.warehouse_purpose === 'fg') || warehouses.find(w => w.is_default);

  // 3. Fetch active Job Cards to compute active WIP
  const jobCards = await P.fetchJobCards(orgId);
  const activeJobCards = jobCards.filter(jc => jc.status === 'in_progress' || jc.status === 'issued');

  // 4. Fetch BOM headers to link products to BOMs
  const { data: boms } = await supabase
    .from('bom_headers')
    .select('id, product_id')
    .eq('organisation_id', orgId)
    .eq('is_active', true);

  // Map product to BOM ID
  const bomMap: Record<string, string> = {};
  boms?.forEach(bom => {
    bomMap[bom.product_id] = bom.id;
  });

  // Aggregate customer demands by product_id
  const demandMap: Record<string, {
    product_name: string;
    demand_qty: number;
    linked: Array<{ order_id: string; order_no: string; qty: number; due_date: string }>;
  }> = {};

  openOrders.forEach(order => {
    const items = (order as any).sales_order_items || [];
    items.forEach((item: any) => {
      const remaining = Math.max(0, item.quantity - (item.delivered_qty || 0));
      if (remaining > 0) {
        if (!demandMap[item.material_id]) {
          demandMap[item.material_id] = {
            product_name: item.materials?.name || 'Unknown',
            demand_qty: 0,
            linked: []
          };
        }
        demandMap[item.material_id].demand_qty += remaining;
        demandMap[item.material_id].linked.push({
          order_id: order.id,
          order_no: order.order_no,
          qty: remaining,
          due_date: order.delivery_date || ''
        });
      }
    });
  });

  // Calculate Net requirements per product
  const results: DemandRequirement[] = [];

  for (const productId of Object.keys(demandMap)) {
    const demandInfo = demandMap[productId];

    // Look up FG stock
    let fgStock = 0;
    if (fgWh) {
      const stockRow = await P.fetchItemStockSingle(productId, fgWh.id, orgId);
      fgStock = stockRow?.current_stock || 0;
    }

    // Look up WIP
    const productActiveCards = activeJobCards.filter(jc => {
      return jc.bom_headers?.product_id === productId;
    });
    const wipQty = productActiveCards.reduce((acc, curr) => acc + (curr.planned_qty || 0), 0);

    const netToProduce = Math.max(0, demandInfo.demand_qty - fgStock - wipQty);

    results.push({
      product_id: productId,
      product_name: demandInfo.product_name,
      bom_id: bomMap[productId] || null,
      demand_qty: demandInfo.demand_qty,
      current_fg_stock: fgStock,
      wip_qty: wipQty,
      net_to_produce: netToProduce,
      linked_sales_orders: demandInfo.linked
    });
  }

  return results;
}

export async function createProductionPlanAggregate(
  plan: Omit<ProductionPlan, 'id' | 'plan_no' | 'created_at' | 'updated_at'>,
  items: Omit<ProductionPlanItem, 'id' | 'plan_id' | 'created_at'>[],
  orgId: string,
  userId: string
) {
  const planNo = await generateNextPlanNumber(orgId);
  const createdPlan = await P.insertProductionPlan({
    ...plan,
    plan_no: planNo,
    organisation_id: orgId,
    created_by: userId
  });

  const planId = createdPlan.id!;

  const itemsPayload = items.map(item => ({
    ...item,
    plan_id: planId,
    organisation_id: orgId
  }));

  const createdItems = await P.insertProductionPlanItems(itemsPayload);

  // Log activity
  await P.insertActivityLog({
    entity_type: 'production_plan',
    entity_id: planId,
    action: 'created',
    action_details: {
      plan_no: planNo,
      items_count: createdItems.length
    },
    user_id: userId,
    user_name: 'Plant Manager',
    organisation_id: orgId
  });

  return {
    plan: createdPlan,
    items: createdItems
  };
}

export async function convertPlanToJobCardsAggregate(
  planId: string,
  itemIds: string[],
  orgId: string,
  userId: string
) {
  const plan = await P.fetchProductionPlanById(planId);
  if (!plan) throw new Error('Plan not found');

  const allItems = await P.fetchProductionPlanItems(planId);
  const selectedItems = allItems.filter(item => itemIds.includes(item.id!));

  const createdJobCardIds: string[] = [];

  for (const item of selectedItems) {
    if (item.status !== 'pending') continue;
    if (!item.bom_id) {
      throw new Error(`Cannot schedule product ${item.product_name} because it has no BOM schema`);
    }

    // 1. Generate Job Card number
    const jcNo = await generateNextJobCardNumber(orgId);

    // 2. Insert Job Card
    const { data: jobCard, error: jcErr } = await supabase
      .from('job_cards')
      .insert([{
        job_card_no: jcNo,
        bom_id: item.bom_id,
        planned_qty: item.planned_qty || item.net_to_produce,
        output_unit: item.materials?.unit || 'Nos',
        status: 'draft',
        organisation_id: orgId,
        created_by: userId
      }])
      .select()
      .single();

    if (jcErr) throw jcErr;

    const jobCardId = jobCard.id;
    createdJobCardIds.push(jobCardId);

    // 3. Load and replicate BOM ingredients into job_card_materials
    const bomItems = await P.fetchBomItems(item.bom_id);
    const jcMaterialsPayload = bomItems.map(bi => ({
      job_card_id: jobCardId,
      material_id: bi.material_id,
      planned_qty: bi.qty * (item.planned_qty || item.net_to_produce),
      issued_qty: 0,
      consumed_qty: 0,
      wastage_qty: 0,
      return_qty: 0,
      unit: bi.unit,
      organisation_id: orgId
    }));

    if (jcMaterialsPayload.length > 0) {
      const { error: jcmErr } = await supabase
        .from('job_card_materials')
        .insert(jcMaterialsPayload);
      if (jcmErr) throw jcmErr;
    }

    // 4. Link Sales Orders to Job Card for tracing
    if (item.linked_sales_orders && item.linked_sales_orders.length > 0) {
      // Find open sales order items mapping to this product
      const orderIds = item.linked_sales_orders.map(o => o.order_id);
      const { data: orderLines } = await supabase
        .from('sales_order_items')
        .select('id, sales_order_id, quantity, delivered_qty')
        .eq('material_id', item.product_id)
        .in('sales_order_id', orderIds);

      if (orderLines && orderLines.length > 0) {
        const linksPayload = orderLines.map(line => {
          const matchingOrder = item.linked_sales_orders?.find(o => o.order_id === line.sales_order_id);
          const allocated = matchingOrder ? Math.min(line.quantity - (line.delivered_qty || 0), matchingOrder.qty) : line.quantity;
          
          return {
            sales_order_item_id: line.id,
            job_card_id: jobCardId,
            allocated_qty: allocated,
            organisation_id: orgId
          };
        });
        await P.insertSalesOrderProductionLink(linksPayload);
      }
    }

    // 5. Update plan item status to scheduled
    await P.updateProductionPlanItem(item.id!, {
      status: 'scheduled',
      linked_job_card_ids: [...(item.linked_job_card_ids || []), jobCardId]
    });
  }

  // 6. Update plan status if all items scheduled
  const refreshedItems = await P.fetchProductionPlanItems(planId);
  const allScheduled = refreshedItems.every(i => i.status === 'scheduled');
  if (allScheduled) {
    await P.updateProductionPlan(planId, { status: 'in_progress' });
  }

  return createdJobCardIds;
}
