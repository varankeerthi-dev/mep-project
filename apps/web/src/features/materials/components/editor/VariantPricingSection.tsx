import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import { Input } from '../../../../components/ui/input';
import { Checkbox } from '../../../../components/ui/checkbox';
import { EditorSection } from './EditorSection';
import { inputFieldSm, selectFieldSm, addLink } from './formStyles';
import type { VariantPricingRow } from '../../model/aggregates';

interface VariantPricingSectionProps {
  number?: number;
  variantPricing: VariantPricingRow[];
  variants: { id: string; variant_name: string }[];
  usesVariant: boolean;
  onToggleVariant: (checked: boolean) => void;
  onAddRow: () => void;
  onRemoveRow: (id: number | string) => void;
  onRowChange: (id: number | string, field: string, value: string) => void;
}

export function VariantPricingSection({
  number,
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
    <div ref={sectionRef}>
      <EditorSection
        number={number}
        title="Variant Pricing"
        description="Set different prices for different discount categories."
        hint="Leave blank to use default prices"
        expanded={!collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      >
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={usesVariant}
            onCheckedChange={(checked) => onToggleVariant(checked)}
          />
          <span className="text-[#111827]">Enable Discount Category / Variant Pricing</span>
        </label>

        {usesVariant && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#6B7280]">Set different prices for different discount categories</span>
              <button
                onClick={onAddRow}
                className={addLink}
              >
                <Plus size={14} /> Add Row
              </button>
            </div>

            {variantPricing.map((row) => (
              <div key={row.id} className="flex items-center gap-2 rounded-xl p-2.5">
                <div className="relative w-40 shrink-0">
                  <select
                    className={selectFieldSm}
                    value={row.company_variant_id}
                    onChange={(e) => onRowChange(row.id, 'company_variant_id', e.target.value)}
                  >
                    <option value="">Select category</option>
                    {variants.map(v => (
                      <option key={v.id} value={v.id}>{v.variant_name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                </div>
                <Input
                  value={row.make}
                  onChange={(e) => onRowChange(row.id, 'make', e.target.value)}
                  placeholder="Make/Brand"
                  className={inputFieldSm + ' w-32'}
                />
                <div className="relative w-40 shrink-0">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">₹</span>
                  <Input
                    value={row.sale_price}
                    onChange={(e) => onRowChange(row.id, 'sale_price', e.target.value)}
                    placeholder="Sale Price"
                    type="number"
                    step="0.01"
                    className={inputFieldSm + ' pl-9'}
                  />
                </div>
                <div className="relative w-40 shrink-0">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">₹</span>
                  <Input
                    value={row.purchase_price}
                    onChange={(e) => onRowChange(row.id, 'purchase_price', e.target.value)}
                    placeholder="Purchase Price"
                    type="number"
                    step="0.01"
                    className={inputFieldSm + ' pl-9'}
                  />
                </div>
                <button
                  onClick={() => onRemoveRow(row.id)}
                  className="ml-2 rounded-lg p-1.5 text-[#6B7280] transition-colors hover:bg-[#EF4444]/10 hover:text-[#EF4444]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {variantPricing.length === 0 && (
              <p className="text-xs italic text-[#6B7280]">No pricing rows. Click "Add Row" to add one.</p>
            )}
          </div>
        )}
      </EditorSection>
    </div>
  );
}
