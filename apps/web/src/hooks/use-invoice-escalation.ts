import { useMemo } from 'react';
import type { InvoiceFollowUp } from '../types/followup';
import {
  getEscalationMeta,
  getEscalationRowClass,
  getReminderStage,
  type EscalationStageMeta,
} from '../lib/followup/escalation-engine';

export function useInvoiceEscalation(invoice: InvoiceFollowUp | null) {
  return useMemo(() => {
    if (!invoice) {
      return {
        stage: 0 as const,
        meta: null as EscalationStageMeta | null,
        rowClass: '',
      };
    }
    const stage = getReminderStage(invoice.days_overdue);
    const meta = getEscalationMeta(invoice.days_overdue);
    return {
      stage,
      meta,
      rowClass: getEscalationRowClass(meta.severity),
    };
  }, [invoice]);
}
