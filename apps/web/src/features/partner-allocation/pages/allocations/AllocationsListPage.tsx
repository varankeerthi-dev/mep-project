import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../../App';
import { useAllocations, useAllocationsByLead } from '../../hooks/useAllocations';
import type { AllocationFilterParams } from '../../api/allocations';
import { allocationStatusEnum } from '../../model';
import AllocatePartnerModal from '../../components/AllocatePartnerModal';
import AllocationStatusBadge from '../../components/AllocationStatusBadge';
import { Plus } from 'lucide-react';

export default function AllocationsListPage() {
  const { organisation } = useAuth();
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('lead_id');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);

  const filters: AllocationFilterParams = useMemo(() => ({
    organisation_id: organisation?.id || '',
    status: statusFilter || undefined,
    lead_id: leadId || undefined,
  }), [organisation?.id, statusFilter, leadId]);

  const { data: allocations, isLoading } = useAllocations(filters);
  const { data: leadAllocations } = useAllocationsByLead(leadId || null);

  const displayAllocations = leadId ? leadAllocations : allocations;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">Lead Allocations</h1>
          {leadId && <p className="text-sm text-zinc-500 mt-1">Showing allocations for a specific lead</p>}
        </div>
        <button onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="h-4 w-4" />
          Allocate Partner
        </button>
      </div>

      {!leadId && (
        <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-100">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
            <option value="">All Statuses</option>
            {allocationStatusEnum.options.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-sm text-zinc-500">Loading...</div>
        ) : displayAllocations?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-sm text-zinc-400">
            No allocations found
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">
                <th className="px-6 py-3">Lead</th>
                <th className="px-6 py-3">Partner</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Assigned At</th>
                <th className="px-6 py-3">Est. Value</th>
              </tr>
            </thead>
            <tbody>
              {(displayAllocations || []).map((allocation: any) => (
                <tr key={allocation.id} className="border-b border-zinc-50 hover:bg-zinc-50 text-sm">
                  <td className="px-6 py-3">
                    <div className="font-medium text-zinc-800">{allocation.lead?.contact_name || 'Unknown'}</div>
                    <div className="text-xs text-zinc-400">{allocation.lead?.company_name || ''}</div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="text-zinc-800">{allocation.partner?.business_name || 'Unknown'}</div>
                    <div className="text-xs text-zinc-400">{allocation.partner?.contact_person || ''}</div>
                  </td>
                  <td className="px-6 py-3"><AllocationStatusBadge status={allocation.status} /></td>
                  <td className="px-6 py-3 text-zinc-600">{new Date(allocation.assigned_at || allocation.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-3 text-zinc-600">₹{(allocation.estimated_value || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <AllocatePartnerModal
          leadId={leadId || ''}
          onClose={() => setShowModal(false)}
          onSuccess={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
