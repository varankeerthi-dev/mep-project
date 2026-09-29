import { supabase } from '../../../supabase';
import { generateProGridSalesOrderPdf, type SalesOrderPdfData } from '../../../pdf/proGridSalesOrderPdf';

// Shared sales-order PDF pipeline (Phase 1): fetch everything the renderer
// needs, derive display-only totals, generate, preview or download.
export async function fetchSalesOrderPdfData(
  orgId: string,
  orderId: string
): Promise<{ data: SalesOrderPdfData; organisation: Record<string, unknown> }> {
  const { data: order, error: orderErr } = await supabase
    .from('sales_orders')
    .select('*, client:clients(client_name), project:projects(name)')
    .eq('id', orderId)
    .eq('organisation_id', orgId)
    .single();
  if (orderErr || !order) throw orderErr || new Error('Sales order not found');

  const { data: items } = await supabase
    .from('sales_order_items')
    .select('*, material:materials(hsn_code)')
    .eq('sales_order_id', orderId);

  const { data: org } = await supabase
    .from('organisations')
    .select('*')
    .eq('id', orgId)
    .single();

  let clientPoNumber: string | null = null;
  let clientPoDate: string | null = null;
  if ((order as any).client_po_id) {
    const { data: po } = await supabase
      .from('client_purchase_orders')
      .select('po_number, po_date')
      .eq('id', (order as any).client_po_id)
      .maybeSingle();
    if (po) {
      clientPoNumber = (po as any).po_number || null;
      clientPoDate = (po as any).po_date || null;
    }
  }

  const subtotal = Number((order as any).subtotal || 0);
  const tax = Number((order as any).tax_amount || 0);
  const grand = Number((order as any).grand_total || 0);
  const taxable = grand - tax;
  const discountTotal = Math.max(0, subtotal - taxable);
  const orgState = String((org as any)?.state || '').trim().toLowerCase();
  const orderState = String((order as any).state || '').trim().toLowerCase();
  const isInterState = orgState !== '' && orderState !== '' && orgState !== orderState;

  const signatures: any[] = ((org as any)?.signatures || []) as any[];
  const sign = signatures.find((s: any) => s.id === (order as any).authorized_signatory_id) || null;

  const data: SalesOrderPdfData = {
    sales_order_no: (order as any).sales_order_no || '',
    order_date: (order as any).order_date,
    delivery_date: (order as any).delivery_date,
    client_po_number: clientPoNumber,
    client_po_date: clientPoDate,
    quotation_no: (order as any).quotation_no,
    payment_terms: null,
    remarks: (order as any).remarks,
    client_name: (order as any).client?.client_name,
    billing_address: (order as any).billing_address,
    shipping_address: (order as any).shipping_address,
    gstin: (order as any).gstin,
    state: (order as any).state,
    project_name: (order as any).project?.name,
    subtotal,
    discount_total: discountTotal,
    taxable,
    cgst: !isInterState ? tax / 2 : 0,
    sgst: !isInterState ? tax / 2 : 0,
    igst: isInterState ? tax : 0,
    grand_total: grand,
    is_inter_state: isInterState,
    terms: (order as any).terms_conditions,
    signatory_name: sign?.name || sign?.signatory_name || null,
    signatory_url: sign?.url || null,
    items: (items || []).map((it: any) => ({
      description: it.description,
      hsn_code: it.material?.hsn_code || null,
      qty: Number(it.qty),
      uom: it.uom,
      rate: Number(it.rate || 0),
      discount_percent: Number(it.discount_percent || 0),
      tax_percent: Number(it.tax_percent || 0),
      line_total: Number(it.line_total || 0),
    })),
  };

  return { data, organisation: (org || {}) as Record<string, unknown> };
}

export async function downloadSalesOrderPdf(orgId: string, orderId: string) {
  const { data, organisation } = await fetchSalesOrderPdfData(orgId, orderId);
  const doc = generateProGridSalesOrderPdf(data, organisation);
  const blob = new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${data.sales_order_no || 'sales-order'}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function previewSalesOrderPdf(
  orgId: string,
  orderId: string
): Promise<{ url: string; number: string }> {
  const { data, organisation } = await fetchSalesOrderPdfData(orgId, orderId);
  const doc = generateProGridSalesOrderPdf(data, organisation);
  const blob = new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
  return { url: URL.createObjectURL(blob), number: data.sales_order_no };
}
