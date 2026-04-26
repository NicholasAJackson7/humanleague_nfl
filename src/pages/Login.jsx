import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

export default function Login() {
  const { ready, authenticated, authEnabled, refresh } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  if (ready && !authEnabled) {
    return <Navigate to="/" replace />;
  }
  if (ready && authenticated) {
    return <Navigate to={from === '/login' ? '/' : from} replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
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

  return (
    <div className="page" style={{ maxWidth: 420, margin: '0 auto', paddingTop: 24 }}>
      <header className="page-header">
        <span className="eyebrow">Human League</span>
        <h1>Sign in</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Enter the shared site password your commissioner set on the host.
        </p>
      </header>

      <form className="card" onSubmit={onSubmit} style={{ marginTop: 20 }}>
        <label style={{ display: 'block', marginBottom: 8, fontSize: 14 }} htmlFor="site-password">
          Password
        </label>
        <input
          id="site-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
          required
        />
        {error ? (
          <p className="muted" style={{ color: 'var(--color-danger, #f87171)', marginTop: 12, marginBottom: 0 }}>
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="btn btn-primary"
          style={{ marginTop: 16, width: '100%' }}
          disabled={submitting}
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
