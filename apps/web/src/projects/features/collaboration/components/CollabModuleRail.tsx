// CollabModuleRail.tsx — primary module bar of the collaboration workspace.
// A horizontal sticky strip across the top of the workspace: the app shell
// already carries the organisation identity in its own sticky header, so this
// bar only navigates. Every item maps to a real app route.
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  CheckSquare,
  Folder,
  MessageSquare,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';

interface RailItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Routes that should light this item up as active. */
  match: string[];
  to: string;
}

const ITEMS: RailItem[] = [
  { id: 'activity', label: 'Activity', icon: Activity, match: ['/dashboard'], to: '/dashboard' },
  // The ?tab= param is what actually selects the Collaboration sub-tab: the
  // Projects shell mounts on the list tab otherwise.
  {
    id: 'channels',
    label: 'Channels',
    icon: MessageSquare,
    match: ['/collaboration'],
    to: '/collaboration?tab=collaboration',
  },
  { id: 'projects', label: 'Projects', icon: Folder, match: ['/projects'], to: '/projects' },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, match: ['/tasks', '/todo'], to: '/tasks' },
  { id: 'reminders', label: 'Reminders', icon: Bell, match: ['/remindme'], to: '/remindme' },
];

export function CollabModuleRail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You';
  const avatarUrl: string | null = user?.user_metadata?.avatar_url ?? null;
  const initials = displayName
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const isActive = (item: RailItem) =>
    item.match.some((m) => location.pathname === m || location.pathname.startsWith(`${m}/`));

  return (
    <nav
      className="sticky top-0 z-30 shrink-0 h-11 w-full bg-collab-rail border-b border-collab-line flex items-center justify-between px-2 select-none"
      data-testid="collab-module-rail"
      aria-label="Collaboration modules"
    >
      <div className="flex items-center gap-0.5 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ITEMS.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.to)}
              className={`relative h-9 px-2.5 lg:px-3 rounded-md flex items-center gap-1.5 shrink-0 transition ${
                active
                  ? 'bg-collab-hover text-blue-300'
                  : 'text-slate-400 hover:text-white hover:bg-collab-hover'
              }`}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              data-testid={`collab-rail-${item.id}`}
              data-active={active ? 'true' : 'false'}
            >
              <Icon className={`h-3.5 w-3.5 ${active ? 'text-blue-400' : ''}`} />
              {/* Labels collapse to icons on narrow screens so every module stays
                  reachable instead of scrolling out of the bar. */}
              <span className={`hidden lg:inline text-[11px] ${active ? 'font-semibold' : ''}`}>
                {item.label}
              </span>
              {active && (
                <span
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 rounded-t"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1 shrink-0 pl-2">
        <button
          type="button"
          onClick={() => navigate('/settings-v2')}
          className="w-8 h-8 rounded-md text-slate-400 hover:text-white hover:bg-collab-hover flex items-center justify-center transition"
          title="Settings"
          aria-label="Settings"
          data-testid="collab-rail-settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => navigate('/settings-v2')}
          className="relative cursor-pointer shrink-0"
          title={displayName}
          aria-label={`${displayName} — profile settings`}
          data-testid="collab-rail-profile"
        >
          <span className="w-7 h-7 rounded-full overflow-hidden border border-blue-500 flex items-center justify-center bg-slate-800 text-[10px] font-semibold text-slate-200">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              initials || '·'
            )}
          </span>
          <span
            className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-400 border border-collab-rail rounded-full"
            aria-hidden="true"
          />
        </button>
      </div>
    </nav>
  );
}

export default CollabModuleRail;
