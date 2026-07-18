import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../../App';
import { useBOQ, useCreateBOQ, useUpdateBOQ } from '../../hooks/useBOQ';
import { useClients } from '../../../../hooks/useClients';
import { useProjects } from '../../../../hooks/useProjects';
import { BOQ_STATUSES } from '../../constants';
import { ArrowLeft, Save } from 'lucide-react';

export default function BOQFormPage() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const isEdit = !!id;
  const navigate = useNavigate();
  const { organisation, user } = useAuth();

  const { data: existingBOQ } = useBOQ(isEdit ? id! : null);
  const { data: clients } = useClients();
  const { data: projects } = useProjects();
  const createBOQ = useCreateBOQ();
  const updateBOQ = useUpdateBOQ(id || '');

  const [form, setForm] = useState({
    boq_no: '',
    revision_no: 1,
    title: '',
    client_id: '',
    project_id: '',
    date: new Date().toISOString().split('T')[0],
    status: 'Draft' as string,
    currency: 'INR',
    notes: '',
  });

  useEffect(() => {
    if (existingBOQ) {
      setForm({
        boq_no: existingBOQ.boq_no || '',
        revision_no: existingBOQ.revision_no || 1,
        title: existingBOQ.title || '',
        client_id: existingBOQ.client_id || '',
        project_id: existingBOQ.project_id || '',
        date: existingBOQ.date?.split('T')[0] || '',
        status: existingBOQ.status || 'Draft',
        currency: existingBOQ.currency || 'INR',
        notes: existingBOQ.notes || '',
      });
    }
  }, [existingBOQ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisation?.id) return;

    try {
      if (isEdit) {
        await updateBOQ.mutateAsync(form);
      } else {
        const result = await createBOQ.mutateAsync({
          ...form,
          organisation_id: organisation.id,
          created_by: user?.id,
        } as any);
        navigate(`/estimation/boq/detail?id=${result.id}`);
        return;
      }
      navigate(`/estimation/boq/detail?id=${id}`);
    } catch (err) {
      console.error('Failed to save BOQ:', err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 px-6 py-4 border-b border-zinc-200">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-zinc-100 rounded">
          <ArrowLeft className="h-5 w-5 text-zinc-600" />
        </button>
        <h1 className="text-xl font-semibold text-zinc-800">{isEdit ? 'Edit BOQ' : 'New BOQ'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">BOQ No *</label>
              <input
                required
                value={form.boq_no}
                onChange={(e) => setForm({ ...form, boq_no: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Revision No</label>
              <input
                type="number"
                value={form.revision_no}
                onChange={(e) => setForm({ ...form, revision_no: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
                {clients?.map((c) => (
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
              <label className="block text-sm font-medium text-zinc-700 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
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
                {BOQ_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="AED">AED</option>
              </select>
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
              disabled={createBOQ.isPending || updateBOQ.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {createBOQ.isPending || updateBOQ.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
