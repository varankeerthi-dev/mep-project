import { useState } from 'react';
import { supabase } from '../../../supabase';
import { usePartners } from '../hooks/usePartners';
import { X, Phone, CheckCircle, Loader2 } from 'lucide-react';

type DealerAvailabilityDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  issueId: string;
  issueTitle: string;
  organisationId: string;
  onAssignToPartner: (partnerId: string, partnerName: string, contactPerson: string) => void;
};

export default function DealerAvailabilityDrawer({ isOpen, onClose, issueId, issueTitle, organisationId, onAssignToPartner }: DealerAvailabilityDrawerProps) {
  const [search, setSearch] = useState('');
  const [callingPartner, setCallingPartner] = useState<string | null>(null);
  const [confirmedPartners, setConfirmedPartners] = useState<Record<string, { confirmed: boolean; contact: string }>>({});
  const [callLog, setCallLog] = useState<Record<string, string>>({});

  const { data: partners, isLoading } = usePartners({
    organisation_id: organisationId,
    is_active: true,
  });

  const filteredPartners = (partners || []).filter((p: any) =>
    !search || p.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
    p.categories?.some((c: string) => c.toLowerCase().includes(search.toLowerCase())) ||
    p.service_areas?.some((a: string) => a.toLowerCase().includes(search.toLowerCase()))
  );

  const handleCall = async (partner: any) => {
    setCallingPartner(partner.id);
    await new Promise(r => setTimeout(r, 800));
    setCallLog(prev => ({ ...prev, [partner.id]: new Date().toISOString() }));
    setCallingPartner(null);
  };

  const handleConfirm = (partnerId: string, contactName: string) => {
    setConfirmedPartners(prev => ({
      ...prev,
      [partnerId]: { confirmed: true, contact: contactName || 'Unknown' }
    }));
  };

  const handleAssign = (partner: any) => {
    const contactInfo = confirmedPartners[partner.id]?.contact || partner.contact_person || partner.business_name;
    onAssignToPartner(partner.id, partner.business_name, contactInfo);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-xl h-full overflow-auto">
        <div className="sticky top-0 bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between z-10">
          <div>
            <h2 className="text-sm font-semibold text-zinc-800">Dealer Availability</h2>
            <p className="text-xs text-zinc-500 truncate max-w-[280px]">{issueTitle}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded" type="button">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="p-3 border-b border-zinc-100">
          <input
            type="text" placeholder="Search dealers by name, area, category..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="p-3 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading dealers...
            </div>
          ) : filteredPartners.length === 0 ? (
            <div className="text-center py-8 text-sm text-zinc-400">No dealers found</div>
          ) : (
            filteredPartners.map((partner: any) => {
              const called = !!callLog[partner.id];
              const confirmed = confirmedPartners[partner.id]?.confirmed;
              return (
                <div key={partner.id} className={`rounded-xl border p-3 transition ${confirmed ? 'border-green-300 bg-green-50' : called ? 'border-blue-200 bg-blue-50' : 'border-zinc-200 bg-white'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-sm text-zinc-800">{partner.business_name}</h3>
                      {partner.contact_person && (
                        <p className="text-xs text-zinc-500">{partner.contact_person}</p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${partner.is_active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {partner.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-zinc-500 mb-2">
                    {partner.phone && <span>{partner.phone}</span>}
                    {partner.max_active_jobs > 0 && (
                      <span>Max jobs: {partner.max_active_jobs}</span>
                    )}
                  </div>

                  {partner.categories?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {partner.categories.slice(0, 3).map((cat: string) => (
                        <span key={cat} className="px-1.5 py-0.5 bg-zinc-100 text-zinc-600 rounded text-[10px]">{cat}</span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {!called ? (
                      <button onClick={() => handleCall(partner)}
                        disabled={callingPartner === partner.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        type="button">
                        {callingPartner === partner.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Phone className="h-3 w-3" />}
                        Call
                      </button>
                    ) : !confirmed ? (
                      <>
                        <span className="text-xs text-blue-600 font-medium">✓ Called</span>
                        <input
                          type="text" placeholder="Who confirmed?" value={callLog[partner.id] || ''}
                          onChange={e => setCallLog(prev => ({ ...prev, [partner.id]: e.target.value }))}
                          className="flex-1 px-2 py-1 border border-zinc-200 rounded text-xs focus:ring-1 focus:ring-blue-500 min-w-0"
                        />
                        <button onClick={() => handleConfirm(partner.id, callLog[partner.id] || partner.contact_person || '')}
                          disabled={!callLog[partner.id] && !partner.contact_person}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                          type="button">
                          <CheckCircle className="h-3 w-3" />
                          Confirm
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 w-full">
                        <span className="text-xs text-green-700 font-medium">
                          ✓ Confirmed — {confirmedPartners[partner.id]?.contact}
                        </span>
                        <button onClick={() => handleAssign(partner)}
                          className="ml-auto px-3 py-1.5 bg-zinc-800 text-white text-xs font-medium rounded-lg hover:bg-zinc-700"
                          type="button">
                          Assign to {partner.business_name}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
