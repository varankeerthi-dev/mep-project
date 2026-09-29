import { cn } from '@/lib/utils';

const STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  trial: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  suspended: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  banned: 'bg-red-600 text-white',
  churned: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const USER_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  inactive: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  onboarding: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  left: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

export function OrgStatusBadge({ status }: { status: string }) {
  const key = (status || '').toLowerCase();
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        STYLES[key] || 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      )}
    >
      {status}
    </span>
  );
}

export function UserStatusBadge({ status }: { status: string }) {
  const key = (status || '').toLowerCase();
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        USER_STYLES[key] || 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      )}
    >
      {status}
    </span>
  );
}
