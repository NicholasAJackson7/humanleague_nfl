import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { config } from '../config.js';
import { fetchLeague, fetchUsers, fetchRosters, avatarUrl } from '../lib/sleeper.js';
import { fetchHallOfFame } from '../lib/hallOfFame.js';
import './Home.css';

export default function Home() {
  const [state, setState] = useState({ status: 'loading' });
  const [hof, setHof] = useState({ status: 'idle' });

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

  useEffect(() => {
    if (!config.leagueId) return;
    let cancelled = false;
    setHof({ status: 'loading' });
    fetchHallOfFame(config.leagueId)
      .then((rows) => {
        if (!cancelled) setHof({ status: 'ready', rows });
      })
      .catch((err) => {
        if (!cancelled) setHof({ status: 'error', message: err.message || String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      <header className="card home-banner">
        <img
          className="home-banner__logo"
          src="/icons/icon-192.svg"
          width="192"
          height="192"
          alt=""
          decoding="async"
        />
        <div className="home-banner__text">
          <span className="eyebrow">Fantasy Dashboard</span>
          <h1 className="home-banner__title">{state.league?.name || 'Your league'}</h1>
        </div>
      </header>

      {config.leagueId && hof.status === 'loading' && (
        <div className="card" style={{ marginBottom: 16 }} aria-busy="true">
          <div className="skeleton" style={{ height: 20, width: '35%', marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 56, width: '100%' }} />
        </div>
      )}
      {config.leagueId && hof.status === 'ready' && hof.rows?.length > 0 && (
        <HallOfFame rows={hof.rows} />
      )}
      {config.leagueId && hof.status === 'error' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p className="muted" style={{ margin: 0 }}>
            Could not load Hall of Fame: {hof.message}
          </p>
        </div>
      )}

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
        <FeatureLink to="/stats" title="League stats" body="Standings, highlights, all-time totals, head-to-head — all in one place." />
        <FeatureLink to="/rules" title="Rule suggestions" body="Suggest a rule and vote on what should change next season." />
      </div>
    </div>
  );
}

function HallOfFame({ rows }) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="row" style={{ marginBottom: 12, alignItems: 'baseline', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Hall of Fame</h2>
        <span className="dim" style={{ fontSize: 13 }}>Playoff champions by season</span>
      </div>
      <div className="scroll-x">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-dim)' }}>
                Season
              </th>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-dim)' }}>
                Champion
              </th>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-dim)' }}>
                Runner-up
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.season} style={{ borderTop: '1px solid var(--color-border)' }}>
                <td style={{ padding: '12px 10px', fontWeight: 700, whiteSpace: 'nowrap' }}>{r.season}</td>
                <td style={{ padding: '12px 10px' }}>
                  <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                    {r.champion.avatar ? (
                      <img src={r.champion.avatar} alt="" width="28" height="28" style={{ borderRadius: '50%' }} />
                    ) : (
                      <span style={{ width: 28, height: 28, display: 'inline-block' }} />
                    )}
                    <span className="truncate" style={{ maxWidth: 160 }} title={r.champion.name}>
                      {r.champion.name}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '12px 10px' }}>
                  {r.runnerUp ? (
                    <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                      {r.runnerUp.avatar ? (
                        <img src={r.runnerUp.avatar} alt="" width="28" height="28" style={{ borderRadius: '50%' }} />
                      ) : (
                        <span style={{ width: 28, height: 28, display: 'inline-block' }} />
                      )}
                      <span className="truncate muted" style={{ maxWidth: 160 }} title={r.runnerUp.name}>
                        {r.runnerUp.name}
                      </span>
                    </div>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
