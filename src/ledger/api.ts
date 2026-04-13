import { supabase } from '@/supabase';

export type LedgerClient = {
  id: string;
  name: string;
  org_id: string | null;
  gstin?: string | null;
  state?: string | null;
  email?: string | null;
  contact?: string | null;
};

export type OpeningBalance = {
  id: string;
  client_id: string;
  organisation_id: string;
  financial_year: string;
  amount: number;
  as_of_date: string | null;
  remarks: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type OpeningBalanceInput = {
  client_id: string;
  organisation_id: string;
  financial_year: string;
  amount: number;
  as_of_date?: string;
  remarks?: string;
};

export type BulkOpeningBalanceInput = {
  client_id: string;
  amount: number;
  as_of_date?: string;
  remarks?: string;
};

export type LedgerInvoice = {
  id: string;
  org_id: string | null;
  client_id: string;
  invoice_no: string;
  invoice_date: string | null;
  due_date: string | null;
  total: number;
  remarks: string | null;
  created_at: string | null;
  client?: { id: string; client_name?: string | null; name?: string | null } | null;
};

export type LedgerReceipt = {
  id: string;
  org_id: string;
  client_id: string;
  invoice_id?: string | null;
  receipt_no?: string | null;
  amount: number;
  receipt_date: string;
  remarks?: string | null;
  payment_type?: string | null;
  created_at?: string | null;
};

export type LedgerDateRange = {
  startDate: string;
  endDate: string;
};

export type ReceiptInput = {
  org_id: string;
  client_id: string;
  amount: number;
  receipt_date: string;
  remarks: string;
  payment_type?: string | null;
};

export async function listLedgerClients(orgId: string): Promise<LedgerClient[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, org_id, client_name, name, gstin, gst_number, state, email, contact')
    .or(`org_id.eq.${orgId},org_id.is.null`)
    .order('client_name', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    name: String(row.name ?? row.client_name ?? 'Unnamed client'),
    org_id: row.org_id ?? null,
    gstin: row.gstin ?? row.gst_number ?? null,
    state: row.state ?? null,
    email: row.email ?? null,
    contact: row.contact ?? null,
  }));
}

export async function listLedgerInvoices(orgId: string, range: LedgerDateRange): Promise<LedgerInvoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('id, org_id, client_id, invoice_no, invoice_date, due_date, total, remarks, created_at, client:clients(id, client_name, name)')
    .eq('org_id', orgId)
    .gte('invoice_date', range.startDate)
    .lte('invoice_date', range.endDate)
    .order('invoice_date', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any, index: number) => ({
    id: String(row.id),
    org_id: row.org_id ?? null,
    client_id: String(row.client_id),
    invoice_no: String(row.invoice_no ?? `INV-${String(index + 1).padStart(4, '0')}`),
    invoice_date: row.invoice_date ?? null,
    due_date: row.due_date ?? null,
    total: Number(row.total ?? 0),
    remarks: row.remarks ?? null,
    created_at: row.created_at ?? null,
    client: row.client
      ? {
          id: String(row.client.id),
          client_name: row.client.client_name ?? null,
          name: row.client.name ?? null,
        }
      : null,
  }));
}

export async function listLedgerReceipts(orgId: string, range: LedgerDateRange): Promise<LedgerReceipt[]> {
  const { data, error } = await supabase
    .from('receipts')
    .select('id, org_id, client_id, invoice_id, receipt_no, amount, receipt_date, remarks, payment_type, created_at')
    .eq('org_id', orgId)
    .gte('receipt_date', range.startDate)
    .lte('receipt_date', range.endDate)
    .order('receipt_date', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    org_id: String(row.org_id),
    client_id: String(row.client_id),
    invoice_id: row.invoice_id ?? null,
    receipt_no: row.receipt_no ?? null,
    amount: Number(row.amount ?? 0),
    receipt_date: String(row.receipt_date),
    remarks: row.remarks ?? null,
    payment_type: row.payment_type ?? null,
    created_at: row.created_at ?? null,
  }));
}

export async function createReceipt(input: ReceiptInput): Promise<LedgerReceipt> {
  const { data, error } = await supabase
    .from('receipts')
    .insert({
      org_id: input.org_id,
      client_id: input.client_id,
      amount: input.amount,
      receipt_date: input.receipt_date,
      remarks: input.remarks || null,
      payment_type: input.payment_type || null,
    })
    .select('id, org_id, client_id, invoice_id, receipt_no, amount, receipt_date, remarks, payment_type, created_at')
    .single();

  if (error) throw error;
  if (!data) throw new Error('Unable to record payment.');

  return {
    id: String(data.id),
    org_id: String(data.org_id),
    client_id: String(data.client_id),
    invoice_id: data.invoice_id ?? null,
    receipt_no: data.receipt_no ?? null,
    amount: Number(data.amount ?? 0),
    receipt_date: String(data.receipt_date),
    remarks: data.remarks ?? null,
    payment_type: data.payment_type ?? null,
    created_at: data.created_at ?? null,
  };
}

export type UpdateReceiptInput = {
  id: string;
  amount?: number;
  receipt_date?: string;
  remarks?: string;
  payment_type?: string | null;
};

export async function updateReceipt(input: UpdateReceiptInput): Promise<LedgerReceipt> {
  const { data, error } = await supabase
    .from('receipts')
    .update({
      amount: input.amount,
      receipt_date: input.receipt_date,
      remarks: input.remarks || null,
      payment_type: input.payment_type || null,
    })
    .eq('id', input.id)
    .select('id, org_id, client_id, invoice_id, receipt_no, amount, receipt_date, remarks, payment_type, created_at')
    .single();

  if (error) throw error;
  if (!data) throw new Error('Unable to update receipt.');

  return {
    id: String(data.id),
    org_id: String(data.org_id),
    client_id: String(data.client_id),
    invoice_id: data.invoice_id ?? null,
    receipt_no: data.receipt_no ?? null,
    amount: Number(data.amount ?? 0),
    receipt_date: String(data.receipt_date),
    remarks: data.remarks ?? null,
    payment_type: data.payment_type ?? null,
    created_at: data.created_at ?? null,
  };
}

export async function deleteReceipt(id: string): Promise<void> {
  const { error } = await supabase.from('receipts').delete().eq('id', id);
  if (error) throw error;
}

export async function getOpeningBalances(orgId: string, financialYear: string): Promise<OpeningBalance[]> {
  const { data, error } = await supabase
    .from('client_opening_balances')
    .select('*')
    .eq('organisation_id', orgId)
    .eq('financial_year', financialYear);

  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    client_id: String(row.client_id),
    organisation_id: String(row.organisation_id),
    financial_year: String(row.financial_year),
    amount: Number(row.amount ?? 0),
    as_of_date: row.as_of_date ?? null,
    remarks: row.remarks ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  }));
}

export async function getOpeningBalance(clientId: string, orgId: string, financialYear: string): Promise<OpeningBalance | null> {
  const { data, error } = await supabase
    .from('client_opening_balances')
    .select('*')
    .eq('client_id', clientId)
    .eq('organisation_id', orgId)
    .eq('financial_year', financialYear)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return null;

  return {
    id: String(data.id),
    client_id: String(data.client_id),
    organisation_id: String(data.organisation_id),
    financial_year: String(data.financial_year),
    amount: Number(data.amount ?? 0),
    as_of_date: data.as_of_date ?? null,
    remarks: data.remarks ?? null,
    created_at: data.created_at ?? null,
    updated_at: data.updated_at ?? null,
  };
}

export async function setOpeningBalance(input: OpeningBalanceInput): Promise<OpeningBalance> {
  const { data, error } = await supabase
    .from('client_opening_balances')
    .upsert({
      client_id: input.client_id,
      organisation_id: input.organisation_id,
      financial_year: input.financial_year,
      amount: input.amount,
      as_of_date: input.as_of_date || null,
      remarks: input.remarks || null,
    }, {
      onConflict: 'client_id,organisation_id,financial_year'
    })
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Unable to save opening balance.');

  return {
    id: String(data.id),
    client_id: String(data.client_id),
    organisation_id: String(data.organisation_id),
    financial_year: String(data.financial_year),
    amount: Number(data.amount ?? 0),
    as_of_date: data.as_of_date ?? null,
    remarks: data.remarks ?? null,
    created_at: data.created_at ?? null,
    updated_at: data.updated_at ?? null,
  };
}

export async function bulkUpsertOpeningBalances(
  orgId: string, 
  financialYear: string, 
  balances: BulkOpeningBalanceInput[]
): Promise<void> {
  const records = balances.map(b => ({
    client_id: b.client_id,
    organisation_id: orgId,
    financial_year: financialYear,
    amount: b.amount,
    as_of_date: b.as_of_date || null,
    remarks: b.remarks || null,
  }));

  const { error } = await supabase
    .from('client_opening_balances')
    .upsert(records, { onConflict: 'client_id,organisation_id,financial_year' });

  if (error) throw error;
}

export async function calculatePreviousYearOutstanding(clientId: string, orgId: string, previousFy: string): Promise<number> {
  const startMonth = 4;
  const year = parseInt(previousFy.match(/\d{2}$/)?.[0] || '0') || new Date().getFullYear() - 1;
  const century = Math.floor(year / 100) * 100;
  const shortYear = year % 100;
  const fullYear = century + shortYear;
  
  const startDate = `${fullYear}-04-01`;
  const endDate = `${fullYear + 1}-03-31`;

  const [invoicesResult, receiptsResult] = await Promise.all([
    supabase
      .from('invoices')
      .select('total')
      .eq('org_id', orgId)
      .eq('client_id', clientId)
      .gte('invoice_date', startDate)
      .lte('invoice_date', endDate),
    supabase
      .from('receipts')
      .select('amount')
      .eq('org_id', orgId)
      .eq('client_id', clientId)
      .gte('receipt_date', startDate)
      .lte('receipt_date', endDate)
  ]);

  const totalInvoices = (invoicesResult.data ?? []).reduce((sum, inv) => sum + Number(inv.total || 0), 0);
  const totalReceipts = (receiptsResult.data ?? []).reduce((sum, rcp) => sum + Number(rcp.amount || 0), 0);
  
  return Number((totalInvoices - totalReceipts).toFixed(2));
}

export async function getOrAutoCreateOpeningBalance(
  clientId: string, 
  orgId: string, 
  financialYear: string,
  asOfDate: string
): Promise<OpeningBalance> {
  const existing = await getOpeningBalance(clientId, orgId, financialYear);
  if (existing) return existing;

  const previousFy = getPreviousFinancialYear(financialYear);
  const previousOutstanding = await calculatePreviousYearOutstanding(clientId, orgId, previousFy);
  
  return setOpeningBalance({
    client_id: clientId,
    organisation_id: orgId,
    financial_year: financialYear,
    amount: previousOutstanding,
    as_of_date: asOfDate,
    remarks: `Carried from ${previousFy} outstanding`,
  });
}

export function getPreviousFinancialYear(currentFy: string): string {
  const match = currentFy.match(/(\d{2})-(\d{2})/);
  if (!match) return currentFy;
  
  const currentEndYear = parseInt(match[2]);
  const previousStartYear = currentEndYear - 1;
  const previousEndYear = currentEndYear;
  
  return `${previousStartYear.toString().padStart(2, '0')}-${previousEndYear.toString().padStart(2, '0')}`;
}

export function getFyDateRange(financialYear: string, startMonth: number = 4): { startDate: string; endDate: string } {
  const match = financialYear.match(/(\d{2})-(\d{2})$/);
  if (!match) {
    const currentYear = new Date().getFullYear();
    return {
      startDate: `${currentYear}-04-01`,
      endDate: `${currentYear + 1}-03-31`
    };
  }
  
  const endYearSuffix = parseInt(match[2]);
  const currentCentury = Math.floor(new Date().getFullYear() / 100) * 100;
  const endYear = currentCentury + endYearSuffix;
  const startYear = endYear - 1;
  
  return {
    startDate: `${startYear}-${startMonth.toString().padStart(2, '0')}-01`,
    endDate: `${endYear}-${((startMonth - 1 + 12) % 12 || 12).toString().padStart(2, '0')}-${startMonth === 1 ? '31' : (startMonth === 4 ? '31' : '28')}`,
  };
}
