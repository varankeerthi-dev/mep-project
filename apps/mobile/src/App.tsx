import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Login } from './screens/Login';
import { Dashboard } from './screens/Dashboard';
import { Approvals } from './screens/Approvals';
import { Home, ClipboardList, Loader2 } from 'lucide-react';

type Screen = 'dashboard' | 'approvals';

function App() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Login onLoginSuccess={() => setCurrentScreen('dashboard')} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans select-none antialiased">
      {/* Active Screen */}
      <div className="flex-1 overflow-hidden">
        {currentScreen === 'dashboard' && (
          <Dashboard
            onLogout={() => setSession(null)}
            onNavigateToApprovals={() => setCurrentScreen('approvals')}
          />
        )}
        {currentScreen === 'approvals' && <Approvals />}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t border-border pb-safe">
        <div className="flex items-end justify-around h-16 max-w-lg mx-auto px-2 pb-1">
          {/* Dashboard Tab */}
          <button
            onClick={() => setCurrentScreen('dashboard')}
            className={`flex-1 flex flex-col items-center justify-center h-full relative cursor-pointer ${
              currentScreen === 'dashboard' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Home className="h-5 w-5 mb-0.5" />
            <span className="text-[9px] font-medium">Dashboard</span>
            {currentScreen === 'dashboard' && (
              <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />
            )}
          </button>

          {/* Approvals Tab */}
          <button
            onClick={() => setCurrentScreen('approvals')}
            className={`flex-1 flex flex-col items-center justify-center h-full relative cursor-pointer ${
              currentScreen === 'approvals' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <ClipboardList className="h-5 w-5 mb-0.5" />
            <span className="text-[9px] font-medium">Approvals</span>
            {currentScreen === 'approvals' && (
              <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        </div>
      </nav>
    </div>
  );
}

export default App;
