import { supabase } from './supabase';

export async function initializeDatabase() {
  const tables = [
    {
      name: 'projects',
      create: `
        CREATE TABLE IF NOT EXISTS projects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          client_name VARCHAR(255),
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'materials',
      create: `
        CREATE TABLE IF NOT EXISTS materials (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          unit VARCHAR(50) NOT NULL,
          default_rate DECIMAL(10,2),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'delivery_challans',
      create: `
        CREATE TABLE IF NOT EXISTS delivery_challans (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          dc_number VARCHAR(50) UNIQUE NOT NULL,
          project_id UUID REFERENCES projects(id),
          dc_date DATE NOT NULL,
          client_name VARCHAR(255),
          site_address TEXT,
          vehicle_number VARCHAR(50),
          driver_name VARCHAR(100),
          dc_type VARCHAR(20) DEFAULT 'billable',
          remarks TEXT,
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'delivery_challan_items',
      create: `
        CREATE TABLE IF NOT EXISTS delivery_challan_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          delivery_challan_id UUID REFERENCES delivery_challans(id) ON DELETE CASCADE,
          material_id UUID REFERENCES materials(id),
          material_name VARCHAR(255) NOT NULL,
          unit VARCHAR(50) NOT NULL,
          size VARCHAR(100),
          quantity DECIMAL(10,2) NOT NULL,
          rate DECIMAL(10,2),
          amount DECIMAL(10,2),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    }
  ];

  return { success: true, message: 'Database ready' };
}

export async function fetchProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('project_name', { ascending: true });
  if (error) {
    // Fallback to 'name' if project_name fetch fails
    const { data: fallback, error: err2 } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (err2) throw err2;
    return fallback;
  }
  return data;
}

export async function createProject(project) {
  const { data, error } = await supabase
    .from('projects')
    .insert(project)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchMaterials() {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
}

export async function createMaterial(material) {
  const { data, error } = await supabase
    .from('materials')
    .insert(material)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchDeliveryChallans(filters = {}) {
  let query = supabase
    .from('delivery_challans')
    .select(`
      *,
      project:projects(project_name),
      items:delivery_challan_items(*)
    `)
    .order('dc_date', { ascending: false });

  if (filters.projectId) {
    query = query.eq('project_id', filters.projectId);
  }
  if (filters.startDate) {
    query = query.gte('dc_date', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('dc_date', filters.endDate);
  }
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters.dc_type) {
    query = query.eq('dc_type', filters.dc_type);
  }
  /*
  if (filters.organisation_id) {
    query = query.eq('organisation_id', filters.organisation_id);
  }
  */

  const { data, error } = await query;
  if (error) {
    // If project_name fetch fails, try fallback to 'name'
    const retryQuery = supabase
      .from('delivery_challans')
      .select(`
        *,
        project:projects(name),
        items:delivery_challan_items(*)
      `)
      .order('dc_date', { ascending: false });
    
    const { data: retryData, error: retryError } = await retryQuery;
    if (retryError) throw retryError;
    return retryData;
  }
  return data;
}

export async function fetchDeliveryChallanById(id) {
  const { data, error } = await supabase
    .from('delivery_challans')
    .select(`
      *,
      project:projects(name),
      items:delivery_challan_items(*)
    `)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createDeliveryChallan(challan) {
  const dcType = challan.dc_type || 'billable';
  const prefix = dcType === 'billable' ? 'DC-' : 'NBDC-';

  const { data: existingDCs } = await supabase
    .from('delivery_challans')
    .select('dc_number')
    .eq('dc_type', dcType)
    .order('dc_number', { ascending: false })
    .limit(1);
  
  let newDcNumber = `${prefix}0001`;
  if (existingDCs && existingDCs.length > 0) {
    const lastNumStr = existingDCs[0].dc_number.replace(prefix, '');
    const lastNum = parseInt(lastNumStr);
    if (!isNaN(lastNum)) {
      newDcNumber = `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
    }
  }

  const { data: challanData, error: challanError } = await supabase
    .from('delivery_challans')
    .insert({ ...challan, dc_number: newDcNumber, dc_type: dcType })
    .select()
    .single();
  
  if (challanError) throw challanError;
  return { ...challanData, dc_number: newDcNumber };
}

export async function updateDeliveryChallan(id, updates) {
  const { data, error } = await supabase
    .from('delivery_challans')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDeliveryChallan(id) {
  const { error } = await supabase
    .from('delivery_challans')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return { success: true };
}

export async function addDeliveryChallanItems(challanId, items) {
  const itemsWithChallanId = items.map(item => ({
    ...item,
    delivery_challan_id: challanId,
    amount: item.quantity && item.rate ? parseFloat(item.quantity) * parseFloat(item.rate) : 0
  }));

  const { data, error } = await supabase
    .from('delivery_challan_items')
    .insert(itemsWithChallanId)
    .select();
  if (error) throw error;
  return data;
}

export async function updateDeliveryChallanItems(challanId, items) {
  await supabase
    .from('delivery_challan_items')
    .delete()
    .eq('delivery_challan_id', challanId);

  const itemsWithChallanId = items.map(item => ({
    ...item,
    delivery_challan_id: challanId,
    amount: item.quantity && item.rate ? parseFloat(item.quantity) * parseFloat(item.rate) : 0
  }));

  const { data, error } = await supabase
    .from('delivery_challan_items')
    .insert(itemsWithChallanId)
    .select();
  if (error) throw error;
  return data;
}

export async function getConsolidationDateWise(filters = {}) {
  let query = supabase
    .from('delivery_challans')
    .select(`
      id,
      dc_number,
      dc_date,
      client_name,
      items:delivery_challan_items(
        id,
        material_name,
        unit,
        size,
        quantity,
        rate,
        amount
      )
    `)
    .eq('status', 'active');

  if (filters.projectId) {
    query = query.eq('project_id', filters.projectId);
  }
  if (filters.startDate) {
    query = query.gte('dc_date', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('dc_date', filters.endDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getConsolidationMaterialWise(filters = {}) {
  let query = supabase
    .from('delivery_challan_items')
    .select(`
      id,
      material_name,
      unit,
      size,
      quantity,
      rate,
      amount,
      delivery_challan:delivery_challans(
        id,
        dc_number,
        dc_date,
        client_name
      )
    `);

  const { data: challans, error: challanError } = await supabase
    .from('delivery_challans')
    .select('id')
    .eq('status', 'active');

  if (challanError) throw challanError;

  const { data, error } = await supabase
    .from('delivery_challan_items')
    .select(`
      *,
      delivery_challan:delivery_challans(dc_number, dc_date, client_name)
    `);

  if (error) throw error;
  return data;
}

export async function fetchQuotations(filters = {}) {
  let query = supabase
    .from('quotation_header')
    .select(`
      *,
      client:clients(id, client_name, gstin, state),
      project:projects(id, project_name),
      items:quotation_items(*)
    `)
    .order('created_at', { ascending: false });

  if (filters.clientId) {
    query = query.eq('client_id', filters.clientId);
  }
  if (filters.projectId) {
    query = query.eq('project_id', filters.projectId);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.startDate) {
    query = query.gte('date', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('date', filters.endDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchQuotationById(id) {
  const { data, error } = await supabase
    .from('quotation_header')
    .select(`
      *,
      client:clients(*),
      project:projects(id, project_name, project_code),
      items:quotation_items(*)
    `)
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data;
}

export async function createQuotation(quotation) {
  const { data: existing } = await supabase
    .from('quotation_header')
    .select('quotation_no')
    .order('created_at', { ascending: false })
    .limit(1);
  
  let quotationNo = 'QT-0001';
  if (existing && existing.length > 0) {
    const lastNum = parseInt(existing[0].quotation_no.replace(/[^0-9]/g, ''));
    quotationNo = `QT-${String(lastNum + 1).padStart(4, '0')}`;
  }

  const { data, error } = await supabase
    .from('quotation_header')
    .insert({ ...quotation, quotation_no: quotationNo })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateQuotation(id, updates) {
  const { data, error } = await supabase
    .from('quotation_header')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteQuotation(id) {
  const { error } = await supabase
    .from('quotation_header')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  return { success: true };
}

export async function createQuotationItems(quotationId, items) {
  const itemsWithQuotationId = items.map(item => ({
    ...item,
    quotation_id: quotationId,
    line_total: calculateLineTotal(item)
  }));

  const { data, error } = await supabase
    .from('quotation_items')
    .insert(itemsWithQuotationId)
    .select();
  
  if (error) throw error;
  return data;
}

export async function updateQuotationItems(quotationId, items) {
  await supabase
    .from('quotation_items')
    .delete()
    .eq('quotation_id', quotationId);

  const itemsWithQuotationId = items.map(item => ({
    ...item,
    quotation_id: quotationId,
    line_total: calculateLineTotal(item)
  }));

  const { data, error } = await supabase
    .from('quotation_items')
    .insert(itemsWithQuotationId)
    .select();
  
  if (error) throw error;
  return data;
}

function calculateLineTotal(item) {
  const qty = parseFloat(item.qty) || 0;
  const rate = parseFloat(item.rate) || 0;
  const gross = qty * rate;
  const discountPercent = parseFloat(item.discount_percent) || 0;
  const discountAmount = (gross * discountPercent) / 100;
  const taxable = gross - discountAmount;
  const taxPercent = parseFloat(item.tax_percent) || 0;
  const taxAmount = (taxable * taxPercent) / 100;
  return taxable + taxAmount;
}

export async function duplicateQuotation(id) {
  const original = await fetchQuotationById(id);
  
  const { data: existing } = await supabase
    .from('quotation_header')
    .select('quotation_no')
    .order('created_at', { ascending: false })
    .limit(1);
  
  let quotationNo = 'QT-0001';
  if (existing && existing.length > 0) {
    const lastNum = parseInt(existing[0].quotation_no.replace(/[^0-9]/g, ''));
    quotationNo = `QT-${String(lastNum + 1).padStart(4, '0')}`;
  }

  const newQuotation = {
    quotation_no: quotationNo,
    client_id: original.client_id,
    project_id: original.project_id,
    billing_address: original.billing_address,
    gstin: original.gstin,
    state: original.state,
    date: new Date().toISOString().split('T')[0],
    valid_till: original.valid_till,
    payment_terms: original.payment_terms,
    contact_no: original.contact_no || null,
    remarks: original.remarks || original.reference || null,
    reference: original.reference,
    subtotal: original.subtotal,
    total_item_discount: original.total_item_discount,
    extra_discount_percent: original.extra_discount_percent,
    extra_discount_amount: original.extra_discount_amount,
    total_tax: original.total_tax,
    round_off: original.round_off,
    grand_total: original.grand_total,
    status: 'Draft',
    negotiation_mode: false,
    revised_from_id: id
  };

  const { data, error } = await supabase
    .from('quotation_header')
    .insert(newQuotation)
    .select()
    .single();
  
  if (error) throw error;

  if (original.items && original.items.length > 0) {
    const itemsToInsert = original.items.map(item => ({
      quotation_id: data.id,
      item_id: item.item_id,
      variant_id: item.variant_id,
      description: item.description,
      qty: item.qty,
      uom: item.uom,
      rate: item.rate,
      original_discount_percent: item.original_discount_percent,
      discount_percent: item.discount_percent,
      discount_amount: item.discount_amount,
      tax_percent: item.tax_percent,
      tax_amount: item.tax_amount,
      line_total: item.line_total,
      override_flag: false
    }));

    await supabase.from('quotation_items').insert(itemsToInsert);
  }

  return data;
}

/**
 * Creates a Lot-Based Quotation by consolidating multiple Delivery Challans
 * @param {Array<string>} dcIds - Array of DC UUIDs
 * @param {string} userId - UUID of the performing user
 */
export async function createQuotationFromDC(dcIds, userId) {
  try {
    // We use Supabase RPC to call the stored procedure defined in the database
    // This ensures the entire operation is wrapped in a single DB transaction
    const { data, error } = await supabase.rpc('create_quotation_from_dc', {
      p_dc_ids: dcIds,
      p_user_id: userId
    });

    if (error) {
      // Handle Postgres exceptions raised via RAISE EXCEPTION
      throw new Error(error.message);
    }

    return data;
  } catch (err) {
    console.error('ERP API Error [QuotationFromDC]:', err.message);
    throw err;
  }
}

export async function fetchDiscountProfiles() {
  const { data, error } = await supabase
    .from('discount_structures')
    .select('*')
    .eq('is_active', true)
    .order('structure_number');
  if (error) throw error;
  return data;
}

export async function fetchDiscountProfileById(id) {
  const { data, error } = await supabase
    .from('discount_structures')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchDiscountVariantSettings(profileId) {
  const { data, error } = await supabase
    .from('discount_variant_settings')
    .select('*, variant:company_variants(variant_name)')
    .eq('structure_id', profileId);
  if (error) throw error;
  return data;
}

export async function updateClientPricingProfile(clientId, profileId) {
  const { data, error } = await supabase
    .from('clients')
    .update({ discount_profile_id: profileId })
    .eq('id', clientId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchTemplates(documentType) {
  const { data, error } = await supabase
    .from('document_templates')
    .select('*')
    .eq('document_type', documentType)
    .eq('active', true)
    .order('is_default', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchTemplateById(id) {
  const { data, error } = await supabase
    .from('document_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function getDefaultTemplate(documentType) {
  const { data, error } = await supabase
    .from('document_templates')
    .select('*')
    .eq('document_type', documentType)
    .eq('is_default', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// ============================================
// BOQ API Functions
// ============================================

export async function fetchBOQList(filters = {}) {
  let query = supabase
    .from('boq_headers')
    .select(`
      *,
      client:clients(id, client_name),
      project:projects(id, project_name),
      sheets:boq_sheets(*)
    `)
    .order('created_at', { ascending: false });

  if (filters.clientId) {
    query = query.eq('client_id', filters.clientId);
  }
  if (filters.projectId) {
    query = query.eq('project_id', filters.projectId);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchBOQById(id) {
  const { data: header, error } = await supabase
    .from('boq_headers')
    .select(`
      *,
      client:clients(*),
      project:projects(*),
      sheets:boq_sheets(*, items:boq_items(*))
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return header;
}

export async function createBOQ(boq) {
  const { data: header, error } = await supabase
    .from('boq_headers')
    .insert(boq)
    .select()
    .single();

  if (error) throw error;
  return header;
}

export async function updateBOQ(id, updates) {
  const { data, error } = await supabase
    .from('boq_headers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBOQ(id) {
  const { error } = await supabase
    .from('boq_headers')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}

export async function createBOQSheets(boqHeaderId, sheets) {
  const sheetsWithHeaderId = sheets.map((sheet, index) => ({
    ...sheet,
    boq_header_id: boqHeaderId,
    sheet_order: index + 1
  }));

  const { data, error } = await supabase
    .from('boq_sheets')
    .insert(sheetsWithHeaderId)
    .select();

  if (error) throw error;
  return data;
}

export async function updateBOQItems(boqSheetId, items) {
  await supabase
    .from('boq_items')
    .delete()
    .eq('boq_sheet_id', boqSheetId);

  const itemsWithSheetId = items.map((item, index) => {
    const description = item.description || '';
    const material = item.material || description || null;
    const specification = item.specification || '';
    return {
      boq_sheet_id: boqSheetId,
      row_order: index + 1,
      is_header_row: !!item.isHeaderRow,
      header_text: item.headerText || null,
      item_id: item.itemId || null,
      variant_id: item.variantId || null,
      make: item.make || null,
      quantity: item.quantity || 0,
      rate: item.rate || 0,
      discount_percent: item.discountPercent || 0,
      specification: specification || null,
      remarks: item.remarks || null,
      pressure: item.pressure || null,
      thickness: item.thickness || null,
      schedule: item.schedule || null,
      material,
      updated_at: new Date().toISOString()
    };
  }).filter(item => !item.is_header_row || item.header_text);

  if (itemsWithSheetId.length > 0) {
    const { data, error } = await supabase
      .from('boq_items')
      .insert(itemsWithSheetId)
      .select();
    if (error) throw error;
    return data;
  }
  return [];
}

export async function saveBOQ(boqData) {
  const { id, boqNo, revisionNo, date, clientId, projectId, variantId, status, termsConditions, preface } = boqData;

  let headerId = id;

  if (!id) {
    const header = await createBOQ({
      boq_no: boqNo,
      revision_no: revisionNo || 1,
      boq_date: date,
      client_id: clientId,
      project_id: projectId,
      variant_id: variantId,
      status: status || 'Draft',
      terms_conditions: termsConditions,
      preface: preface
    });
    headerId = header.id;
  } else {
    await updateBOQ(id, {
      boq_no: boqNo,
      revision_no: revisionNo,
      boq_date: date,
      client_id: clientId,
      project_id: projectId,
      variant_id: variantId,
      status: status,
      terms_conditions: termsConditions,
      preface: preface
    });
  }

  return headerId;
}

export async function saveBOQWithItems(boqData, sheets, itemsMap) {
  const headerId = await saveBOQ(boqData);

  for (const sheet of sheets) {
    if (!sheet.id || sheet.id.startsWith('temp-')) {
      const newSheet = {
        boq_header_id: headerId,
        sheet_name: sheet.name,
        sheet_order: sheets.indexOf(sheet) + 1,
        is_default: sheet.isDefault || false
      };
      const { data: createdSheet } = await supabase
        .from('boq_sheets')
        .insert(newSheet)
        .select()
        .single();
      
      if (createdSheet && itemsMap[sheet.id]) {
        await updateBOQItems(createdSheet.id, itemsMap[sheet.id]);
      }
    } else if (itemsMap[sheet.id]) {
      await updateBOQItems(sheet.id, itemsMap[sheet.id]);
    }
  }

  return headerId;
}
