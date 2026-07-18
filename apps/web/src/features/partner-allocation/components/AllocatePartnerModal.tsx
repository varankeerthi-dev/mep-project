import { useState } from 'react';
import { usePartners } from '../hooks/usePartners';
import { useCreateAllocation, useAllocationsByLead } from '../hooks/useAllocations';
import { useAuth } from '../../../App';
import { X } from 'lucide-react';

type PartnerSelectorProps = {
  leadId: string;
  onClose: () => void;
  onSuccess: () => void;
};

export default function AllocatePartnerModal({ leadId, onClose, onSuccess }: PartnerSelectorProps) {
  const { organisation } = useAuth();
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [dispatcherNotes, setDispatcherNotes] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');

  const { data: partners } = usePartners({
    organisation_id: organisation?.id || '',
    is_active: true,
  });
  const createAllocation = useCreateAllocation();
  const { data: existingAllocations } = useAllocationsByLead(leadId);

  const hasActiveAllocation = (existingAllocations || []).some(
    (a: any) => a.status !== 'Rejected' && a.status !== 'Verified' && a.status !== 'Reassigned'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartnerId || !organisation?.id) return;

    try {
      await createAllocation.mutateAsync({
        organisation_id: organisation.id,
        lead_id: leadId,
        partner_id: selectedPartnerId,
        dispatcher_notes: dispatcherNotes || null,
        estimated_value: parseFloat(estimatedValue) || 0,
        status: 'Pending',
      } as any);
      onSuccess();
    } catch (err) {
      console.error('Failed to create allocation:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <h2 className="text-lg font-semibold text-zinc-800">Allocate to Partner</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded" type="button">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        {hasActiveAllocation ? (
          <div className="p-6 text-sm text-zinc-600">
            This lead already has an active allocation. Please wait for it to be completed or verified before reallocating.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Select Partner *</label>
              <select value={selectedPartnerId} onChange={e => setSelectedPartnerId(e.target.value)} required
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                <option value="">Choose a partner...</option>
                {partners?.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.business_name} {p.contact_person ? `(${p.contact_person})` : ''}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Estimated Value (₹)</label>
              <input type="number" value={estimatedValue} onChange={e => setEstimatedValue(e.target.value)} min={0}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Dispatcher Notes</label>
              <textarea value={dispatcherNotes} onChange={e => setDispatcherNotes(e.target.value)} rows={3}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>

            <button type="submit" disabled={createAllocation.isPending}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
              {createAllocation.isPending ? 'Allocating...' : 'Allocate'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
