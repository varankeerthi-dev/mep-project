import { Input } from '../../../../components/ui/input';
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
  const variantIds = usesVariant && variantNames.length > 0
    ? variantNames
    : ['no_variant'];

  return (
    <fieldset className="border border-zinc-200 rounded-lg p-4 space-y-4">
      <legend className="text-sm font-semibold text-zinc-700 px-2">Inventory</legend>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={trackInventory}
          onChange={(e) => onToggleInventory(e.target.checked)}
          className="rounded border-zinc-300"
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
                            <input
                              type="checkbox"
                              checked={stock?.exclude ?? false}
                              onChange={(e) => onStockChange(key, 'exclude', e.target.checked)}
                              className="rounded border-zinc-300"
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
    </fieldset>
  );
}
