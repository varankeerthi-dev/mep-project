import { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase';
import { useAuth } from '../../../../App';
import { X } from 'lucide-react';
import { SubcontractorModuleNav } from '../Shared/SubcontractorModuleNav';
import { WorkOrdersTab } from './WorkOrdersTab';

interface WorkOrdersPageProps {
  onNavigate?: (path: string) => void;
}

export function WorkOrdersPage({ onNavigate }: WorkOrdersPageProps) {
  const { organisation } = useAuth();
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadWOs = async () => {
    if (!organisation?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('subcontractor_work_orders')
      .select(`
        *,
        subcontractors(id, company_name, sub_number),
        clients(id, name),
        projects(id, name)
      `)
      .eq('organisation_id', organisation.id)
      .order('created_at', { ascending: false });
    setWorkOrders(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadWOs();
  }, [organisation?.id]);

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900">Work Orders (V2)</h1>
            <p className="font-medium text-zinc-400">Issue and track task-specific contracts for partners</p>
          </div>
          <button
            onClick={() => onNavigate?.('/subcontractors-v2')}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-400 hover:bg-zinc-50 transition"
          >
            <X size={20} />
          </button>
        </div>

        {onNavigate && <SubcontractorModuleNav onNavigate={onNavigate} />}

        <div className="mt-6">
          {loading ? (
            <div className="rounded-[2rem] border border-zinc-200 bg-white py-20 text-center text-zinc-400 shadow-xl shadow-zinc-200/50">
              Loading work orders...
            </div>
          ) : (
            <WorkOrdersTab
              workOrders={workOrders}
              onNavigate={onNavigate}
              fullWidth={true}
            />
          )}
        </div>
      </div>
    </div>
  );
}
export default WorkOrdersPage;
