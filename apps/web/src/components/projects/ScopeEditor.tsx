import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Loader2, Check, Pencil, X, FileText, CheckCircle2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';

export type ScopeType = 'contractor_scope' | 'client_scope' | 'excluded_scope' | 'pending_approval' | 'site_instructions';

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
  const qc = useQueryClient();
  const [newItemText, setNewItemText] = useState('');
  const [savedStatus, setSavedStatus] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Fetch current scope string from projects table
  const { data: scopeValue = '', isLoading } = useQuery({
    queryKey: ['projectScopeField', projectId, scopeType],
    queryFn: async () => {
      if (!projectId) return '';
      const { data, error } = await supabase
        .from('projects')
        .select(scopeType)
        .eq('id', projectId)
        .single();
      if (error) throw error;
      return (data as any)?.[scopeType] || '';
    },
    enabled: !!projectId,
  });

  // Mutate projects table with updated scope items
  const updateMutation = useMutation({
    mutationFn: async (formattedText: string) => {
      const { error } = await supabase
        .from('projects')
        .update({ [scopeType]: formattedText || null })
        .eq('id', projectId);
      if (error) throw error;
      return formattedText;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projectScopeField', projectId, scopeType] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      setSavedStatus(true);
      setEditingIndex(null);
      setIsBulkMode(false);
      setTimeout(() => setSavedStatus(false), 2000);
    },
    onError: (err: any) => {
      alert(`Failed to save scope: ${err?.message || err}`);
    }
  });

  const items = scopeValue
    ? scopeValue.split('\n').map((s: string) => s.trim()).filter(Boolean)
    : [];

  useEffect(() => {
    if (editingIndex !== null) {
      editInputRef.current?.focus();
    }
  }, [editingIndex]);

  const handleAdd = () => {
    if (!newItemText.trim()) return;
    const updated = [...items, newItemText.trim()];
    updateMutation.mutate(updated.join('\n'));
    setNewItemText('');
  };

  const handleDelete = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    updateMutation.mutate(updated.join('\n'));
  };

  const handleStartEdit = (index: number, text: string) => {
    setEditingIndex(index);
    setEditingText(text.replace(/^\d+\.\s*/, ''));
  };

  const handleSaveEdit = (index: number) => {
    if (!editingText.trim()) {
      handleDelete(index);
      return;
    }
    const updated = [...items];
    updated[index] = editingText.trim();
    updateMutation.mutate(updated.join('\n'));
  };

  const handleStartBulk = () => {
    setBulkText(items.join('\n'));
    setIsBulkMode(true);
  };

  const handleSaveBulk = () => {
    const formatted = bulkText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .join('\n');
    updateMutation.mutate(formatted);
  };

  return (
    <div className="flex flex-col gap-2 p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-xl">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          {SCOPE_LABELS[scopeType]}
        </label>
        <div className="flex items-center gap-1.5 text-[10px]">
          {updateMutation.isPending && (
            <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
              <Loader2 size={11} className="animate-spin" /> Saving...
            </span>
          )}
          {savedStatus && (
            <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
              <Check size={11} /> Saved
            </span>
          )}
          <button
            type="button"
            onClick={isBulkMode ? () => setIsBulkMode(false) : handleStartBulk}
            className="text-[11px] font-medium text-slate-500 hover:text-blue-600 px-1.5 py-0.5 rounded hover:bg-slate-200/60 transition-colors inline-flex items-center gap-1"
            title={isBulkMode ? 'Switch to list view' : 'Edit as multiline text'}
          >
            <FileText size={11} />
            {isBulkMode ? 'List' : 'Bulk'}
          </button>
          <span className="bg-slate-200/80 text-slate-600 px-1.5 py-0.2 rounded font-semibold">
            {items.length}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="text-xs text-slate-400 py-2">Loading items...</div>
      ) : isBulkMode ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`Enter each ${SCOPE_LABELS[scopeType].toLowerCase()} item on a new line...`}
            rows={5}
            className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800 font-mono resize-y"
          />
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setIsBulkMode(false)}
              className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200/60 rounded-md font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveBulk}
              disabled={updateMutation.isPending}
              className="px-2.5 py-1 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-md font-medium inline-flex items-center gap-1"
            >
              <CheckCircle2 size={12} /> Save
            </button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-400 italic py-1">No items defined yet.</p>
      ) : (
        <ul className="space-y-1.5 my-1 max-h-48 overflow-y-auto pr-1">
          {items.map((item: string, idx: number) => (
            <li
              key={idx}
              className={`flex items-start justify-between gap-2 p-1.5 bg-white border rounded-lg transition-colors ${
                editingIndex === idx ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200/90 group hover:border-slate-300'
              }`}
            >
              {editingIndex === idx ? (
                <div className="flex items-center gap-1.5 w-full">
                  <span className="text-[11px] font-mono font-semibold text-blue-600 shrink-0">
                    {idx + 1}.
                  </span>
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(idx);
                      if (e.key === 'Escape') setEditingIndex(null);
                    }}
                    className="flex-1 text-xs px-1.5 py-0.5 border border-slate-300 rounded focus:outline-none focus:border-blue-500 text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(idx)}
                    disabled={updateMutation.isPending}
                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded shrink-0"
                    title="Save (Enter)"
                  >
                    <Check size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingIndex(null)}
                    className="p-1 text-slate-400 hover:bg-slate-100 rounded shrink-0"
                    title="Cancel (Esc)"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className="flex items-start gap-2 min-w-0 flex-1 cursor-pointer"
                    onClick={() => handleStartEdit(idx, item)}
                    title="Click to edit"
                  >
                    <span className="text-[11px] font-mono font-semibold text-slate-400 shrink-0 mt-0.5">
                      {idx + 1}.
                    </span>
                    <span className="text-xs text-slate-700 leading-snug break-words hover:text-blue-600">
                      {item.replace(/^\d+\.\s*/, '')}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(idx, item)}
                      className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Edit item"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(idx)}
                      disabled={updateMutation.isPending}
                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete item"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {!isBulkMode && (
        <div className="flex gap-1.5 mt-1">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder={`Add ${SCOPE_LABELS[scopeType].toLowerCase()} item...`}
            className="flex-1 text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newItemText.trim() || updateMutation.isPending}
            className="inline-flex items-center justify-center w-8 h-8 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs shrink-0"
            title="Add item"
          >
            <Plus size={14} />
          </button>
        </div>
      )}
    </div>
  );
}


