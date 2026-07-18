import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { Input } from '../../../../components/ui/input';
import { Checkbox } from '../../../../components/ui/checkbox';
import { Select } from '../../../../components/ui/select';
import type { VendorMappingRow } from '../../model/aggregates';

interface VendorSectionProps {
  vendorMappings: VendorMappingRow[];
  vendors: { id: string; company_name: string }[];
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  onRowChange: (id: string, field: string, value: any) => void;
}

export function VendorSection({ vendorMappings, vendors, onAddRow, onRemoveRow, onRowChange }: VendorSectionProps) {
  const [collapsed, setCollapsed] = useState(true);
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
        <div key={row.id} className="flex items-center gap-2 bg-zinc-50 rounded-md p-2 flex-wrap">
          <Select
            value={row.vendor_id}
            onValueChange={(v) => onRowChange(row.id, 'vendor_id', v)}
            className="h-8 flex-[2] min-w-[150px] text-xs"
            options={[
              {value: '', label: 'Select vendor'},
              ...vendors.map(v => ({value: v.id, label: v.company_name}))
            ]}
          />
          <Input
            value={row.base_rate}
            onChange={(e) => onRowChange(row.id, 'base_rate', parseFloat(e.target.value) || 0)}
            placeholder="Base Rate"
            type="number"
            step="0.01"
            className="h-8 text-xs w-24"
          />
          <Input
            value={row.discount_percent}
            onChange={(e) => onRowChange(row.id, 'discount_percent', parseFloat(e.target.value) || 0)}
            placeholder="Disc %"
            type="number"
            step="0.1"
            min="0"
            max="100"
            className="h-8 text-xs w-20"
          />
          <label className="flex items-center gap-1 text-xs cursor-pointer whitespace-nowrap">
            <Checkbox
              checked={row.is_preferred}
              onCheckedChange={(checked) => onRowChange(row.id, 'is_preferred', checked)}
            />
            Preferred
          </label>
          <button
            onClick={() => onRemoveRow(row.id)}
            className="p-1.5 rounded-md hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors relative after:absolute after:inset-[-8px]"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {vendorMappings.length === 0 && (
        <p className="text-xs text-zinc-400 italic">No vendor mappings. Click "Add Vendor" to add one.</p>
      )}
      </>)}
    </div>
  );
}
