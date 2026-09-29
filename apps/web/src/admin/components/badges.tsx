import { cn } from '@/lib/utils';

const STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  trial: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  suspended: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  banned: 'bg-red-600 text-white',
  churned: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
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
