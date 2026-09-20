// ReminderCreateDrawer.tsx — drawer to set a reminder from a collaboration message.
import { useState, useEffect } from 'react';
import { X, Bell, Calendar, User, Clock } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { useChannelMembers, useCreateReminderFromMessage, useSendMessage } from '../hooks';
import { useCollabStore } from '../store';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function ReminderCreateDrawer() {
  const { user } = useAuth();
  const reminderDrawerOpen = useCollabStore((s) => s.reminderDrawerOpen);
  const reminderInitial = useCollabStore((s) => s.reminderInitial);
  const closeReminderCreate = useCollabStore((s) => s.closeReminderCreate);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [recipientId, setRecipientId] = useState<string>('');
  const [remindAt, setRemindAt] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const channelId = reminderInitial?.channelId ?? '';
  const membersQuery = useChannelMembers(channelId);
  const createReminder = useCreateReminderFromMessage(channelId);
  const sendMessage = useSendMessage(channelId);

  useEffect(() => {
    if (reminderInitial) {
      setTitle(reminderInitial.defaultTitle ?? '');
      setNotes(reminderInitial.defaultNotes ?? '');
      setRecipientId(user?.id ?? '');
      setRemindAt('');
    }
  }, [reminderInitial, user?.id]);

  if (!reminderDrawerOpen || !reminderInitial) return null;

  const handleQuickTime = (type: 'tomorrow' | 'in2days' | 'nextweek' | 'none') => {
    if (type === 'none') {
      setRemindAt('');
      return;
    }
    const d = new Date();
    if (type === 'tomorrow') d.setDate(d.getDate() + 1);
    else if (type === 'in2days') d.setDate(d.getDate() + 2);
    else if (type === 'nextweek') d.setDate(d.getDate() + 7);
    d.setHours(9, 0, 0, 0);

    // Format for datetime-local: YYYY-MM-DDTHH:mm
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    setRemindAt(localISOTime);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    try {
      setIsSubmitting(true);
      const isoRemindAt = remindAt ? new Date(remindAt).toISOString() : null;

      const created = await createReminder.mutateAsync({
        messageId: reminderInitial.messageId,
        recipientId: recipientId || user?.id || null,
        title: title.trim(),
        notes: notes.trim() || null,
        remindAt: isoRemindAt,
      });

      const member = (membersQuery.data ?? []).find((m) => m.user_id === recipientId);
      const recipientName = recipientId === user?.id ? 'Myself' : (member?.full_name ?? 'Team Member');

      // Post system card message to channel
      try {
        await sendMessage.mutateAsync({
          text: `Reminder set: ${title.trim()}`,
          parentMessageId: null,
          linkedEntities: [
            {
              type: 'reminder',
              id: created.id,
              label: title.trim(),
              snapshot: {
                title: title.trim(),
                remind_at: isoRemindAt,
                recipient_name: recipientName,
                status: 'pending',
              },
            },
          ],
        });
      } catch {
        // non-blocking
      }

      toast.success('✓ Reminder set');
      closeReminderCreate();
    } catch {
      toast.error('Failed to set reminder');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-purple-50/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Set Reminder</h2>
              <p className="text-xs text-gray-500">From collaboration message</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeReminderCreate}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Reminder Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What should be remembered?"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Context / Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional additional context..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Recipient
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <select
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 bg-white"
              >
                <option value={user?.id ?? ''}>Myself</option>
                {(membersQuery.data ?? [])
                  .filter((m) => m.user_id !== user?.id)
                  .map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.full_name || 'Team member'}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Remind At (Optional)
            </label>
            {/* Quick Pills */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => handleQuickTime('tomorrow')}
                className="px-2.5 py-1 text-xs font-medium rounded-full border border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-600 hover:text-purple-700 transition"
              >
                Tomorrow 9 AM
              </button>
              <button
                type="button"
                onClick={() => handleQuickTime('in2days')}
                className="px-2.5 py-1 text-xs font-medium rounded-full border border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-600 hover:text-purple-700 transition"
              >
                In 2 Days
              </button>
              <button
                type="button"
                onClick={() => handleQuickTime('nextweek')}
                className="px-2.5 py-1 text-xs font-medium rounded-full border border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-600 hover:text-purple-700 transition"
              >
                Next Week
              </button>
              <button
                type="button"
                onClick={() => handleQuickTime('none')}
                className="px-2.5 py-1 text-xs font-medium rounded-full border border-gray-200 hover:border-gray-400 text-gray-500 transition"
              >
                Date-less
              </button>
            </div>

            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="datetime-local"
                value={remindAt}
                onChange={(e) => setRemindAt(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              Leave blank for date-less reminders (always visible in Reminders tab).
            </p>
          </div>

          <div className="pt-4 border-t border-gray-200 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeReminderCreate}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-purple-600 hover:bg-purple-700 text-white"
              disabled={isSubmitting || !title.trim()}
            >
              {isSubmitting ? 'Setting…' : 'Set Reminder'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
