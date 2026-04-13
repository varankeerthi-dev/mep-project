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
    .eq('org_id', orgId)
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
