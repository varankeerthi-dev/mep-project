import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Login } from './screens/Login';
import { Dashboard } from './screens/Dashboard';
import { Approvals } from './screens/Approvals';
import { ClientCommunication } from './screens/ClientCommunication';
import { SiteReport } from './screens/SiteReport';
import { SiteVisits } from './screens/SiteVisits';
import { Home, ClipboardList, Loader2, MessageSquare, ClipboardCheck, MapPin } from 'lucide-react';

type Screen = 'dashboard' | 'approvals' | 'communications' | 'site_report' | 'site_visits';

function App() {
  const [session, setSession] = useState<any>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!isDemo) {
          setSession(session);
        }
        setAuthLoading(false);
      })
      .catch((err) => {
        console.warn('Supabase session fetch failed:', err);
        setAuthLoading(false);
      });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isDemo) {
        setSession(session);
      }
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [isDemo]);

  const handleLoginSuccess = (demoMode = false) => {
    if (demoMode) {
      setIsDemo(true);
      setSession({
        user: {
          id: 'demo-user-id',
          email: 'demo@billfast.com',
          user_metadata: { full_name: 'Demo User' }
        }
      });
    }
    setCurrentScreen('dashboard');
  };

  const handleLogout = () => {
    setIsDemo(false);
    setSession(null);
  };

  if (authLoading && !isDemo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const NAV_ITEMS = [
    { key: 'dashboard',      label: 'Dashboard',   Icon: Home },
    { key: 'approvals',      label: 'Approvals',   Icon: ClipboardList },
    { key: 'site_report',    label: 'Site Report', Icon: ClipboardCheck },
    { key: 'site_visits',    label: 'Site Visit',  Icon: MapPin },
    { key: 'communications', label: 'Comms',       Icon: MessageSquare },
  ] as const;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans select-none antialiased">
      {/* Active Screen */}
      <div className="flex-1 overflow-hidden">
        {currentScreen === 'dashboard' && (
          <Dashboard
            onLogout={handleLogout}
            onNavigateToApprovals={() => setCurrentScreen('approvals')}
            isDemo={isDemo}
          />
        )}
        {currentScreen === 'approvals' && <Approvals isDemo={isDemo} />}
        {currentScreen === 'site_report' && <SiteReport isDemo={isDemo} />}
        {currentScreen === 'site_visits' && <SiteVisits isDemo={isDemo} />}
        {currentScreen === 'communications' && <ClientCommunication isDemo={isDemo} />}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t border-border pb-safe">
        <div className="flex items-end justify-around h-16 max-w-lg mx-auto px-2 pb-1">
          {NAV_ITEMS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setCurrentScreen(key as Screen)}
              className={`flex-1 flex flex-col items-center justify-center h-full relative cursor-pointer ${
                currentScreen === key ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="h-5 w-5 mb-0.5" />
              <span className="text-[9px] font-medium">{label}</span>
              {currentScreen === key && (
                <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default App;

