import { useState, useCallback, useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { useAuth } from '../contexts/AuthContext';

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

const icons: Record<string, ReactElement> = {
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  fileText: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  truck: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  help: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  menu: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  logout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

export default function QuickAccessBar({ onNewQuote, onNewDC, onHelp, onLogout, onMenuToggle, organisation, sidebarCollapsed }: QuickAccessBarProps) {
  const { user } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [showDropdown]);

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const userEmail = user?.email || '';
  const userRole = organisation?.id ? 'Admin' : '—';

  return (
    <header className={`quick-access-bar${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <div className="quick-access-left">
        <button className="quick-tool-btn menu-btn" onClick={onMenuToggle} title="Menu">
          {icons.menu}
        </button>
        <span className="quick-bar-divider" />
        <button className="quick-tool-btn" onClick={onNewQuote} title="Create New Quote">
          {icons.fileText}
          New Quote
        </button>
        <button className="quick-tool-btn" onClick={onNewDC} title="Create New Delivery Challan">
          {icons.truck}
          New DC
        </button>
      </div>

      <div className="quick-access-right">
        <button className="quick-tool-btn" onClick={onHelp} title="Help">
          {icons.help}
          Help
        </button>
        <span className="quick-bar-divider" />
        <div className="user-menu" ref={dropdownRef}>
          <button
            className="user-profile-compact"
            onClick={() => setShowDropdown(prev => !prev)}
            aria-expanded={showDropdown}
            aria-haspopup="true"
          >
            <div className="user-avatar-compact">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="user-info-compact">
              <span className="user-name-compact">{displayName}</span>
              <span className="user-role-compact">RBAC: {userRole}</span>
            </div>
          </button>

          {showDropdown && (
            <div className="user-dropdown">
              <div className="user-dropdown-header">
                <div className="user-dropdown-avatar">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="user-dropdown-name">{displayName}</div>
                  <div className="user-dropdown-email">{userEmail}</div>
                  <div className="user-dropdown-role">RBAC: {userRole}</div>
                </div>
              </div>
              <div className="user-dropdown-divider" />
              <button className="user-dropdown-item" onClick={onLogout}>
                {icons.logout}
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
