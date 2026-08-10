import { cn } from '../../../../lib/utils';
import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import { Input } from '../../../../components/ui/input';
import { Checkbox } from '../../../../components/ui/checkbox';
import { EditorSection } from './EditorSection';
import { inputFieldSm, selectFieldSm, addLink, deleteIconButton } from './formStyles';
import type { VendorMappingRow } from '../../model/aggregates';
import { Button } from '@/components/ui/button';

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

  const tdStyle: React.CSSProperties = { padding: '12px 16px' };

  return (
    <div ref={sectionRef}>
      <EditorSection
        number={number}
        title="Purchase & Vendor Mapping"
        expanded={!collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        headerActions={
          <Button variant="default" size="default" type="button" onClick={onAddRow} className={addLink} >
            <Plus size={14} /> Add Vendor
          </Button>
        }
      >
        {vendorMappings.map((row, idx) => (
          <div key={row.id} className={cn('rounded-lg border border-[#E2E5EB] bg-white p-5 transition-colors hover:bg-[#F9FAFB]/80', idx > 0 && 'mt-3')}>
            {/* Row Header */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Vendor Mapping</span>
              <Button variant="default" size="default" onClick={() => onRemoveRow(row.id)}
                className={deleteIconButton}
                aria-label="Delete vendor mapping"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Fields Grid */}
            <div className="grid grid-cols-1 items-center gap-x-4 gap-y-3 sm:grid-cols-[140px_400px]">
              <label className="text-[13px] font-medium text-[#475467]">Variant</label>
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
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              </div>

              <label className="text-[13px] font-medium text-[#475467]">Make</label>
              <Input
                value={row.make || ''}
                onChange={(e) => onRowChange(row.id, 'make', e.target.value)}
                placeholder="e.g. Brand A"
                className={inputFieldSm}
              />

              <label className="text-[13px] font-medium text-[#475467]">Vendor</label>
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
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              </div>

              <label className="text-[13px] font-medium text-[#475467]">Base Rate</label>
              <Input
                value={row.base_rate}
                onChange={(e) => onRowChange(row.id, 'base_rate', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                type="number"
                step="0.01"
                className={inputFieldSm}
              />

              <label className="text-[13px] font-medium text-[#475467]">Discount %</label>
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

              <label className="text-[13px] font-medium text-[#475467]">Preferred</label>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#475467]">
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
          <div className="rounded-lg border border-dashed border-[#D0D5DD] bg-[#F9FAFB] px-6 py-8 text-center">
            <p className="text-[13px] text-[#9CA3AF]">No vendor mappings yet.</p>
            <p className="mt-1 text-[12px] text-[#D0D5DD]">Click "Add Vendor" to map this item to a preferred vendor.</p>
          </div>
        )}
      </EditorSection>
    </div>
  );
}
