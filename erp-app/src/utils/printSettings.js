import { supabase } from '../supabase';

const LOCAL_STORAGE_KEY = 'mep_print_settings';

/**
 * Default print settings structure
 */
export const DEFAULT_PRINT_SETTINGS = {
  margins: { top: 10, bottom: 10, left: 15, right: 15 },
  font_sizes: { header: 12, body: 9, footer: 8, table_head: 10 },
  visibility: {
    show_logo: true,
    show_bank_details: true,
    show_tax_column: true,
    show_discount: true,
    show_signature: true,
    show_hsn: true
  },
  colors: { primary: '#3b82f6', text: '#1f2937', border: '#e5e7eb' }
};

/**
 * Fetches print settings for a specific document type
 * @param {string} docType - 'Quotation', 'Invoice', or 'DC'
 */
export async function getPrintSettings(docType) {
  try {
    // 1. Try to get from Supabase
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('document_type', docType)
      .eq('is_default', true)
      .maybeSingle();

    if (data) {
      return {
        id: data.id,
        column_settings: data.column_settings || {},
        style_settings: data.style_settings || DEFAULT_PRINT_SETTINGS,
        header_settings: data.header_settings || {},
        footer_settings: data.footer_settings || {}
      };
    }

    // 2. Fallback to Local Storage
    const local = localStorage.getItem(`${LOCAL_STORAGE_KEY}_${docType}`);
    if (local) return JSON.parse(local);

    // 3. Absolute Fallback
    return { style_settings: DEFAULT_PRINT_SETTINGS };
  } catch (err) {
    console.error('Error loading print settings:', err);
    return { style_settings: DEFAULT_PRINT_SETTINGS };
  }
}

/**
 * Saves print settings
 */
export async function savePrintSettings(docType, settings) {
  try {
    // Save to Local Storage for instant persistence
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_${docType}`, JSON.stringify(settings));

    // Save to Supabase if ID exists
    if (settings.id) {
      const { error } = await supabase
        .from('document_templates')
        .update({
          style_settings: settings.style_settings,
          column_settings: settings.column_settings,
          updated_at: new Date().toISOString()
        })
        .eq('id', settings.id);
      
      if (error) throw error;
    }
    
    return { success: true };
  } catch (err) {
    console.error('Error saving print settings:', err);
    return { success: false, error: err.message };
  }
}
