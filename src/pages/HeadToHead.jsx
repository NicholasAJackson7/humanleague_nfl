import React, { useEffect, useMemo, useState } from 'react';
import { config } from '../config.js';
import { fetchLeagueHistoryBundles } from '../lib/sleeper.js';
import {
  collectAllOwnersFromBundles,
  computeHeadToHeadRecords,
  listH2hGamesBetweenUsers,
  summarizeH2hGames,
} from '../lib/h2h.js';

export default function HeadToHead() {
  const [state, setState] = useState({ status: 'loading' });
  const [managerA, setManagerA] = useState('');
  const [managerB, setManagerB] = useState('');

  async function load({ force = false } = {}) {
    setState({ status: 'loading' });
    if (!config.leagueId) {
      setState({ status: 'no-config' });
      return;
    }
    try {
      const entries = await fetchLeagueHistoryBundles(config.leagueId, { force });
      if (!entries.length) {
        setState({ status: 'no-data' });
        return;
      }
      const bundles = entries.map((e) => e.bundle);
      const usersById = collectAllOwnersFromBundles(bundles);
      const seasons = [...new Set(entries.map((e) => String(e.season)))].sort(
        (a, b) => Number(a) - Number(b)
      );
      setState({
        status: 'ready',
        bundles,
        usersById,
        seasonCount: entries.length,
        seasonsLabel:
          seasons.length > 1
            ? `${seasons[0]}–${seasons[seasons.length - 1]}`
            : seasons[0] || '',
      });
    } catch (err) {
      setState({ status: 'error', error: err.message || String(err) });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const userOptions = useMemo(() => {
    if (state.status !== 'ready') return [];
    return Object.keys(state.usersById)
      .map((id) => ({
        id,
        label: state.usersById[id]?.displayName || id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [state]);

  const games = useMemo(() => {
    if (state.status !== 'ready' || !managerA || !managerB || managerA === managerB) {
      return [];
    }
    return listH2hGamesBetweenUsers(state.bundles, managerA, managerB);
  }, [state, managerA, managerB]);

  const summary = useMemo(() => {
    if (!games.length || !managerA || !managerB) return null;
    return summarizeH2hGames(games, managerA, managerB);
  }, [games, managerA, managerB]);

  const gamesBySeason = useMemo(() => {
    const map = new Map();
    for (const g of games) {
      if (!map.has(g.season)) map.set(g.season, []);
      map.get(g.season).push(g);
    }
    return [...map.entries()].sort((a, b) => Number(b[0]) - Number(a[0]));
  }, [games]);

  const leagueWide = useMemo(() => {
    if (state.status !== 'ready') return { regular: [], playoff: [] };
    const reg = computeHeadToHeadRecords(state.bundles, { scope: 'regular' });
    const po = computeHeadToHeadRecords(state.bundles, { scope: 'playoff' });
    return { regular: reg.rows, playoff: po.rows };
  }, [state]);

  function onPickA(id) {
    setManagerA(id);
    if (id && id === managerB) setManagerB('');
  }

  function onPickB(id) {
    setManagerB(id);
    if (id && id === managerA) setManagerA('');
  }

  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">Matchups</span>
        <h1>Head-to-head</h1>
        <p className="muted">
          {state.status === 'ready'
            ? `Pick two managers for a game-by-game log across ${state.seasonCount} linked season${
                state.seasonCount === 1 ? '' : 's'
              } (${state.seasonsLabel}).`
            : 'Compare any two owners across your league’s Sleeper history.'}
        </p>
      </header>

      {state.status === 'no-config' && (
        <div className="card">
          <h3>League id not set</h3>
          <p className="muted">Set <code>VITE_SLEEPER_LEAGUE_ID</code> and reload.</p>
        </div>
      )}

      {state.status === 'no-data' && (
        <div className="card">
          <h3>No leagues loaded</h3>
          <p className="muted">Could not resolve a league history for this id.</p>
        </div>
      )}

      {state.status === 'loading' && (
        <>
          <div className="skeleton" style={{ height: 24, width: '50%' }} />
          <div className="skeleton" style={{ height: 200, marginTop: 16 }} />
        </>
      )}

      {state.status === 'error' && (
        <div className="card">
          <h3>Could not load</h3>
          <p className="muted">{state.error}</p>
          <button type="button" className="btn" onClick={() => load({ force: true })}>
            Try again
          </button>
        </div>
      )}

      {state.status === 'ready' && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Compare managers</h3>
            <div
              className="h2h-pickers"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                alignItems: 'end',
              }}
            >
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="dim">Manager A</span>
                <select
                  className="h2h-select"
                  value={managerA}
                  onChange={(e) => onPickA(e.target.value)}
                >
                  <option value="">Select…</option>
                  {userOptions.map((u) => (
                    <option key={u.id} value={u.id} disabled={u.id === managerB}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="dim">Manager B</span>
                <select
                  className="h2h-select"
                  value={managerB}
                  onChange={(e) => onPickB(e.target.value)}
                >
                  <option value="">Select…</option>
                  {userOptions.map((u) => (
                    <option key={u.id} value={u.id} disabled={u.id === managerA}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <style>{`
              @media (max-width: 520px) {
                .h2h-pickers { grid-template-columns: 1fr !important; }
              }
              .h2h-select {
                width: 100%;
                padding: 10px 12px;
                border-radius: var(--radius-md, 8px);
                border: 1px solid var(--color-border);
                background: var(--color-surface, #0f172a);
                color: var(--color-text, #e2e8f0);
                font-size: 15px;
              }
            `}</style>
            <div className="row" style={{ marginTop: 14, flexWrap: 'wrap', gap: 8 }}>
              <span className="dim" style={{ marginRight: 'auto' }}>Cached locally</span>
              <button type="button" className="btn btn-ghost" onClick={() => load({ force: true })}>
                Refresh data
              </button>
            </div>
          </div>

          {!managerA || !managerB ? (
            <div className="card">
              <p className="muted" style={{ margin: 0 }}>
                Choose <strong>Manager A</strong> and <strong>Manager B</strong> to load every head-to-head
                week between them: season, regular vs playoffs, week, optional winners-bracket round (when
                Sleeper lists that matchup in the bracket feed), scores, and who won.
              </p>
            </div>
          ) : managerA === managerB ? (
            <div className="card">
              <p className="muted">Pick two different managers.</p>
            </div>
          ) : !games.length ? (
            <div className="card">
              <p className="muted">
                No Sleeper weeks found where these two managers were paired in the same matchup.
              </p>
            </div>
          ) : (
            <>
              <H2hSummary
                summary={summary}
                metaA={state.usersById[managerA]}
                metaB={state.usersById[managerB]}
                idA={managerA}
                idB={managerB}
              />
              <section className="card" style={{ marginTop: 16 }}>
                <h3 style={{ marginTop: 0, marginBottom: 12 }}>Every meeting ({games.length} games)</h3>
                <p className="muted" style={{ marginTop: 0, marginBottom: 12, fontSize: '0.95em' }}>
                  Newest first. Scores in the <strong>A</strong> / <strong>B</strong> columns follow your
                  picker order above. Margin is A minus B (positive means A outscored B that week).
                </p>
                <div className="scroll-x">
                  <table className="h2h-detail-table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Bracket</th>
                        <th style={{ textAlign: 'right' }}>A PF</th>
                        <th style={{ textAlign: 'right' }}>B PF</th>
                        <th style={{ textAlign: 'right' }}>Margin (A−B)</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    {gamesBySeason.map(([season, rows]) => (
                      <tbody key={season}>
                        <tr className="h2h-season-row">
                          <td colSpan={6}>
                            <strong>{season}</strong>
                            {rows[0]?.leagueName ? (
                              <span className="muted"> · {rows[0].leagueName}</span>
                            ) : null}
                          </td>
                        </tr>
                        {rows.map((g, idx) => (
                          <tr key={`${g.season}-${g.week}-${g.phase}-${idx}`}>
                            <td>{g.moniker}</td>
                            <td className="muted" style={{ fontSize: '0.92em', whiteSpace: 'nowrap' }}>
                              {g.phase === 'playoff' && g.bracketRound != null
                                ? `Winners · Rd ${g.bracketRound}`
                                : g.phase === 'playoff'
                                  ? '—'
                                  : '—'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{g.scoreA.toFixed(2)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{g.scoreB.toFixed(2)}</td>
                            <td
                              style={{
                                textAlign: 'right',
                                fontVariantNumeric: 'tabular-nums',
                                color:
                                  g.margin > 0
                                    ? 'var(--color-accent, #38bdf8)'
                                    : g.margin < 0
                                      ? '#f472b6'
                                      : undefined,
                              }}
                            >
                              {g.margin > 0 ? '+' : ''}
                              {g.margin.toFixed(2)}
                            </td>
                            <td>
                              {g.winnerUserId === managerA ? (
                                <span style={{ fontWeight: 600 }}>A wins</span>
                              ) : g.winnerUserId === managerB ? (
                                <span style={{ fontWeight: 600 }}>B wins</span>
                              ) : (
                                <span className="muted">Tie</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    ))}
                  </table>
                </div>
                <style>{`
                  .h2h-detail-table { width: 100%; border-collapse: collapse; }
                  .h2h-detail-table th {
                    text-align: left;
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    color: var(--color-text-dim, #94a3b8);
                    padding: 8px 10px;
                    border-bottom: 1px solid var(--color-border);
                  }
                  .h2h-detail-table td { padding: 10px; vertical-align: middle; }
                  .h2h-season-row td {
                    background: rgba(56, 189, 248, 0.06);
                    border-top: 1px solid var(--color-border);
                    padding-top: 12px;
                    padding-bottom: 8px;
                  }
                `}</style>
              </section>
            </>
          )}

          <details className="card" style={{ marginTop: 20 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>League-wide series tables</summary>
            <p className="muted" style={{ marginTop: 8 }}>
              Aggregated W–L–T across all pairs (not filtered by the two managers above).
            </p>
            <h4 style={{ marginBottom: 8 }}>Regular season</h4>
            {!leagueWide.regular.length ? (
              <p className="muted">No rows.</p>
            ) : (
              <H2hTable rows={leagueWide.regular} usersById={state.usersById} />
            )}
            <h4 style={{ marginTop: 16, marginBottom: 8 }}>Playoffs</h4>
            {!leagueWide.playoff.length ? (
              <p className="muted">No rows.</p>
            ) : (
              <H2hTable rows={leagueWide.playoff} usersById={state.usersById} />
            )}
          </details>
        </>
      )}
    </div>
  );
}

function H2hSummary({ summary, metaA, metaB, idA, idB }) {
  if (!summary) return null;
  const nameA = metaA?.displayName || idA;
  const nameB = metaB?.displayName || idB;
  return (
    <div className="card-grid" style={{ marginBottom: 4 }}>
      <StatCard
        title="Series record"
        primary={`${summary.winsA}–${summary.winsB}${summary.ties ? `–${summary.ties}` : ''}`}
        secondary={`${nameA} vs ${nameB}`}
      />
      <StatCard
        title="Total points"
        primary={`${summary.pfA.toFixed(1)} / ${summary.pfB.toFixed(1)}`}
        secondary="Sum of every listed game"
      />
      <StatCard
        title="Avg per game"
        primary={`${summary.avgA.toFixed(1)} / ${summary.avgB.toFixed(1)}`}
        secondary={`${summary.games} game${summary.games === 1 ? '' : 's'}`}
      />
      <StatCard
        title="Games by phase"
        primary={`${summary.regGames} reg · ${summary.poGames} post`}
        secondary="Regular vs playoff weeks"
      />
    </div>
  );
}

function StatCard({ title, primary, secondary }) {
  return (
    <div className="card">
      <div className="dim" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 11 }}>
        {title}
      </div>
      <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, marginTop: 4 }}>{primary}</div>
      {secondary && <div className="muted" style={{ marginTop: 4 }}>{secondary}</div>}
    </div>
  );
}

function H2hTable({ rows, usersById }) {
  return (
    <section className="card" style={{ marginTop: 8 }}>
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>Manager A</th>
              <th>Record (A–B–T)</th>
              <th>Manager B</th>
              <th>Games</th>
              <th>Avg PF</th>
              <th>Total PF</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.userA}-${r.userB}`}>
                <td>
                  <ManagerCell
                    userId={r.userA}
                    meta={usersById[r.userA]}
                    strong={r.winsA > r.winsB}
                  />
                </td>
                <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {r.winsA}–{r.winsB}
                  {r.ties ? `–${r.ties}` : ''}
                </td>
                <td>
                  <ManagerCell
                    userId={r.userB}
                    meta={usersById[r.userB]}
                    strong={r.winsB > r.winsA}
                  />
                </td>
                <td>{r.games}</td>
                <td className="muted" style={{ fontSize: '0.92em', whiteSpace: 'nowrap' }}>
                  {r.avgA.toFixed(1)} / {r.avgB.toFixed(1)}
                </td>
                <td className="muted" style={{ fontSize: '0.92em', whiteSpace: 'nowrap' }}>
                  {r.pfA.toFixed(1)} / {r.pfB.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ManagerCell({ userId, meta, strong }) {
  const name = meta?.displayName || userId;
  return (
    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
      {meta?.avatar ? (
        <img src={meta.avatar} alt="" width="24" height="24" style={{ borderRadius: '50%' }} />
      ) : (
        <span style={{ width: 24, height: 24, display: 'inline-block' }} />
      )}
      <span className="truncate" style={{ maxWidth: 140, fontWeight: strong ? 700 : 500 }} title={userId}>
        {name}
      </span>
    </div>
  );
}
