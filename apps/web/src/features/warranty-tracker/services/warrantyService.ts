import { supabase } from '@/supabase';

export const warrantyService = {
  async updateMaterialWarrantySettings(payload: {
    material_id: string;
    organisation_id: string;
    has_warranty: boolean;
    warranty_period?: number;
    warranty_unit?: 'months' | 'years';
    has_serial_number: boolean;
    serial_number_format?: string;
  }) {
    const { data, error } = await supabase.rpc('update_material_warranty_settings', {
      p_material_id: payload.material_id,
      p_organisation_id: payload.organisation_id,
      p_has_warranty: payload.has_warranty,
      p_warranty_period: payload.warranty_period || null,
      p_warranty_unit: payload.warranty_unit || null,
      p_has_serial_number: payload.has_serial_number,
      p_serial_number_format: payload.serial_number_format || null,
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async updateGRNItemSerials(payload: {
    grn_item_id: string;
    organisation_id: string;
    serial_number?: string;
    warranty_start_date?: string;
    warranty_end_date?: string;
  }) {
    const { data, error } = await supabase.rpc('update_grn_item_serials', {
      p_grn_item_id: payload.grn_item_id,
      p_organisation_id: payload.organisation_id,
      p_serial_number: payload.serial_number || null,
      p_warranty_start_date: payload.warranty_start_date || null,
      p_warranty_end_date: payload.warranty_end_date || null,
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async allocateSerialsToDC(payload: {
    dc_item_id: string;
    organisation_id: string;
    serial_numbers?: string[];
    warranty_start_date?: string;
    warranty_end_date?: string;
  }) {
    const { data, error } = await supabase.rpc('allocate_serials_to_dc', {
      p_dc_item_id: payload.dc_item_id,
      p_organisation_id: payload.organisation_id,
      p_serial_numbers: payload.serial_numbers || null,
      p_warranty_start_date: payload.warranty_start_date || null,
      p_warranty_end_date: payload.warranty_end_date || null,
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async getWarrantyTrackerData(payload: {
    organisation_id: string;
    filter_customer_id?: string;
    filter_item_id?: string;
    filter_expiry_days?: number;
    filter_status?: string;
  }) {
    const { data, error } = await supabase.rpc('get_warranty_tracker_data', {
      p_organisation_id: payload.organisation_id,
      p_filter_customer_id: payload.filter_customer_id || null,
      p_filter_item_id: payload.filter_item_id || null,
      p_filter_expiry_days: payload.filter_expiry_days || null,
      p_filter_status: payload.filter_status || null,
    });

    if (error) throw new Error(error.message);
    return data || [];
  },
};
