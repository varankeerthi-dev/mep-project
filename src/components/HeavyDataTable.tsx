import { useEffect, useState, useCallback, useRef } from 'react';
import { usePresenceAware } from '../hooks';
import { supabase } from '../supabase';

interface Material {
  id: string;
  name: string;
  unit: string;
  sale_price: number;
}

interface HeavyDataTableProps {
  organisationId: string;
}

export function HeavyDataTable({ organisationId }: HeavyDataTableProps) {
  const [data, setData] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef<number>(0);

  const { 
    isPaused, 
    startPolling, 
    stopPolling,
    pauseExecution,
    resumeExecution
  } = usePresenceAware({
    autoPause: true,
    autoResume: true,
    pollingInterval: 10000,
  });

  const fetchData = useCallback(async () => {
    if (!organisationId) return;
    
    // Prevent fetching if paused (tab hidden or user idle)
    if (isPaused) return;
    
    // Rate limit: don't fetch more than once per 2 seconds
    const now = Date.now();
    if (now - lastFetchRef.current < 2000) return;
    lastFetchRef.current = now;

    setLoading(true);
    setError(null);

    try {
      const { data: materials, error: fetchError } = await supabase
        .from('materials')
        .select('id, name, unit, sale_price')
        .eq('organisation_id', organisationId)
        .limit(100);

      if (fetchError) throw fetchError;
      setData(materials || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [organisationId, isPaused]);

  // Start polling for real-time updates when visible and active
  useEffect(() => {
    if (!isPaused) {
      startPolling(fetchData, 10000);
    }
    
    return () => {
      stopPolling();
    };
  }, [isPaused, startPolling, stopPolling]);

  // Manual refresh button
  const handleRefresh = useCallback(() => {
    if (!isPaused) {
      fetchData();
    }
  }, [fetchData, isPaused]);

  if (isPaused) {
    return (
      <div className="p-4 border border-zinc-200 rounded-lg bg-zinc-50">
        <p className="text-zinc-500 text-sm">
          Data refresh paused — tab is in background or user is idle
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-800">Materials</h3>
        <button 
          onClick={handleRefresh}
          disabled={loading}
          className="btn btn-secondary"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 sticky top-0 z-10">
            <tr>
              <th className="h-10 pl-4 pr-3 text-left text-xs font-medium text-zinc-500">Name</th>
              <th className="h-10 px-3 text-left text-xs font-medium text-zinc-500">Unit</th>
              <th className="h-10 px-3 text-right text-xs font-medium text-zinc-500">Sale Price</th>
            </tr>
          </thead>
          <tbody>
            {data.map(item => (
              <tr key={item.id} className="border-b border-zinc-200 hover:bg-zinc-50">
                <td className="pl-4 py-3 text-sm font-medium text-zinc-700">{item.name}</td>
                <td className="px-3 py-3 text-sm text-zinc-600">{item.unit}</td>
                <td className="px-3 py-3 text-sm text-zinc-600 text-right">₹{item.sale_price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}