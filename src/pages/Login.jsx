import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import './Login.css';

async function fetchAuthConfig() {
  const res = await fetch('/api/auth/config');
  if (!res.ok) return null;
  return res.json();
}

export default function Login() {
  const { ready, authenticated, authEnabled, refresh } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modes, setModes] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cfg = await fetchAuthConfig();
      if (!cancelled && cfg) setModes(cfg);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (ready && !authEnabled) {
    return <Navigate to="/" replace />;
  }
  if (ready && authenticated) {
    return <Navigate to={from === '/login' ? '/' : from} replace />;
  }

  const userLogin = Boolean(modes?.userAccountsLogin);
  const siteLogin = Boolean(modes?.sitePasswordLogin);
  const usernameRequired = userLogin && !siteLogin;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const u = username.trim();
    try {
      if (usernameRequired && u.length < 2) {
        setError('Enter your username');
        return;
      }
      const body = { password };
      if (u.length >= 2) body.username = u;

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      await refresh();
      navigate(from === '/login' ? '/' : from, { replace: true });
    } catch {
      setError('Could not reach the server. Use `npx vercel dev` locally so /api runs.');
    } finally {
      setSubmitting(false);
    }
  }

  let lead =
    'Sign in to open the league hub. If your deployment uses member accounts, use the username your commissioner gave you.';
  if (modes) {
    if (userLogin && siteLogin) {
      lead =
        'Use your member username and password, or leave username blank and enter the shared league password.';
    } else if (userLogin) {
      lead = 'Use the username and password your commissioner set up for you.';
    } else if (siteLogin) {
      lead = 'Enter the shared league password your commissioner configured on the host.';
    }
  }

  return (
    <div className="page login-page">
      <div className="login-brand" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M12 15v2M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
        </svg>
      </div>
      <header className="page-header">
        <span className="eyebrow">Human League</span>
        <h1>Sign in</h1>
        <p className="muted login-lead">{lead}</p>
      </header>

      <form className="card login-card" onSubmit={onSubmit}>
        {(modes == null || userLogin) && (
          <div className="login-field">
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={submitting}
              required={usernameRequired}
              placeholder={userLogin ? 'e.g. nicho' : 'Optional for shared password'}
            />
            {modes != null && userLogin && siteLogin ? (
              <p className="login-hint">Leave blank if you are using the shared league password instead.</p>
            ) : null}
          </div>
        )}

        <div className="login-field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            required
            minLength={usernameRequired ? 8 : 1}
          />
          {usernameRequired ? <p className="login-hint">At least 8 characters.</p> : null}
        </div>

        {error ? <p className="login-err">{error}</p> : null}

        <button type="submit" className="btn btn-primary login-submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="login-foot">Sessions use a secure cookie on this domain. Use a private device when possible.</p>
    </div>
  );
}
