import { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase';
import { useAuth } from '../../../../App';
import { Plus, X, RefreshCcw } from 'lucide-react';
import { AppTable } from '../../../../components/ui/AppTable';
import { SubcontractorModuleNav } from '../Shared/SubcontractorModuleNav';

interface WorkOrdersPageProps {
  onNavigate?: (path: string) => void;
}

export function WorkOrdersPage({ onNavigate }: WorkOrdersPageProps) {
  const { organisation } = useAuth();
  const [subcontractors, setSubcontractors] = useState<any[]>([]);
  const [subId, setSubId] = useState('');
  const [woNo, setWoNo] = useState('');
  const [desc, setDesc] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [value, setValue] = useState('');
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (organisation?.id) {
      supabase
        .from('subcontractors')
        .select('*')
        .eq('organisation_id', organisation.id)
        .order('company_name')
        .then(({ data }) => setSubcontractors(data || []));
    }
  }, [organisation?.id]);

  const loadWOs = async () => {
    if (subId && organisation?.id) {
      setLoading(true);
      const { data } = await supabase
        .from('subcontractor_work_orders')
        .select('*')
        .eq('subcontractor_id', subId)
        .eq('organisation_id', organisation.id)
        .order('created_at', { ascending: false });
      setWorkOrders(data || []);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subId) {
      loadWOs();
    }
  }, [subId]);

  const saveWO = async () => {
    if (!subId || !woNo || !organisation?.id) return;
    setSaving(true);
    await supabase.from('subcontractor_work_orders').insert({
      organisation_id: organisation.id,
      subcontractor_id: subId,
      work_order_no: woNo,
      work_description: desc,
      start_date: startDate || null,
      end_date: endDate || null,
      contract_value: parseFloat(value) || 0,
      total_amount: parseFloat(value) || 0,
      status: 'Pending'
    });
    setSaving(false);
    setWoNo('');
    setDesc('');
    setValue('');
    loadWOs();
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900">Work Orders (V2)</h1>
            <p className="font-medium text-zinc-400">Issue and track task-specific contracts for partners</p>
          </div>
          <button
            onClick={() => onNavigate?.('/subcontractors-v2')}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-400"
          >
            <X size={20} />
          </button>
        </div>

        {onNavigate && <SubcontractorModuleNav onNavigate={onNavigate} />}

        <div className="grid gap-10 lg:grid-cols-4 mt-6">
          <div className="lg:col-span-1">
            <div className="rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-xl shadow-zinc-200/50 space-y-4">
              <h3 className="mb-4 text-[11px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 pb-3">New Contract</h3>
              <div className="space-y-3">
                <select
                  className="h-11 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-xs font-bold text-zinc-900 outline-none"
                  value={subId}
                  onChange={e => setSubId(e.target.value)}
                >
                  <option value="">Select Partner</option>
                  {subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                </select>
                <input
                  placeholder="Contract # / WO #"
                  className="h-11 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-xs font-bold text-zinc-900 outline-none"
                  value={woNo}
                  onChange={e => setWoNo(e.target.value)}
                />
                <textarea
                  placeholder="Job Description"
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-bold text-zinc-900 outline-none resize-none"
                  rows={3}
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Contract Value"
                  className="h-11 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-xs font-bold text-zinc-900 outline-none"
                  value={value}
                  onChange={e => setValue(e.target.value)}
                />
                <button
                  onClick={saveWO}
                  disabled={saving || !subId}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 text-[11px] font-black uppercase tracking-widest text-white shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {saving ? <RefreshCcw className="animate-spin h-4 w-4" /> : <Plus size={14} />}
                  Issue Order
                </button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-3">
            <div className="rounded-[2rem] border border-zinc-200 bg-white overflow-hidden shadow-xl shadow-zinc-200/50">
              {loading ? (
                <div className="py-20 text-center text-zinc-400">Loading work orders...</div>
              ) : (
                <AppTable
                  data={workOrders}
                  columns={[
                    { header: 'Order ID', accessorKey: 'work_order_no', cell: (i: any) => <b className="text-blue-600 font-black tracking-tight uppercase text-[11px]">{i.getValue()}</b> },
                    { header: 'Job Details', accessorKey: 'work_description', cell: (i: any) => <span className="text-xs font-bold text-zinc-900">{i.getValue()}</span> },
                    { header: 'Value', accessorKey: 'contract_value', cell: (i: any) => <span className="font-black text-zinc-900 italic">₹{Number(i.getValue() || i.row.original.total_amount || 0).toLocaleString('en-IN')}</span> },
                    { header: 'Status', accessorKey: 'status', cell: (i: any) => <span className="text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-3 py-1 rounded-full">{i.getValue()}</span> }
                  ]}
                  emptyMessage="Select a partner to view assigned work packages."
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default WorkOrdersPage;
