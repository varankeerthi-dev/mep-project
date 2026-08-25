import { useEffect, useState } from 'react';
import { FileCheck2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';

export function SiteMaterials() { return <div><div className="card"><div className="empty-state"><h3>Site Materials</h3><p>Manage materials at project site</p></div></div></div>; }
export function ToolsList() { return <div><div className="page-header"><h1 className="page-title">Tools</h1></div><div className="card"><div className="empty-state"><h3>Tools</h3><p>Monitoring tools</p></div></div></div>; }
export function ClientComm() { return <div><div className="page-header"><h1 className="page-title">Client Communication</h1></div><div className="card"><div className="empty-state"><h3>Client Communication</h3></div></div></div>; }

type CertificateRow = { id: string; certificate_no: string; certificate_date: string; completion_date: string; work_name: string; client_snapshot: { name?: string } | null; status: string };

export function Documents() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadCertificates() {
      if (!organisation?.id) { setLoading(false); return; }
      const { data } = await supabase
        .from('work_completion_certificates')
        .select('id, certificate_no, certificate_date, completion_date, work_name, client_snapshot, status')
        .eq('organisation_id', organisation.id)
        .order('certificate_date', { ascending: false });
      if (!cancelled) { setCertificates((data || []) as CertificateRow[]); setLoading(false); }
    }
    loadCertificates();
    return () => { cancelled = true; };
  }, [organisation?.id]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Project documents</p>
            <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
            <p className="mt-1 text-sm text-slate-500">Create optional supporting documents independently from invoices.</p>
          </div>
          <button type="button" onClick={() => navigate('/work-completion/create')} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-700">
            <Plus size={16} /> Work Completion Certificate
          </button>
        </div>
        <div className="mb-5 grid gap-4 md:grid-cols-2">
          <button type="button" onClick={() => navigate('/work-completion/create')} className="group rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700"><FileCheck2 size={20} /></div>
            <h2 className="font-bold text-slate-900">Work Completion Certificate</h2>
            <p className="mt-1 text-sm text-slate-500">Prepare a linked or standalone certificate with editable text, client details, PO/invoice references, and company branding.</p>
            <span className="mt-4 inline-block text-xs font-bold text-cyan-700 group-hover:underline">Create certificate →</span>
          </button>
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5">
            <h2 className="font-bold text-slate-700">More document formats</h2>
            <p className="mt-1 text-sm text-slate-500">Additional project documents can be added here without coupling them to invoice creation.</p>
          </div>
        </div>
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Saved work completion certificates</h2></div>
          {loading ? <p className="px-5 py-8 text-sm text-slate-500">Loading certificates...</p> : certificates.length === 0 ? <p className="px-5 py-8 text-sm text-slate-500">No certificates created yet. You can create one without first creating an invoice.</p> : <div className="divide-y divide-slate-100">{certificates.map(certificate => <button type="button" key={certificate.id} onClick={() => navigate(`/work-completion/edit?id=${certificate.id}`)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50"><div><p className="text-sm font-bold text-slate-900">{certificate.certificate_no}</p><p className="mt-0.5 text-xs text-slate-500">{certificate.client_snapshot?.name || 'Client'} · {certificate.work_name}</p></div><div className="text-right"><p className="text-xs font-semibold text-slate-700">Completion: {certificate.completion_date || '-'}</p><p className="mt-0.5 text-[11px] uppercase text-cyan-700">{certificate.status || 'draft'} · Edit</p></div></button>)}</div>}
        </section>
      </div>
    </div>
  );
}

import { IssueDashboard, IssueListPage, IssueDetailPage } from '../issues';
export function IssueList() { return <IssueDashboard />; }
export function IssueAllList() { return <IssueListPage />; }
export function IssueViewDetail({ id }: { id?: string }) { return id ? <IssueDetailPage /> : <IssueListPage />; }
