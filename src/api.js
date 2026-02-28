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
    .order('created_at', { ascending: false });
  if (error) throw error;
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
      project:projects(name),
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
  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;
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
  const { data: existingDCs } = await supabase
    .from('delivery_challans')
    .select('dc_number')
    .order('dc_number', { ascending: false })
    .limit(1);
  
  let newDcNumber = 'DC-0001';
  if (existingDCs && existingDCs.length > 0) {
    const lastNum = parseInt(existingDCs[0].dc_number.replace('DC-', ''));
    newDcNumber = `DC-${String(lastNum + 1).padStart(4, '0')}`;
  }

  const { data: challanData, error: challanError } = await supabase
    .from('delivery_challans')
    .insert({ ...challan, dc_number: newDcNumber })
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
