import { supabase } from '../supabase';

export type WorkCompletionRpcInput = {
  organisationId: string;
  clientId: string;
  projectId?: string | null;
  poId?: string | null;
  invoiceId?: string | null;
  certificateDate: string;
  completionDate: string;
  workName: string;
  poNumber?: string | null;
  invoiceNumber?: string | null;
  bodyIntro?: string | null;
  clauses: string[];
  notes?: string | null;
  outputFormat: 'letterhead' | 'simple_a4';
  showLogo: boolean;
  footerText?: string | null;
  leftSignatureLabel?: string | null;
  rightSignatureLabel?: string | null;
};

function toRpcInput(input: WorkCompletionRpcInput) {
  return {
    p_organisation_id: input.organisationId,
    p_client_id: input.clientId,
    p_project_id: input.projectId || null,
    p_po_id: input.poId || null,
    p_invoice_id: input.invoiceId || null,
    p_certificate_date: input.certificateDate,
    p_completion_date: input.completionDate,
    p_work_name: input.workName,
    p_po_number: input.poNumber || null,
    p_invoice_number: input.invoiceNumber || null,
    p_body_intro: input.bodyIntro || null,
    p_clauses: input.clauses,
    p_notes: input.notes || null,
    p_output_format: input.outputFormat,
    p_show_logo: input.showLogo,
    p_footer_text: input.footerText || null,
    p_left_signature_label: input.leftSignatureLabel || null,
    p_right_signature_label: input.rightSignatureLabel || null,
  };
}

export async function createWorkCompletionCertificate(input: WorkCompletionRpcInput) {
  const { data, error } = await supabase.rpc('create_work_completion_certificate', toRpcInput(input));
  if (error) throw error;
  return data as { certificate_id: string; certificate_no: string; status: string };
}

export async function updateWorkCompletionCertificate(certificateId: string, input: WorkCompletionRpcInput) {
  const updateArgs = toRpcInput(input) as Record<string, unknown>;
  delete updateArgs.p_organisation_id;
  const { data, error } = await supabase.rpc('update_work_completion_certificate', {
    p_certificate_id: certificateId,
    ...updateArgs,
  });
  if (error) throw error;
  return data as { certificate_id: string; certificate_no: string; status: string };
}
