import { useState, useCallback, useEffect, useRef } from 'react';
import type { ReactElement } from 'react';

type OrganisationSummary = {
  name?: string | null;
  id?: string;
};

type QuickAction =
  | 'daily-updates'
  | 'approvals'
  | 'new-dc'
  | 'remind'
  | 'search'
  | 'export';

type QuickAccessBarProps = {
  onQuickAction: (action: QuickAction) => void;
  organisation?: OrganisationSummary | null;
  onLogout: () => void | Promise<void>;
  onMenuToggle: () => void;
  onNavigate?: (path: string) => void;
};

const icons: Record<string, ReactElement> = {
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  download: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  bell: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  logout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  user: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  building: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><line x1="8" y1="6" x2="8" y2="6"/><line x1="16" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/></svg>,
  calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
  file: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  menu: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
};

export default function QuickAccessBar({ onQuickAction, organisation, onLogout, onMenuToggle }: QuickAccessBarProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside — fixes unresponsive dropdown after inactivity
  useEffect(() => {
    if (!showDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    // Use capture phase so it fires before any stopped-propagation handlers
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [showDropdown]);

  const handleQuickAction = useCallback((action: QuickAction) => {
    onQuickAction(action);
  }, [onQuickAction]);

  const toggleDropdown = useCallback(() => {
    setShowDropdown(prev => !prev);
  }, []);

  const handleSettingsClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setShowDropdown(false);
    // Use react-router navigation instead of manual pushState hack
    window.history.pushState({}, '', '/settings');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  const handleLogoutClick = useCallback(() => {
    onLogout();
    setShowDropdown(false);
  }, [onLogout]);

  return (
    <header className="quick-access-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button className="mobile-menu-btn" onClick={onMenuToggle}>
          {icons.menu}
        </button>
        <div className="logo">
          <div className="logo-icon">D</div>
          <span className="logo-text">DOT ERP</span>
        </div>
      </div>
      
      <div className="top-navbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button className="top-nav-btn" onClick={handleQuickAction.bind(null, 'daily-updates')}>
          {icons.calendar}
          Daily Updates
        </button>
        <button className="top-nav-btn" onClick={handleQuickAction.bind(null, 'approvals')}>
          {icons.check}
          Approvals
        </button>
        <button className="top-nav-btn primary" onClick={handleQuickAction.bind(null, 'new-dc')}>
          {icons.plus}
          Create DC
        </button>
        <button className="top-nav-btn" onClick={handleQuickAction.bind(null, 'remind')}>
          {icons.clock}
          Remind
        </button>
      </div>

      <div className="user-menu" style={{ display: 'flex', alignItems: 'center', gap: '4px' }} ref={dropdownRef}>
        <button 
          className="user-profile"
          onClick={toggleDropdown}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
          aria-expanded={showDropdown}
          aria-haspopup="true"
        >
          <div className="user-profile-avatar" style={{ width: '20px', height: '20px', fontSize: '9px' }}>
            {organisation?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <span className="user-profile-name" style={{ fontSize: '11px' }}>
            Profile
          </span>
        </button>

        <button 
          className="top-nav-btn"
          onClick={handleLogoutClick}
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          {icons.logout}
          Logout
        </button>

        {showDropdown && (
          <div className="user-dropdown">
            <div className="user-dropdown-item" style={{ cursor: 'default', color: 'var(--text-secondary)', fontSize: '12px' }}>
              {icons.building}
              <span>{organisation?.name}</span>
            </div>
            {organisation?.id && (
              <>
                <div className="user-dropdown-divider" />
                <div 
                  className="user-dropdown-item" 
                  style={{ cursor: 'pointer', fontSize: '8px' }}
                  onClick={() => {
                    navigator.clipboard.writeText(organisation?.id || '');
                  }}
                  title="Click to copy Organisation ID"
                >
                  {icons.file}
                  <span style={{ flex: 1 }}>Org ID: {organisation?.id}</span>
                </div>
              </>
            )}
            <div className="user-dropdown-divider" />
            <a href="/settings" className="user-dropdown-item" onClick={handleSettingsClick}>
              {icons.settings}
              <span>Settings</span>
            </a>
          </div>
        )}
      </div>
    </header>
  );
}
