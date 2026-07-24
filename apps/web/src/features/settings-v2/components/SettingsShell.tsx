import { LogOutIcon, Settings } from 'lucide-react';

interface SettingsShellProps {
  organisationName?: string;
  userEmail?: string;
  onLogout?: () => void;
  children: React.ReactNode;
}

export function SettingsShell({
  organisationName,
  userEmail,
  onLogout,
  children,
}: SettingsShellProps) {
  const avatarLetter = (userEmail || '?').charAt(0).toUpperCase();

  return (
    <div
      className="flex flex-col h-full bg-[#fafafa] font-['Inter',system-ui,sans-serif]"
      data-slot="settings-shell"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 bg-white border-b border-[#e5e5e5] shrink-0">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-zinc-700" />
          <div>
            <h1 className="m-0 text-xl font-semibold text-[#171717]">
              {organisationName || 'Settings'}
            </h1>
            <p className="m-0 mt-0.5 text-[13px] text-[#525252]">
              Manage workspace preferences and team access.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div
            className="flex items-center justify-center w-9 h-9 text-sm font-semibold text-white rounded-full bg-[#1a1a1a]"
            title={userEmail || ''}
          >
            {avatarLetter}
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#525252] bg-transparent border-none rounded cursor-pointer hover:bg-[#f5f5f5] transition-colors"
            >
              <LogOutIcon size={16} />
              Sign out
            </button>
          )}
        </div>
      </div>

      {/* Body: Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
