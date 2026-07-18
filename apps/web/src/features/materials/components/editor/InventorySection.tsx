import { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Checkbox } from '../../../../components/ui/checkbox';
import type { WarehouseStockMap } from '../../model/aggregates';
import type { Warehouse } from '../../model/entities';

interface InventorySectionProps {
  trackInventory: boolean;
  warehouseStock: WarehouseStockMap;
  warehouses: Warehouse[];
  usesVariant: boolean;
  variantNames: string[];
  onToggleInventory: (checked: boolean) => void;
  onStockChange: (key: string, field: 'exclude' | 'current_stock', value: boolean | number) => void;
}

export function InventorySection({
  trackInventory,
  warehouseStock,
  warehouses,
  usesVariant,
  variantNames,
  onToggleInventory,
  onStockChange,
}: InventorySectionProps) {
  const [collapsed, setCollapsed] = useState(true);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [collapsed]);
  const variantIds = usesVariant && variantNames.length > 0
    ? variantNames
    : ['no_variant'];

  return (
    <div ref={sectionRef} className="rounded-lg shadow-[0px_0px_0px_1px_oklch(0_0_0_/_0.06),0px_1px_2px_-1px_oklch(0_0_0_/_0.06),0px_2px_4px_0px_oklch(0_0_0_/_0.04)] bg-green-50 p-4 space-y-4">
      <div
        className="flex items-center justify-between gap-3 cursor-pointer select-none"
        onClick={() => setCollapsed(!collapsed)}
      >
        <h4 className="text-sm font-semibold text-zinc-700">Inventory Tracking</h4>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-400">Track stock levels per warehouse</span>
          {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />}
        </div>
      </div>

      {!collapsed && (<>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox
          checked={trackInventory}
          onCheckedChange={(checked) => onToggleInventory(checked)}
        />
        <span className="text-zinc-700">Track Inventory</span>
      </label>

      {trackInventory && warehouses.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500">Warehouse</th>
                {variantIds.map((vId) => (
                  <th key={vId} className="text-left py-2 px-2 text-xs font-medium text-zinc-500">
                    {vId === 'no_variant' ? 'Default' : vId}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {warehouses.map((wh) => (
                <tr key={wh.id} className="border-b border-zinc-100">
                  <td className="py-2 px-2 text-xs text-zinc-700 font-medium">{wh.warehouse_name || wh.name}</td>
                  {variantIds.map((vId) => {
                    const key = `${wh.id}_${vId}`;
                    const stock = warehouseStock[key];
                    return (
                      <td key={key} className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={stock?.current_stock ?? 0}
                            onChange={(e) => onStockChange(key, 'current_stock', parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs w-20"
                            disabled={stock?.exclude}
                          />
                            <label className="flex items-center gap-1 text-[10px] text-zinc-400 cursor-pointer whitespace-nowrap">
                              <Checkbox
                                checked={stock?.exclude ?? false}
                                onCheckedChange={(checked) => onStockChange(key, 'exclude', checked)}
                              />
                            Exclude
                          </label>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {trackInventory && warehouses.length === 0 && (
        <p className="text-xs text-zinc-400 italic">No warehouses configured. Add warehouses in Settings first.</p>
      )}
      </>)}
    </div>
  );
}
