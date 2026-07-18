import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../../App';
import { usePartner, useCreatePartner, useUpdatePartner } from '../../hooks/usePartners';
import { partnerTypeEnum } from '../../model';
import { ArrowLeft, Save } from 'lucide-react';

export default function PartnerFormPage() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const isEdit = !!id;
  const navigate = useNavigate();
  const { organisation } = useAuth();

  const { data: existingPartner } = usePartner(isEdit ? id! : null);
  const createPartner = useCreatePartner();
  const updatePartner = useUpdatePartner(id || '');

  const [form, setForm] = useState({
    business_name: '',
    partner_type: 'individual' as string,
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gstin: '',
    categories: '',
    service_areas: '',
    is_active: true,
    max_active_jobs: 0,
  });

  useEffect(() => {
    if (existingPartner) {
      setForm({
        business_name: existingPartner.business_name || '',
        partner_type: existingPartner.partner_type || 'individual',
        contact_person: existingPartner.contact_person || '',
        phone: existingPartner.phone || '',
        email: existingPartner.email || '',
        address: existingPartner.address || '',
        city: existingPartner.city || '',
        state: existingPartner.state || '',
        pincode: existingPartner.pincode || '',
        gstin: existingPartner.gstin || '',
        categories: (existingPartner.categories || []).join(', '),
        service_areas: (existingPartner.service_areas || []).join(', '),
        is_active: existingPartner.is_active ?? true,
        max_active_jobs: existingPartner.max_active_jobs ?? 0,
      });
    }
  }, [existingPartner]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisation?.id) return;

    const payload = {
      organisation_id: organisation.id,
      business_name: form.business_name,
      partner_type: form.partner_type as any,
      contact_person: form.contact_person || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      pincode: form.pincode || null,
      gstin: form.gstin || null,
      categories: form.categories ? form.categories.split(',').map(s => s.trim()).filter(Boolean) : [],
      service_areas: form.service_areas ? form.service_areas.split(',').map(s => s.trim()).filter(Boolean) : [],
      is_active: form.is_active,
      max_active_jobs: form.max_active_jobs,
    };

    try {
      if (isEdit && id) {
        await updatePartner.mutateAsync(payload as any);
      } else {
        await createPartner.mutateAsync(payload as any);
      }
      navigate('/partner-allocation/partners');
    } catch (err) {
      console.error('Failed to save partner:', err);
    }
  };

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 px-6 py-4 border-b border-zinc-200">
        <button onClick={() => navigate('/partner-allocation/partners')} className="p-1 hover:bg-zinc-100 rounded" type="button">
          <ArrowLeft className="h-5 w-5 text-zinc-600" />
        </button>
        <h1 className="text-xl font-semibold text-zinc-800">{isEdit ? 'Edit Partner' : 'New Partner'}</h1>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
          <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Basic Information</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-zinc-700 mb-1">Business Name *</label>
                <input type="text" value={form.business_name} onChange={e => set('business_name', e.target.value)} required
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Partner Type</label>
                <select value={form.partner_type} onChange={e => set('partner_type', e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  {partnerTypeEnum.options.map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Max Active Jobs</label>
                <input type="number" min={0} value={form.max_active_jobs} onChange={e => set('max_active_jobs', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Contact Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Contact Person</label>
                <input type="text" value={form.contact_person} onChange={e => set('contact_person', e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Phone</label>
                <input type="text" value={form.phone} onChange={e => set('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">GSTIN</label>
                <input type="text" value={form.gstin} onChange={e => set('gstin', e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Address</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-zinc-700 mb-1">Address</label>
                <input type="text" value={form.address} onChange={e => set('address', e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">City</label>
                <input type="text" value={form.city} onChange={e => set('city', e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">State</label>
                <input type="text" value={form.state} onChange={e => set('state', e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Pincode</label>
                <input type="text" value={form.pincode} onChange={e => set('pincode', e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Service Configuration</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Categories (comma-separated)</label>
                <input type="text" value={form.categories} onChange={e => set('categories', e.target.value)} placeholder="HVAC Installation, Piping, Electrical"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Service Areas (comma-separated)</label>
                <input type="text" value={form.service_areas} onChange={e => set('service_areas', e.target.value)} placeholder="Mumbai, Thane, Navi Mumbai"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300" />
              <label htmlFor="is_active" className="text-sm text-zinc-700">Active</label>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={createPartner.isPending || updatePartner.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
              <Save className="h-4 w-4" />
              {isEdit ? 'Update Partner' : 'Create Partner'}
            </button>
            <button type="button" onClick={() => navigate('/partner-allocation/partners')}
              className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-lg hover:bg-zinc-50 text-sm font-medium">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
