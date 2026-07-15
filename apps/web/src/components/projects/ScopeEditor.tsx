import { useState } from 'react';
import { Plus, Trash2, History } from 'lucide-react';
import { useProjectScopeItems, useUpsertScopeItem, useDeleteScopeItem, useScopeItemVersions, type ScopeItem } from '../../hooks/useProjectScope';

type ScopeType = ScopeItem['scope_type'];

const SCOPE_LABELS: Record<ScopeType, string> = {
  contractor_scope: 'Contractor Scope',
  client_scope: 'Client Scope',
  excluded_scope: 'Excluded Scope',
  pending_approval: 'Pending Approval',
  site_instructions: 'Site Instructions',
};

interface Props {
  projectId: string;
  scopeType: ScopeType;
}

export function ScopeEditor({ projectId, scopeType }: Props) {
  const { data: items, isLoading } = useProjectScopeItems(projectId);
  const upsertMutation = useUpsertScopeItem();
  const deleteMutation = useDeleteScopeItem();
  const [newItemText, setNewItemText] = useState('');
  const [viewVersionsId, setViewVersionsId] = useState<string | null>(null);
  const { data: versions } = useScopeItemVersions(viewVersionsId ?? undefined);

  const typeItems = (items ?? []).filter((i) => i.scope_type === scopeType);

  const handleAdd = () => {
    if (!newItemText.trim()) return;
    upsertMutation.mutate(
      { project_id: projectId, scope_type: scopeType, description: newItemText.trim() },
      { onSuccess: () => setNewItemText('') }
    );
  };

  const handleDelete = (item: ScopeItem) => {
    deleteMutation.mutate({ id: item.id, project_id: projectId });
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">{SCOPE_LABELS[scopeType]}</label>
      {isLoading ? (
        <div className="text-xs text-zinc-400">Loading...</div>
      ) : (
        <ul className="space-y-1">
          {typeItems.map((item) => (
            <li key={item.id} className="flex items-start gap-2 group">
              <span className="text-xs text-zinc-700 flex-1 leading-relaxed">{item.description}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={() => setViewVersionsId(viewVersionsId === item.id ? null : item.id)}
                  className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600"
                  title="View history"
                >
                  <History size={12} />
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  className="p-1 rounded hover:bg-red-50 text-zinc-400 hover:text-red-500"
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {viewVersionsId && versions && versions.length > 0 && (
        <div className="ml-4 pl-3 border-l-2 border-zinc-200 space-y-1 mt-1">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase">Version History</p>
          {versions.map((v) => (
            <div key={v.id} className="text-[11px] text-zinc-500">
              <span className="text-zinc-400">v{v.version}</span> — {v.description}
              {v.change_summary && <span className="text-zinc-300 ml-1">({v.change_summary})</span>}
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          placeholder="Add item..."
          className="flex-1 text-xs px-2 py-1.5 border border-zinc-200 rounded"
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
        />
        <button
          onClick={handleAdd}
          disabled={!newItemText.trim() || upsertMutation.isPending}
          className="px-2 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
