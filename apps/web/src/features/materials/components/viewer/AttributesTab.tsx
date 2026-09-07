import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ClipboardList, Loader2 } from 'lucide-react';
import { supabase } from '../../../../supabase';
import type { MaterialCustomAttribute } from '../../model/entities';

interface AttributesTabProps {
  materialId?: string;
}

function formatAttributeValue(attribute: MaterialCustomAttribute) {
  if (!attribute.attribute_value) return '—';
  if (attribute.data_type === 'boolean') return attribute.attribute_value === 'true' ? 'Yes' : 'No';
  return attribute.attribute_value;
}

export function AttributesTab({ materialId }: AttributesTabProps) {
  const { data: attributes = [], isLoading } = useQuery({
    queryKey: ['material-custom-attributes', materialId],
    queryFn: async () => {
      if (!materialId) return [] as MaterialCustomAttribute[];
      const { data, error } = await supabase
        .from('material_custom_attributes')
        .select('*')
        .eq('material_id', materialId)
        .order('sort_order');
      if (error) throw error;
      return (data || []) as MaterialCustomAttribute[];
    },
    enabled: !!materialId,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center gap-2 p-8 text-xs text-zinc-500"><Loader2 size={14} className="animate-spin" /> Loading attributes...</div>;
  }

  if (attributes.length === 0) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><ClipboardList size={23} /></div>
        <div>
          <p className="text-sm font-semibold text-zinc-800">No custom attributes saved</p>
          <p className="mt-1 text-xs text-zinc-500">Add item-specific details from Edit Item.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-900">
        <CalendarDays size={15} className="mt-0.5 shrink-0 text-indigo-600" />
        <span>These details describe the item master. Production batch, expiry, and serial values are tracked with the inventory lot and shown on dispatch or invoice when selected.</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {attributes.map((attribute) => (
          <div key={attribute.id || `${attribute.attribute_name}-${attribute.sort_order}`} className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5">
            <div className="text-[11px] font-medium text-zinc-500">{attribute.attribute_name || 'Unnamed attribute'}</div>
            <div className="mt-1 text-sm font-semibold text-zinc-900">
              {formatAttributeValue(attribute)}
              {attribute.attribute_unit && <span className="ml-1 text-xs font-normal text-zinc-500">{attribute.attribute_unit}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
