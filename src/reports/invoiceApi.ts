import { supabase } from '../supabase';

// Invoice API functions for fetching real organization data

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  client_name?: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  organisation_id: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  item_id: string;
  item_name?: string;
  hsn_code?: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  tax_rate: number;
  tax_amount: number;
  organisation_id: string;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  organisation_id: string;
}

export interface HSNData {
  hsn_code: string;
  description?: string;
  total_quantity: number;
  total_amount: number;
  tax_amount: number;
  unit: string;
  invoices: string[];
}

// Fetch invoices for organization with filters
export const getInvoices = async (
  organisationId: string,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    month?: number;
    year?: number;
    clientIds?: string[];
    status?: string[];
  }
) => {
  let query = supabase
    .from('invoices')
    .select(`
      *,
      clients(name, email),
      invoice_line_items(
        id,
        item_id,
        quantity,
        unit_price,
        total_amount,
        tax_rate,
        tax_amount,
        items(name, hsn_code)
      )
    `)
    .eq('organisation_id', organisationId)
    .order('invoice_date', { ascending: false });

  // Apply date filters
  if (filters?.dateFrom) {
    query = query.gte('invoice_date', filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte('invoice_date', filters.dateTo);
  }

  // Apply month/year filter
  if (filters?.month && filters?.year) {
    const startDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`;
    const endDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-31`;
    query = query.gte('invoice_date', startDate).lte('invoice_date', endDate);
  }

  // Apply client filter
  if (filters?.clientIds && filters.clientIds.length > 0) {
    query = query.in('client_id', filters.clientIds);
  }

  // Apply status filter
  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as any[];
};

// Fetch clients for organization
export const getClients = async (organisationId: string) => {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('name', { ascending: true });

  if (error) throw error;
  return data as Client[];
};

// Fetch invoice line items for detailed breakdown
export const getInvoiceLineItems = async (
  organisationId: string,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    month?: number;
    year?: number;
    clientIds?: string[];
  }
) => {
  let query = supabase
    .from('invoice_line_items')
    .select(`
      *,
      invoices(invoice_number, invoice_date, due_date, status),
      items(name, hsn_code),
      clients(name)
    `)
    .eq('invoice_line_items.organisation_id', organisationId)
    .order('invoice_date', { ascending: false });

  // Apply date filters through invoices table
  if (filters?.dateFrom) {
    query = query.gte('invoices.invoice_date', filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte('invoices.invoice_date', filters.dateTo);
  }

  // Apply month/year filter
  if (filters?.month && filters?.year) {
    const startDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`;
    const endDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-31`;
    query = query.gte('invoices.invoice_date', startDate).lte('invoices.invoice_date', endDate);
  }

  // Apply client filter
  if (filters?.clientIds && filters.clientIds.length > 0) {
    query = query.in('invoices.client_id', filters.clientIds);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as any[];
};

// Fetch HSN-wise data for reports
export const getHSNReportData = async (
  organisationId: string,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    month?: number;
    year?: number;
    clientIds?: string[];
  }
) => {
  // This would typically be a more complex query with grouping
  // For now, we'll fetch line items and group them in the application
  const lineItems = await getInvoiceLineItems(organisationId, filters);
  
  // Group by HSN code
  const hsnMap = new Map<string, HSNData>();
  
  lineItems.forEach(item => {
    const hsnCode = item.hsn_code || 'UNKNOWN';
    const existing = hsnMap.get(hsnCode) || {
      hsn_code: hsnCode,
      description: `HSN ${hsnCode}`,
      total_quantity: 0,
      total_amount: 0,
      tax_amount: 0,
      unit: 'Units',
      invoices: []
    };
    
    existing.total_quantity += item.quantity;
    existing.total_amount += item.total_amount;
    existing.tax_amount += item.tax_amount;
    
    if (item.invoice_number && !existing.invoices.includes(item.invoice_number)) {
      existing.invoices.push(item.invoice_number);
    }
    
    hsnMap.set(hsnCode, existing);
  });
  
  return Array.from(hsnMap.values());
};

// Get invoice summary statistics
export const getInvoiceSummaryStats = async (
  organisationId: string,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    month?: number;
    year?: number;
    clientIds?: string[];
  }
) => {
  const invoices = await getInvoices(organisationId, filters);
  
  const totalInvoices = invoices.length;
  const totalAmount = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
  const paidInvoices = invoices.filter(inv => inv.status === 'paid').length;
  const pendingInvoices = invoices.filter(inv => inv.status === 'sent').length;
  const overdueInvoices = invoices.filter(inv => inv.status === 'overdue').length;
  const averageInvoiceValue = totalInvoices > 0 ? totalAmount / totalInvoices : 0;

  return {
    totalInvoices,
    totalAmount,
    paidInvoices,
    pendingInvoices,
    overdueInvoices,
    averageInvoiceValue
  };
};

// Get HSN summary statistics
export const getHSNSummaryStats = async (
  organisationId: string,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    month?: number;
    year?: number;
    clientIds?: string[];
  }
) => {
  const hsnData = await getHSNReportData(organisationId, filters);
  
  const totalHSNItems = hsnData.length;
  const totalQuantity = hsnData.reduce((sum, hsn) => sum + hsn.total_quantity, 0);
  const totalAmount = hsnData.reduce((sum, hsn) => sum + hsn.total_amount, 0);
  const totalTax = hsnData.reduce((sum, hsn) => sum + hsn.tax_amount, 0);
  const averageHSNValue = totalHSNItems > 0 ? totalAmount / totalHSNItems : 0;

  return {
    totalHSNItems,
    totalQuantity,
    totalAmount,
    totalTax,
    averageHSNValue
  };
};
