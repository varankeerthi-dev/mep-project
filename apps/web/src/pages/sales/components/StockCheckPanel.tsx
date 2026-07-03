import { useState, useEffect } from 'react';
import { supabase } from '../../../supabase';
import {
  X as XIcon,
  Loader2,
  PackageCheck,
  AlertTriangle,
  Play as PlayIcon,
  RefreshCw,
  Hammer
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { toast } from '../../../lib/logger';
import MrpRequirementModal from './MrpRequirementModal';

interface StockCheckPanelProps {
  isOpen: boolean;
  onClose: () => void;
  salesOrderId: string;
  items: any[];
  order: any;
}

interface WarehouseStock {
  warehouse_id: string;
  warehouse_name: string;
  current_stock: number;
  reserved_qty: number;
  available_qty: number;
  to_reserve: number;
}

interface ItemStockCheck {
  so_item_id: string;
  item_id: string;
  name: string;
  code: string;
  qty: number;
  currently_reserved: number;
  shortfall: number;
  stocks: WarehouseStock[];
}

export default function StockCheckPanel({
  onClose,
  salesOrderId,
  items,
  order
}: StockCheckPanelProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stockChecks, setStockChecks] = useState<ItemStockCheck[]>([]);
  const [selectedJcItem, setSelectedJcItem] = useState<{ id: string; name: string; shortfall: number; jobCardId?: string } | null>(null);

  const fetchStockData = async () => {
    try {
      setLoading(true);
      const checks: ItemStockCheck[] = [];

      for (const item of items) {
        // 1. Fetch current stock by warehouse
        const { data: stockData } = await supabase
          .from('item_stock')
          .select(`
            qty,
            warehouse_id,
            warehouse:warehouses(name)
          `)
          .eq('material_id', item.item_id);

        // 2. Fetch active reservations by warehouse
        const { data: resData } = await supabase
          .from('sales_order_reservations')
          .select('warehouse_id, qty')
          .eq('item_id', item.item_id);

        const resMap = new Map<string, number>();
        (resData || []).forEach((r) => {
          resMap.set(r.warehouse_id, (resMap.get(r.warehouse_id) || 0) + parseFloat(r.qty));
        });

        // 3. Map warehouse stock
        const stocks: WarehouseStock[] = (stockData || []).map((s: any) => {
          const reserved = resMap.get(s.warehouse_id) || 0;
          return {
            warehouse_id: s.warehouse_id,
            warehouse_name: s.warehouse?.name || 'Unknown Store',
            current_stock: parseFloat(s.qty) || 0,
            reserved_qty: reserved,
            available_qty: Math.max(0, (parseFloat(s.qty) || 0) - reserved),
            to_reserve: 0
          };
        });

        const currentlyReserved = parseFloat(item.reserved_qty) || 0;
        const shortfall = Math.max(0, parseFloat(item.qty) - currentlyReserved);

        checks.push({
          so_item_id: item.id,
          item_id: item.item_id,
          name: item.material?.name || 'Product',
          code: item.material?.code || '',
          qty: parseFloat(item.qty),
          currently_reserved: currentlyReserved,
          shortfall,
          stocks
        });
      }

      setStockChecks(checks);
    } catch (err: any) {
      toast.error('Failed to load stock data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockData();
  }, [items]);

  const handleReserveChange = (itemIdx: number, stockIdx: number, value: number) => {
    const next = [...stockChecks];
    const item = next[itemIdx];
    const stock = item.stocks[stockIdx];

    // Cap the reservation to available qty
    const cappedVal = Math.min(value, stock.available_qty);
    stock.to_reserve = cappedVal;

    // Recalculate shortfall
    const totalProposed = item.stocks.reduce((acc, s) => acc + s.to_reserve, 0);
    item.shortfall = Math.max(0, item.qty - item.currently_reserved - totalProposed);

    setStockChecks(next);
  };

  const handleSaveReservations = async () => {
    try {
      setSaving(true);
      const reservationsToInsert: any[] = [];

      stockChecks.forEach((check) => {
        check.stocks.forEach((stock) => {
          if (stock.to_reserve > 0) {
            reservationsToInsert.push({
              sales_order_item_id: check.so_item_id,
              item_id: check.item_id,
              warehouse_id: stock.warehouse_id,
              qty: stock.to_reserve,
              organisation_id: order.organisation_id
            });
          }
        });
      });

      if (reservationsToInsert.length === 0) {
        toast.error('No reservation quantities specified');
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('sales_order_reservations')
        .insert(reservationsToInsert);

      if (error) throw error;

      toast.success('Stock reserved successfully');
      fetchStockData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save reservations');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateJobCard = async (check: ItemStockCheck) => {
    if (check.shortfall <= 0) {
      toast.error('No shortfall to produce for this item');
      return;
    }

    try {
      // 1. BOM Guard: Check if active BOM exists for finished good
      const { data: bom, error: bomError } = await supabase
        .from('boms')
        .select('id')
        .eq('material_id', check.item_id)
        .eq('is_active', true)
        .maybeSingle();

      if (bomError || !bom) {
        toast.error(`No active BOM found for product ${check.name}. Please define a BOM first or plan manually.`);
        return;
      }

      // Generate unique job card number
      const jcNo = 'JC-' + Date.now().toString().slice(-6);

      const jobCard = {
        job_card_no: jcNo,
        bom_id: bom.id,
        sales_order_item_id: check.so_item_id,
        target_qty: check.shortfall,
        status: 'draft',
        organisation_id: order.organisation_id
      };

      const { data: newJc, error: jcError } = await supabase
        .from('job_cards')
        .insert(jobCard)
        .select()
        .single();

      if (jcError || !newJc) throw jcError;

      toast.success(`Job Card ${jcNo} created for shortfall of ${check.shortfall} units`);
      setSelectedJcItem({
        id: check.so_item_id,
        name: check.name,
        shortfall: check.shortfall,
        jobCardId: newJc.id
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create Job Card');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-zinc-900/40 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl animate-slide-in">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Stock Check & Reservation</h2>
            <p className="text-xs text-zinc-500">
              Order: <span className="font-semibold">{order.sales_order_no}</span> | Allocate inventory splits
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <XIcon className="h-5 w-5 text-zinc-500" />
          </Button>
        </div>

        {/* Warning about Pre-Approval Issuance Lock */}
        {order.status === 'waiting_approval' && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              <strong>Pre-Approval Status:</strong> You can reserve stock and generate Job Cards, but physical raw material issuance is locked.
            </span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
              <span className="text-sm text-zinc-500 mt-2">Checking inventory...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {stockChecks.map((check, itemIdx) => (
                <div key={check.so_item_id} className="border border-zinc-200 rounded-xl p-5 bg-zinc-50/50 space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div>
                      <h3 className="font-bold text-sm text-zinc-900">{check.name}</h3>
                      <p className="text-[10px] text-zinc-400">Order Target: {check.qty} | Reserved: {check.currently_reserved}</p>
                    </div>
                    {check.shortfall > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Shortfall: {check.shortfall}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <PackageCheck className="h-3.5 w-3.5" />
                        Fully Reserved
                      </span>
                    )}
                  </div>

                  {/* Warehouse stocks listing */}
                  {check.stocks.length === 0 ? (
                    <div className="text-xs text-zinc-500 italic py-2">
                      No stock available in any warehouse.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-12 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                        <div className="col-span-5">Warehouse</div>
                        <div className="col-span-2 text-right">In Stock</div>
                        <div className="col-span-2 text-right">Available</div>
                        <div className="col-span-3 text-right">Allocate</div>
                      </div>

                      {check.stocks.map((stock, stockIdx) => (
                        <div key={stock.warehouse_id} className="grid grid-cols-12 gap-2 items-center text-xs text-zinc-700 py-1">
                          <div className="col-span-5 font-medium">{stock.warehouse_name}</div>
                          <div className="col-span-2 text-right">{stock.current_stock}</div>
                          <div className="col-span-2 text-right text-emerald-600 font-semibold">{stock.available_qty}</div>
                          <div className="col-span-3 text-right">
                            <Input
                              type="number"
                              disabled={stock.available_qty <= 0}
                              value={stock.to_reserve || ''}
                              onChange={(e) => handleReserveChange(itemIdx, stockIdx, parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              className="h-8 text-xs text-right w-20 ml-auto"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions for shortfall */}
                  {check.shortfall > 0 && (
                    <div className="pt-3 border-t flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGenerateJobCard(check)}
                        className="text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                      >
                        <Hammer className="h-3.5 w-3.5 mr-1" />
                        Create Job Card ({check.shortfall})
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t bg-zinc-50 flex justify-between gap-3">
          <Button variant="outline" onClick={onClose}>
            Close Stock Check
          </Button>

          <Button
            onClick={handleSaveReservations}
            disabled={saving || loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <PackageCheck className="h-4 w-4 mr-1.5" />
            )}
            Confirm Reservations
          </Button>
        </div>

        {/* MRP / Purchase Modal overlay if Job Card created */}
        {selectedJcItem && (
          <MrpRequirementModal
            isOpen={!!selectedJcItem}
            onClose={() => {
              setSelectedJcItem(null);
              fetchStockData();
            }}
            jobCardId={selectedJcItem.jobCardId || ''}
            productName={selectedJcItem.name}
            shortfallQty={selectedJcItem.shortfall}
            salesOrderId={salesOrderId}
          />
        )}
      </div>
    </div>
  );
}
