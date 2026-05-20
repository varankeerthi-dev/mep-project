import type { InvoiceFollowUp, PodcBacklogItem, QuotationFollowUp } from '../../types/followup';
import { formatFollowUpCurrency } from './currency-format';

function normalizePhone(phone?: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

function buildWhatsAppUrl(phone: string | undefined, message: string): string {
  const encoded = encodeURIComponent(message);
  const digits = normalizePhone(phone);
  if (digits) {
    return `https://wa.me/${digits}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}

export function buildQuotationReminderMessage(quote: QuotationFollowUp): string {
  return [
    `Dear ${quote.client_name},`,
    '',
    `Gentle follow-up on quotation *${quote.quotation_no}* for *${quote.project_name}*.`,
    `Total value: *${formatFollowUpCurrency(quote.total_value)}*`,
    `Valid until: ${quote.valid_till}`,
    '',
    `Quote PDF: ${quote.pdf_url}`,
    '',
    'Please share your confirmation or feedback at the earliest.',
    'Thank you.',
  ].join('\n');
}

export function buildPodcPackMessage(item: PodcBacklogItem): string {
  const photoLinks = [
    ...item.delivery_photo_urls,
    ...item.completion_photo_urls,
  ].filter(Boolean);

  return [
    `Dear ${item.client_name},`,
    '',
    `Follow-up for official PO against *${item.dc_wo_number}* — *${item.project_name}*.`,
    `Estimated value: *${formatFollowUpCurrency(item.estimated_value)}*`,
    `Days pending PO: *${item.days_pending_po}*`,
    '',
    `Signed DC: ${item.signed_dc_url}`,
    photoLinks.length ? `Delivery / completion proof:\n${photoLinks.join('\n')}` : '',
    '',
    'Kindly issue the client PO to enable invoicing and payment realization.',
    'Site Engineer: ' + item.site_engineer,
    'Thank you.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildInvoiceReminderMessage(
  invoice: InvoiceFollowUp,
  actionHint: string
): string {
  return [
    `Dear ${invoice.client_name},`,
    '',
    `Payment follow-up — Invoice *${invoice.invoice_no}* (${invoice.project_name}).`,
    `Balance due: *${formatFollowUpCurrency(invoice.balance_due)}*`,
    `Due date: ${invoice.due_date}`,
    invoice.payment_link ? `Pay here: ${invoice.payment_link}` : '',
    '',
    actionHint,
    '',
    'Accounts Team',
  ]
    .filter(Boolean)
    .join('\n');
}

export function openQuotationReminderWhatsApp(quote: QuotationFollowUp): void {
  const url = buildWhatsAppUrl(quote.contact_phone, buildQuotationReminderMessage(quote));
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function openPodcPackWhatsApp(item: PodcBacklogItem): void {
  const url = buildWhatsAppUrl(item.contact_phone, buildPodcPackMessage(item));
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function openInvoiceReminderWhatsApp(invoice: InvoiceFollowUp, actionHint: string): void {
  const url = buildWhatsAppUrl(
    invoice.contact_phone,
    buildInvoiceReminderMessage(invoice, actionHint)
  );
  window.open(url, '_blank', 'noopener,noreferrer');
}
