import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { Input } from '../../../../components/ui/input';
import { Checkbox } from '../../../../components/ui/checkbox';
import { Select } from '../../../../components/ui/select';
import type { VendorMappingRow } from '../../model/aggregates';

interface VendorSectionProps {
  vendorMappings: VendorMappingRow[];
  vendors: { id: string; company_name: string }[];
  variants: { id: string; variant_name: string }[];
  variantPricing: { company_variant_id: string | null }[];
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  onRowChange: (id: string, field: string, value: any) => void;
}

export function VendorSection({ vendorMappings, vendors, variants, variantPricing, onAddRow, onRemoveRow, onRowChange }: VendorSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [collapsed]);

  return (
    <div ref={sectionRef} className="rounded-lg shadow-[0px_0px_0px_1px_oklch(0_0_0_/_0.06),0px_1px_2px_-1px_oklch(0_0_0_/_0.06),0px_2px_4px_0px_oklch(0_0_0_/_0.04)] bg-amber-50 p-4 space-y-4">
      <div
        className="flex items-center justify-between gap-3 cursor-pointer select-none"
        onClick={() => setCollapsed(!collapsed)}
      >
        <h4 className="text-sm font-semibold text-zinc-700">Purchase & Vendor Mapping</h4>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-400">Map vendor-specific pricing</span>
          {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />}
        </div>
      </div>

      {!collapsed && (<>

      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">Map this item to preferred vendors</span>
        <button
          onClick={onAddRow}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Add Vendor
        </button>
      </div>

      {vendorMappings.map((row) => (
        <div key={row.id} className="bg-zinc-50 rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide">Vendor Mapping</span>
            <button
              onClick={() => onRemoveRow(row.id)}
              className="p-1 rounded hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 items-center pl-2">
            <label className="text-xs text-zinc-500">Variant</label>
            <Select
              value={row.variant_id || ''}
              onValueChange={(v) => onRowChange(row.id, 'variant_id', v || null)}
              className="h-8 text-xs"
              options={[
                {value: '', label: 'No Category'},
                ...Array.from(new Set(variantPricing.map(p => p.company_variant_id).filter(Boolean)))
                  .map(vId => {
                    const v = variants.find(v => v.id === vId);
                    return v ? {value: v.id, label: v.variant_name} : null;
                  })
                  .filter(Boolean) as {value: string; label: string}[]
              ]}
            />
            <label className="text-xs text-zinc-500">Make</label>
            <Input
              value={row.make || ''}
              onChange={(e) => onRowChange(row.id, 'make', e.target.value)}
              placeholder="e.g. Brand A"
              className="h-8 text-xs"
            />
            <label className="text-xs text-zinc-500">Vendor</label>
            <Select
              value={row.vendor_id}
              onValueChange={(v) => onRowChange(row.id, 'vendor_id', v)}
              className="h-8 text-xs"
              options={[
                {value: '', label: 'Select vendor'},
                ...vendors.map(v => ({value: v.id, label: v.company_name}))
              ]}
            />
            <label className="text-xs text-zinc-500">Base Rate</label>
            <Input
              value={row.base_rate}
              onChange={(e) => onRowChange(row.id, 'base_rate', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              type="number"
              step="0.01"
              className="h-8 text-xs"
            />
            <label className="text-xs text-zinc-500">Discount %</label>
            <Input
              value={row.discount_percent}
              onChange={(e) => onRowChange(row.id, 'discount_percent', parseFloat(e.target.value) || 0)}
              placeholder="0"
              type="number"
              step="0.1"
              min="0"
              max="100"
              className="h-8 text-xs"
            />
            <label className="text-xs text-zinc-500">Preferred</label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
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
        <p className="text-xs text-zinc-400 italic">No vendor mappings. Click "Add Vendor" to add one.</p>
      )}
      </>)}
    </div>
  );
}
