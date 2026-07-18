import { Plus, Trash2 } from 'lucide-react';
import { Input } from '../../../../components/ui/input';
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
  return (
    <fieldset className="border border-zinc-200 rounded-lg p-4 space-y-4">
      <legend className="text-sm font-semibold text-zinc-700 px-2">Discount Category Pricing</legend>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={usesVariant}
          onChange={(e) => onToggleVariant(e.target.checked)}
          className="rounded border-zinc-300"
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
            <div key={row.id} className="flex items-center gap-2 bg-zinc-50 rounded-lg p-2">
              <select
                value={row.company_variant_id}
                onChange={(e) => onRowChange(row.id, 'company_variant_id', e.target.value)}
                className="h-8 flex-1 rounded-md border border-zinc-300 bg-white px-2 text-xs"
              >
                <option value="">Select category</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>{v.variant_name}</option>
                ))}
              </select>
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
                className="p-1.5 rounded-md hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors"
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
    </fieldset>
  );
}
