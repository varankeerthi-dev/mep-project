import { useState, useCallback, memo } from 'react';
import { Plus, Trash2, Mail, Building2, User } from 'lucide-react';
import type { AttendeeRole } from '../types';

export interface Attendee {
  id: string;
  name: string;
  email: string;
  role: string;
  organisation: string;
}

interface AttendeeListProps {
  attendees: Attendee[];
  onChange: (attendees: Attendee[]) => void;
  readonly?: boolean;
}

const ROLE_OPTIONS: { value: AttendeeRole; label: string }[] = [
  { value: 'organizer', label: 'Organizer' },
  { value: 'client_rep', label: 'Client Representative' },
  { value: 'vendor_rep', label: 'Vendor Representative' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'site_engineer', label: 'Site Engineer' },
  { value: 'team_member', label: 'Team Member' },
  { value: 'attendee', label: 'Attendee' },
  { value: 'observer', label: 'Observer' },
];

export const AttendeeList = memo(function AttendeeList({
  attendees,
  onChange,
  readonly = false,
}: AttendeeListProps) {
  const [newAttendee, setNewAttendee] = useState<Attendee>({
    id: '',
    name: '',
    email: '',
    role: 'attendee',
    organisation: '',
  });

  const addAttendee = useCallback(() => {
    if (!newAttendee.name.trim()) return;
    onChange([...attendees, { ...newAttendee, id: crypto.randomUUID() }]);
    setNewAttendee({ id: '', name: '', email: '', role: 'attendee', organisation: '' });
  }, [newAttendee, attendees, onChange]);

  const removeAttendee = useCallback((id: string) => {
    onChange(attendees.filter((a) => a.id !== id));
  }, [attendees, onChange]);

  const updateAttendee = useCallback((id: string, field: keyof Attendee, value: string) => {
    onChange(attendees.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
  }, [attendees, onChange]);

  return (
    <div className="attendee-list">
      <div className="space-y-3">
        {attendees.map((attendee) => (
          <div key={attendee.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <div className="flex-1 grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  <User size={12} className="inline mr-1" />
                  Name *
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[30px]"
                  value={attendee.name}
                  onChange={(e) => updateAttendee(attendee.id, 'name', e.target.value)}
                  readOnly={readonly}
                  placeholder="Attendee name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  <Mail size={12} className="inline mr-1" />
                  Email
                </label>
                <input
                  type="email"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[30px]"
                  value={attendee.email}
                  onChange={(e) => updateAttendee(attendee.id, 'email', e.target.value)}
                  readOnly={readonly}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                <select
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[30px]"
                  value={attendee.role}
                  onChange={(e) => updateAttendee(attendee.id, 'role', e.target.value)}
                  disabled={readonly}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  <Building2 size={12} className="inline mr-1" />
                  Organisation
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[30px]"
                  value={attendee.organisation}
                  onChange={(e) => updateAttendee(attendee.id, 'organisation', e.target.value)}
                  readOnly={readonly}
                  placeholder="Company name"
                />
              </div>
            </div>
            {!readonly && (
              <button
                type="button"
                onClick={() => removeAttendee(attendee.id)}
                className="p-2 hover:bg-red-100 text-red-600 rounded mt-5"
                title="Remove attendee"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      {!readonly && (
        <div className="mt-4 p-4 bg-slate-50 rounded-lg">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Add New Attendee</h4>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <input
                type="text"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[30px]"
                value={newAttendee.name}
                onChange={(e) => setNewAttendee({ ...newAttendee, name: e.target.value })}
                placeholder="Name *"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addAttendee();
                }}
              />
            </div>
            <div>
              <input
                type="email"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[30px]"
                value={newAttendee.email}
                onChange={(e) => setNewAttendee({ ...newAttendee, email: e.target.value })}
                placeholder="Email"
              />
            </div>
            <div>
              <select
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[30px]"
                value={newAttendee.role}
                onChange={(e) => setNewAttendee({ ...newAttendee, role: e.target.value })}
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <input
                type="text"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[30px]"
                value={newAttendee.organisation}
                onChange={(e) => setNewAttendee({ ...newAttendee, organisation: e.target.value })}
                placeholder="Organisation"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={addAttendee}
            disabled={!newAttendee.name.trim()}
            className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 text-sm"
          >
            <Plus size={16} />
            Add Attendee
          </button>
        </div>
      )}

      {attendees.length === 0 && !readonly && (
        <div className="text-center py-4 text-slate-500 text-sm">
          No attendees added yet. Add attendees above.
        </div>
      )}
    </div>
  );
});
