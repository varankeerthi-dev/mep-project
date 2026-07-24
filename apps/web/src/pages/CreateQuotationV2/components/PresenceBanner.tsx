import React, { useState, useEffect } from 'react';
import { Eye, AlertTriangle, X } from 'lucide-react';
import { PresenceUser } from '../hooks/usePresence';

interface PresenceBannerProps {
  users: PresenceUser[];
}

export function PresenceBanner({ users }: PresenceBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state if the active users list changes
  useEffect(() => {
    setDismissed(false);
  }, [users.length]);

  if (users.length === 0 || dismissed) {
    return null;
  }

  const userListText = users.map((u) => `${u.user_name} (${u.email})`).join(', ');

  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-6 py-3 rounded-lg flex items-center justify-between text-xs font-semibold mb-4 animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 animate-bounce" />
        <span>
          <strong className="text-amber-900">Collaboration Warning:</strong> {users.length === 1 ? 'Another user' : 'Other users'} ({userListText}) {users.length === 1 ? 'is' : 'are'} currently viewing or editing this quotation. Saving your changes might overwrite their work.
        </span>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-amber-500 hover:text-amber-800 p-1 hover:bg-amber-100 rounded transition-all cursor-pointer"
        title="Dismiss warning"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
