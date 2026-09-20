// PersonalTaskListView.tsx — Private personal tasks view ("My Tasks")
import { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Calendar,
  Bookmark,
  MessageSquare,
  Clock,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { usePersonalTasks, useTogglePersonalTask } from '../../projects/features/collaboration/hooks';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function PersonalTaskListView() {
  const { user, organisation } = useAuth();
  const qc = useQueryClient();
  const { data: tasks = [], isLoading } = usePersonalTasks();
  const toggleTask = useTogglePersonalTask();

  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !user?.id || !organisation?.id) return;

    try {
      setIsAdding(true);
      const { error } = await supabase.from('personal_tasks').insert({
        user_id: user.id,
        organisation_id: organisation.id,
        title: newTitle.trim(),
        due_date: newDueDate || null,
        priority: newPriority,
      });

      if (error) throw error;
      setNewTitle('');
      setNewDueDate('');
      qc.invalidateQueries({ queryKey: ['collab', 'personal-tasks', user.id] });
      toast.success('Task added');
    } catch {
      toast.error('Failed to add task');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      const { error } = await supabase.from('personal_tasks').delete().eq('id', taskId);
      if (error) throw error;
      if (user?.id) qc.invalidateQueries({ queryKey: ['collab', 'personal-tasks', user.id] });
      toast.success('Task deleted');
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const filteredTasks = tasks.filter((t: any) => {
    if (filter === 'pending') return !t.is_completed;
    if (filter === 'completed') return t.is_completed;
    return true;
  });

  const pendingCount = tasks.filter((t: any) => !t.is_completed).length;
  const completedCount = tasks.filter((t: any) => t.is_completed).length;

  return (
    <div className="h-full flex flex-col bg-slate-50/50 p-6 overflow-y-auto" data-testid="personal-tasks-view">
      <div className="max-w-4xl w-full mx-auto space-y-5">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60">
              <Bookmark className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">My Personal Tasks</h1>
              <p className="text-xs text-slate-500">
                100% private to you — not visible to team members or organization admins.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setFilter('pending')}
              className={`px-3 py-1.5 rounded-md transition ${
                filter === 'pending' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('completed')}
              className={`px-3 py-1.5 rounded-md transition ${
                filter === 'completed' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
              }`}
            >
              Done ({completedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-md transition ${
                filter === 'all' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
              }`}
            >
              All ({tasks.length})
            </button>
          </div>
        </div>

        {/* Quick Add Form */}
        <form
          onSubmit={handleCreate}
          className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex flex-wrap sm:flex-nowrap items-center gap-2"
        >
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a new personal task..."
            className="flex-1 min-w-[200px] px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
          />

          <div className="flex items-center gap-2 shrink-0">
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="px-2.5 py-2 text-xs border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
              title="Due date (optional)"
            />

            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as any)}
              className="px-2.5 py-2 text-xs border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>

            <button
              type="submit"
              disabled={isAdding || !newTitle.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add</span>
            </button>
          </div>
        </form>

        {/* Tasks List */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
              <p className="text-xs">Loading personal tasks…</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Sparkles className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">No tasks in this view</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Add one above or click &quot;Add to my task&quot; from any chat message.
              </p>
            </div>
          ) : (
            filteredTasks.map((t: any) => (
              <div
                key={t.id}
                className={`p-4 flex items-start justify-between gap-3 group hover:bg-slate-50/70 transition ${
                  t.is_completed ? 'bg-slate-50/40 opacity-75' : ''
                }`}
                data-testid={`personal-task-row-${t.id}`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => toggleTask.mutate({ taskId: t.id, isCompleted: !t.is_completed })}
                    className="mt-0.5 text-slate-400 hover:text-amber-600 transition shrink-0 cursor-pointer"
                    aria-label={t.is_completed ? 'Mark pending' : 'Mark completed'}
                  >
                    {t.is_completed ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium ${
                        t.is_completed ? 'line-through text-slate-400' : 'text-slate-800'
                      }`}
                    >
                      {t.title}
                    </p>

                    {t.description && (
                      <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap line-clamp-2">
                        {t.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2.5 mt-2 text-[11px] text-slate-500">
                      {t.due_date && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          <Calendar className="h-3 w-3" />
                          {t.due_date}
                        </span>
                      )}

                      <span
                        className={`px-1.5 py-0.5 rounded font-medium ${
                          t.priority === 'urgent'
                            ? 'bg-red-50 text-red-700'
                            : t.priority === 'high'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {t.priority}
                      </span>

                      {t.source_message_id && (
                        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50/80 px-2 py-0.5 rounded">
                          <MessageSquare className="h-3 w-3" />
                          From chat
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(t.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition shrink-0 cursor-pointer"
                  title="Delete task"
                  aria-label="Delete task"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
