import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';

type DashboardProps = {
  onNavigate: (path: string) => void;
};

export default function ManufacturingDashboard({ onNavigate }: DashboardProps) {
  const { organisation } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['manufacturing-dashboard', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return null;

      const [boms, jobCards, productionEntries] = await Promise.all([
        supabase
          .from('bom_headers')
          .select('id', { count: 'exact', head: true })
          .eq('organisation_id', organisation.id)
          .eq('is_active', true),
        supabase
          .from('job_cards')
          .select('id, status', { count: 'exact' })
          .eq('organisation_id', organisation.id)
          .in('status', ['draft', 'issued', 'in_progress']),
        supabase
          .from('production_entries')
          .select('id', { count: 'exact', head: true })
          .eq('organisation_id', organisation.id)
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      ]);

      return {
        activeBOMs: boms.count || 0,
        activeJobCards: jobCards.count || 0,
        jobCardsByStatus: jobCards.data?.reduce((acc, jc) => {
          acc[jc.status] = (acc[jc.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {},
        recentEntries: productionEntries.count || 0
      };
    },
    enabled: !!organisation?.id
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-200 rounded w-1/4 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-zinc-100 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Manufacturing</h1>
        <p className="text-zinc-500 mt-1">Manage BOMs, job cards, and production entries</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <button
          onClick={() => onNavigate('/manufacturing/boms')}
          className="bg-white border border-zinc-200 rounded-lg p-6 text-left hover:border-blue-500 transition-colors"
        >
          <div className="text-3xl font-semibold text-zinc-900">{stats?.activeBOMs || 0}</div>
          <div className="text-sm text-zinc-500 mt-1">Active BOMs</div>
        </button>

        <button
          onClick={() => onNavigate('/manufacturing/job-cards')}
          className="bg-white border border-zinc-200 rounded-lg p-6 text-left hover:border-blue-500 transition-colors"
        >
          <div className="text-3xl font-semibold text-zinc-900">{stats?.activeJobCards || 0}</div>
          <div className="text-sm text-zinc-500 mt-1">Active Job Cards</div>
        </button>

        <button
          onClick={() => onNavigate('/manufacturing/production')}
          className="bg-white border border-zinc-200 rounded-lg p-6 text-left hover:border-blue-500 transition-colors"
        >
          <div className="text-3xl font-semibold text-zinc-900">{stats?.recentEntries || 0}</div>
          <div className="text-sm text-zinc-500 mt-1">Entries (7 days)</div>
        </button>

        <button
          onClick={() => onNavigate('/manufacturing/schedules')}
          className="bg-white border border-zinc-200 rounded-lg p-6 text-left hover:border-blue-500 transition-colors"
        >
          <div className="text-3xl font-semibold text-zinc-900">-</div>
          <div className="text-sm text-zinc-500 mt-1">Production Schedules</div>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-zinc-200 rounded-lg p-6">
          <h2 className="text-lg font-medium text-zinc-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <button
              onClick={() => onNavigate('/manufacturing/boms/create')}
              className="w-full text-left px-4 py-3 border border-zinc-200 rounded-lg hover:border-blue-500 transition-colors"
            >
              <div className="font-medium text-zinc-900">Create BOM</div>
              <div className="text-sm text-zinc-500">Define a new bill of materials</div>
            </button>
            <button
              onClick={() => onNavigate('/manufacturing/job-cards/create')}
              className="w-full text-left px-4 py-3 border border-zinc-200 rounded-lg hover:border-blue-500 transition-colors"
            >
              <div className="font-medium text-zinc-900">Create Job Card</div>
              <div className="text-sm text-zinc-500">Issue materials for production</div>
            </button>
            <button
              onClick={() => onNavigate('/manufacturing/production/create')}
              className="w-full text-left px-4 py-3 border border-zinc-200 rounded-lg hover:border-blue-500 transition-colors"
            >
              <div className="font-medium text-zinc-900">Record Production</div>
              <div className="text-sm text-zinc-500">Log actual consumption and output</div>
            </button>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-lg p-6">
          <h2 className="text-lg font-medium text-zinc-900 mb-4">Job Card Status</h2>
          <div className="space-y-3">
            {['draft', 'issued', 'in_progress'].map((status) => (
              <div key={status} className="flex items-center justify-between px-4 py-3 border border-zinc-100 rounded-lg">
                <span className="capitalize text-zinc-700">{status.replace('_', ' ')}</span>
                <span className="font-medium text-zinc-900">{stats?.jobCardsByStatus?.[status] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
