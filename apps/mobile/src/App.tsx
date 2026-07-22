import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { Login } from './screens/Login';
import { Dashboard } from './screens/Dashboard';
import { Approvals } from './screens/Approvals';
import { ClientCommunication } from './screens/ClientCommunication';
import { SiteReport } from './screens/SiteReport';
import { SiteVisits } from './screens/SiteVisits';
import { ClientLookup } from './screens/ClientLookup';
import { ClientModule } from './screens/ClientModule';
import { ProjectModule } from './screens/ProjectModule';
import { PurchaseModule } from './screens/PurchaseModule';
import { AlertTriangle } from 'lucide-react';
import { Home, ClipboardList, Loader2, MessageSquare, ClipboardCheck, MapPin, LogOut } from 'lucide-react';

import { FieldVariationMobile } from './screens/FieldVariationMobile';
import { MaterialReturnMobile } from './screens/MaterialReturnMobile';

type Screen = 'dashboard' | 'approvals' | 'communications' | 'site_report' | 'site_visits' | 'lookup' | 'field_variation' | 'material_return';
type ModuleScreen = 'none' | 'client' | 'project' | 'purchase';

function App() {
  const [session, setSession] = useState<any>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [activeModule, setActiveModule] = useState<ModuleScreen>('none');
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [showDirtyDialog, setShowDirtyDialog] = useState(false);

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

  const backStateRef = useRef({ formDirty, activeModule, currentScreen });
  backStateRef.current = { formDirty, activeModule, currentScreen };

  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const onPopState = () => {
      const s = backStateRef.current;
      if (s.formDirty) {
        setShowDirtyDialog(true);
        return;
      }
      if (s.activeModule !== 'none') {
        setActiveModule('none');
        window.history.pushState(null, '', window.location.href);
        return;
      }
      if (s.currentScreen !== 'dashboard') {
        setCurrentScreen('dashboard');
        window.history.pushState(null, '', window.location.href);
        return;
      }
      setShowExitDialog(true);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const confirmDiscard = () => {
    setFormDirty(false);
    setShowDirtyDialog(false);
    if (activeModule !== 'none') {
      setActiveModule('none');
    } else if (currentScreen !== 'dashboard') {
      setCurrentScreen('dashboard');
    } else {
      setShowExitDialog(true);
    }
  };

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
        {currentScreen === 'dashboard' && activeModule === 'none' && (
          <Dashboard
            onLogout={handleLogout}
            onNavigateToApprovals={() => setCurrentScreen('approvals')}
            onNavigateToLookup={() => setCurrentScreen('lookup')}
            onNavigateToFieldVariation={() => setCurrentScreen('field_variation')}
            onNavigateToMaterialReturn={() => setCurrentScreen('material_return')}
            onOpenModule={(m) => setActiveModule(m)}
            isDemo={isDemo}
          />
        )}
        {currentScreen === 'approvals' && <Approvals isDemo={isDemo} />}
        {currentScreen === 'site_report' && <SiteReport isDemo={isDemo} onFormDirtyChange={setFormDirty} />}
        {currentScreen === 'site_visits' && <SiteVisits isDemo={isDemo} />}
        {currentScreen === 'communications' && <ClientCommunication isDemo={isDemo} />}
        {currentScreen === 'field_variation' && <FieldVariationMobile onBack={() => setCurrentScreen('dashboard')} />}
        {currentScreen === 'material_return' && <MaterialReturnMobile onBack={() => setCurrentScreen('dashboard')} />}
        {currentScreen === 'lookup' && (
          <ClientLookup 
            onBack={() => setCurrentScreen('dashboard')} 
            isDemo={isDemo} 
          />
        )}
        {activeModule === 'client' && (
          <ClientModule onBack={() => setActiveModule('none')} isDemo={isDemo} onFormDirtyChange={setFormDirty} />
        )}
        {activeModule === 'project' && (
          <ProjectModule onBack={() => setActiveModule('none')} isDemo={isDemo} />
        )}
        {activeModule === 'purchase' && (
          <PurchaseModule onBack={() => setActiveModule('none')} isDemo={isDemo} />
        )}
      </div>

      {/* Bottom Navigation — hidden when a module is open (full-screen drill-down) */}
      {activeModule === 'none' && (
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
              <span className="text-[11px] font-semibold">{label}</span>
              {currentScreen === key && (
                <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
        </nav>
      )}

      {/* Unsaved Changes Dialog */}
      {showDirtyDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDirtyDialog(false)} />
          <div className="relative bg-card rounded-2xl p-6 max-w-sm w-full border border-border shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Unsaved Changes</h3>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              You have unsaved form data. Going back will discard all changes.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowDirtyDialog(false)}
                className="h-10 px-5 rounded-xl bg-card border border-border text-sm font-semibold text-foreground active:scale-[0.98] transition-all cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={confirmDiscard}
                className="h-10 px-5 rounded-xl bg-destructive text-white text-sm font-semibold flex items-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit Confirmation Dialog */}
      {showExitDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6" onClick={() => setShowExitDialog(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-card rounded-2xl p-6 max-w-sm w-full border border-border shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <LogOut className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Exit App?</h3>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to leave the app?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowExitDialog(false)}
                className="h-10 px-5 rounded-xl bg-card border border-border text-sm font-semibold text-muted-foreground active:scale-[0.98] transition-all cursor-pointer"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={() => window.close()}
                className="h-10 px-5 rounded-xl bg-destructive text-white text-sm font-semibold flex items-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

