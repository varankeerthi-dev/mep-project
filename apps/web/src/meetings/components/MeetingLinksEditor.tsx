import { memo, useState } from 'react';
import { Link2, Plus, Trash2 } from 'lucide-react';
import { useSearchProjectWork } from '../hooks/useMeetings';
import type { MeetingLink, MeetingWorkOption } from '../types';

interface MeetingLinksEditorProps {
  links: MeetingLink[];
  projectId?: string;
  readonly?: boolean;
  onAdd: (link: MeetingLink) => void;
  onRemove: (index: number) => void;
}

export const MeetingLinksEditor = memo(function MeetingLinksEditor({
  links,
  projectId,
  readonly = false,
  onAdd,
  onRemove,
}: MeetingLinksEditorProps) {
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<'task' | 'milestone'>('task');
  const { data: workOptions = [], isLoading } = useSearchProjectWork(search, projectId);

  const filteredOptions = workOptions.filter((option) => option.task_type === selectedType);

  const handleAdd = (option: MeetingWorkOption) => {
    if (links.some((link) => link.entity_type === option.task_type && link.entity_id === option.id)) return;
    onAdd({
      id: '',
      meeting_id: '',
      entity_type: option.task_type,
      entity_id: option.id,
      entity_name: option.title,
      source_type: 'meeting',
      created_at: new Date().toISOString(),
    });
    setSearch('');
  };

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Link2 size={18} />
            Project Work Links ({links.length})
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Connect this MOM to tasks and milestones so the discussion history follows the work.
          </p>
        </div>
      </div>

      {!readonly && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[160px_minmax(0,1fr)] mb-4">
          <select
            value={selectedType}
            onChange={(event) => setSelectedType(event.target.value as 'task' | 'milestone')}
            className="rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Link type"
          >
            <option value="task">Task</option>
            <option value="milestone">Milestone</option>
          </select>
          <div className="relative">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search project tasks or milestones..."
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Search project tasks or milestones"
            />
            {search && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-auto rounded border border-slate-200 bg-white shadow-lg">
                {isLoading ? (
                  <div className="px-3 py-2 text-sm text-slate-500">Searching...</div>
                ) : filteredOptions.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-500">No matching {selectedType}s found.</div>
                ) : (
                  filteredOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleAdd(option)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <span className="truncate">{option.title}</span>
                      <Plus size={15} className="shrink-0 text-indigo-600" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {links.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
          No project tasks or milestones linked yet.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {links.map((link, index) => (
            <div key={link.id || `${link.entity_type}-${link.entity_id}-${index}`} className="flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-sm text-indigo-800">
              <span className="font-medium capitalize">{link.entity_type}</span>
              <span className="max-w-[260px] truncate">{link.entity_name || link.entity_id}</span>
              {!readonly && (
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="rounded-full p-0.5 text-indigo-600 hover:bg-indigo-100"
                  aria-label={`Remove ${link.entity_type} link`}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default MeetingLinksEditor;
