import { useState, useMemo } from 'react';
import { Search, X, UserPlus, UserMinus, Check } from 'lucide-react';
import { useTeamMembers, useBulkAssignTasks, useBulkUnassignTasks } from './hooks';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';

interface BulkAssignModalProps {
  taskIds: string[];
  mode: 'assign' | 'unassign';
  onClose: () => void;
}

export default function BulkAssignModal({ taskIds, mode, onClose }: BulkAssignModalProps) {
  const { organisation } = useAuth();
  const orgId = organisation?.id;
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: members = [], isLoading } = useTeamMembers(orgId);
  const bulkAssign = useBulkAssignTasks();
  const bulkUnassign = useBulkUnassignTasks();

  const filtered = useMemo(() => {
    if (!search) return members;
    const q = search.toLowerCase();
    return members.filter((m) => m.id.toLowerCase().includes(q));
  }, [members, search]);

  const handleConfirm = () => {
    if (!selectedId) return;
    if (mode === 'assign') {
      bulkAssign.mutate(
        { taskIds, assigneeId: selectedId },
        { onSuccess: onClose }
      );
    } else {
      bulkUnassign.mutate(
        { taskIds, assigneeId: selectedId },
        { onSuccess: onClose }
      );
    }
  };

  const isPending = bulkAssign.isPending || bulkUnassign.isPending;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
          <div className="flex items-center gap-2">
            {mode === 'assign' ? (
              <UserPlus className="w-5 h-5 text-blue-600" />
            ) : (
              <UserMinus className="w-5 h-5 text-red-600" />
            )}
            <h2 className="text-base font-semibold text-zinc-900">
              {mode === 'assign' ? 'Assign Tasks' : 'Unassign Tasks'}
            </h2>
          </div>
          <Button variant="secondary" size="icon-xs" onClick={onClose} >
            <X size={18} />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-4">
          <p className="text-sm text-zinc-500 mb-3">
            {taskIds.length} task{taskIds.length !== 1 ? 's' : ''} selected
          </p>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search team members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Member list */}
          {isLoading ? (
            <div className="py-8 text-center text-sm text-zinc-400">Loading team members...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-400">No team members found</div>
          ) : (
            <div className="space-y-1">
              {filtered.map((member) => (
                <Button variant="default" size="sm" key={member.id} onClick={() => setSelectedId(selectedId === member.id ? null : member.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    selectedId === member.id
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-zinc-50 border border-transparent'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                    style={{
                      backgroundColor: selectedId === member.id ? '#dbeafe' : '#f4f4f5',
                      color: selectedId === member.id ? '#1d4ed8' : '#71717a',
                    }}
                  >
                    {member.id.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-900 truncate">{member.id}</div>
                    <div className="text-xs text-zinc-500 capitalize">{member.role}</div>
                  </div>
                  {selectedId === member.id && (
                    <Check className="w-4 h-4 text-blue-600 shrink-0" />
                  )}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-zinc-200 bg-zinc-50/50">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isPending} >
            Cancel
          </Button>
          <Button variant="default" size="sm" onClick={handleConfirm} disabled={!selectedId || isPending} className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${ mode === 'assign' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700' }`} >
            {isPending
              ? 'Processing...'
              : mode === 'assign'
              ? `Assign to ${taskIds.length} task${taskIds.length !== 1 ? 's' : ''}`
              : `Unassign from ${taskIds.length} task${taskIds.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
