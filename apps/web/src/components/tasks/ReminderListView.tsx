// ReminderListView.tsx — Recipient-scoped reminders sub-tab in Task module
import { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Circle,
  Clock,
  Trash2,
  User,
  Calendar,
  Sparkles,
  Loader2,
  XCircle,
} from 'lucide-react';
import { useTaskReminders, useToggleReminderStatus } from '../../projects/features/collaboration/hooks';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function ReminderListView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: reminders = [], isLoading } = useTaskReminders();
  const toggleStatus = useToggleReminderStatus();
  const [filter, setFilter] = useState<'pending' | 'completed' | 'all'>('pending');

  const handleDelete = async (reminderId: string) => {
    try {
      const { error } = await supabase.from('task_reminders').delete().eq('id', reminderId);
      if (error) throw error;
      if (user?.id) qc.invalidateQueries({ queryKey: ['collab', 'reminders', user.id] });
      toast.success('Reminder removed');
    } catch {
      toast.error('Failed to remove reminder');
    }
  };

  const filtered = reminders.filter((r: any) => {
    if (filter === 'pending') return r.status === 'pending';
    if (filter === 'completed') return r.status === 'completed';
    return true;
  });

  const pendingCount = reminders.filter((r: any) => r.status === 'pending').length;
  const completedCount = reminders.filter((r: any) => r.status === 'completed').length;

  return (
    <div className="h-full flex flex-col bg-slate-50/50 p-6 overflow-y-auto" data-testid="reminders-view">
      <div className="max-w-4xl w-full mx-auto space-y-5">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200/60">
              <Bell className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Reminders</h1>
              <p className="text-xs text-slate-500">
                Actionable alerts set for you or assigned by team members.
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
              Completed ({completedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-md transition ${
                filter === 'all' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
              }`}
            >
              All ({reminders.length})
            </button>
          </div>
        </div>

        {/* Reminders List */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
              <p className="text-xs">Loading reminders…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Sparkles className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">No reminders in this view</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Hover any message in collaboration chat and select &quot;Set Reminder&quot;.
              </p>
            </div>
          ) : (
            filtered.map((r: any) => {
              const isDone = r.status === 'completed';
              const isOverdue = r.remind_at && new Date(r.remind_at).getTime() < Date.now() && !isDone;

              return (
                <div
                  key={r.id}
                  className={`p-4 flex items-start justify-between gap-3 group hover:bg-slate-50/70 transition ${
                    isDone ? 'bg-slate-50/40 opacity-75' : ''
                  }`}
                  data-testid={`reminder-row-${r.id}`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() =>
                        toggleStatus.mutate({
                          reminderId: r.id,
                          status: isDone ? 'pending' : 'completed',
                        })
                      }
                      className="mt-0.5 text-slate-400 hover:text-purple-600 transition shrink-0 cursor-pointer"
                      aria-label={isDone ? 'Mark pending' : 'Mark completed'}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium ${
                          isDone ? 'line-through text-slate-400' : 'text-slate-800'
                        }`}
                      >
                        {r.title}
                      </p>

                      {r.notes && (
                        <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap line-clamp-2">
                          {r.notes}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2.5 mt-2 text-[11px]">
                        {r.remind_at ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium ${
                              isOverdue
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-purple-50 text-purple-700'
                            }`}
                          >
                            <Clock className="h-3 w-3" />
                            {new Date(r.remind_at).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {isOverdue && <span className="font-bold"> (Overdue)</span>}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-500 italic">
                            Date-less
                          </span>
                        )}

                        {r.created_by === user?.id ? (
                          <span className="text-slate-500">Self reminder</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                            <User className="h-3 w-3" />
                            From colleague
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition shrink-0 cursor-pointer"
                    title="Delete reminder"
                    aria-label="Delete reminder"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
