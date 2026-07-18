import type { AllocationStatus } from '../model';

const STATUS_CONFIG: Record<AllocationStatus, { label: string; color: string }> = {
  'Pending': { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  'Accepted': { label: 'Accepted', color: 'bg-blue-100 text-blue-700' },
  'Rejected': { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  'In Progress': { label: 'In Progress', color: 'bg-indigo-100 text-indigo-700' },
  'Completed': { label: 'Completed', color: 'bg-green-100 text-green-700' },
  'Verified': { label: 'Verified', color: 'bg-emerald-100 text-emerald-700' },
  'Reassigned': { label: 'Reassigned', color: 'bg-zinc-100 text-zinc-600' },
};

export default function AllocationStatusBadge({ status }: { status: AllocationStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['Pending'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}
