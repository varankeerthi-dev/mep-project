import { HeavyDataTable } from '../components/HeavyDataTable';

// Example 1: Wrap with PresenceProvider at app root level (optional)
// This enables global presence context if you want to use usePresenceContext()

// import { PresenceProvider } from './hooks';
// 
// function App() {
//   return (
//     <PresenceProvider idleTimeout={30000} throttleMs={1000}>
//       <AppRoutes />
//     </PresenceProvider>
//   );
// }

// Example 2: Using usePresenceAware hook directly in any component
// This is the recommended pattern for pausing expensive operations

/*
  import { usePresenceAware } from '../hooks';
  
  function MyComponent() {
    const { isPaused, startPolling, stopPolling } = usePresenceAware({
      autoPause: true,      // Pause when tab hidden or user idle
      autoResume: true,     // Resume when tab visible and user active  
      pollingInterval: 5000 // Poll every 5 seconds
    });
    
    useEffect(() => {
      // This polling will automatically pause when:
      // - User switches to another tab
      // - User becomes idle (no mouse/keyboard for 30s)
      // - Tab is hidden
      
      const cleanup = startPolling(() => {
        fetchExpensiveData();
      }, 5000);
      
      return cleanup;
    }, [startPolling]);
    
    if (isPaused) {
      return <div>Paused</div>;
    }
    
    return <div>Data: {data}</div>;
  }
*/

// Example 3: Using HeavyDataTable component (already configured)

/*
  <HeavyDataTable organisationId={orgId} />
*/

export default function PresenceAwareExample() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Presence Aware Component</h2>
      {/* Example with real org ID */}
      {/* <HeavyDataTable organisationId="xxx-xxx-xxx" /> */}
      <p className="text-zinc-600">
        See code comments above for usage patterns.
      </p>
    </div>
  );
}