import { pdf } from '@react-pdf/renderer';
import { supabase } from '../supabase';
import { ensurePdfFontsRegistered } from '../pdf/registerFonts';
import { getProformaById, type ProformaWithRelations } from './api';
import { ProformaPdfDocument } from './pdf-document';
import type {
  ProformaPdfCompany,
  ProformaPdfData,
  ProformaPdfOptions,
} from './pdf-types';

type ProformaLike = ProformaWithRelations | string;

async function getOrganisationDetails(organisationId: string): Promise<ProformaPdfCompany | null> {
  const { data, error } = await supabase
    .from('organisations')
    .select('id, name, logo_url, address, phone, email, gstin, pan, tan, msme_no, website, state, bank_details')
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

  return {
    proforma,
    company,
    template,
  };
}

export async function generateProformaPdf(
  proforma: ProformaLike,
  options: ProformaPdfOptions = {},
): Promise<Blob> {
  ensurePdfFontsRegistered();

  const resolvedProforma = await resolveProforma(proforma, options.organisationId);
  const data = await buildProformaPdfData(resolvedProforma, options);

  const doc = <ProformaPdfDocument data={data} />;
  const pdfBlob = await pdf(doc).toBlob();

  return pdfBlob;
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
