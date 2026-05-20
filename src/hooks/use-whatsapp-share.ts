import { useCallback } from 'react';
import type { InvoiceFollowUp, PodcBacklogItem, QuotationFollowUp } from '../types/followup';
import { getEscalationMeta } from '../lib/followup/escalation-engine';
import {
  openInvoiceReminderWhatsApp,
  openPodcPackWhatsApp,
  openQuotationReminderWhatsApp,
} from '../lib/followup/whatsapp-builder';

export function useWhatsappShare() {
  const sendQuotationReminder = useCallback((quote: QuotationFollowUp) => {
    openQuotationReminderWhatsApp(quote);
  }, []);

  const sharePodcPack = useCallback((item: PodcBacklogItem) => {
    openPodcPackWhatsApp(item);
  }, []);

  const sendInvoiceReminder = useCallback((invoice: InvoiceFollowUp) => {
    const meta = getEscalationMeta(invoice.days_overdue);
    openInvoiceReminderWhatsApp(invoice, meta.recommendedAction);
  }, []);

  return { sendQuotationReminder, sharePodcPack, sendInvoiceReminder };
}
