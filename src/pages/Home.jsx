import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { config } from '../config.js';
import { fetchLeague, fetchUsers, fetchRosters, avatarUrl } from '../lib/sleeper.js';

export default function Home() {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    if (!config.leagueId) {
      setState({ status: 'no-config' });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [league, users, rosters] = await Promise.all([
          fetchLeague(config.leagueId),
          fetchUsers(config.leagueId),
          fetchRosters(config.leagueId),
        ]);
        if (cancelled) return;
        setState({ status: 'ready', league, users, rosters });
      } catch (err) {
        if (cancelled) return;
        setState({ status: 'error', error: err.message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">Fantasy Dashboard</span>
        <h1>{state.league?.name || 'Your league'}</h1>
      </header>

      {state.status === 'no-config' && <NoConfig />}
      {state.status === 'loading' && <LoadingCard />}
      {state.status === 'error' && (
        <div className="card">
          <h3>Could not load league</h3>
          <p className="muted">{state.error}</p>
          <p className="dim">Double check your VITE_SLEEPER_LEAGUE_ID env var.</p>
        </div>
      )}
      {state.status === 'ready' && (
        <Standings league={state.league} users={state.users} rosters={state.rosters} />
      )}

      <div className="card-grid">
        <FeatureLink to="/stats" title="Last season stats" body="Standings, blowouts, bench points and more." />
        <FeatureLink to="/wheel" title="Keeper wheel" body="Going decide keepers with a weighted random spin." />
        <FeatureLink to="/rules" title="Rule suggestions" body="Suggest a rule and vote on what should change next season." />
      </div>
    </div>
  );
}

function NoConfig() {
  return (
    <div className="card">
      <h3>League id not set</h3>
      <p className="muted">
        Set <code>VITE_SLEEPER_LEAGUE_ID</code> in <code>.env</code> (locally) or in your Vercel
        project settings, then redeploy.
      </p>
      <p className="dim">
        You can find your league id in the URL when you view your league on{' '}
        <a href="https://sleeper.app/" target="_blank" rel="noreferrer">sleeper.app</a>.
      </p>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="card" aria-busy="true">
      <div className="skeleton" style={{ height: 22, width: '50%', marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 16, width: '80%', marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 16, width: '70%' }} />
    </div>
  );
}

function Standings({ league, users, rosters }) {
  const userById = Object.fromEntries(users.map((u) => [u.user_id, u]));
  const rows = rosters
    .map((r) => {
      const user = userById[r.owner_id];
      const wins = r.settings?.wins ?? 0;
      const losses = r.settings?.losses ?? 0;
      const ties = r.settings?.ties ?? 0;
      const fpts = (r.settings?.fpts ?? 0) + (r.settings?.fpts_decimal ?? 0) / 100;
      return {
        rosterId: r.roster_id,
        team:
          user?.metadata?.team_name ||
          user?.display_name ||
          `Team ${r.roster_id}`,
        avatar: user?.avatar ? avatarUrl(user.avatar, true) : null,
        wins,
        losses,
        ties,
        fpts,
      };
    })
    .sort((a, b) => b.wins - a.wins || b.fpts - a.fpts);

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Standings</h3>
        <span className="dim" style={{ marginLeft: 'auto' }}>{league.season} · {league.status.replace('_', ' ')}</span>
      </div>
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>W-L-T</th>
              <th>PF</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.rosterId}>
                <td>{i + 1}</td>
                <td>
                  <div className="row" style={{ gap: 10 }}>
                    {row.avatar ? (
                      <img src={row.avatar} alt="" width="22" height="22" style={{ borderRadius: '50%' }} />
                    ) : (
                      <span style={{ width: 22, height: 22, display: 'inline-block' }} />
                    )}
                    <span className="truncate" style={{ maxWidth: 180 }}>{row.team}</span>
                  </div>
                </td>
                <td>{row.wins}-{row.losses}{row.ties ? `-${row.ties}` : ''}</td>
                <td>{row.fpts.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeatureLink({ to, title, body }) {
  return (
    <Link to={to} className="card" style={{ display: 'block', color: 'inherit' }}>
      <h3 style={{ margin: '0 0 6px' }}>{title}</h3>
      <p className="muted" style={{ margin: 0 }}>{body}</p>
    </Link>
  );
}
