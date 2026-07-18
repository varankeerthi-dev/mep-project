import { Plus, Trash2 } from 'lucide-react';
import { Input } from '../../../../components/ui/input';
import type { ClientMappingRow } from '../../model/aggregates';

interface ClientSectionProps {
  clientMappings: ClientMappingRow[];
  clients: { id: string; client_name: string }[];
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  onRowChange: (id: string, field: string, value: any) => void;
}

export function ClientSection({ clientMappings, clients, onAddRow, onRemoveRow, onRowChange }: ClientSectionProps) {
  return (
    <fieldset className="border border-zinc-200 rounded-lg p-4 space-y-4">
      <legend className="text-sm font-semibold text-zinc-700 px-2">Client Mappings</legend>

      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">Map this item to client-specific part numbers</span>
        <button
          onClick={onAddRow}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Add Client
        </button>
      </div>

      {clientMappings.map((row) => (
        <div key={row.id} className="flex items-center gap-2 bg-zinc-50 rounded-lg p-2 flex-wrap">
          <select
            value={row.client_id}
            onChange={(e) => onRowChange(row.id, 'client_id', e.target.value)}
            className="h-8 flex-1 min-w-[150px] rounded-md border border-zinc-300 bg-white px-2 text-xs"
          >
            <option value="">Select client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.client_name}</option>
            ))}
          </select>
          <Input
            value={row.client_part_no}
            onChange={(e) => onRowChange(row.id, 'client_part_no', e.target.value)}
            placeholder="Part No"
            className="h-8 text-xs w-24"
          />
          <Input
            value={row.client_description}
            onChange={(e) => onRowChange(row.id, 'client_description', e.target.value)}
            placeholder="Description"
            className="h-8 text-xs w-32"
          />
          <button
            onClick={() => onRemoveRow(row.id)}
            className="p-1.5 rounded-md hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {clientMappings.length === 0 && (
        <p className="text-xs text-zinc-400 italic">No client mappings. Click "Add Client" to add one.</p>
      )}
    </fieldset>
  );
}
