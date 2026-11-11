import { useQuery } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { supabase } from '@/supabase';

interface ApprovalLockBannerProps {
  quotationId?: string | null;
  organisationId?: string | null;
}

interface OpenApproval {
  approval_id: string;
  level: number;
  max_levels: number;
  approver_name: string | null;
}

export function ApprovalLockBanner({ quotationId, organisationId }: ApprovalLockBannerProps) {
  const { data } = useQuery({
    queryKey: ['quotation-open-approval', quotationId, organisationId],
    enabled: Boolean(quotationId && organisationId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('quotation_open_approval', {
        p_quotation_id: quotationId,
        p_organisation_id: organisationId,
      });
      // An error here means the lock is not deployed, not that the document is frozen, so the
      // banner stays silent and the save path stays the authority.
      if (error) return null;
      return (data as OpenApproval | null) ?? null;
    },
  });

  if (!data) return null;

  return (
    <div className="bg-orange-50 border border-orange-200 text-orange-900 px-6 py-3 rounded-lg flex items-start gap-2 text-xs font-semibold mb-4">
      <Lock className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
      <span>
        <strong className="text-orange-900">Locked for approval:</strong> an approver has this
        quotation at level {data.level} of {data.max_levels}
        {data.approver_name ? ` (${data.approver_name})` : ''}. Edits will be rejected until it is
        approved, rejected, returned or put on hold.
      </span>
    </div>
  );
}
