import { useProjectClosureChecklist, useUpdateChecklistGate, type ClosureChecklist } from '../../hooks/useProjectClosureChecklist';

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: '#fef3c7', color: '#d97706', label: 'Pending' },
  passed: { bg: '#dcfce7', color: '#16a34a', label: 'Passed' },
  failed: { bg: '#fee2e2', color: '#dc2626', label: 'Failed' },
  skipped: { bg: '#f1f5f9', color: '#94a3b8', label: 'Skipped' },
};

interface Props {
  projectId: string;
}

export function ClosureChecklistPanel({ projectId }: Props) {
  const { data: checklist, isLoading } = useProjectClosureChecklist(projectId);
  const updateMutation = useUpdateChecklistGate();

  const handleStatusChange = (gateId: string, status: ClosureChecklist['status']) => {
    updateMutation.mutate({ project_id: projectId, gate_id: gateId, status });
  };

  if (isLoading) {
    return <div className="text-xs text-zinc-400 p-4">Loading closure checklist...</div>;
  }

  if (!checklist || checklist.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-zinc-400">No closure checklist configured.</p>
        <p className="text-[11px] text-zinc-300 mt-1">An admin needs to set up a closure template in Settings first.</p>
      </div>
    );
  }

  const allPassed = checklist.every((item) => item.status === 'passed' || item.status === 'skipped');
  const passedCount = checklist.filter((i) => i.status === 'passed' || i.status === 'skipped').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-zinc-700">Project Closure Checklist</h4>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${allPassed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {passedCount}/{checklist.length} passed
        </span>
      </div>
      <div className="space-y-2">
        {checklist.map((item) => {
          const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.pending;
          return (
            <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg border border-zinc-100 bg-white">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-zinc-700">{item.gate?.label ?? item.gate_id}</p>
                {item.gate?.description && (
                  <p className="text-[11px] text-zinc-400 truncate">{item.gate.description}</p>
                )}
              </div>
              <select
                value={item.status}
                onChange={(e) => handleStatusChange(item.gate_id, e.target.value as ClosureChecklist['status'])}
                className="text-xs px-2 py-1 border border-zinc-200 rounded bg-white cursor-pointer"
                style={{ color: badge.color }}
              >
                <option value="pending">Pending</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
                <option value="skipped">Skipped</option>
              </select>
              {item.verified_at && (
                <span className="text-[10px] text-zinc-300 shrink-0">
                  {new Date(item.verified_at).toLocaleDateString()}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {allPassed && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
          <span className="text-xs font-medium text-green-700">All closure gates passed. Project is ready to close.</span>
        </div>
      )}
    </div>
  );
}
