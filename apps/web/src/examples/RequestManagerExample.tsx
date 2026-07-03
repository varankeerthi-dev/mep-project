import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabase';
import { TabActivityProvider, useTabActivity } from '../hooks';

interface Material {
  id: string;
  name: string;
  sale_price: number;
}

// Wrap your app with TabActivityProvider
/*
  import { TabActivityProvider } from './hooks';
  
  function App() {
    return (
      <TabActivityProvider autoCancelRequests={true} maxPendingRequests={20}>
        <YourApp />
      </TabActivityProvider>
    );
  }
*/

// Example: Using useTabActivity hook in a component with background polling
function MaterialsListWithPause() {
  const { isActive, isPaused, createAbortSignal, withCancellation } = useTabActivity();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMaterials = useCallback(async () => {
    if (!isActive) {
      console.log('Tab hidden - skipping fetch');
      return;
    }

    const signal = createAbortSignal();
    
    const promise = supabase
      .from('materials')
      .select('id, name, sale_price')
      .abortSignal(signal)
      .limit(50);

    const result = await withCancellation(promise);
    
    if (result) {
      setMaterials(result.data || []);
    }
  }, [isActive, createAbortSignal, withCancellation]);

  // Polling that automatically pauses when tab is hidden
  useEffect(() => {
    if (isPaused) {
      console.log('⏸ Pausing polling - tab is hidden');
      return;
    }

    const intervalId = setInterval(fetchMaterials, 5000);
    fetchMaterials(); // Immediate fetch

    return () => clearInterval(intervalId);
  }, [isPaused, fetchMaterials]);

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold">Materials</h2>
        {isPaused && (
          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-full">
            Paused
          </span>
        )}
        {isActive && (
          <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
            Active
          </span>
        )}
      </div>

      {loading && <p className="text-zinc-500">Loading...</p>}
      
      <div className="border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 sticky top-0 z-10">
            <tr>
              <th className="h-10 pl-4 text-left text-xs font-medium text-zinc-500">Name</th>
              <th className="h-10 px-3 text-right text-xs font-medium text-zinc-500">Price</th>
            </tr>
          </thead>
          <tbody>
            {materials.map(m => (
              <tr key={m.id} className="border-b border-zinc-200">
                <td className="pl-4 py-3">{m.name}</td>
                <td className="px-3 py-3 text-right">₹{m.sale_price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Example: Usage at app level
export default function RequestManagerExample() {
  return (
    <TabActivityProvider autoCancelRequests={true} maxPendingRequests={20}>
      <MaterialsListWithPause />
    </TabActivityProvider>
  );
}