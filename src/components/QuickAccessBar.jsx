import { useState } from 'react';

const icons = {
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  download: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  logo: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  logout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  user: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  building: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><line x1="8" y1="6" x2="8" y2="6"/><line x1="16" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/></svg>
};

export default function QuickAccessBar({ onQuickAction, organisation, onLogout }) {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <header className="quick-access-bar">
      <div className="logo">
        {icons.logo}
        <span>MEP Projects</span>
      </div>
      
      <div className="quick-access-actions" style={{ marginLeft: 'auto', marginRight: '20px' }}>
        <button className="quick-btn" onClick={() => onQuickAction('daily-updates')}>
          Daily Updates
        </button>
        <button className="quick-btn" onClick={() => onQuickAction('approvals')}>
          Approvals
        </button>
        <button className="quick-btn" onClick={() => onQuickAction('new-dc')}>
          Create DC
        </button>
        <button className="quick-btn" onClick={() => onQuickAction('remind')}>
          Remind
        </button>
      </div>

      <div className="user-menu">
        <button 
          className="user-button"
          onClick={() => setShowDropdown(!showDropdown)}
        >
          <div className="user-avatar">
            {organisation?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <span style={{ fontSize: '13px', fontWeight: 500 }}>
            {organisation?.name || 'Organisation'}
          </span>
        </button>

        {showDropdown && (
          <div className="user-dropdown">
            <div className="user-dropdown-item" style={{ cursor: 'default', color: 'var(--text-secondary)' }}>
              {icons.building}
              <span>{organisation?.name}</span>
            </div>
            <div className="user-dropdown-divider" />
            <a href="#/settings" className="user-dropdown-item" onClick={() => setShowDropdown(false)}>
              {icons.settings}
              <span>Settings</span>
            </a>
            <div className="user-dropdown-divider" />
            <div className="user-dropdown-item" onClick={() => { onLogout(); setShowDropdown(false); }}>
              {icons.logout}
              <span>Sign Out</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
