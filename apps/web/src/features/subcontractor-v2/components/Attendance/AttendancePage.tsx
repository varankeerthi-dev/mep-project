import { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase';
import { useAuth } from '../../../../App';
import { Plus, X, RefreshCcw } from 'lucide-react';
import { AppTable } from '../../../../components/ui/AppTable';
import { SubcontractorModuleNav } from '../Shared/SubcontractorModuleNav';

interface AttendancePageProps {
  onNavigate?: (path: string) => void;
}

export function AttendancePage({ onNavigate }: AttendancePageProps) {
  const { organisation } = useAuth();
  const [subcontractors, setSubcontractors] = useState<any[]>([]);
  const [subId, setSubId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [workers, setWorkers] = useState(1);
  const [supervisor, setSupervisor] = useState('');
  const [remarks, setRemarks] = useState('');
  const [records, setRecords] = useState<any[]>([]);
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

  const loadRecords = async () => {
    if (subId && organisation?.id) {
      setLoading(true);
      const { data } = await supabase
        .from('subcontractor_attendance')
        .select('*')
        .eq('subcontractor_id', subId)
        .eq('organisation_id', organisation.id)
        .order('attendance_date', { ascending: false });
      setRecords(data || []);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subId) {
      loadRecords();
    }
  }, [subId]);

  const saveAttendance = async () => {
    if (!subId || !organisation?.id) return;
    setSaving(true);
    await supabase.from('subcontractor_attendance').insert({
      organisation_id: organisation.id,
      subcontractor_id: subId,
      attendance_date: date,
      workers_count: workers,
      supervisor_name: supervisor,
      remarks
    });
    setSaving(false);
    setRemarks('');
    loadRecords();
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900">Daily Workforce Count (V2)</h1>
            <p className="font-medium text-zinc-400">Log and monitor sub-contractor headcounts across sites</p>
          </div>
          <button
            onClick={() => onNavigate?.('/subcontractors-v2')}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-400"
          >
            <X size={20} />
          </button>
        </div>

        {onNavigate && <SubcontractorModuleNav onNavigate={onNavigate} />}

        <div className="grid gap-10 lg:grid-cols-3 mt-6">
          <div className="lg:col-span-1">
            <div className="rounded-[2.5rem] border border-zinc-200 bg-white p-8 shadow-xl shadow-zinc-200/50 space-y-4">
              <h3 className="mb-4 text-[11px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 pb-3">Logging Form</h3>
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
                  type="date"
                  className="h-11 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-xs font-bold text-zinc-900 outline-none"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Workers Count"
                    className="h-11 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-xs font-bold text-zinc-900 outline-none"
                    value={workers}
                    onChange={e => setWorkers(parseInt(e.target.value) || 0)}
                  />
                  <input
                    placeholder="Supervisor"
                    className="h-11 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-xs font-bold text-zinc-900 outline-none"
                    value={supervisor}
                    onChange={e => setSupervisor(e.target.value)}
                  />
                </div>
                <textarea
                  placeholder="Remarks..."
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-bold text-zinc-900 outline-none resize-none"
                  rows={3}
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                />
                <button
                  onClick={saveAttendance}
                  disabled={saving || !subId}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 text-[11px] font-black uppercase tracking-widest text-white shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {saving ? <RefreshCcw className="animate-spin h-4 w-4" /> : <Plus size={14} />}
                  Capture Log
                </button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="rounded-[2.5rem] border border-zinc-200 bg-white overflow-hidden shadow-xl shadow-zinc-200/50">
              {loading ? (
                <div className="py-20 text-center text-zinc-400">Loading attendance...</div>
              ) : (
                <AppTable
                  data={records}
                  columns={[
                    { header: 'Date', accessorKey: 'attendance_date', cell: (i: any) => <span className="font-black text-zinc-900">{i.getValue()}</span> },
                    { header: 'Workers', accessorKey: 'workers_count', cell: (i: any) => <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 font-black text-blue-600 text-[10px] uppercase border border-blue-100">{i.getValue()}</div> },
                    { header: 'Supervisor', accessorKey: 'supervisor_name', cell: (i: any) => <span className="text-xs font-bold text-zinc-600">{i.getValue() || '-'}</span> },
                    { header: 'Remarks', accessorKey: 'remarks', cell: (i: any) => <span className="text-[11px] font-medium text-zinc-400 italic line-clamp-1">{i.getValue() || '-'}</span> }
                  ]}
                  emptyMessage="Select a partner to view attendance cycles."
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default AttendancePage;
