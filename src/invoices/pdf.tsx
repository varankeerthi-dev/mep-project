import { pdf } from '@react-pdf/renderer';
import { supabase } from '../supabase';
import { ensurePdfFontsRegistered } from '../pdf/registerFonts';
import { getPrintConfig } from '../pdf/print-config';
import {
  getInvoiceById,
  loadInvoiceSource,
  type InvoiceTemplateRecord,
  type InvoiceWithRelations,
} from './api';
import { InvoicePdfDocument } from './pdf-document';
import { ProGridInvoiceDocument } from './pro-grid-invoice-document';
import { GridMinimalInvoiceDocument } from './grid-minimal-invoice-document';
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

type DocumentTemplateRecord = {
  id: string;
  template_name: string;
  column_settings: Record<string, unknown>;
};

async function getDefaultDocumentTemplate(documentType: string, organisationId?: string): Promise<DocumentTemplateRecord | null> {
  let query = supabase
    .from('document_templates')
    .select('id, template_name, column_settings')
    .eq('document_type', documentType)
    .eq('is_default', true);

  if (organisationId) {
    query = query.eq('organisation_id', organisationId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) return null;
  if (!data) return null;

  return {
    id: String((data as any).id),
    template_name: String((data as any).template_name ?? ''),
    column_settings:
      (data as any).column_settings && typeof (data as any).column_settings === 'object'
        ? ((data as any).column_settings as Record<string, unknown>)
        : {},
  };
}

function resolveInvoicePdfElement(data: InvoicePdfData, invoiceTemplateConfig: DocumentTemplateRecord | null) {
  const printConfig = getPrintConfig(invoiceTemplateConfig?.column_settings);
  const title =
    printConfig.style === 'grid_minimal' && printConfig.gridMinimal?.titleOverride
      ? printConfig.gridMinimal.titleOverride
      : 'TAX INVOICE';

  const headerLabelsRaw = (invoiceTemplateConfig?.column_settings as any)?.header_labels;
  const headerLabels: Record<string, string> =
    headerLabelsRaw && typeof headerLabelsRaw === 'object' && !Array.isArray(headerLabelsRaw)
      ? (headerLabelsRaw as Record<string, string>)
      : {};

  if (printConfig.style === 'grid_minimal') {
    return (
      <GridMinimalInvoiceDocument
        data={data}
        title={title}
        columns={printConfig.gridMinimal?.columns}
        headerLabels={headerLabels}
      />
    );
  }

  return <InvoicePdfDocument data={data} />;
}

async function resolveInvoice(invoice: InvoiceLike, organisationId?: string): Promise<InvoiceWithRelations> {
  if (typeof invoice === 'string') {
    return getInvoiceById(invoice, organisationId);
  }
  return invoice;
}

async function getInvoiceTemplateById(id?: string | null, organisationId?: string): Promise<InvoiceTemplateRecord | null> {
  if (!id) return null;

  let query = supabase
    .from('invoice_templates')
    .select('id, name, layout_json, created_at')
    .eq('id', id);

  if (organisationId) {
    query = query.eq('organisation_id', organisationId);
  }

  const { data, error } = await query.maybeSingle();

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
  if (!organisationId) return null;

  const { data, error } = await supabase
    .from('organisations')
    .select('id, name, logo_url, address, phone, email, gstin, pan, tan, msme_no, website, state, bank_details')
    .eq('id', organisationId)
    .maybeSingle();
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
    bank_details:
      data.bank_details && typeof data.bank_details === 'object'
        ? (data.bank_details as any)
        : null,
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
  const orgId = options.organisationId;
  const invoice = await resolveInvoice(invoiceInput, orgId);
  const finalOrgId = orgId || invoice.organisation_id;

  const [template, source, company, materials] = await Promise.all([
    options.template !== undefined ? Promise.resolve(options.template) : getInvoiceTemplateById(invoice.template_id, finalOrgId),
    options.source !== undefined
      ? Promise.resolve(options.source)
      : loadInvoiceSource(invoice.source_type, invoice.source_id, finalOrgId).catch(() => null as InvoiceSourceDocument | null),
    options.company !== undefined ? Promise.resolve(options.company) : getInvoiceCompany(finalOrgId),
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
  const orgId = options.organisationId || data.invoice.organisation_id;
  const invoiceTemplateConfig = await getDefaultDocumentTemplate('Invoice', orgId);
  ensurePdfFontsRegistered();
  return pdf(resolveInvoicePdfElement(data, invoiceTemplateConfig)).toBlob();
}

export async function generateProGridInvoicePDF(
  invoiceInput: InvoiceLike,
  options: InvoicePdfOptions = {},
): Promise<Blob> {
  const invoice = await resolveInvoice(invoiceInput, options.organisationId);
  const finalOrgId = options.organisationId || invoice.organisation_id;
  const organisation = options.company ?? await getInvoiceCompany(finalOrgId);
  
  if (!organisation) {
    throw new Error('Organisation not found');
  }

  const client = invoice.client ? {
    client_name: invoice.client.name || 'Client',
    gstin: invoice.client.gst_number || undefined,
    state: invoice.client.state || undefined,
  } : {
    client_name: 'Client',
  };

  return pdf(<ProGridInvoiceDocument
    invoice={invoice as any}
    organisation={organisation as any}
    client={client as any}
  />).toBlob();
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
  const orgId = options.organisationId || data.invoice.organisation_id;
  const invoiceTemplateConfig = await getDefaultDocumentTemplate('Invoice', orgId);
  ensurePdfFontsRegistered();
  const blob = await pdf(resolveInvoicePdfElement(data, invoiceTemplateConfig)).toBlob();

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

export async function getInvoicePdfBlobUrl(
  invoiceInput: InvoiceLike,
  options: InvoicePdfOptions = {},
): Promise<string> {
  const { blob } = await renderInvoicePdfBlob(invoiceInput, options);
  return URL.createObjectURL(blob);
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
