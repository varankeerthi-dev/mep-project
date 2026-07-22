import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { Input } from '../../../../components/ui/input';
import { Checkbox } from '../../../../components/ui/checkbox';
import { Select } from '../../../../components/ui/select';
import type { VariantPricingRow } from '../../model/aggregates';

interface VariantPricingSectionProps {
  variantPricing: VariantPricingRow[];
  variants: { id: string; variant_name: string }[];
  usesVariant: boolean;
  onToggleVariant: (checked: boolean) => void;
  onAddRow: () => void;
  onRemoveRow: (id: number | string) => void;
  onRowChange: (id: number | string, field: string, value: string) => void;
}

export function VariantPricingSection({
  variantPricing,
  variants,
  usesVariant,
  onToggleVariant,
  onAddRow,
  onRemoveRow,
  onRowChange,
}: VariantPricingSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [collapsed]);

  return (
    <div ref={sectionRef} className="rounded-lg shadow-[0px_0px_0px_1px_oklch(0_0_0_/_0.06),0px_1px_2px_-1px_oklch(0_0_0_/_0.06),0px_2px_4px_0px_oklch(0_0_0_/_0.04)] bg-purple-50 p-4 space-y-4">
      <div
        className="flex items-center justify-between gap-3 cursor-pointer select-none"
        onClick={() => setCollapsed(!collapsed)}
      >
        <h4 className="text-sm font-semibold text-zinc-700">Variant Pricing</h4>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-400">Leave blank to use default prices</span>
          {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />}
        </div>
      </div>

      {!collapsed && (<>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox
          checked={usesVariant}
          onCheckedChange={(checked) => onToggleVariant(checked)}
        />
        <span className="text-zinc-700">Enable Discount Category / Variant Pricing</span>
      </label>

      {usesVariant && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Set different prices for different discount categories</span>
            <button
              onClick={onAddRow}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Add Row
            </button>
          </div>

          {variantPricing.map((row) => (
            <div key={row.id} className="flex items-center gap-2 bg-zinc-50 rounded-md p-2">
              <Select
                value={row.company_variant_id}
                onValueChange={(v) => onRowChange(row.id, 'company_variant_id', v)}
                className="flex-1 h-8 text-xs"
                options={[
                  {value: '', label: 'Select category'},
                  ...variants.map(v => ({value: v.id, label: v.variant_name}))
                ]}
              />
              <Input
                value={row.make}
                onChange={(e) => onRowChange(row.id, 'make', e.target.value)}
                placeholder="Make/Brand"
                className="h-8 text-xs w-28"
              />
              <Input
                value={row.sale_price}
                onChange={(e) => onRowChange(row.id, 'sale_price', e.target.value)}
                placeholder="Sale Price"
                type="number"
                step="0.01"
                className="h-8 text-xs w-24"
              />
              <Input
                value={row.purchase_price}
                onChange={(e) => onRowChange(row.id, 'purchase_price', e.target.value)}
                placeholder="Purchase Price"
                type="number"
                step="0.01"
                className="h-8 text-xs w-24"
              />
              <button
                onClick={() => onRemoveRow(row.id)}
                className="p-1.5 rounded-md hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors relative after:absolute after:inset-[-8px]"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {variantPricing.length === 0 && (
            <p className="text-xs text-zinc-400 italic">No pricing rows. Click "Add Row" to add one.</p>
          )}
        </div>
      )}
      </>)}
    </div>
  );
}
