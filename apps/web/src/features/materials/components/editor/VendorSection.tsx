import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import { Input } from '../../../../components/ui/input';
import { Checkbox } from '../../../../components/ui/checkbox';
import { EditorSection } from './EditorSection';
import { inputFieldSm, selectFieldSm, addLink } from './formStyles';
import type { VendorMappingRow } from '../../model/aggregates';

interface VendorSectionProps {
  number?: number;
  vendorMappings: VendorMappingRow[];
  vendors: { id: string; company_name: string }[];
  variants: { id: string; variant_name: string }[];
  variantPricing: { company_variant_id: string | null }[];
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  onRowChange: (id: string, field: string, value: any) => void;
}

export function VendorSection({ number, vendorMappings, vendors, variants, variantPricing, onAddRow, onRemoveRow, onRowChange }: VendorSectionProps) {
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
        title="Purchase & Vendor Mapping"
        description="Map this item to preferred vendors and set vendor-specific rates."
        expanded={!collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#6B7280]">Map this item to preferred vendors</span>
          <button
            onClick={onAddRow}
            className={addLink}
          >
            <Plus size={14} /> Add Vendor
          </button>
        </div>

        {vendorMappings.map((row) => (
          <div key={row.id} className="space-y-3 rounded-xl border border-[#E7EAF1] bg-[#F8FAFC] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">Vendor Mapping</span>
              <button
                onClick={() => onRemoveRow(row.id)}
                className="rounded-lg p-1 text-[#6B7280] transition-colors hover:bg-[#EF4444]/10 hover:text-[#EF4444]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 items-center gap-x-4 gap-y-3 sm:grid-cols-[140px_1fr]">
              <label className="text-xs text-[#6B7280]">Variant</label>
              <div className="relative">
                <select
                  className={selectFieldSm}
                  value={row.variant_id || ''}
                  onChange={(e) => onRowChange(row.id, 'variant_id', e.target.value || null)}
                >
                  <option value="">No Category</option>
                  {(() => {
                    const variantOpts = Array.from(new Set(variantPricing.map(p => p.company_variant_id).filter(Boolean)))
                      .map(vId => {
                        const v = variants.find(v => v.id === vId);
                        return v ? {value: v.id, label: v.variant_name} : null;
                      })
                      .filter(Boolean) as {value: string; label: string}[];
                    return variantOpts.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ));
                  })()}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
              </div>
              <label className="text-xs text-[#6B7280]">Make</label>
              <Input
                value={row.make || ''}
                onChange={(e) => onRowChange(row.id, 'make', e.target.value)}
                placeholder="e.g. Brand A"
                className={inputFieldSm}
              />
              <label className="text-xs text-[#6B7280]">Vendor</label>
              <div className="relative">
                <select
                  className={selectFieldSm}
                  value={row.vendor_id}
                  onChange={(e) => onRowChange(row.id, 'vendor_id', e.target.value)}
                >
                  <option value="">Select vendor</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.company_name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
              </div>
              <label className="text-xs text-[#6B7280]">Base Rate</label>
              <Input
                value={row.base_rate}
                onChange={(e) => onRowChange(row.id, 'base_rate', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                type="number"
                step="0.01"
                className={inputFieldSm}
              />
              <label className="text-xs text-[#6B7280]">Discount %</label>
              <Input
                value={row.discount_percent}
                onChange={(e) => onRowChange(row.id, 'discount_percent', parseFloat(e.target.value) || 0)}
                placeholder="0"
                type="number"
                step="0.1"
                min="0"
                max="100"
                className={inputFieldSm}
              />
              <label className="text-xs text-[#6B7280]">Preferred</label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                <Checkbox
                  checked={row.is_preferred}
                  onCheckedChange={(checked) => onRowChange(row.id, 'is_preferred', checked)}
                />
                Set as preferred vendor
              </label>
            </div>
          </div>
        ))}

        {vendorMappings.length === 0 && (
          <p className="rounded-xl border border-dashed border-[#D6DAE6] bg-white px-4 py-3 text-xs italic text-[#6B7280]">
            No vendor mappings. Click "Add Vendor" to add one.
          </p>
        )}
      </EditorSection>
    </div>
  );
}
