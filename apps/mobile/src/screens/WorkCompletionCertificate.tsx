import React, { useEffect, useState } from 'react';
import { ArrowLeft, FileCheck2, Loader2, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface WorkCompletionCertificateProps { onBack: () => void; isDemo?: boolean; }

const today = () => new Date().toISOString().slice(0, 10);

export const WorkCompletionCertificate: React.FC<WorkCompletionCertificateProps> = ({ onBack, isDemo = false }) => {
  const [organisationId, setOrganisationId] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isDemo);
  const [form, setForm] = useState({ certificate_no: `WCC-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`, certificate_date: today(), completion_date: today(), client_id: '', work_name: '', po_id: '', po_number: '', invoice_id: '', invoice_number: '', body_intro: 'This is to certify that the above-mentioned work has been completed as per the approved scope, purchase order, and agreed specifications.', notes: 'We thank you for your cooperation and support during completion of the above-mentioned work.', output_format: 'letterhead' });

  useEffect(() => {
    if (isDemo) { setClients([{ id: 'demo-client', client_name: 'Demo Client' }]); setLoading(false); return; }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: member } = await supabase.from('org_members').select('organisation_id').eq('user_id', user.id).limit(1).maybeSingle();
      const orgId = member?.organisation_id;
      if (!orgId) { setLoading(false); return; }
      setOrganisationId(orgId);
      const { data } = await supabase.from('clients').select('id, client_name, name, gstin').eq('organisation_id', orgId).order('client_name');
      setClients(data || []);
      setLoading(false);
    })();
  }, [isDemo]);

  useEffect(() => {
    if (!organisationId || !form.client_id) { setPos([]); setInvoices([]); return; }
    (async () => {
      const [{ data: poData }, { data: invoiceData }] = await Promise.all([
        supabase.from('client_purchase_orders').select('id, po_number, order_number').eq('organisation_id', organisationId).eq('client_id', form.client_id).order('po_date', { ascending: false }).limit(50),
        supabase.from('invoices').select('id, invoice_no, invoice_number').eq('organisation_id', organisationId).eq('client_id', form.client_id).order('invoice_date', { ascending: false }).limit(50),
      ]);
      setPos(poData || []); setInvoices(invoiceData || []);
    })();
  }, [organisationId, form.client_id]);

  const setField = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));
  const save = async () => {
    if (isDemo) { onBack(); return; }
    if (!organisationId || !form.client_id || !form.work_name.trim()) return;
    setSaving(true);
    const { error } = await supabase.rpc('create_work_completion_certificate', {
      p_organisation_id: organisationId,
      p_client_id: form.client_id,
      p_project_id: null,
      p_po_id: form.po_id || null,
      p_invoice_id: form.invoice_id || null,
      p_certificate_date: form.certificate_date,
      p_completion_date: form.completion_date,
      p_work_name: form.work_name,
      p_po_number: form.po_number || null,
      p_invoice_number: form.invoice_number || null,
      p_body_intro: form.body_intro,
      p_clauses: [],
      p_notes: form.notes,
      p_output_format: form.output_format,
      p_show_logo: true,
      p_footer_text: null,
      p_left_signature_label: 'For Customer',
      p_right_signature_label: 'For Organisation',
    });
    setSaving(false);
    if (error) { alert(`Unable to save certificate: ${error.message}`); return; }
    onBack();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;

  return <div className="min-h-screen bg-background pb-8">
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card/95 px-4 py-4 backdrop-blur">
      <div className="flex items-center gap-3"><button type="button" onClick={onBack} className="h-9 w-9 rounded-xl border border-border flex items-center justify-center"><ArrowLeft className="h-4 w-4" /></button><div><p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Documents</p><h1 className="text-base font-bold">Work Completion</h1></div></div>
      <button type="button" onClick={save} disabled={saving || !form.client_id || !form.work_name.trim()} className="h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"><Save className="h-3.5 w-3.5" /> {saving ? 'Saving' : 'Save'}</button>
    </header>
    <main className="px-4 pt-5 space-y-5 max-w-lg mx-auto">
      <div className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-2 mb-4"><FileCheck2 className="h-5 w-5 text-primary" /><div><h2 className="font-bold">Certificate details</h2><p className="text-xs text-muted-foreground">Create independently from an invoice.</p></div></div>
        <div className="grid grid-cols-2 gap-3"><label><span className="mobile-label">Certificate date</span><input className="mobile-input" type="date" value={form.certificate_date} onChange={e => setField('certificate_date', e.target.value)} /></label><label><span className="mobile-label">Completion date</span><input className="mobile-input" type="date" value={form.completion_date} onChange={e => setField('completion_date', e.target.value)} /></label></div>
        <label className="block mt-3"><span className="mobile-label">Certificate number (generated on save)</span><input className="mobile-input" value={form.certificate_no || 'Generated by server'} readOnly /></label>
        <label className="block mt-3"><span className="mobile-label">Client</span><select className="mobile-input" value={form.client_id} onChange={e => setField('client_id', e.target.value)}><option value="">Select client</option>{clients.map(client => <option key={client.id} value={client.id}>{client.client_name || client.name}</option>)}</select></label>
        <label className="block mt-3"><span className="mobile-label">Name of work</span><input className="mobile-input" placeholder="e.g. Piping installation" value={form.work_name} onChange={e => setField('work_name', e.target.value)} /></label>
        <div className="grid grid-cols-2 gap-3 mt-3"><label><span className="mobile-label">Linked PO</span><select className="mobile-input" value={form.po_id} onChange={e => { setField('po_id', e.target.value); const po = pos.find(row => row.id === e.target.value); setField('po_number', po?.po_number || po?.order_number || ''); }}><option value="">None</option>{pos.map(po => <option key={po.id} value={po.id}>{po.po_number || po.order_number}</option>)}</select></label><label><span className="mobile-label">PO number</span><input className="mobile-input" value={form.po_number} onChange={e => setField('po_number', e.target.value)} /></label></div>
        <div className="grid grid-cols-2 gap-3 mt-3"><label><span className="mobile-label">Linked invoice</span><select className="mobile-input" value={form.invoice_id} onChange={e => { setField('invoice_id', e.target.value); const invoice = invoices.find(row => row.id === e.target.value); setField('invoice_number', invoice?.invoice_no || invoice?.invoice_number || ''); }}><option value="">None</option>{invoices.map(invoice => <option key={invoice.id} value={invoice.id}>{invoice.invoice_no || invoice.invoice_number}</option>)}</select></label><label><span className="mobile-label">Invoice number</span><input className="mobile-input" value={form.invoice_number} onChange={e => setField('invoice_number', e.target.value)} /></label></div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4"><h2 className="font-bold mb-3">Output format</h2><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setField('output_format', 'letterhead')} className={`rounded-xl border p-3 text-left text-xs ${form.output_format === 'letterhead' ? 'border-primary bg-primary/10' : 'border-border'}`}><strong>Letterhead</strong><span className="block mt-1 text-muted-foreground">Logo and footer</span></button><button type="button" onClick={() => setField('output_format', 'simple_a4')} className={`rounded-xl border p-3 text-left text-xs ${form.output_format === 'simple_a4' ? 'border-primary bg-primary/10' : 'border-border'}`}><strong>Simple A4</strong><span className="block mt-1 text-muted-foreground">Inbuilt logo</span></button></div></div>
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3"><h2 className="font-bold">Editable text</h2><label><span className="mobile-label">Opening text</span><textarea className="mobile-input min-h-24" value={form.body_intro} onChange={e => setField('body_intro', e.target.value)} /></label><label><span className="mobile-label">Closing text</span><textarea className="mobile-input min-h-20" value={form.notes} onChange={e => setField('notes', e.target.value)} /></label></div>
    </main>
    <style>{`.mobile-label { display:block; margin-bottom:.35rem; font-size:.7rem; font-weight:700; color:var(--muted-foreground); } .mobile-input { width:100%; border:1px solid hsl(var(--border)); border-radius:.75rem; background:hsl(var(--card)); color:hsl(var(--foreground)); padding:.65rem .75rem; font-size:.78rem; outline:none; }`}</style>
  </div>;
};
