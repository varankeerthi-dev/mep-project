// apps/web/src/pages/ReturnViewPage.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from '../lib/logger';
import { generateNextCNNumber } from '../credit-notes/api';
import { 
  ArrowLeftIcon, 
  ArrowDownTrayIcon, 
  CheckIcon, 
  ExclamationCircleIcon,
  CreditCardIcon
} from '@heroicons/react/24/outline';
import { renderReturnPDF } from '../pdf/proGridReturnPdf';

type ReturnDetail = {
  id: string;
  return_number: string;
  return_date: string;
  status: 'draft' | 'completed' | 'cancelled';
  remarks: string;
  customer_dc_number?: string;
  vehicle_number?: string;
  next_action_type?: string;
  next_action_remarks?: string;
  next_action_status?: string;
  next_action_due_date?: string;
  project: {
    id: string;
    project_name: string;
    client_id: string;
    clients: {
      client_name: string;
    };
  };
  warehouse?: {
    id: string;
    name: string;
  };
  employee?: {
    id: string;
    name: string;
  };
  assigned_employee?: {
    id: string;
    name: string;
  };
};

type ReturnItemRow = {
  id: string;
  item_id: string;
  variant_id: string | null;
  name: string;
  variant_name: string | null;
  quantity: number;
  unit: string;
  is_scrap: boolean;
  rate: number;
  total: number;
  remarks: string;
  warehouse?: {
    name: string;
  };
  sources: {
    id: string;
    invoice_item_id: string | null;
    delivery_challan_item_id: string | null;
    quantity: number;
    document_number: string;
    type: 'invoice' | 'dc';
    rate: number;
  }[];
};

export default function ReturnViewPage() {
  const { organisation, user } = useAuth();
  
  const queryParams = new URLSearchParams(window.location.search);
  const returnId = queryParams.get('id');

  const [doc, setDoc] = useState<ReturnDetail | null>(null);
  const [items, setItems] = useState<ReturnItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);

  const formatWarehouseName = (wh: any) => {
    if (!wh) return 'N/A';
    if (typeof wh === 'string') return wh;
    if (Array.isArray(wh)) {
      const first = wh[0];
      return typeof first === 'object' ? first?.warehouse_name || 'N/A' : String(first || 'N/A');
    }
    if (typeof wh === 'object') {
      return wh.warehouse_name || 'N/A';
    }
    return 'N/A';
  };

  const loadDocument = async () => {
    if (!returnId || !organisation?.id) return;
    setLoading(true);
    try {
      // 1. Fetch Return details
      const { data: ret, error: retErr } = await supabase
        .from('returns')
        .select(`
          *,
          project:projects(id, project_name, client_id, clients:clients(client_name)),
          warehouse:warehouses(id, warehouse_name),
          employee:employees!returns_returned_by_fkey(id, name),
          assigned_employee:employees!returns_next_action_assigned_to_fkey(id, name)
        `)
        .eq('id', returnId)
        .single();

      if (retErr) throw retErr;
      setDoc(ret as any);

      // 2. Fetch items
      const { data: retItems, error: itemsErr } = await supabase
        .from('return_items')
        .select(`
          *,
          material:materials(name, unit),
          variant:company_variants(variant_name),
          warehouse:warehouses(warehouse_name)
        `)
        .eq('return_id', returnId);

      if (itemsErr) throw itemsErr;

      const loadedRows: ReturnItemRow[] = [];

      for (const item of (retItems || [])) {
        // Fetch source mappings
        const { data: mappings, error: mapErr } = await supabase
          .from('return_sources')
          .select('*')
          .eq('return_item_id', item.id);

        if (mapErr) throw mapErr;

        const sources = [];
        for (const m of (mappings || [])) {
          let docNum = '';
          let docType: 'invoice' | 'dc' = 'dc';
          let rate = 0;

          if (m.invoice_item_id) {
            docType = 'invoice';
            const { data: inv } = await supabase
              .from('invoice_items')
              .select('rate, invoices(invoice_number)')
              .eq('id', m.invoice_item_id)
              .single();
            const invData = inv as any;
            docNum = Array.isArray(invData?.invoices) ? invData.invoices[0]?.invoice_number : invData?.invoices?.invoice_number || 'INV';
            rate = inv?.rate || 0;
          } else if (m.delivery_challan_item_id) {
            docType = 'dc';
            const { data: dc } = await supabase
              .from('delivery_challan_items')
              .select('rate, delivery_challans(dc_number)')
              .eq('id', m.delivery_challan_item_id)
              .single();
            const dcData = dc as any;
            docNum = Array.isArray(dcData?.delivery_challans) ? dcData.delivery_challans[0]?.dc_number : dcData?.delivery_challans?.dc_number || 'DC';
            rate = dc?.rate || 0;
          }

          sources.push({
            id: m.id,
            invoice_item_id: m.invoice_item_id,
            delivery_challan_item_id: m.delivery_challan_item_id,
            quantity: Number(m.quantity),
            document_number: docNum,
            type: docType,
            rate: rate
          });
        }

        loadedRows.push({
          id: item.id,
          item_id: item.item_id,
          variant_id: item.variant_id,
          name: item.material?.name || 'Material',
          variant_name: item.variant?.variant_name || null,
          quantity: Number(item.quantity),
          unit: item.unit,
          is_scrap: item.is_scrap || false,
          rate: Number(item.rate),
          total: Number(item.total),
          remarks: item.remarks || '',
          warehouse: item.warehouse || undefined,
          sources: sources
        });
      }

      setItems(loadedRows);
    } catch (err: any) {
      console.error('Error loading return:', err);
      toast.error('Failed to load material return details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocument();
  }, [returnId, organisation?.id]);

  // Convert invoice-mapped returned items to Credit Notes
  const handleConvertToCreditNote = async () => {
    if (!doc || !organisation?.id) return;

    // Gather invoice mappings
    const invoiceMappings: {
      invoice_id: string;
      source_item_id: string;
      returned_qty: number;
      return_item_id: string;
    }[] = [];

    for (const item of items) {
      for (const src of item.sources) {
        if (src.invoice_item_id) {
          // Fetch invoice_id of the item
          const { data: invItem } = await supabase
            .from('invoice_items')
            .select('invoice_id')
            .eq('id', src.invoice_item_id)
            .single();

          if (invItem?.invoice_id) {
            invoiceMappings.push({
              invoice_id: invItem.invoice_id,
              source_item_id: src.invoice_item_id,
              returned_qty: src.quantity,
              return_item_id: item.id
            });
          }
        }
      }
    }

    if (invoiceMappings.length === 0) {
      toast.error('No invoice-mapped items found in this return document.');
      return;
    }

    setConverting(true);
    try {
      // Group by invoice_id
      const grouped = invoiceMappings.reduce((acc, curr) => {
        if (!acc[curr.invoice_id]) {
          acc[curr.invoice_id] = [];
        }
        acc[curr.invoice_id].push(curr);
        return acc;
      }, {} as Record<string, typeof invoiceMappings>);

      const createdCNs: string[] = [];

      for (const invId of Object.keys(grouped)) {
        const mappingsForInvoice = grouped[invId];

        // 1. Fetch original invoice header metadata
        const { data: invoice } = await supabase
          .from('invoices')
          .select('client_id, tax_type')
          .eq('id', invId)
          .single();

        if (!invoice) throw new Error(`Invoice metadata not found for ID ${invId}`);

        // Generate next CN number Series
        const nextCNNumber = await generateNextCNNumber(organisation.id);

        // 2. Fetch original invoice line details and compute pro-rated pricing/taxes
        const cnItems = [];
        let totalTaxable = 0;
        let totalCgst = 0;
        let totalSgst = 0;
        let totalIgst = 0;
        let totalAmount = 0;

        for (const mapping of mappingsForInvoice) {
          const { data: origLine } = await supabase
            .from('invoice_items')
            .select('*')
            .eq('id', mapping.source_item_id)
            .single();

          if (!origLine) continue;

          const originalQty = Number(origLine.qty || 1);
          const returnedQty = mapping.returned_qty;
          const rate = Number(origLine.rate || 0);

          // Pro-rate discount
          const originalDiscount = Number(origLine.discount_amount || 0);
          const discount = (originalDiscount / originalQty) * returnedQty;

          const taxable = (returnedQty * rate) - discount;

          // Tax calculations
          const cgstPct = Number(origLine.cgst_percent || 0);
          const sgstPct = Number(origLine.sgst_percent || 0);
          const igstPct = Number(origLine.igst_percent || 0);

          const cgst = taxable * (cgstPct / 100);
          const sgst = taxable * (sgstPct / 100);
          const igst = taxable * (igstPct / 100);

          const total = taxable + cgst + sgst + igst;

          cnItems.push({
            description: origLine.description || 'Returned Material',
            hsn_code: origLine.hsn_code,
            quantity: returnedQty,
            rate: rate,
            discount_amount: discount,
            taxable_value: taxable,
            cgst_percent: cgstPct,
            cgst_amount: cgst,
            sgst_percent: sgstPct,
            sgst_amount: sgst,
            igst_percent: igstPct,
            igst_amount: igst,
            total_amount: total
          });

          totalTaxable += taxable;
          totalCgst += cgst;
          totalSgst += sgst;
          totalIgst += igst;
          totalAmount += total;
        }

        // 3. Insert Credit Note header
        const { data: cnHeader, error: headerErr } = await supabase
          .from('credit_notes')
          .insert({
            organisation_id: organisation.id,
            client_id: invoice.client_id,
            invoice_id: invId,
            cn_number: nextCNNumber,
            cn_date: new Date().toISOString().split('T')[0],
            cn_type: 'Taxable',
            reason: `Returned materials against Return ${doc.return_number}`,
            taxable_amount: totalTaxable,
            cgst_amount: totalCgst,
            sgst_amount: totalSgst,
            igst_amount: totalIgst,
            total_amount: totalAmount,
            approval_status: 'Approved'
          })
          .select('id, cn_number')
          .single();

        if (headerErr) throw headerErr;
        createdCNs.push(cnHeader.cn_number);

        // 4. Insert Credit Note items
        const itemInserts = cnItems.map(item => ({
          cn_id: cnHeader.id,
          organisation_id: organisation.id,
          ...item
        }));

        const { error: itemsErr } = await supabase
          .from('credit_note_items')
          .insert(itemInserts);

        if (itemsErr) throw itemsErr;
      }

      // Update next action status on the Return document
      await supabase
        .from('returns')
        .update({
          next_action_status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', doc.id);

      toast.success(`Successfully generated Credit Note(s): ${createdCNs.join(', ')}`);
      loadDocument();
    } catch (err: any) {
      console.error('Error converting to credit note:', err);
      toast.error(err.message || 'Failed to convert returns to Credit Note');
    } finally {
      setConverting(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!doc) return;
    try {
      renderReturnPDF({
        ...doc,
        items: items.map(item => ({
          name: item.name,
          variant_name: item.variant_name,
          warehouse_name: item.warehouse?.name || doc.warehouse?.name || '-',
          quantity: item.quantity,
          unit: item.unit,
          is_scrap: item.is_scrap,
          rate: item.rate,
          total: item.total,
          remarks: item.remarks
        })),
        client_name: doc.project?.clients?.client_name || 'Client',
        project_name: doc.project?.project_name || 'Project'
      });
      toast.success('PDF download started.');
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Failed to generate PDF');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-emerald-500 dark:text-emerald-400';
      case 'cancelled': return 'text-rose-500 dark:text-rose-400';
      default: return 'text-zinc-500 dark:text-zinc-400';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 bg-zinc-50 dark:bg-zinc-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">Loading material return details...</span>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 bg-zinc-50 dark:bg-zinc-950 text-center">
        <ExclamationCircleIcon className="h-12 w-12 text-rose-500 mb-2" />
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Document not found</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">The requested material return document does not exist or has been deleted.</p>
        <a href="/returns" className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition">
          Back to List
        </a>
      </div>
    );
  }

  const invoiceAllocations = items.flatMap(item => item.sources.filter(x => x.invoice_item_id));

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      {/* Top Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800/80 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <a
            href="/returns"
            className="p-2 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-650 dark:text-zinc-300 rounded-lg transition"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </a>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{doc.return_number}</h1>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border capitalize ${
                doc.status === 'completed' 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                  : doc.status === 'cancelled'
                  ? 'bg-rose-50 text-rose-700 border-rose-250 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20'
                  : 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-850 dark:text-zinc-400 dark:border-zinc-700'
              }`}>
                {doc.status}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Return document for project: <strong className="font-semibold text-zinc-700 dark:text-zinc-300">{doc.project?.project_name}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Convert to Credit Note action */}
          {doc.status === 'completed' && invoiceAllocations.length > 0 && doc.next_action_status !== 'completed' && (
            <button
              onClick={handleConvertToCreditNote}
              disabled={converting}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-650 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-lg font-semibold text-sm shadow-sm transition"
            >
              <CreditCardIcon className="h-4 w-4" />
              <span>{converting ? 'Converting...' : 'Convert to Credit Note'}</span>
            </button>
          )}

          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 px-4 py-2 border border-zinc-250 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-750 dark:text-zinc-200 rounded-lg font-medium text-sm transition"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Main View Container */}
      <div className="flex-1 overflow-auto p-6 flex flex-col gap-6 max-w-5xl mx-auto w-full">
        
        {/* Info Grid Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <span className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Return Date</span>
              <span className="font-semibold text-zinc-850 dark:text-zinc-200">
                {new Date(doc.return_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Client</span>
              <span className="font-semibold text-zinc-850 dark:text-zinc-200">
                {doc.project?.clients?.client_name || 'N/A'}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Default Warehouse</span>
              <span className="font-semibold text-zinc-850 dark:text-zinc-200">
                {formatWarehouseName(doc.warehouse)}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Customer DC No</span>
              <span className="font-semibold text-zinc-850 dark:text-zinc-200">
                {doc.customer_dc_number || <span className="text-zinc-400 dark:text-zinc-500 italic">None</span>}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Vehicle Number</span>
              <span className="font-semibold text-zinc-850 dark:text-zinc-200">
                {doc.vehicle_number || <span className="text-zinc-400 dark:text-zinc-500 italic">None</span>}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Returned By (Employee)</span>
              <span className="font-semibold text-zinc-850 dark:text-zinc-200">
                {doc.employee?.name || 'N/A'}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Document Status</span>
              <span className={`font-semibold flex items-center gap-1.5 ${getStatusColor(doc.status)}`}>
                <CheckIcon className="h-4 w-4" />
                <span className="capitalize">{doc.status}</span>
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Total Valuation</span>
              <span className="text-base font-bold text-zinc-950 dark:text-zinc-50">
                ₹{items.reduce((s, x) => s + x.total, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {doc.remarks && (
            <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-4">
              <span className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Remarks / Comments</span>
              <p className="text-sm text-zinc-650 dark:text-zinc-350 leading-relaxed whitespace-pre-wrap">{doc.remarks}</p>
            </div>
          )}
        </div>

        {/* Returned Items Table */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">Returned Material Items</h3>
          </div>
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-bold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider">
                <th className="px-6 py-3 w-12 text-center">S.No</th>
                <th className="px-6 py-3">Material & Variant</th>
                <th className="px-6 py-3">Target Warehouse</th>
                <th className="px-6 py-3 w-20 text-center">Scrap?</th>
                <th className="px-6 py-3 w-24 text-right">Qty</th>
                <th className="px-6 py-3 w-28 text-right">Rate (₹)</th>
                <th className="px-6 py-3 w-28 text-right">Total (₹)</th>
                <th className="px-6 py-3">Mapped Supply Sources</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/80 text-zinc-700 dark:text-zinc-300">
              {items.map((item, index) => (
                <tr key={item.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-800/10 transition-colors">
                  <td className="px-6 py-4 text-center text-xs text-zinc-500 font-medium">{index + 1}</td>
                  <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">
                    <div>{item.name}</div>
                    {item.variant_name && <span className="text-[10px] text-zinc-450 font-normal">{item.variant_name}</span>}
                  </td>
                  <td className="px-6 py-4">
                    {formatWarehouseName(item.warehouse || doc.warehouse)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {item.is_scrap ? (
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">SCRAP</span>
                    ) : (
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">GOOD</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-medium">
                    {item.quantity} <span className="text-xs text-zinc-450">{item.unit}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-zinc-900 dark:text-zinc-100">
                    ₹{item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-zinc-900 dark:text-zinc-100">
                    ₹{item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 max-w-[240px]">
                      {item.sources.map((src, sIdx) => (
                        <div key={sIdx} className="flex items-center justify-between text-xs border border-zinc-100 bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700/80 px-2 py-0.5 rounded">
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">
                            {src.document_number}
                          </span>
                          <span className="font-bold text-indigo-650 dark:text-indigo-400">
                            {src.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Downstream Next Action Status Panel */}
        {doc.next_action_type && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-4">
              <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-350 uppercase tracking-wider">Follow-up Next Action Status</h3>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                doc.next_action_status === 'completed'
                  ? 'bg-zinc-100 text-zinc-650 border-zinc-200 dark:bg-zinc-800/40 dark:text-zinc-400'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400'
              }`}>
                {doc.next_action_status || 'pending'}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div>
                <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Action Assigned</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200 bg-indigo-500/[0.04] border border-indigo-100 dark:border-indigo-900/30 px-2 py-0.5 rounded uppercase text-xs">
                  {doc.next_action_type.replace('_', ' ')}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Assigned Owner</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{doc.assigned_employee?.name || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Due Date</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {doc.next_action_due_date ? new Date(doc.next_action_due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A'}
                </span>
              </div>
              {doc.next_action_remarks && (
                <div className="col-span-1 md:col-span-3 border-t border-zinc-100 dark:border-zinc-800/60 pt-4">
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Downstream Instructions</span>
                  <p className="text-zinc-650 dark:text-zinc-350 leading-relaxed italic">{doc.next_action_remarks}</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
