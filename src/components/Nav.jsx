import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import './Nav.css';

const items = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/stats', label: 'Stats', icon: StatsIcon },
  { to: '/h2h', label: 'H2H', icon: H2HIcon },
  { to: '/rules', label: 'Rules', icon: RulesIcon },
];

export default function Nav() {
  const { authEnabled, authenticated, devBypass, refresh } = useAuth();
  const navigate = useNavigate();
  const showLogout = authEnabled && authenticated && !devBypass;

  async function onLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      await refresh();
      navigate('/login', { replace: true });
    }
  }

  return (
    <nav className={'bottom-nav' + (showLogout ? ' bottom-nav--auth' : '')} aria-label="Primary">
      <ul>
        {items.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}
            >
              <Icon />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
        {showLogout && (
          <li>
            <button type="button" className="tab tab-logout" onClick={onLogout}>
              <LogoutIcon />
              <span>Log out</span>
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

function StatsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="20" x2="4" y2="10" />
      <line x1="10" y1="20" x2="10" y2="4" />
      <line x1="16" y1="20" x2="16" y2="14" />
      <line x1="22" y1="20" x2="22" y2="8" />
    </svg>
  );
}

function H2HIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="9" r="3.5" />
      <circle cx="16" cy="9" r="3.5" />
      <path d="M4 20c.8-3 3.5-5 8-5s7.2 2 8 5" />
    </svg>
  );
}

function RulesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 4h9l4 4v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M14 4v5h5" />
      <path d="M9 14h6" />
      <path d="M9 18h4" />
    </svg>
  );
}
