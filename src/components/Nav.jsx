import React from 'react';
import { NavLink } from 'react-router-dom';
import './Nav.css';

const items = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/stats', label: 'Stats', icon: StatsIcon },
  { to: '/h2h', label: 'H2H', icon: H2HIcon },
  { to: '/rules', label: 'Rules', icon: RulesIcon },
];

export default function Nav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
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
      </ul>
    </nav>
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
