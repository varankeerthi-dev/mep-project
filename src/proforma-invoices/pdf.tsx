import { pdf } from '@react-pdf/renderer';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { supabase } from '../supabase';
import { ensurePdfFontsRegistered } from '../pdf/registerFonts';
import { getProformaById, type ProformaWithRelations } from './api';
import { ProformaPdfDocument } from './pdf-document';
import { generateProGridProformaPdf } from '../pdf/proGridProformaPdf';
import VerticalTemplate from '../templates/VerticalTemplate';
import { htmlToPdf } from '../utils/htmlTemplateRenderer';
import type {
  ProformaPdfCompany,
  ProformaPdfData,
  ProformaPdfOptions,
} from './pdf-types';

type ProformaLike = ProformaWithRelations | string;

async function getOrganisationDetails(organisationId: string): Promise<ProformaPdfCompany | null> {
  const { data, error } = await supabase
    .from('organisations')
    .select('id, name, logo_url, address, phone, email, gstin, pan, tan, msme_no, website, state, bank_details, signatures')
    .eq('id', organisationId)
    .single();

  if (error) {
    console.error('Error fetching organisation details:', error);
    return null;
  }

  return {
    id: String(data.id),
    name: data.name ?? 'Organisation',
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
    bank_details: data.bank_details ?? null,
    signatures: data.signatures ?? null,
  };
}

async function getProformaTemplateById(templateId: string | null, organisationId: string) {
  if (!templateId) return null;
  const { data, error } = await supabase
    .from('document_templates')
    .select('*')
    .eq('id', templateId)
    .eq('organisation_id', organisationId)
    .single();
  if (error) {
    console.error('Error fetching proforma template:', error);
    return null;
  }
  return data;
}

async function resolveProforma(proforma: ProformaLike, organisationId?: string): Promise<ProformaWithRelations> {
  if (typeof proforma === 'string') {
    return getProformaById(proforma, organisationId);
  }
  return proforma;
}

async function buildProformaPdfData(
  proforma: ProformaWithRelations,
  options: ProformaPdfOptions = {},
): Promise<ProformaPdfData> {
  const organisationId = options.organisationId;
  const company = options.company ?? (organisationId ? await getOrganisationDetails(organisationId) : null);
  const template = options.template ?? (organisationId && proforma.template_id ? await getProformaTemplateById(proforma.template_id, organisationId) : null);

  let authorizedSignatory = null;
  if (proforma.authorized_signatory_id && company?.signatures) {
    authorizedSignatory = company.signatures.find((s: any) => String(s.id) === String(proforma.authorized_signatory_id)) || null;
  }

  const proformaWithSignatory = {
    ...proforma,
    authorized_signatory: authorizedSignatory
  };

  return {
    proforma: proformaWithSignatory,
    company,
    template,
  };
}

export async function generateProformaPdf(
  proforma: ProformaLike,
  options: ProformaPdfOptions = {},
): Promise<Blob> {
  const resolvedProforma = await resolveProforma(proforma, options.organisationId);
  const template = options.template ?? (options.organisationId && resolvedProforma.template_id ? await getProformaTemplateById(resolvedProforma.template_id, options.organisationId) : null);
  const company = options.company ?? (options.organisationId ? await getOrganisationDetails(options.organisationId) : null);

  // Use Classic Proforma Template if selected
  if (template?.template_code === 'PI_CLASSIC') {
    let authorizedSignatory = null;
    if (resolvedProforma.authorized_signatory_id && company?.signatures) {
      authorizedSignatory = company.signatures.find((s: any) => String(s.id) === String(resolvedProforma.authorized_signatory_id)) || null;
    }
    const proformaWithSignatory = {
      ...resolvedProforma,
      authorized_signatory: authorizedSignatory
    };
    const doc = generateProGridProformaPdf(proformaWithSignatory as any, company as any, template);
    return doc.output('blob') as Blob;
  }

  // Use Vertical Template if selected
  if (template?.column_settings?.print?.style === 'vertical') {
    return await generateVerticalProformaPdf(resolvedProforma, template, company);
  }

  // Default to React-PDF document
  ensurePdfFontsRegistered();
  const data = await buildProformaPdfData(resolvedProforma, { ...options, template });
  const doc = <ProformaPdfDocument data={data} />;
  const pdfBlob = await pdf(doc).toBlob();

  return pdfBlob;
}

async function generateVerticalProformaPdf(
  proforma: ProformaWithRelations,
  template: any,
  company: ProformaPdfCompany | null
): Promise<Blob> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '210mm';
  container.style.background = 'white';
  document.body.appendChild(container);

  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap';
  document.head.appendChild(fontLink);

  const root = createRoot(container);
  try {
    const proformaData = buildProformaVerticalData(proforma);
    flushSync(() => {
      root.render(<VerticalTemplate data={proformaData} organisation={company} templateConfig={template.column_settings} />);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    return await htmlToPdf(container, `${proforma.pi_number || proforma.id}.pdf`);
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}

function buildProformaVerticalData(proforma: ProformaWithRelations) {
  const totalTax = (proforma.cgst || 0) + (proforma.sgst || 0) + (proforma.igst || 0);
  return {
    ...proforma,
    document_type: 'Proforma Invoice',
    items: (proforma.items || []).map((item: any, idx: number) => ({
      sno: idx + 1,
      item: item.item_name || item.description,
      description: item.description || '',
      qty: item.quantity || item.qty,
      uom: item.uom || 'Nos',
      rate: item.rate,
      discount_percent: item.discount_percent || 0,
      rate_after_discount: item.rate_after_discount || item.rate,
      base_amount: item.base_amount || (item.quantity || item.qty) * item.rate,
      tax_percent: item.tax_percent || (proforma as any).gst_rate || 18,
      tax_amount: item.tax_amount || 0,
      line_total: item.line_total || item.total,
      hsn_code: item.hsn_code || '',
      make: item.make || '',
      item_code: item.item_code || '',
    })),
    subtotal: proforma.subtotal,
    total_tax: totalTax,
    round_off: (proforma as any).round_off || 0,
    grand_total: proforma.total,
    client: proforma.client,
    billing_address: (proforma as any).billing_address || proforma.client?.billing_address || null,
    shipping_address: (proforma as any).shipping_address || proforma.client?.shipping_address || null,
    po_no: proforma.po_number,
    po_date: proforma.po_date,
    valid_till: proforma.valid_until,
    reference: (proforma as any).reference || null,
  };
}

export async function downloadProformaPdf(
  proforma: ProformaLike,
  options: ProformaPdfOptions = {},
): Promise<void> {
  const pdfBlob = await generateProformaPdf(proforma, options);
  const resolvedProforma = await resolveProforma(proforma, options.organisationId);
  const fileName = options.fileName || `Proforma-${resolvedProforma.pi_number || resolvedProforma.id}.pdf`;

  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function previewProformaPdf(
  proforma: ProformaLike,
  options: ProformaPdfOptions = {},
): Promise<ProformaPdfData> {
  const resolvedProforma = await resolveProforma(proforma, options.organisationId);
  return buildProformaPdfData(resolvedProforma, options);
}

export async function emailProformaInvoice(
  proformaId: string,
  organisationId: string,
  clientEmail: string,
  subject?: string,
  message?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const proforma = await getProformaById(proformaId, organisationId);
    const pdfBlob = await generateProformaPdf(proforma, { organisationId });
    
    // Convert blob to base64 for email attachment
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(pdfBlob);
    });
    const base64Pdf = await base64Promise;

    const emailSubject = subject || `Proforma Invoice ${proforma.pi_number || proforma.id}`;
    const emailBody = message || `Please find attached the proforma invoice for your review.`;

    // Using mailto as fallback - in production, this should use a proper email service
    const mailtoLink = `mailto:${clientEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    
    // Open email client
    window.open(mailtoLink, '_blank');

    return { success: true };
  } catch (error) {
    console.error('Error emailing proforma invoice:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
