import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Wrench } from 'lucide-react';

interface MobileMachineCard {
  id: string;
  name: string;
  code: string;
  machine_status: string;
  machine_type: string;
  clamping_force_tonnes?: number;
  tooling_name?: string;
  no_of_cavities?: number;
  active_job_product?: string;
  active_job_number?: string;
  is_downtime?: boolean;
}

export function MachineBoardMobile() {
  const [machines, setMachines] = useState<MobileMachineCard[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMobileBoard = async () => {
    setLoading(true);
    try {
      const { data: rawMachines } = await supabase.from('work_centers').select('*');
      const { data: rawToolings } = await supabase.from('manufacturing_tooling').select('*');
      const { data: rawJobs } = await supabase.from('job_cards').select('*').not('status', 'in', '("completed","cancelled")');
      const { data: rawDowntimes } = await supabase.from('machine_downtime').select('*').is('downtime_end', null);

      const toolingMap = new Map((rawToolings || []).map(t => [t.id, t]));

      const list: MobileMachineCard[] = (rawMachines || []).map((m: any) => {
        const job = (rawJobs || []).find((j: any) => j.machine_id === m.id || j.work_center_id === m.id);
        const downtime = (rawDowntimes || []).find((d: any) => d.machine_id === m.id);
        const mountedTooling = m.current_tooling_id ? toolingMap.get(m.current_tooling_id) : null;

        return {
          id: m.id,
          name: m.name,
          code: m.code,
          machine_status: downtime ? 'breakdown' : m.machine_status || 'idle',
          machine_type: m.machine_type || 'general',
          clamping_force_tonnes: m.clamping_force_tonnes,
          tooling_name: mountedTooling?.tooling_name,
          no_of_cavities: mountedTooling?.no_of_cavities,
          active_job_product: job?.product_name,
          active_job_number: job?.job_card_number,
          is_downtime: !!downtime,
        };
      });

      setMachines(list);
    } catch (err) {
      console.error('Error fetching mobile machine board:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMobileBoard();
  }, []);

  return (
    <div className="p-4 space-y-4 font-['Inter'] pb-24">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Machine Board</h1>
          <p className="text-xs text-slate-500">Shopfloor Machine & Tooling Monitor</p>
        </div>
        <button onClick={fetchMobileBoard} className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg">
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : machines.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
          No machines found.
        </div>
      ) : (
        <div className="space-y-3">
          {machines.map((m) => (
            <div
              key={m.id}
              className={`bg-white/80 backdrop-blur-md rounded-xl border p-4 shadow-xs space-y-2.5 ${
                m.is_downtime ? 'border-rose-300 bg-rose-50/30' :
                m.active_job_number ? 'border-emerald-300 bg-emerald-50/30' :
                'border-slate-200'
              }`}
              style={{ paddingLeft: '12px' }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{m.name}</h3>
                  <span className="text-[11px] text-slate-500">Code: {m.code} {m.clamping_force_tonnes ? `· ${m.clamping_force_tonnes}T` : ''}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  m.is_downtime ? 'bg-rose-100 text-rose-800' :
                  m.active_job_number ? 'bg-emerald-100 text-emerald-800' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {m.is_downtime ? 'DOWN' : m.active_job_number ? 'RUNNING' : 'IDLE'}
                </span>
              </div>

              {/* Tooling info */}
              <div className="bg-white/60 p-2 rounded-lg border border-slate-100 text-xs flex justify-between items-center">
                <span className="text-indigo-700 font-medium flex items-center gap-1">
                  <Wrench size={12} /> {m.tooling_name || 'No Mould Mounted'}
                </span>
                {m.no_of_cavities && <span className="text-[11px] text-slate-500">{m.no_of_cavities} cav</span>}
              </div>

              {/* Active Job info */}
              {m.active_job_number && (
                <div className="text-xs text-slate-700 space-y-0.5">
                  <div className="font-semibold text-slate-900">📦 {m.active_job_product}</div>
                  <div className="text-[11px] text-slate-500">Job: {m.active_job_number}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
