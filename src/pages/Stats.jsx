import React, { useEffect, useState } from 'react';
import { config } from '../config.js';
import { fetchLeagueHistoryBundles } from '../lib/sleeper.js';
import { computeStats, computeCareerByUser } from '../lib/stats.js';

export default function Stats() {
  const [state, setState] = useState({ status: 'loading' });
  const [tab, setTab] = useState('latest');

  async function load({ force = false } = {}) {
    setState({ status: 'loading' });
    if (!config.leagueId) {
      setState({ status: 'no-config' });
      return;
    }
    try {
      const entries = await fetchLeagueHistoryBundles(config.leagueId, { force });
      if (!entries.length) {
        setState({ status: 'no-prev' });
        return;
      }

      const seasonStats = entries.map((e) => ({
        season: e.season,
        leagueId: e.leagueId,
        name: e.name,
        stats: computeStats(e.bundle),
      }));

      if (!seasonStats.length) {
        setState({ status: 'error', error: 'No season data could be loaded.' });
        return;
      }

      const latestStats = seasonStats[0].stats;
      const career = computeCareerByUser(seasonStats);
      const seasonsLabel =
        career.seasons.length > 1
          ? `${career.seasons[0]}–${career.seasons[career.seasons.length - 1]}`
          : career.seasons[0] || '';
      setState({
        status: 'ready',
        latestStats,
        career,
        seasonCount: entries.length,
        seasonsLabel,
      });
    } catch (err) {
      setState({ status: 'error', error: err.message || String(err) });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = state.latestStats;

  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">League history</span>
        <h1>{stats?.league?.name || 'League stats'}</h1>
        <p className="muted">
          {state.status === 'ready' && stats
            ? (() => {
                const regW = stats.weeksTracked.length;
                const poW = stats.playoff?.weeksTracked?.length || 0;
                const poBit =
                  poW > 0 ? ` · ${poW} playoff week${poW === 1 ? '' : 's'}` : '';
                return state.seasonCount > 1
                  ? `Latest on record: ${stats.league.season} · ${state.seasonCount} linked seasons (${state.seasonsLabel}) · ${regW} regular-season weeks${poBit}`
                  : `${stats.league.season} season · ${regW} regular-season weeks${poBit}`;
              })()
            : 'Standings, scoring, and career totals across linked Sleeper seasons.'}
        </p>
      </header>

      {state.status === 'no-config' && (
        <div className="card">
          <h3>League id not set</h3>
          <p className="muted">Set <code>VITE_SLEEPER_LEAGUE_ID</code> and reload.</p>
        </div>
      )}

      {state.status === 'no-prev' && (
        <div className="card">
          <h3>No previous season yet</h3>
          <p className="muted">
            Sleeper has not linked a previous season for this league. Once the current season ends
            (or a previous one is linked), this page will populate.
          </p>
        </div>
      )}

      {state.status === 'loading' && <Loading />}

      {state.status === 'error' && (
        <div className="card">
          <h3>Could not load stats</h3>
          <p className="muted">{state.error}</p>
          <button className="btn" onClick={() => load({ force: true })}>Try again</button>
        </div>
      )}

      {state.status === 'ready' && stats && (
        <>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <div className="row" style={{ gap: 8 }}>
              <button
                type="button"
                className={`btn ${tab === 'latest' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setTab('latest')}
              >
                Latest season
              </button>
              <button
                type="button"
                className={`btn ${tab === 'career' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setTab('career')}
              >
                All-time by user
              </button>
            </div>
            <span className="dim" style={{ marginLeft: 'auto' }}>Cached locally · safe to refresh</span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => load({ force: true })}
            >
              Refresh
            </button>
          </div>

          {tab === 'latest' && (
            <>
              <Standings stats={stats} />
              <Highlights stats={stats} />
              <Aggregates stats={stats} />
              <PlayoffSection playoff={stats.playoff} season={stats.league.season} />
            </>
          )}

          {tab === 'career' && (
            <CareerTable career={state.career} seasonCount={state.seasonCount} />
          )}
        </>
      )}
    </div>
  );
}

function Loading() {
  return (
    <>
      <div className="skeleton" style={{ height: 24, width: '40%' }} />
      <div className="card-grid">
        <div className="skeleton" style={{ height: 140 }} />
        <div className="skeleton" style={{ height: 140 }} />
        <div className="skeleton" style={{ height: 140 }} />
      </div>
      <div className="skeleton" style={{ height: 240 }} />
    </>
  );
}

function CareerTable({ career, seasonCount }) {
  const { rows } = career;
  if (!rows.length) {
    return (
      <div className="card">
        <p className="muted">No manager rows could be built from the loaded seasons.</p>
      </div>
    );
  }

  return (
    <section className="card">
      <h3>All-time by Sleeper user</h3>
      <p className="muted" style={{ marginBottom: 12 }}>
        Rows are keyed by <strong>owner user id</strong> across every linked season in this chain
        ({seasonCount} {seasonCount === 1 ? 'league' : 'leagues'}). Team names can change year to year;
        display name and avatar use the most recent season we loaded.
      </p>
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Manager</th>
              <th>Seasons</th>
              <th>W-L-T</th>
              <th>Career PF</th>
              <th>Career PA</th>
              <th>Avg / game</th>
              <th>Best week</th>
              <th>Worst week</th>
              <th>Bench pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.userId}>
                <td>{i + 1}</td>
                <td>
                  <div className="row" style={{ gap: 10 }}>
                    {r.avatar ? (
                      <img src={r.avatar} alt="" width="22" height="22" style={{ borderRadius: '50%' }} />
                    ) : (
                      <span style={{ width: 22, height: 22, display: 'inline-block' }} />
                    )}
                    <span className="truncate" style={{ maxWidth: 160 }} title={r.userId}>
                      {r.displayName}
                    </span>
                  </div>
                </td>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>{r.seasonsLabel}</td>
                <td>
                  {r.wins}-{r.losses}{r.ties ? `-${r.ties}` : ''}
                </td>
                <td>{r.careerPf.toFixed(2)}</td>
                <td>{r.careerPa.toFixed(2)}</td>
                <td>{r.gamesPlayed ? r.avgPtsPerGame.toFixed(2) : '—'}</td>
                <td className="muted" style={{ fontSize: '0.92em' }}>
                  {r.bestWeek
                    ? `${r.bestWeek.points.toFixed(2)} (${r.bestWeek.season} w${r.bestWeek.week})`
                    : '—'}
                </td>
                <td className="muted" style={{ fontSize: '0.92em' }}>
                  {r.worstWeek
                    ? `${r.worstWeek.points.toFixed(2)} (${r.worstWeek.season} w${r.worstWeek.week})`
                    : '—'}
                </td>
                <td>{r.benchTotal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PlayoffSection({ playoff, season }) {
  if (!playoff) return null;
  const showScores = playoff.hasScores;
  const showBracket = playoff.hasBracket;
  if (!showScores && !showBracket) {
    return (
      <section className="card" style={{ marginTop: 20 }}>
        <h3>Playoffs {season}</h3>
        <p className="muted">
          No playoff scores or winners bracket in Sleeper yet for this league (season not started,
          still in regular season, or data not published).
        </p>
      </section>
    );
  }

  return (
    <section style={{ marginTop: 24 }}>
      <h3 style={{ marginBottom: 6 }}>Playoffs {season}</h3>
      <p className="muted" style={{ marginBottom: 12 }}>
        Playoff weeks are week {playoff.playoffWeekStart} and later (through week 18). Highlights
        and manager profiles below use <strong>only</strong> those weeks. “Most / fewest points”
        and “points against” are summed across playoff games only.
      </p>

      {showBracket && (playoff.bracket?.championName || playoff.bracket?.decisiveMatches?.length) ? (
        <div className="card" style={{ marginBottom: 12 }}>
          {playoff.bracket.championName && (
            <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, marginBottom: 8 }}>
              Champion: {playoff.bracket.championName}
            </p>
          )}
          {playoff.bracket.decisiveMatches.length > 0 && (
            <>
              <h4 style={{ marginBottom: 8 }}>Winners bracket</h4>
              <div className="scroll-x">
                <table>
                  <thead>
                    <tr>
                      <th>Rd</th>
                      <th>M</th>
                      <th>Game</th>
                      <th>Winner</th>
                      <th>Loser</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playoff.bracket.decisiveMatches.map((m, i) => (
                      <tr key={`${m.round}-${m.match}-${i}`}>
                        <td>{m.round}</td>
                        <td className="muted">{m.match || '—'}</td>
                        <td className="muted" style={{ fontSize: '0.92em' }}>
                          {m.slotLabel || '—'}
                        </td>
                        <td>{m.winner}</td>
                        <td className="muted">{m.loser}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ) : null}

      {showScores ? (
        <>
          <h4 style={{ marginBottom: 8 }}>Playoff highlights</h4>
          <Highlights stats={playoff} />
          <h4 style={{ marginBottom: 8, marginTop: 16 }}>Playoff manager profiles</h4>
          <Aggregates stats={playoff} />
        </>
      ) : (
        <p className="muted dim">
          Bracket results above; weekly playoff scores not available in matchups yet.
        </p>
      )}
    </section>
  );
}

function Standings({ stats }) {
  return (
    <section className="card">
      <h3>Final standings</h3>
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>Record</th>
              <th>PF</th>
              <th>PA</th>
            </tr>
          </thead>
          <tbody>
            {stats.standings.map((t, i) => (
              <tr key={t.rosterId}>
                <td>{i + 1}</td>
                <td>
                  <div className="row" style={{ gap: 10 }}>
                    {t.avatar ? (
                      <img src={t.avatar} alt="" width="22" height="22" style={{ borderRadius: '50%' }} />
                    ) : (
                      <span style={{ width: 22, height: 22, display: 'inline-block' }} />
                    )}
                    <span className="truncate" style={{ maxWidth: 180 }}>{t.name}</span>
                  </div>
                </td>
                <td>
                  {t.wins}-{t.losses}{t.ties ? `-${t.ties}` : ''}
                </td>
                <td>{t.fpts.toFixed(2)}</td>
                <td>{t.fptsAgainst.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Highlights({ stats }) {
  return (
    <section>
      <h3 style={{ marginBottom: 8 }}>Highlights</h3>
      <div className="card-grid">
        {stats.highest && (
          <StatCard
            title="Highest single week"
            primary={`${stats.highest.points.toFixed(2)} pts`}
            secondary={`${stats.highest.team} · Week ${stats.highest.week}`}
          />
        )}
        {stats.lowest && (
          <StatCard
            title="Lowest single week"
            primary={`${stats.lowest.points.toFixed(2)} pts`}
            secondary={`${stats.lowest.team} · Week ${stats.lowest.week}`}
          />
        )}
        {stats.blowout && (
          <StatCard
            title="Biggest blowout"
            primary={`${stats.blowout.diff.toFixed(2)} margin`}
            secondary={`${stats.blowout.winner.team} (${stats.blowout.winner.points.toFixed(
              2
            )}) over ${stats.blowout.loser.team} (${stats.blowout.loser.points.toFixed(2)}) · Week ${
              stats.blowout.week
            }`}
          />
        )}
        {stats.closest && (
          <StatCard
            title="Closest matchup"
            primary={`${stats.closest.diff.toFixed(2)} margin`}
            secondary={`${stats.closest.winner.team} edged ${stats.closest.loser.team} · Week ${stats.closest.week}`}
          />
        )}
        {stats.totalsLeader && (
          <StatCard
            title="Most points scored"
            primary={`${stats.totalsLeader.fpts.toFixed(2)} pts`}
            secondary={stats.totalsLeader.name}
          />
        )}
        {stats.fewestPoints && (
          <StatCard
            title="Fewest points scored"
            primary={`${stats.fewestPoints.fpts.toFixed(2)} pts`}
            secondary={stats.fewestPoints.name}
          />
        )}
        {stats.mostPointsAgainst && (
          <StatCard
            title="Most points against (unlucky)"
            primary={`${stats.mostPointsAgainst.fptsAgainst.toFixed(2)} pts`}
            secondary={stats.mostPointsAgainst.name}
          />
        )}
      </div>
    </section>
  );
}

function Aggregates({ stats }) {
  return (
    <section>
      <h3 style={{ marginBottom: 8 }}>Manager profiles</h3>
      <div className="card-grid">
        {stats.mostConsistent && (
          <StatCard
            title="Most consistent"
            primary={`σ ${stats.mostConsistent.stdev.toFixed(2)}`}
            secondary={`${stats.mostConsistent.team} · avg ${stats.mostConsistent.mean.toFixed(2)} pts/wk`}
          />
        )}
        {stats.mostVolatile && (
          <StatCard
            title="Most volatile"
            primary={`σ ${stats.mostVolatile.stdev.toFixed(2)}`}
            secondary={`${stats.mostVolatile.team} · avg ${stats.mostVolatile.mean.toFixed(2)} pts/wk`}
          />
        )}
        {stats.mostBenched && (
          <StatCard
            title="Bench points left behind"
            primary={`${stats.mostBenched.benchTotal.toFixed(2)} pts`}
            secondary={stats.mostBenched.team}
          />
        )}
        {stats.leastBenched && (
          <StatCard
            title="Tightest lineup"
            primary={`${stats.leastBenched.benchTotal.toFixed(2)} bench pts`}
            secondary={stats.leastBenched.team}
          />
        )}
      </div>
    </section>
  );
}

function StatCard({ title, primary, secondary }) {
  return (
    <div className="card">
      <div className="dim" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </div>
      <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, marginTop: 4 }}>{primary}</div>
      {secondary && <div className="muted" style={{ marginTop: 4 }}>{secondary}</div>}
    </div>
  );
}
