import { formatCurrency, formatDate } from '../../../../utils/formatters';
import type { Material } from '../../model/entities';

interface OverviewTabProps {
  material: Material | null;
}

export function OverviewTab({ material }: OverviewTabProps) {
  if (!material) return <div className="p-6 text-sm text-zinc-400">No material selected.</div>;

  const salePrice = material.sale_price || 0;
  const purchasePrice = material.purchase_price || 0;
  const margin = salePrice > 0 ? ((salePrice - purchasePrice) / salePrice * 100).toFixed(1) : '0.0';
  const status = material.is_active ? 'Active' : 'Inactive';
  const statusColor = material.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-zinc-50 text-zinc-500 border-zinc-200';

  return (
    <div className="p-4 space-y-4">
      {/* Header badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-mono font-semibold border border-blue-200">
          {material.item_code}
        </span>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${statusColor}`}>
          {status}
        </span>
        {material.main_category && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-zinc-50 text-zinc-600 text-xs border border-zinc-200">
            {material.main_category}
          </span>
        )}
        {material.make && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-zinc-50 text-zinc-600 text-xs border border-zinc-200">
            {material.make}
          </span>
        )}
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Sale Price" value={salePrice > 0 ? formatCurrency(salePrice) : '—'} sub={`per ${material.unit}`} />
        <MetricCard label="Purchase Price" value={purchasePrice > 0 ? formatCurrency(purchasePrice) : '—'} sub={`per ${material.unit}`} />
        <MetricCard label="Margin" value={`${margin}%`} sub={Number(margin) > 0 ? 'Profit margin' : 'No margin'} />
        <MetricCard label="HSN / GST" value={material.hsn_code || '—'} sub={material.gst_rate != null ? `GST ${material.gst_rate}%` : 'No GST'} />
      </div>

      {/* Basic Info + Pricing */}
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
            <InfoRow label="Sale Price" value={salePrice > 0 ? formatCurrency(salePrice) : '-'} />
            <InfoRow label="Purchase Price" value={purchasePrice > 0 ? formatCurrency(purchasePrice) : '-'} />
            <InfoRow label="HSN/SAC" value={material.hsn_code || '-'} />
            <InfoRow label="GST Rate" value={material.gst_rate != null ? `${material.gst_rate}%` : '-'} />
            <InfoRow label="Status" value={status} />
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

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3">
      <p className="text-[10px] uppercase tracking-wide text-zinc-400 font-semibold">{label}</p>
      <p className="text-sm font-bold text-zinc-800 tabular-nums mt-0.5">{value}</p>
      <p className="text-[11px] text-zinc-400 mt-0.5">{sub}</p>
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
