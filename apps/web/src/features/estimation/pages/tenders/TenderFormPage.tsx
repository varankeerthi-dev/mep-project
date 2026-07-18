import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../../App';
import { useTender, useCreateTender, useUpdateTender } from '../../hooks/useTenders';
import { useClients } from '../../../../hooks/useClients';
import { useProjects } from '../../../../hooks/useProjects';
import { useBOQs } from '../../hooks/useBOQ';
import { TENDER_STATUSES } from '../../constants';
import { ArrowLeft, Save } from 'lucide-react';

export default function TenderFormPage() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const isEdit = !!id;
  const navigate = useNavigate();
  const { organisation, user } = useAuth();

  const { data: existingTender } = useTender(isEdit ? id! : null);
  const { data: clients } = useClients();
  const { data: projects } = useProjects();
  const { data: boqs } = useBOQs({ organisation_id: organisation?.id || '' });
  const createTender = useCreateTender();
  const updateTender = useUpdateTender(id || '');

  const [form, setForm] = useState({
    tender_no: '',
    title: '',
    client_id: '',
    project_id: '',
    boq_id: '',
    bid_amount: '' as string,
    estimated_cost: '' as string,
    expected_margin: '' as string,
    status: 'Draft',
    submission_date: '',
    notes: '',
  });

  useEffect(() => {
    if (existingTender) {
      setForm({
        tender_no: existingTender.tender_no || '',
        title: existingTender.title || '',
        client_id: existingTender.client_id || '',
        project_id: existingTender.project_id || '',
        boq_id: existingTender.boq_id || '',
        bid_amount: existingTender.bid_amount?.toString() || '',
        estimated_cost: existingTender.estimated_cost?.toString() || '',
        expected_margin: existingTender.expected_margin?.toString() || '',
        status: existingTender.status || 'Draft',
        submission_date: existingTender.submission_date?.split('T')[0] || '',
        notes: existingTender.result_notes || '',
      });
    }
  }, [existingTender]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisation?.id) return;

    const payload = {
      tender_no: form.tender_no,
      title: form.title || null,
      client_id: form.client_id || null,
      project_id: form.project_id || null,
      boq_id: form.boq_id || null,
      bid_amount: form.bid_amount ? Number(form.bid_amount) : null,
      estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : null,
      expected_margin: form.expected_margin ? Number(form.expected_margin) : null,
      status: form.status,
      submission_date: form.submission_date || null,
      result_notes: form.notes || null,
      created_by: user?.id,
    };

    try {
      if (isEdit) {
        await updateTender.mutateAsync(payload);
      } else {
        const result = await createTender.mutateAsync({ ...payload, organisation_id: organisation.id } as any);
        navigate(`/estimation/tenders/detail?id=${result.id}`);
        return;
      }
      navigate(`/estimation/tenders/detail?id=${id}`);
    } catch (err) {
      console.error('Failed to save tender:', err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 px-6 py-4 border-b border-zinc-200">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-zinc-100 rounded">
          <ArrowLeft className="h-5 w-5 text-zinc-600" />
        </button>
        <h1 className="text-xl font-semibold text-zinc-800">{isEdit ? 'Edit Tender' : 'New Tender'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Tender No *</label>
              <input
                required
                value={form.tender_no}
                onChange={(e) => setForm({ ...form, tender_no: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TENDER_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-700 mb-1">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Client</label>
              <select
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Client</option>
                {clients?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.client_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Project</label>
              <select
                value={form.project_id}
                onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Project</option>
                {projects?.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.project_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Linked BOQ</label>
              <select
                value={form.boq_id}
                onChange={(e) => setForm({ ...form, boq_id: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select BOQ</option>
                {boqs?.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.boq_no} {b.title ? `- ${b.title}` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Submission Date</label>
              <input
                type="date"
                value={form.submission_date}
                onChange={(e) => setForm({ ...form, submission_date: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div></div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Bid Amount (₹)</label>
              <input
                type="number"
                value={form.bid_amount}
                onChange={(e) => setForm({ ...form, bid_amount: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Estimated Cost (₹)</label>
              <input
                type="number"
                value={form.estimated_cost}
                onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Expected Margin (%)</label>
              <input
                type="number"
                step="0.1"
                value={form.expected_margin}
                onChange={(e) => setForm({ ...form, expected_margin: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-700 mb-1">Notes</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTender.isPending || updateTender.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {createTender.isPending || updateTender.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
