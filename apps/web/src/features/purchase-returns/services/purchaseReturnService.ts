import { supabase } from '@/supabase';

export const purchaseReturnService = {
  async createPurchaseReturn(payload: {
    organisation_id: string;
    vendor_id: string;
    grn_id?: string;
    return_number?: string;
    return_date?: string;
    reason: string;
    return_type?: 'credit_note' | 'delivery_challan';
    items?: Array<{
      material_id: string;
      grn_item_id?: string;
      serial_number?: string;
      quantity: number;
      unit: string;
      batch_no?: string;
      warranty_start_date?: string;
      warranty_end_date?: string;
      reason?: string;
    }>;
    created_by?: string;
  }) {
    const { data, error } = await supabase.rpc('create_purchase_return', {
      p_organisation_id: payload.organisation_id,
      p_vendor_id: payload.vendor_id,
      p_grn_id: payload.grn_id || null,
      p_return_number: payload.return_number || null,
      p_return_date: payload.return_date || null,
      p_reason: payload.reason,
      p_return_type: payload.return_type || 'credit_note',
      p_items: payload.items || null,
      p_created_by: payload.created_by || null,
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async getPurchaseReturns(organisationId: string) {
    const { data, error } = await supabase
      .from('purchase_returns')
      .select(`
        *,
        vendor:vendor_id (company_name),
        grn:grn_id (grn_no)
      `)
      .eq('organisation_id', organisationId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getPurchaseReturnItems(purchaseReturnId: string) {
    const { data, error } = await supabase
      .from('purchase_return_items')
      .select(`
        *,
        material:material_id (name, item_code)
      `)
      .eq('purchase_return_id', purchaseReturnId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async updatePurchaseReturnStatus(purchaseReturnId: string, organisationId: string, status: string) {
    const { data, error } = await supabase
      .from('purchase_returns')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', purchaseReturnId)
      .eq('organisation_id', organisationId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async convertToDebitNote(purchaseReturnId: string, organisationId: string) {
    const { data, error } = await supabase.rpc('convert_purchase_return_to_debit_note', {
      p_purchase_return_id: purchaseReturnId,
      p_organisation_id: organisationId,
    });

    if (error) throw new Error(error.message);
    return data;
  },
};
