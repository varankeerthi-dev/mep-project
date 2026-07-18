import { Plus, Trash2 } from 'lucide-react';
import { Input } from '../../../../components/ui/input';
import type { VendorMappingRow } from '../../model/aggregates';

interface VendorSectionProps {
  vendorMappings: VendorMappingRow[];
  vendors: { id: string; company_name: string }[];
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  onRowChange: (id: string, field: string, value: any) => void;
}

export function VendorSection({ vendorMappings, vendors, onAddRow, onRemoveRow, onRowChange }: VendorSectionProps) {
  return (
    <fieldset className="border border-zinc-200 rounded-lg p-4 space-y-4">
      <legend className="text-sm font-semibold text-zinc-700 px-2">Vendor Mappings</legend>

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
        <div key={row.id} className="flex items-center gap-2 bg-zinc-50 rounded-lg p-2 flex-wrap">
          <select
            value={row.vendor_id}
            onChange={(e) => onRowChange(row.id, 'vendor_id', e.target.value)}
            className="h-8 flex-[2] min-w-[150px] rounded-md border border-zinc-300 bg-white px-2 text-xs"
          >
            <option value="">Select vendor</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.company_name}</option>
            ))}
          </select>
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
            <input
              type="checkbox"
              checked={row.is_preferred}
              onChange={(e) => onRowChange(row.id, 'is_preferred', e.target.checked)}
              className="rounded border-zinc-300"
            />
            Preferred
          </label>
          <button
            onClick={() => onRemoveRow(row.id)}
            className="p-1.5 rounded-md hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {vendorMappings.length === 0 && (
        <p className="text-xs text-zinc-400 italic">No vendor mappings. Click "Add Vendor" to add one.</p>
      )}
    </fieldset>
  );
}
