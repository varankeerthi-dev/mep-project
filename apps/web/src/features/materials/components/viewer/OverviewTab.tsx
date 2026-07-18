import { formatCurrency, formatDate } from '../../../../utils/formatters';
import type { Material } from '../../model/entities';

interface OverviewTabProps {
  material: Material | null;
}

export function OverviewTab({ material }: OverviewTabProps) {
  if (!material) return <div className="p-6 text-sm text-zinc-400">No material selected.</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Basic Info</h4>
          <div className="space-y-2">
            <InfoRow label="Item Code" value={material.item_code || '-'} />
            <InfoRow label="Name" value={material.name} />
            <InfoRow label="Display Name" value={material.display_name || '-'} />
            <InfoRow label="Category" value={material.main_category || '-'} />
            <InfoRow label="Sub Category" value={material.sub_category || '-'} />
            <InfoRow label="Unit" value={material.unit} />
          </div>
        </div>
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Pricing & Tax</h4>
          <div className="space-y-2">
            <InfoRow label="Sale Price" value={material.sale_price ? formatCurrency(material.sale_price) : '-'} />
            <InfoRow label="Purchase Price" value={material.purchase_price ? formatCurrency(material.purchase_price) : '-'} />
            <InfoRow label="HSN/SAC" value={material.hsn_code || '-'} />
            <InfoRow label="GST Rate" value={material.gst_rate != null ? `${material.gst_rate}%` : '-'} />
            <InfoRow label="Status" value={material.is_active ? 'Active' : 'Inactive'} />
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-200 pt-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Technical</h4>
            <div className="space-y-2">
              <InfoRow label="Size" value={material.size || '-'} />
              <InfoRow label="Pressure Class" value={material.pressure_class || '-'} />
              <InfoRow label="Make/Brand" value={material.make || '-'} />
              <InfoRow label="Material" value={material.material || '-'} />
              <InfoRow label="End Connection" value={material.end_connection || '-'} />
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Dimensions</h4>
            <div className="space-y-2">
              <InfoRow label="Dimension" value={material.dimension ? `${material.dimension} ${material.dimension_unit}` : '-'} />
              <InfoRow label="Weight" value={material.weight ? `${material.weight} ${material.weight_unit}` : '-'} />
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Classification</h4>
            <div className="space-y-2">
              <InfoRow label="Type" value={material.item_classification || '-'} />
              <InfoRow label="Allow Purchase" value={material.allow_purchase ? 'Yes' : 'No'} />
              <InfoRow label="Allow Sales" value={material.allow_sales ? 'Yes' : 'No'} />
              <InfoRow label="Show in BOM" value={material.show_in_bom ? 'Yes' : 'No'} />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-200 pt-4">
        <div className="grid grid-cols-2 gap-4">
          <InfoRow label="Created" value={material.created_at ? formatDate(material.created_at) : '-'} />
          <InfoRow label="Last Updated" value={material.updated_at ? formatDate(material.updated_at) : '-'} />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-xs font-medium text-zinc-800 text-right">{value}</span>
    </div>
  );
}
