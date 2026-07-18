import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../../App';
import { useAllocations, useUpdateAllocationStatus } from '../../hooks/useAllocations';
import type { AllocationFilterParams } from '../../api/allocations';
import AllocationStatusBadge from '../../components/AllocationStatusBadge';
import { CheckCircle, XCircle, Play, CheckCircle2, MessageSquare } from 'lucide-react';

const PARTNER_ACTIONS: Record<string, { label: string; nextStatus: string; icon: any; color: string }[]> = {
  'Pending': [
    { label: 'Accept Job', nextStatus: 'Accepted', icon: CheckCircle, color: 'bg-green-600 hover:bg-green-700' },
    { label: 'Decline', nextStatus: 'Rejected', icon: XCircle, color: 'bg-red-600 hover:bg-red-700' },
  ],
  'Accepted': [
    { label: 'Start Work', nextStatus: 'In Progress', icon: Play, color: 'bg-blue-600 hover:bg-blue-700' },
  ],
  'In Progress': [
    { label: 'Mark Completed', nextStatus: 'Completed', icon: CheckCircle2, color: 'bg-green-600 hover:bg-green-700' },
  ],
  'Completed': [],
  'Verified': [],
  'Rejected': [],
  'Reassigned': [],
};

export default function PartnerInboxPage() {
  const { organisation } = useAuth();
  const [searchParams] = useSearchParams();
  const partnerId = searchParams.get('partner_id');
  const [partnerNote, setPartnerNote] = useState<Record<string, string>>({});

  const filters: AllocationFilterParams = {
    organisation_id: organisation?.id || '',
    partner_id: partnerId || undefined,
  };

  const { data: allocations, isLoading } = useAllocations(filters);
  const updateStatus = useUpdateAllocationStatus();

  const handleStatusUpdate = async (allocationId: string, status: string) => {
    try {
      await updateStatus.mutateAsync({
        allocationId,
        status,
        partner_notes: partnerNote[allocationId] || undefined,
      });
      setPartnerNote(prev => ({ ...prev, [allocationId]: '' }));
    } catch (err) {
      console.error('Failed to update allocation status:', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50">
      <div className="bg-white px-4 py-3 border-b border-zinc-200 sticky top-0 z-10">
        <h1 className="text-lg font-semibold text-zinc-800">Partner Inbox</h1>
        <p className="text-sm text-zinc-500">Jobs assigned to you</p>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3 max-w-2xl mx-auto w-full">
        {isLoading ? (
          <div className="text-center text-sm text-zinc-500 py-8">Loading...</div>
        ) : allocations?.length === 0 ? (
          <div className="text-center text-sm text-zinc-400 py-8">No jobs assigned yet</div>
        ) : (
          allocations?.map((allocation: any) => {
            const actions = PARTNER_ACTIONS[allocation.status] || [];
            return (
              <div key={allocation.id} className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-zinc-800">{allocation.lead?.contact_name || 'Unknown'}</h3>
                    <p className="text-sm text-zinc-500">{allocation.lead?.company_name || ''}</p>
                  </div>
                  <AllocationStatusBadge status={allocation.status} />
                </div>

                <div className="text-sm text-zinc-600 space-y-1 mb-3">
                  {allocation.lead?.city && (
                    <p><span className="text-zinc-400">Location:</span> {allocation.lead.city}</p>
                  )}
                  {allocation.lead?.project_name && (
                    <p><span className="text-zinc-400">Project:</span> {allocation.lead.project_name}</p>
                  )}
                  {allocation.lead?.requirement_summary && (
                    <p><span className="text-zinc-400">Scope:</span> {allocation.lead.requirement_summary}</p>
                  )}
                  {allocation.dispatcher_notes && (
                    <div className="mt-2 p-2 bg-blue-50 rounded-lg text-xs text-blue-700">
                      <span className="font-medium">Dispatcher note:</span> {allocation.dispatcher_notes}
                    </div>
                  )}
                </div>

                {allocation.status === 'Rejected' && allocation.partner_notes && (
                  <div className="mb-3 p-2 bg-red-50 rounded-lg text-xs text-red-700">
                    <span className="font-medium">Your note:</span> {allocation.partner_notes}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5 text-zinc-400" />
                    <input
                      type="text" placeholder="Add a note..." value={partnerNote[allocation.id] || ''}
                      onChange={e => setPartnerNote(prev => ({ ...prev, [allocation.id]: e.target.value }))}
                      className="flex-1 px-3 py-1.5 border border-zinc-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {actions.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {actions.map(action => (
                        <button
                          key={action.nextStatus}
                          onClick={() => handleStatusUpdate(allocation.id, action.nextStatus)}
                          disabled={updateStatus.isPending}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-medium rounded-lg disabled:opacity-50 ${action.color}`}
                          type="button"
                        >
                          <action.icon className="h-3.5 w-3.5" />
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
