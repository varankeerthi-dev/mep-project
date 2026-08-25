import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, FileCheck2, Loader2, Plus, Printer, Save, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import { Button } from '../components/ui/button';
import { toast } from '../lib/logger';
import { createWorkCompletionCertificate, updateWorkCompletionCertificate } from '../work-completion/api';

type OutputFormat = 'letterhead' | 'simple_a4';

type Party = {
  id: string;
  name: string;
  gstin: string;
  state: string;
  address: string;
};

type WorkCompletionForm = {
  id: string;
  certificate_no: string;
  certificate_date: string;
  completion_date: string;
  client_id: string;
  project_id: string;
  po_id: string;
  invoice_id: string;
  work_name: string;
  po_number: string;
  invoice_number: string;
  client_address: string;
  client_gstin: string;
  client_state: string;
  body_intro: string;
  clauses: string[];
  notes: string;
  output_format: OutputFormat;
  show_logo: boolean;
  footer_text: string;
  left_signature_label: string;
  right_signature_label: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = (): WorkCompletionForm => ({
  id: '',
  certificate_no: `WCC-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
  certificate_date: today(),
  completion_date: today(),
  client_id: '',
  project_id: '',
  po_id: '',
  invoice_id: '',
  work_name: '',
  po_number: '',
  invoice_number: '',
  client_address: '',
  client_gstin: '',
  client_state: '',
  body_intro: 'This is to certify that the above-mentioned work has been completed at the customer premises as per the approved scope, purchase order, and agreed specifications.',
  clauses: [
    'The work has been carried out as per the sanctioned estimate, approved drawings, and agreed plan.',
    'The completed work has been inspected and found suitable for its intended use.',
    'All applicable testing and commissioning activities have been completed in the presence of the customer representatives.',
    'The applicable warranty and support obligations will be governed by the agreed commercial terms.',
  ],
  notes: 'We thank you for your cooperation and support during completion of the above-mentioned work.',
  output_format: 'letterhead',
  show_logo: true,
  footer_text: '',
  left_signature_label: 'For Customer',
  right_signature_label: 'For {{organisation_name}}',
});

function formatDate(value: string) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function normalizeParty(row: any): Party {
  return {
    id: String(row.id),
    name: String(row.client_name ?? row.name ?? row.company_name ?? 'Unnamed client'),
    gstin: String(row.gstin ?? row.gst_number ?? ''),
    state: String(row.state ?? ''),
    address: [row.address1, row.address2, row.address, row.city, row.state, row.pincode].filter(Boolean).join(', '),
  };
}

function PrintableCertificate({ form, party, organisation, logoUrl }: { form: WorkCompletionForm; party?: Party; organisation: any; logoUrl?: string }) {
  const organisationName = organisation?.name || 'Organisation';
  const signatureRight = form.right_signature_label.replace('{{organisation_name}}', organisationName);
  const showHeaderBranding = form.output_format === 'letterhead' || form.show_logo;
  const organisationAddress = [organisation?.address1, organisation?.address2, organisation?.address, organisation?.city, organisation?.state, organisation?.pincode].filter(Boolean).join(', ');

  return (
    <article id="work-completion-printable" className="work-completion-paper bg-white text-slate-900 shadow-xl ring-1 ring-slate-200">
      <header className={`border-b-2 border-slate-800 ${form.output_format === 'letterhead' ? 'pb-3' : 'pb-4'}`}>
        {showHeaderBranding && (
          <div className="flex items-start gap-3">
            {logoUrl ? <img src={logoUrl} alt="Organisation logo" className="h-14 w-14 object-contain" /> : <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-cyan-500 text-xs font-bold text-cyan-600">LOGO</div>}
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-extrabold uppercase tracking-tight text-cyan-500">{organisationName}</h1>
              {organisation?.tagline && <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-700">{organisation.tagline}</p>}
              {organisationAddress && <p className="mt-1 text-[9px] leading-4 text-slate-600">{organisationAddress}</p>}
              {(organisation?.gstin || organisation?.phone || organisation?.email) && <p className="text-[9px] text-slate-700">{organisation?.gstin ? `GSTIN: ${organisation.gstin}` : ''}{organisation?.phone ? ` | ${organisation.phone}` : ''}{organisation?.email ? ` | ${organisation.email}` : ''}</p>}
            </div>
          </div>
        )}
        <div className="mt-2 flex justify-end text-[10px] font-semibold">DATE: {formatDate(form.certificate_date)}</div>
      </header>

      <main className="py-5 text-[11px] leading-5">
        <h2 className="mb-5 text-center text-sm font-extrabold uppercase underline underline-offset-4">Work Completion Certificate</h2>
        <dl className="grid grid-cols-[175px_16px_1fr] gap-y-2">
          <dt>Name of the Customer</dt><dd>:</dd><dd className="font-semibold">{party?.name || 'Select client'}</dd>
          <dt>Address of the Customer</dt><dd>:</dd><dd>{form.client_address || party?.address || '-'}</dd>
          <dt>Name of the Work</dt><dd>:</dd><dd className="font-semibold">{form.work_name || '-'}</dd>
          <dt>Customer GST No.</dt><dd>:</dd><dd>{form.client_gstin || party?.gstin || '-'}</dd>
          <dt>Work Order / PO No.</dt><dd>:</dd><dd>{form.po_number || '-'}</dd>
          {form.invoice_number && <><dt>Service Invoice No.</dt><dd>:</dd><dd>{form.invoice_number}</dd></>}
          <dt>Date of Completion of Work</dt><dd>:</dd><dd>{formatDate(form.completion_date)}</dd>
        </dl>

        <section className="mt-8">
          <h3 className="font-extrabold uppercase">This is to certify that:</h3>
          <p className="mt-2">{form.body_intro || '-'}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {form.clauses.filter(Boolean).map((clause, index) => <li key={`${clause}-${index}`}>{clause}</li>)}
          </ol>
        </section>
        {form.notes && <p className="mt-7">{form.notes}</p>}

        <div className="mt-14 grid grid-cols-2 gap-8 text-center text-[10px] font-bold uppercase">
          <div className="pt-6">{form.left_signature_label}</div>
          <div className="pt-6">{signatureRight}</div>
        </div>
      </main>

      {(form.output_format === 'letterhead' || form.footer_text) && <footer className="border-t border-slate-300 pt-2 text-center text-[9px] text-slate-600">{form.footer_text || organisation?.footer_text || organisationAddress}</footer>}
    </article>
  );
}

export default function WorkCompletionCertificatePage() {
  const { organisation } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const preselectedClientId = searchParams.get('clientId');
  const preselectedInvoiceId = searchParams.get('invoiceId');
  const preselectedPoId = searchParams.get('poId');
  const [form, setForm] = useState<WorkCompletionForm>(() => emptyForm());
  const [clients, setClients] = useState<Party[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [orgDetails, setOrgDetails] = useState<any>(organisation || {});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const printableRef = useRef<HTMLDivElement>(null);

  const selectedParty = useMemo(() => clients.find(client => client.id === form.client_id), [clients, form.client_id]);
  const filteredClients = useMemo(() => clients.filter(client => client.name.toLowerCase().includes(clientSearch.toLowerCase())), [clients, clientSearch]);

  const update = <K extends keyof WorkCompletionForm>(key: K, value: WorkCompletionForm[K]) => setForm(current => ({ ...current, [key]: value }));
  const updatePartySnapshot = (party: Party) => setForm(current => ({ ...current, client_id: party.id, client_address: party.address, client_gstin: party.gstin, client_state: party.state }));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!organisation?.id) return;
      setLoading(true);
      const [orgResult, clientResult, projectResult] = await Promise.all([
        supabase.from('organisations').select('*').eq('id', organisation.id).maybeSingle(),
        supabase.from('clients').select('*').eq('organisation_id', organisation.id).order('client_name'),
        supabase.from('projects').select('id, project_name, name, project_code, client_id').eq('organisation_id', organisation.id).order('project_name'),
      ]);
      if (cancelled) return;
      if (orgResult.data) setOrgDetails(orgResult.data);
      if (clientResult.error) toast.error('Unable to load clients', { description: clientResult.error.message });
      setClients((clientResult.data || []).map(normalizeParty));
      setProjects(projectResult.data || []);

      if (editId) {
        const { data, error } = await supabase.from('work_completion_certificates').select('*').eq('id', editId).eq('organisation_id', organisation.id).maybeSingle();
        if (error) toast.error('Unable to load certificate', { description: error.message });
        if (data) setForm({ ...emptyForm(), ...data, clauses: Array.isArray(data.clauses) ? data.clauses : emptyForm().clauses, output_format: data.output_format === 'simple_a4' ? 'simple_a4' : 'letterhead' });
      } else if (preselectedClientId) {
        setForm(current => ({ ...current, client_id: preselectedClientId }));
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [organisation?.id, editId, preselectedClientId]);

  useEffect(() => {
    if (!organisation?.id || !form.client_id) {
      setPos([]); setInvoices([]); return;
    }
    const orgId = organisation.id;
    const clientId = form.client_id;
    let cancelled = false;
    async function loadLinkedRecords() {
      const [poResult, invoiceResult] = await Promise.all([
        supabase.from('client_purchase_orders').select('*').eq('organisation_id', orgId).eq('client_id', clientId).order('po_date', { ascending: false }).limit(100),
        supabase.from('invoices').select('*').eq('organisation_id', orgId).eq('client_id', clientId).order('invoice_date', { ascending: false }).limit(100),
      ]);
      if (cancelled) return;
      setPos(poResult.data || []);
      setInvoices(invoiceResult.data || []);
      if (preselectedPoId && poResult.data?.some(row => String(row.id) === preselectedPoId)) update('po_id', preselectedPoId);
      if (preselectedInvoiceId && invoiceResult.data?.some(row => String(row.id) === preselectedInvoiceId)) update('invoice_id', preselectedInvoiceId);
    }
    loadLinkedRecords();
    return () => { cancelled = true; };
  }, [organisation?.id, form.client_id, preselectedPoId, preselectedInvoiceId]);

  useEffect(() => {
    const party = clients.find(client => client.id === form.client_id);
    if (party && !form.client_address && !form.client_gstin) updatePartySnapshot(party);
  }, [clients, form.client_id]);

  const selectPo = (poId: string) => {
    const po = pos.find(row => String(row.id) === poId);
    update('po_id', poId);
    if (po) update('po_number', po.po_number || po.order_number || '');
  };
  const selectInvoice = (invoiceId: string) => {
    const invoice = invoices.find(row => String(row.id) === invoiceId);
    update('invoice_id', invoiceId);
    if (invoice) update('invoice_number', invoice.invoice_no || invoice.invoice_number || '');
  };

  const save = async () => {
    if (!organisation?.id) return;
    if (!form.client_id || !form.work_name.trim()) {
      toast.error('Client and work name are required.');
      return;
    }
    setSaving(true);
    try {
      const rpcInput = {
        organisationId: organisation.id,
        clientId: form.client_id,
        projectId: form.project_id || null,
        poId: form.po_id || null,
        invoiceId: form.invoice_id || null,
        certificateDate: form.certificate_date,
        completionDate: form.completion_date,
        workName: form.work_name,
        poNumber: form.po_number || null,
        invoiceNumber: form.invoice_number || null,
        bodyIntro: form.body_intro,
        clauses: form.clauses,
        notes: form.notes,
        outputFormat: form.output_format,
        showLogo: form.show_logo,
        footerText: form.footer_text,
        leftSignatureLabel: form.left_signature_label,
        rightSignatureLabel: form.right_signature_label,
      } as const;
      if (editId) await updateWorkCompletionCertificate(editId, rpcInput);
      else await createWorkCompletionCertificate(rpcInput);
      toast.success('Work completion certificate saved.');
    } catch (error: any) {
      toast.error('Unable to save certificate', { description: error?.message || 'Secure save failed' });
      setSaving(false);
      return;
    }
    setSaving(false);
    navigate('/work-completion');
  };

  const downloadPdf = async () => {
    if (!printableRef.current) return;
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')]);
      const canvas = await html2canvas(printableRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const width = 190;
      const height = canvas.height * width / canvas.width;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, width, Math.min(height, 277));
      pdf.save(`${form.certificate_no || 'work-completion-certificate'}.pdf`);
    } catch (error: any) {
      toast.error('Unable to create PDF', { description: error?.message || 'Please use Print instead.' });
    }
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <style>{`@media print { body { background:#fff!important; } body * { visibility:hidden; } #work-completion-printable, #work-completion-printable * { visibility:visible; } #work-completion-printable { position:absolute; left:0; top:0; width:190mm; margin:10mm; box-shadow:none!important; } } .work-completion-paper { width:100%; max-width:794px; min-height:1123px; padding:42px 52px; } @media (max-width: 640px) { .work-completion-paper { min-height:0; padding:28px 22px; } }`}</style>
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={() => navigate('/documents')}><ArrowLeft size={18} /></Button><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Documents</p><h1 className="text-lg font-bold text-slate-900">{editId ? 'Edit Work Completion Certificate' : 'Work Completion Certificate'}</h1></div></div>
        <div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => window.print()}><Printer size={15} /> <span className="hidden sm:inline">Print</span></Button><Button variant="outline" size="sm" onClick={downloadPdf}><Download size={15} /> <span className="hidden sm:inline">PDF</span></Button><Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} Save</Button></div>
      </div>

      <div className="mx-auto grid max-w-[1500px] gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_390px] lg:p-6">
        <section className="order-2 flex justify-center lg:order-1"><div ref={printableRef as any} className="w-full"><PrintableCertificate form={form} party={selectedParty} organisation={orgDetails} logoUrl={orgDetails?.logo_url} /></div></section>
        <aside className="order-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:order-2 lg:max-h-[calc(100vh-110px)] lg:overflow-y-auto">
          <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-3"><FileCheck2 size={18} className="text-cyan-600" /><div><h2 className="font-bold text-slate-900">Certificate options</h2><p className="text-xs text-slate-500">Edit the document without changing the invoice.</p></div></div>
          <div className="space-y-4">
            <div><label className="field-label">Output format</label><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => update('output_format', 'letterhead')} className={`rounded-lg border p-3 text-left text-xs ${form.output_format === 'letterhead' ? 'border-cyan-600 bg-cyan-50 text-cyan-800' : 'border-slate-200'}`}><strong>Company letterhead</strong><span className="mt-1 block text-slate-500">Uploaded logo and footer</span></button><button type="button" onClick={() => update('output_format', 'simple_a4')} className={`rounded-lg border p-3 text-left text-xs ${form.output_format === 'simple_a4' ? 'border-cyan-600 bg-cyan-50 text-cyan-800' : 'border-slate-200'}`}><strong>Simple A4</strong><span className="mt-1 block text-slate-500">Inbuilt logo option</span></button></div></div>
            <div className="grid grid-cols-2 gap-3"><label><span className="field-label">Certificate date</span><input className="field-input" type="date" value={form.certificate_date} onChange={e => update('certificate_date', e.target.value)} /></label><label><span className="field-label">Completion date</span><input className="field-input" type="date" value={form.completion_date} onChange={e => update('completion_date', e.target.value)} /></label></div>
            <label><span className="field-label">Certificate number (generated on save)</span><input className="field-input bg-slate-50" value={form.certificate_no || 'Generated by server'} readOnly /></label>
            <div><span className="field-label">Client</span><input className="field-input" placeholder="Search client..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} />{clientSearch && <div className="mt-1 max-h-36 overflow-y-auto rounded border border-slate-200 bg-white">{filteredClients.map(client => <button type="button" key={client.id} className="block w-full border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-cyan-50" onClick={() => { updatePartySnapshot(client); setClientSearch(''); }}><span className="font-semibold">{client.name}</span><span className="ml-2 text-slate-400">{client.gstin || 'No GSTIN'}</span></button>)}{filteredClients.length === 0 && <p className="p-3 text-xs text-slate-400">No clients found</p>}</div>}{selectedParty && <p className="mt-1 text-xs font-semibold text-cyan-700">Selected: {selectedParty.name}</p>}</div>
            <label><span className="field-label">Customer address (from client master)</span><textarea className="field-input min-h-16 bg-slate-50" value={form.client_address} readOnly /></label>
            <div className="grid grid-cols-2 gap-3"><label><span className="field-label">GSTIN (from client master)</span><input className="field-input bg-slate-50" value={form.client_gstin} readOnly /></label><label><span className="field-label">State (from client master)</span><input className="field-input bg-slate-50" value={form.client_state} readOnly /></label></div>
            <label><span className="field-label">Project</span><select className="field-input" value={form.project_id} onChange={e => update('project_id', e.target.value)}><option value="">No linked project</option>{projects.filter(project => !form.client_id || !project.client_id || String(project.client_id) === form.client_id).map(project => <option key={project.id} value={project.id}>{project.project_name || project.name || project.project_code}</option>)}</select></label>
            <label><span className="field-label">Name of the work *</span><input className="field-input" placeholder="e.g. PPP piping for compressed air" value={form.work_name} onChange={e => update('work_name', e.target.value)} /></label>
            <div className="grid grid-cols-2 gap-3"><label><span className="field-label">Linked PO</span><select className="field-input" value={form.po_id} onChange={e => selectPo(e.target.value)}><option value="">No linked PO</option>{pos.map(po => <option key={po.id} value={po.id}>{po.po_number || po.order_number || po.id}</option>)}</select></label><label><span className="field-label">PO number (editable)</span><input className="field-input" value={form.po_number} onChange={e => update('po_number', e.target.value)} /></label></div>
            <div className="grid grid-cols-2 gap-3"><label><span className="field-label">Linked invoice</span><select className="field-input" value={form.invoice_id} onChange={e => selectInvoice(e.target.value)}><option value="">No linked invoice</option>{invoices.map(invoice => <option key={invoice.id} value={invoice.id}>{invoice.invoice_no || invoice.invoice_number || invoice.id}</option>)}</select></label><label><span className="field-label">Invoice number (editable)</span><input className="field-input" value={form.invoice_number} onChange={e => update('invoice_number', e.target.value)} /></label></div>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.show_logo} onChange={e => update('show_logo', e.target.checked)} /> Show logo on simple A4 output</label>
            <label><span className="field-label">Opening text</span><textarea className="field-input min-h-24" value={form.body_intro} onChange={e => update('body_intro', e.target.value)} /></label>
            <div><div className="mb-1 flex items-center justify-between"><span className="field-label mb-0">Certificate clauses</span><button type="button" className="text-xs font-semibold text-cyan-700" onClick={() => update('clauses', [...form.clauses, ''])}><Plus size={13} className="inline" /> Add clause</button></div>{form.clauses.map((clause, index) => <div key={index} className="mb-2 flex gap-2"><textarea className="field-input min-h-14" value={clause} onChange={e => update('clauses', form.clauses.map((item, i) => i === index ? e.target.value : item))} /><button type="button" className="mt-2 text-slate-400 hover:text-red-600" onClick={() => update('clauses', form.clauses.filter((_, i) => i !== index))}><Trash2 size={15} /></button></div>)}</div>
            <label><span className="field-label">Closing text</span><textarea className="field-input min-h-16" value={form.notes} onChange={e => update('notes', e.target.value)} /></label>
            <label><span className="field-label">Footer text</span><textarea className="field-input min-h-14" value={form.footer_text} onChange={e => update('footer_text', e.target.value)} placeholder="Optional footer text" /></label>
            <div className="grid grid-cols-2 gap-3"><label><span className="field-label">Left signature</span><input className="field-input" value={form.left_signature_label} onChange={e => update('left_signature_label', e.target.value)} /></label><label><span className="field-label">Right signature</span><input className="field-input" value={form.right_signature_label} onChange={e => update('right_signature_label', e.target.value)} /></label></div>
          </div>
        </aside>
      </div>
      {previewMode && <div className="fixed inset-0 z-30 bg-black/40 p-4" onClick={() => setPreviewMode(false)}><div className="mx-auto max-h-full max-w-3xl overflow-auto" onClick={event => event.stopPropagation()}><PrintableCertificate form={form} party={selectedParty} organisation={orgDetails} logoUrl={orgDetails?.logo_url} /></div></div>}
      <button type="button" className="fixed bottom-5 right-5 rounded-full bg-cyan-600 px-4 py-3 text-xs font-bold text-white shadow-lg lg:hidden" onClick={() => setPreviewMode(true)}>Preview certificate</button>
      <style>{`.field-label { display:block; margin-bottom:0.35rem; font-size:0.7rem; font-weight:700; color:#475569; } .field-input { width:100%; border:1px solid #cbd5e1; border-radius:0.5rem; padding:0.55rem 0.65rem; font-size:0.75rem; color:#0f172a; background:white; outline:none; } .field-input:focus { border-color:#0891b2; box-shadow:0 0 0 2px rgba(8,145,178,.12); }`}</style>
    </div>
  );
}
