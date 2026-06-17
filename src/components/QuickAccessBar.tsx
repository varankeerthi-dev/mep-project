import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

type OrganisationSummary = {
  name?: string | null;
  id?: string;
};

type QuickAccessBarProps = {
  onNewQuote: () => void;
  onNewDC: () => void;
  onHelp: () => void;
  onLogout: () => void | Promise<void>;
  onMenuToggle: () => void;
  organisation?: OrganisationSummary | null;
  sidebarCollapsed?: boolean;
};

export default function QuickAccessBar({
  onNewQuote,
  onNewDC,
  onHelp,
  onLogout,
  onMenuToggle,
  organisation,
  sidebarCollapsed,
}: QuickAccessBarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const createRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Fetch pending approvals count
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['pending-approvals-count', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return 0;
      const { count } = await supabase
        .from('approvals')
        .select('*', { count: 'exact', head: true })
        .eq('organisation_id', organisation.id)
        .eq('status', 'PENDING');
      return count || 0;
    },
    enabled: !!organisation?.id,
    refetchInterval: 30000,
  });

  // Click outside handlers
  useEffect(() => {
    if (!showCreateMenu && !showUserMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (createRef.current && !createRef.current.contains(e.target as Node)) setShowCreateMenu(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handleClick, true);
    return () => document.removeEventListener('mousedown', handleClick, true);
  }, [showCreateMenu, showUserMenu]);

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const userEmail = user?.email || '';
  const initials = displayName.charAt(0).toUpperCase();

  const createItems = [
    { label: 'New Quotation', path: '/quotation/create', color: '#2563eb' },
    { label: 'New DC', path: '/dc/create', color: '#059669' },
    { label: 'New Client', path: '/clients/new', color: '#7c3aed' },
    { label: 'New Invoice', path: '/invoices/create', color: '#d97706' },
    { label: 'New Purchase Order', path: '/purchase/orders', color: '#dc2626' },
  ];

  const handleCreateClick = (path: string) => {
    setShowCreateMenu(false);
    navigate(path);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/clients?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setSearchFocused(false);
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <header className={`quick-access-bar${sidebarCollapsed ? ' sidebar-collapsed' : ''}`} data-tour-anchor="quick-access-bar">
      {/* LEFT: Menu + Quick Create + Approvals */}
      <div className="quick-access-left">
        <button
          className="quick-tool-btn menu-btn"
          onClick={onMenuToggle}
          title="Toggle Menu"
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="quick-bar-divider" />

        {/* Quick Create */}
        <div
          ref={createRef}
          style={{ position: 'relative' }}
          onMouseEnter={() => setShowCreateMenu(true)}
          onMouseLeave={() => setShowCreateMenu(false)}
        >
          <button
            className="quick-tool-btn"
            onClick={() => setShowCreateMenu(prev => !prev)}
            title="Quick Create"
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '2px 8px', height: '24px',
              background: showCreateMenu ? '#f3f4f6' : 'transparent',
              border: 'none', borderRadius: '4px', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '11px', fontWeight: 400,
              color: '#111827', transition: 'background 0.15s',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10" style={{ opacity: 0.5 }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showCreateMenu && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: '4px',
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)',
              padding: '4px', minWidth: '200px', zIndex: 100,
              animation: 'dropdownFadeIn 0.15s ease',
            }}>
              <style>{`@keyframes dropdownFadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
              {createItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleCreateClick(item.path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    width: '100%', padding: '6px 10px', border: 'none',
                    background: 'transparent', borderRadius: '6px', cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: '12px', color: '#374151',
                    textAlign: 'left', transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: item.color, flexShrink: 0,
                  }} />
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* New Material */}
        <button
          className="quick-tool-btn"
          onClick={() => navigate('/store/materials?add=true')}
          title="New Material"
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
          New Material
        </button>

        {/* Manufacturing */}
        <button
          className="quick-tool-btn"
          onClick={() => navigate('/manufacturing')}
          title="Manufacturing"
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
          Manufacturing
        </button>

        <span className="quick-bar-divider" />

        {/* Approvals */}
        <button
          className="quick-tool-btn"
          onClick={() => navigate('/approvals')}
          title="Approvals"
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          style={{ position: 'relative' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          Approvals
          {pendingCount > 0 && (
            <span style={{
              position: 'absolute', top: '-2px', right: '-4px',
              minWidth: '14px', height: '14px', padding: '0 3px',
              borderRadius: '7px', background: '#ef4444', color: '#fff',
              fontSize: '9px', fontWeight: 600, lineHeight: '14px',
              textAlign: 'center', pointerEvents: 'none',
            }}>
              {pendingCount > 99 ? '99+' : pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* CENTER: Global Search */}
      <div style={{
        flex: 1, maxWidth: '420px', margin: '0 16px',
        position: 'relative',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '0 10px', height: '24px', borderRadius: '6px',
          background: searchFocused ? '#fff' : '#f9fafb',
          border: `1px solid ${searchFocused ? '#d1d5db' : '#f0f0f0'}`,
          transition: 'all 0.2s',
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" style={{ color: '#9ca3af', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search clients, projects, materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onKeyDown={handleSearchKeyDown}
            style={{
              border: 'none', background: 'transparent', outline: 'none',
              fontSize: '11.5px', color: '#374151', width: '100%',
              fontFamily: 'inherit', fontWeight: 300,
            }}
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); }}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                display: 'flex', alignItems: 'center', color: '#9ca3af',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* RIGHT: Org + Help + User */}
      <div className="quick-access-right">
        {/* Org name */}
        {organisation?.name && (
          <span style={{
            fontSize: '11px', fontWeight: 500, color: '#6b7280',
            maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', padding: '2px 6px',
          }}>
            {organisation.name}
          </span>
        )}

        <button
          className="quick-tool-btn"
          onClick={() => navigate('/settings')}
          title="Settings"
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        <button
          className="quick-tool-btn"
          onClick={onHelp}
          title="Help"
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
            <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>

        <span className="quick-bar-divider" />

        {/* User Menu */}
        <div ref={userRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowUserMenu(prev => !prev)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '2px 6px', height: '24px', background: 'transparent',
              border: 'none', borderRadius: '4px', cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{
              width: '18px', height: '18px', borderRadius: '50%',
              background: '#171717', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '9px', fontWeight: 600,
            }}>
              {initials}
            </div>
            <span style={{ fontSize: '11px', color: '#374151', fontWeight: 400 }}>
              {displayName}
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10" style={{ color: '#9ca3af' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showUserMenu && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: '4px',
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)',
              padding: '4px', minWidth: '200px', zIndex: 100,
              animation: 'dropdownFadeIn 0.15s ease',
            }}>
              <div style={{
                padding: '8px 10px', borderBottom: '1px solid #f3f4f6',
              }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{displayName}</div>
                <div style={{ fontSize: '10.5px', color: '#6b7280', marginTop: '1px' }}>{userEmail}</div>
              </div>
              <button
                onClick={() => { setShowUserMenu(false); navigate('/settings'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  width: '100%', padding: '6px 10px', border: 'none',
                  background: 'transparent', borderRadius: '6px', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: '12px', color: '#374151',
                  textAlign: 'left', transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                  <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Settings
              </button>
              <button
                onClick={() => { setShowUserMenu(false); onLogout(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  width: '100%', padding: '6px 10px', border: 'none',
                  background: 'transparent', borderRadius: '6px', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: '12px', color: '#ef4444',
                  textAlign: 'left', transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
