// ============================================
// SALES ORDER MODULE - REACT QUERY HOOKS
// Single statement-management layer for sales orders: key factory, typed
// queries, and mutations with cache invalidation. Pages must use these
// instead of ad-hoc supabase calls so caches stay coherent.
// ============================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { toast } from '../../lib/logger';

// ============================================
// QUERY KEY FACTORY
// ============================================
export const salesKeys = {
  all: ['sales-orders'] as const,
  lists: () => [...salesKeys.all, 'list'] as const,
  list: (orgId?: string | null) => [...salesKeys.lists(), orgId] as const,
  details: () => [...salesKeys.all, 'detail'] as const,
  detail: (id: string) => [...salesKeys.details(), id] as const,
  items: (id: string) => [...salesKeys.all, 'items', id] as const,
  activity: (id: string) => [...salesKeys.all, 'activity', id] as const,
  summaries: (orgId?: string | null) => [...salesKeys.all, 'summaries', orgId] as const,
  jobCards: (id: string) => [...salesKeys.all, 'job-cards', id] as const,
};

export interface SalesOrderLineInput {
  id?: string;
  item_id: string;
  variant_id?: string | null;
  make?: string | null;
  description?: string;
  qty: number;
  uom?: string;
  rate: number;
  discount_percent?: number;
  tax_percent?: number;
  line_total?: number;
}

// ============================================
// QUERIES
// ============================================

export function useSalesOrders(orgId: string | undefined) {
  return useQuery({
    queryKey: salesKeys.list(orgId),
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          client:clients(client_name),
          project:projects(name)
        `)
        .eq('organisation_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });
}

export function useSalesOrderSummaries(orgId: string | undefined) {
  return useQuery({
    queryKey: salesKeys.summaries(orgId),
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('sales_orders')
        .select('id, sales_order_no, grand_total, status, order_date, created_at, client:clients(client_name)')
        .eq('organisation_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });
}

export function useSalesOrder(id: string | null | undefined) {
  return useQuery({
    queryKey: salesKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          client:clients(*),
          project:projects(*)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useSalesOrderItems(orderId: string | null | undefined) {
  return useQuery({
    queryKey: salesKeys.items(orderId || ''),
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from('sales_order_items')
        .select(`
          *,
          material:materials(*),
          variant:company_variants(variant_name)
        `)
        .eq('sales_order_id', orderId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orderId,
  });
}

export function useSalesOrderActivity(orderId: string | null | undefined) {
  return useQuery({
    queryKey: salesKeys.activity(orderId || ''),
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from('sales_order_activity_log')
        .select('*')
        .eq('sales_order_id', orderId)
        .order('created_at', { ascending: true });
      if (error) return [];
      return data || [];
    },
    enabled: !!orderId,
  });
}

// ============================================
// MUTATIONS
// ============================================

export interface CreateSalesOrderInput {
  orgId: string;
  userId: string | null;
  header: Record<string, any>;
  items: SalesOrderLineInput[];
  quotationId?: string | null;
  quoteNo?: string | null;
}

export function useCreateSalesOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSalesOrderInput) => {
      const { data: savedSo, error: soError } = await supabase
        .from('sales_orders')
        .insert(input.header)
        .select()
        .single();
      if (soError || !savedSo) throw soError;
      const soItems = input.items.map((item) => ({
        sales_order_id: savedSo.id,
        item_id: item.item_id,
        variant_id: item.variant_id || null,
        make: item.make || null,
        description: item.description,
        qty: item.qty,
        uom: item.uom,
        rate: item.rate,
        discount_percent: item.discount_percent,
        tax_percent: item.tax_percent,
        line_total: item.line_total,
      }));
      const { error: itemsError } = await supabase.from('sales_order_items').insert(soItems);
      if (itemsError) throw itemsError;
      supabase.from('sales_order_activity_log').insert({
        organisation_id: input.orgId,
        sales_order_id: savedSo.id,
        event_type: 'created',
        summary: {
          sales_order_no: (input.header as any).sales_order_no,
          total: (input.header as any).grand_total,
          ...(input.quotationId ? { converted_from_quotation: input.quotationId, quotation_no: input.quoteNo || null } : {}),
        },
        created_by: input.userId,
      }).then(({ error }: any) => { if (error) console.warn('SO activity log write failed:', error.message); });
      if (input.quotationId) {
        supabase.from('quotation_activity_log').insert({
          organisation_id: input.orgId,
          quotation_id: input.quotationId,
          event_type: 'converted',
          summary: { sales_order_id: savedSo.id, sales_order_no: (input.header as any).sales_order_no, total: (input.header as any).grand_total },
          created_by: input.userId,
        }).then(({ error }: any) => { if (error) console.warn('Quotation activity log write failed:', error.message); });
      }
      return savedSo;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: salesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: salesKeys.summaries(variables.orgId) });
    },
  });
}

export interface UpdateSalesOrderInput {
  orderId: string;
  orgId: string;
  userId: string | null;
  soNo: string;
  header: Record<string, any>;
  items: SalesOrderLineInput[];
}

export function useUpdateSalesOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateSalesOrderInput) => {
      const { error: headErr } = await supabase
        .from('sales_orders')
        .update(input.header)
        .eq('id', input.orderId);
      if (headErr) throw headErr;
      const { data: existing } = await supabase
        .from('sales_order_items')
        .select('id')
        .eq('sales_order_id', input.orderId);
      const existingIds = new Set((existing || []).map((r: any) => r.id));
      const keepIds = new Set(input.items.filter((i) => i.id).map((i) => i.id as string));
      const removed = [...existingIds].filter((x) => !keepIds.has(x));
      if (removed.length > 0) {
        await supabase.from('sales_order_reservations').delete().in('sales_order_item_id', removed);
        const { error: delErr } = await supabase.from('sales_order_items').delete().in('id', removed);
        if (delErr) throw delErr;
      }
      for (const item of input.items) {
        if (item.id) {
          const { id: _drop, hsn_code: _h, is_override: _o, ...fields } = item as any;
          const { error } = await supabase
            .from('sales_order_items')
            .update({ ...fields, variant_id: item.variant_id || null, make: item.make || null })
            .eq('id', item.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('sales_order_items').insert({
            sales_order_id: input.orderId,
            item_id: item.item_id,
            variant_id: item.variant_id || null,
            make: item.make || null,
            description: item.description,
            qty: item.qty,
            uom: item.uom,
            rate: item.rate,
            discount_percent: item.discount_percent,
            tax_percent: item.tax_percent,
            line_total: item.line_total,
          });
          if (error) throw error;
        }
      }
      supabase.from('sales_order_activity_log').insert({
        organisation_id: input.orgId,
        sales_order_id: input.orderId,
        event_type: 'edited',
        summary: { sales_order_no: input.soNo, total: (input.header as any).grand_total },
        created_by: input.userId,
      }).then(({ error }: any) => { if (error) console.warn('SO activity log write failed:', error.message); });
      return input.orderId;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: salesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: salesKeys.summaries(variables.orgId) });
      queryClient.invalidateQueries({ queryKey: salesKeys.detail(variables.orderId) });
      queryClient.invalidateQueries({ queryKey: salesKeys.items(variables.orderId) });
    },
  });
}

export function useDeleteSalesOrders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, orgId }: { ids: string[]; orgId: string }) => {
      const { data: lineIds } = await supabase
        .from('sales_order_items')
        .select('id')
        .in('sales_order_id', ids);
      const itemIds = (lineIds || []).map((r: any) => r.id);
      if (itemIds.length > 0) {
        await supabase.from('sales_order_reservations').delete().in('sales_order_item_id', itemIds);
        await supabase.from('sales_order_items').delete().in('id', itemIds);
      }
      const { error } = await supabase
        .from('sales_orders')
        .delete()
        .in('id', ids)
        .eq('organisation_id', orgId);
      if (error) throw error;
      return ids;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: salesKeys.all });
    },
  });
}

export function useDuplicateSalesOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, orgId }: { orderId: string; orgId: string }) => {
      const { data: soNo, error: noErr } = await supabase.rpc('generate_sales_order_no', { p_org_id: orgId });
      if (noErr || !soNo) throw noErr || new Error('Could not generate SO number');
      const { data: header, error: headErr } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('id', orderId)
        .single();
      if (headErr || !header) throw headErr || new Error('Order not found');
      const { data: lines } = await supabase
        .from('sales_order_items')
        .select('*')
        .eq('sales_order_id', orderId);
      const { id: _drop, sales_order_no: _no, quotation_id: _q, quotation_no: _qn, converted_at: _c, created_at: _ca, updated_at: _ua, cancelled_at: _x, closed_at: _cl, ...rest } = header as any;
      const { data: created, error: createErr } = await supabase
        .from('sales_orders')
        .insert({ ...rest, organisation_id: orgId, sales_order_no: soNo, status: 'draft' })
        .select()
        .single();
      if (createErr || !created) throw createErr || new Error('Duplicate failed');
      if (lines && lines.length > 0) {
        const { error: linesErr } = await supabase.from('sales_order_items').insert(
          lines.map((l: any) => {
            const { id: _lid, sales_order_id: _lso, created_at: _lca, ...lrest } = l;
            return { ...lrest, sales_order_id: created.id };
          })
        );
        if (linesErr) throw linesErr;
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salesKeys.lists() });
    },
  });
}
