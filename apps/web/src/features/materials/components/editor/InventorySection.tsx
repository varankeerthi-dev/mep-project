import { useState, useRef, useEffect } from 'react';
import { Input } from '../../../../components/ui/input';
import { Checkbox } from '../../../../components/ui/checkbox';
import { EditorSection } from './EditorSection';
import { inputFieldSm } from './formStyles';
import { buildStockKey, NO_VARIANT_KEY } from '../../model/aggregates';
import type { WarehouseStockMap } from '../../model/aggregates';
import type { Warehouse } from '../../model/entities';

interface StockCombo {
  variantId: string;
  make: string;
}

interface InventorySectionProps {
  color?: 'indigo' | 'blue' | 'green' | 'purple' | 'orange' | 'teal' | 'slate';
  trackInventory: boolean;
  warehouseStock: WarehouseStockMap;
  warehouses: Warehouse[];
  usesVariant: boolean;
  /** Unique (variant × make) combinations, one stock column each */
  stockCombos: StockCombo[];
  variantNameById?: Record<string, string>;
  onToggleInventory: (checked: boolean) => void;
  onStockChange: (key: string, field: 'exclude' | 'current_stock', value: boolean | number) => void;
}

export function InventorySection({
  color,
  trackInventory,
  warehouseStock,
  warehouses,
  usesVariant,
  stockCombos,
  variantNameById,
  onToggleInventory,
  onStockChange,
}: InventorySectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [collapsed]);
  const combos = usesVariant && stockCombos.length > 0
    ? stockCombos
    : [{ variantId: NO_VARIANT_KEY, make: '' }];

  return (
    <div ref={sectionRef}>
      <EditorSection
        color={color || 'teal'}
        title="Inventory"
        description="Set inventory and stock management details."
        expanded={!collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      >
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={trackInventory}
            onCheckedChange={(checked) => onToggleInventory(checked)}
          />
          <span className="text-[#111827]">Track Inventory</span>
        </label>

        {trackInventory && warehouses.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-[#E7EAF1] bg-white">
            <table className="w-full max-w-2xl text-sm">
              <thead>
                <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">Warehouse</th>
                  {combos.map((c) => (
                    <th key={buildStockKey('header', c.variantId, c.make)} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
                      {c.variantId === NO_VARIANT_KEY
                        ? 'Default'
                        : (variantNameById?.[c.variantId] || c.variantId) + (c.make ? ` — ${c.make}` : '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {warehouses.map((wh) => (
                  <tr key={wh.id} className="border-b border-[#F1F5F9] last:border-b-0 hover:bg-[#F8FAFC]/60">
                    <td className="px-4 py-3 text-[13px] font-medium text-[#111827]">{wh.warehouse_name || wh.name}</td>
                    {combos.map((c) => {
                      const key = buildStockKey(wh.id, c.variantId, c.make);
                      const stock = warehouseStock[key];
                      return (
                        <td key={key} className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={stock?.current_stock ?? 0}
                              onChange={(e) => onStockChange(key, 'current_stock', parseFloat(e.target.value) || 0)}
                              className={inputFieldSm + ' w-24'}
                              disabled={stock?.exclude}
                            />
                            <label className="flex cursor-pointer items-center gap-1 whitespace-nowrap text-xs text-[#6B7280]">
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
          <p className="text-xs italic text-[#6B7280]">No warehouses configured. Add warehouses in Settings first.</p>
        )}
      </EditorSection>
    </div>
  );
}
