import { useState, useEffect } from 'react';
import { supabase } from '../../../supabase';
import {
  X as XIcon,
  Loader2,
  RefreshCw,
  ShoppingCart,
  CheckCircle,
  Package
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { toast } from '../../../lib/logger';

interface MrpRequirementModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobCardId: string;
  productName: string;
  shortfallQty: number;
  salesOrderId: string;
}

interface RawMaterialRequirement {
  material_id: string;
  name: string;
  code: string;
  required_qty: number;
  available_qty: number;
  shortfall: number;
  uom: string;
  supplier_id: string | null;
  supplier_name: string;
  rate: number;
}

export default function MrpRequirementModal({
  onClose,
  jobCardId,
  productName,
  shortfallQty,
  salesOrderId
}: MrpRequirementModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastCalculated, setLastCalculated] = useState<string>('');
  const [requirements, setRequirements] = useState<RawMaterialRequirement[]>([]);

  const calculateMrp = async () => {
    try {
      setLoading(true);
      setLastCalculated(new Date().toLocaleTimeString());

      // 1. Fetch Job Card to get BOM ID and Organization ID
      const { data: jc, error: jcError } = await supabase
        .from('job_cards')
        .select('bom_id, organisation_id')
        .eq('id', jobCardId)
        .single();

      if (jcError || !jc) throw jcError || new Error('Job Card not found');

      // 2. Fetch BOM items
      const { data: bomItems, error: bomError } = await supabase
        .from('bom_items')
        .select(`
          quantity,
          wastage_pct,
          material_id,
          material:materials(name, code, uom, default_purchase_rate, default_supplier_id)
        `)
        .eq('bom_id', jc.bom_id);

      if (bomError) throw bomError;

      const reqs: RawMaterialRequirement[] = [];

      for (const bi of (bomItems || [])) {
        const mat = bi.material as any;
        if (!mat) continue;

        // Calculate raw material requirement scaled to shortfall, incorporating wastage pct
        const standardOutput = 1; // Assuming BOM scales per unit output.
        const qtyReq = (parseFloat(bi.quantity) * shortfallQty) * (1 + (parseFloat(bi.wastage_pct) || 0) / 100);

        // Fetch Main Store stock for this raw material
        const { data: stockData } = await supabase
          .from('item_stock')
          .select(`
            qty,
            warehouse:warehouses(id)
          `)
          .eq('material_id', bi.material_id)
          .eq('warehouse.warehouse_purpose', 'main');

        const mainStoreStock = (stockData || []).reduce((acc, s) => acc + (parseFloat(s.qty) || 0), 0);

        // Fetch active reservations of this raw material in the Main Store
        const { data: resData } = await supabase
          .from('sales_order_reservations')
          .select('qty')
          .eq('item_id', bi.material_id);

        const reservedStock = (resData || []).reduce((acc, r) => acc + (parseFloat(r.qty) || 0), 0);
        const availableStock = Math.max(0, mainStoreStock - reservedStock);
        const shortfall = Math.max(0, qtyReq - availableStock);

        // Fetch supplier name if supplier ID exists
        let supplierName = 'None Assigned';
        if (mat.default_supplier_id) {
          const { data: supplier } = await supabase
            .from('purchase_vendors')
            .select('company_name')
            .eq('id', mat.default_supplier_id)
            .maybeSingle();
          if (supplier) supplierName = supplier.company_name;
        }

        reqs.push({
          material_id: bi.material_id,
          name: mat.name,
          code: mat.code,
          required_qty: parseFloat(qtyReq.toFixed(3)),
          available_qty: parseFloat(availableStock.toFixed(3)),
          shortfall: parseFloat(shortfall.toFixed(3)),
          uom: mat.uom || 'units',
          supplier_id: mat.default_supplier_id || null,
          supplier_name: supplierName,
          rate: parseFloat(mat.default_purchase_rate) || 0
        });
      }

      setRequirements(reqs);
    } catch (err: any) {
      toast.error(err.message || 'MRP calculation failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateMrp();
  }, [jobCardId]);

  const handleGeneratePOs = async () => {
    const shortfalls = requirements.filter((r) => r.shortfall > 0);
    if (shortfalls.length === 0) {
      toast.error('No raw material shortfall found. No Purchase Orders needed.');
      return;
    }

    // Group shortfalls by supplier ID
    const grouped = new Map<string | null, RawMaterialRequirement[]>();
    shortfalls.forEach((item) => {
      const list = grouped.get(item.supplier_id) || [];
      list.push(item);
      grouped.set(item.supplier_id, list);
    });

    try {
      setSaving(true);
      let posCreated = 0;

      // Get organization ID
      const { data: jc } = await supabase
        .from('job_cards')
        .select('organisation_id')
        .eq('id', jobCardId)
        .single();

      if (!jc) throw new Error('Job Card organization not found');

      for (const [supplierId, itemsList] of grouped.entries()) {
        const resolvedSupplierId = supplierId || null;

        // Generate unique PO number
        const poNo = 'PO-' + Date.now().toString().slice(-6) + '-' + Math.floor(Math.random() * 100);

        // 1. Create Purchase Order header in DRAFT status
        const { data: po, error: poError } = await supabase
          .from('purchase_orders')
          .insert({
            po_number: poNo,
            vendor_id: resolvedSupplierId,
            status: 'Draft',
            sales_order_id: salesOrderId,
            organisation_id: jc.organisation_id,
            po_date: new Date().toISOString().split('T')[0]
          })
          .select()
          .single();

        if (poError || !po) throw poError || new Error('Failed to create PO');

        // 2. Create Purchase Order line items
        const poItems = itemsList.map((item) => ({
          purchase_order_id: po.id,
          material_id: item.material_id,
          quantity: item.shortfall,
          uom: item.uom,
          rate: item.rate,
          tax_percent: 18,
          line_total: item.shortfall * item.rate * 1.18
        }));

        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(poItems);

        if (itemsError) throw itemsError;
        posCreated++;
      }

      toast.success(`Generated ${posCreated} Draft Purchase Orders for raw material shortfall`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate Purchase Orders');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col h-[500px]">
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-zinc-900">MRP Raw Material shortfall</h3>
            <p className="text-xs text-zinc-500">
              Product: <span className="font-semibold">{productName}</span> (Shortfall Qty: {shortfallQty})
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <XIcon className="h-5 w-5 text-zinc-500" />
          </Button>
        </div>

        {/* Calculation Timestamp */}
        <div className="px-5 py-2.5 bg-zinc-50 border-b flex justify-between items-center text-xs text-zinc-500">
          <span>Last Calculated: <strong className="text-zinc-700">{lastCalculated}</strong></span>
          <Button variant="ghost" size="sm" onClick={calculateMrp} disabled={loading} className="h-7 text-xs gap-1">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Recalculate
          </Button>
        </div>

        {/* Requirements Table */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-7 w-7 animate-spin text-zinc-400" />
              <span className="text-xs text-zinc-500 mt-2">Scaling raw materials...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-400 font-semibold uppercase tracking-wider pb-2">
                    <th className="py-2">Material</th>
                    <th className="py-2 text-right">Required</th>
                    <th className="py-2 text-right">Main Avail</th>
                    <th className="py-2 text-right">Shortfall</th>
                    <th className="py-2 pl-4">Supplier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {requirements.map((req) => (
                    <tr key={req.material_id} className="hover:bg-zinc-50/50">
                      <td className="py-2.5 pr-2">
                        <span className="font-medium text-zinc-950 block">{req.name}</span>
                        <span className="text-[10px] text-zinc-400 block">{req.code}</span>
                      </td>
                      <td className="py-2.5 text-right font-medium">{req.required_qty} {req.uom}</td>
                      <td className="py-2.5 text-right text-emerald-600 font-medium">{req.available_qty} {req.uom}</td>
                      <td className="py-2.5 text-right font-bold text-red-600">{req.shortfall} {req.uom}</td>
                      <td className="py-2.5 pl-4 truncate max-w-[120px] text-zinc-500" title={req.supplier_name}>
                        {req.supplier_name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t bg-zinc-50 flex justify-between gap-3">
          <Button variant="outline" onClick={onClose}>
            Back
          </Button>

          <Button
            onClick={handleGeneratePOs}
            disabled={saving || loading || requirements.every((r) => r.shortfall <= 0)}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
            Generate Purchase Orders
          </Button>
        </div>
      </div>
    </div>
  );
}
