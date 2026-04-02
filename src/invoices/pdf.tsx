import { pdf } from '@react-pdf/renderer';
import { supabase } from '../supabase';
import {
  getInvoiceById,
  loadInvoiceSource,
  type InvoiceTemplateRecord,
  type InvoiceWithRelations,
} from './api';
import { InvoicePdfDocument } from './pdf-document';
import type {
  InvoicePdfCompany,
  InvoicePdfData,
  InvoicePdfMaterialLine,
  InvoicePdfOptions,
} from './pdf-types';
import type { InvoiceSourceDocument } from './types';
import { getInvoiceDisplayNumber } from './ui-utils';

type InvoiceLike = InvoiceWithRelations | string;

type EmailInvoiceResult = 'shared' | 'mailto';

async function resolveInvoice(invoice: InvoiceLike): Promise<InvoiceWithRelations> {
  if (typeof invoice === 'string') {
    return getInvoiceById(invoice);
  }
  return invoice;
}

async function getInvoiceTemplateById(id?: string | null): Promise<InvoiceTemplateRecord | null> {
  if (!id) return null;

  const { data, error } = await supabase
    .from('invoice_templates')
    .select('id, name, layout_json, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: String(data.id),
    name: String(data.name),
    layout_json:
      data.layout_json && typeof data.layout_json === 'object'
        ? (data.layout_json as Record<string, unknown>)
        : {},
    created_at: data.created_at ?? undefined,
  };
}

async function getInvoiceCompany(organisationId?: string): Promise<InvoicePdfCompany | null> {
  let query = supabase
    .from('organisations')
    .select('id, name, logo_url, address, phone, email, gstin, pan, tan, msme_no, website, state')
    .order('created_at', { ascending: true })
    .limit(1);

  if (organisationId) {
    query = supabase
      .from('organisations')
      .select('id, name, logo_url, address, phone, email, gstin, pan, tan, msme_no, website, state')
      .eq('id', organisationId)
      .limit(1);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    id: String(data.id),
    name: String(data.name ?? 'Organisation'),
    logo_url: data.logo_url ?? null,
    address: data.address ?? null,
    phone: data.phone ?? null,
    email: data.email ?? null,
    gstin: data.gstin ?? null,
    pan: data.pan ?? null,
    tan: data.tan ?? null,
    msme_no: data.msme_no ?? null,
    website: data.website ?? null,
    state: data.state ?? null,
  };
}

async function getMaterialLines(invoice: InvoiceWithRelations): Promise<InvoicePdfMaterialLine[]> {
  if (invoice.materials.length === 0) return [];

  const ids = Array.from(new Set(invoice.materials.map((item) => item.product_id).filter(Boolean)));
  const { data, error } = await supabase
    .from('materials')
    .select('id, display_name, name')
    .in('id', ids);

  if (error) throw error;

  const nameMap = new Map<string, string>();
  (data ?? []).forEach((item: any) => {
    nameMap.set(String(item.id), String(item.display_name ?? item.name ?? item.id));
  });

  return invoice.materials.map((material) => ({
    product_id: material.product_id,
    product_name: nameMap.get(material.product_id) ?? material.product_id,
    qty_used: material.qty_used,
  }));
}

export async function resolveInvoicePdfData(
  invoiceInput: InvoiceLike,
  options: InvoicePdfOptions = {},
): Promise<InvoicePdfData> {
  const invoice = await resolveInvoice(invoiceInput);
  const [template, source, company, materials] = await Promise.all([
    options.template !== undefined ? Promise.resolve(options.template) : getInvoiceTemplateById(invoice.template_id),
    options.source !== undefined
      ? Promise.resolve(options.source)
      : loadInvoiceSource(invoice.source_type, invoice.source_id).catch(() => null as InvoiceSourceDocument | null),
    options.company !== undefined ? Promise.resolve(options.company) : getInvoiceCompany(options.organisationId),
    getMaterialLines(invoice),
  ]);

  return {
    invoice,
    template,
    source,
    company,
    materials,
  };
}

export async function generateInvoicePDF(
  invoiceInput: InvoiceLike,
  options: InvoicePdfOptions = {},
): Promise<Blob> {
  const data = await resolveInvoicePdfData(invoiceInput, options);
  return pdf(<InvoicePdfDocument data={data} />).toBlob();
}

function getDownloadFilename(invoice: InvoiceWithRelations, fileName?: string): string {
  if (fileName && fileName.trim()) {
    return fileName.trim().toLowerCase().endsWith('.pdf') ? fileName.trim() : `${fileName.trim()}.pdf`;
  }
  return `${getInvoiceDisplayNumber(invoice)}.pdf`;
}

async function renderInvoicePdfBlob(
  invoiceInput: InvoiceLike,
  options: InvoicePdfOptions = {},
): Promise<{
  blob: Blob;
  data: InvoicePdfData;
  fileName: string;
}> {
  const data = await resolveInvoicePdfData(invoiceInput, options);
  const blob = await pdf(<InvoicePdfDocument data={data} />).toBlob();

  return {
    blob,
    data,
    fileName: getDownloadFilename(data.invoice, options.fileName),
  };
}

export async function downloadInvoicePDF(
  invoiceInput: InvoiceLike,
  options: InvoicePdfOptions = {},
): Promise<Blob> {
  const { blob, fileName } = await renderInvoicePdfBlob(invoiceInput, options);

  if (typeof window !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return blob;
}

export async function previewInvoicePDF(
  invoiceInput: InvoiceLike,
  options: InvoicePdfOptions = {},
): Promise<string> {
  const { blob } = await renderInvoicePdfBlob(invoiceInput, options);
  const url = URL.createObjectURL(blob);

  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return url;
}

export async function printInvoicePDF(
  invoiceInput: InvoiceLike,
  options: InvoicePdfOptions = {},
): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const { blob, fileName } = await renderInvoicePdfBlob(invoiceInput, options);
  const url = URL.createObjectURL(blob);
  const frame = document.createElement('iframe');

  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.setAttribute('title', fileName);
  frame.src = url;

  document.body.appendChild(frame);

  await new Promise<void>((resolve, reject) => {
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    frame.onerror = () => reject(new Error('Unable to load invoice PDF for printing.'));
  });

  setTimeout(() => {
    frame.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

function buildInvoiceEmailBody(data: InvoicePdfData): string {
  const sourceLabel =
    data.source?.type === 'quotation'
      ? data.source.header.reference
      : data.source?.type === 'challan'
        ? data.source.header.challan_number ?? data.source.header.po_no
        : data.source?.header.po_number;

  const lines = [
    `Please find attached invoice ${getInvoiceDisplayNumber(data.invoice)}.`,
    data.invoice.client?.name ? `Client: ${data.invoice.client.name}` : null,
    sourceLabel ? `Reference: ${sourceLabel}` : null,
    `Total: ${data.invoice.total.toFixed(2)}`,
  ].filter(Boolean);

  return lines.join('\n');
}

export async function emailInvoicePDF(
  invoiceInput: InvoiceLike,
  options: InvoicePdfOptions = {},
): Promise<EmailInvoiceResult> {
  const { blob, data, fileName } = await renderInvoicePdfBlob(invoiceInput, options);

  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'mailto';
  }

  const file = new File([blob], fileName, { type: 'application/pdf' });
  const subject = `Invoice ${getInvoiceDisplayNumber(data.invoice)}`;
  const text = buildInvoiceEmailBody(data);

  if (
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    await navigator.share({
      title: subject,
      text,
      files: [file],
    });
    return 'shared';
  }

  const mailto = new URL('mailto:');
  mailto.searchParams.set('subject', subject);
  mailto.searchParams.set('body', text);
  window.location.href = mailto.toString();
  return 'mailto';
}
