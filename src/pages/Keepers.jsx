import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { areKeeperNominationsHiddenInUi, config } from '../config.js';
import {
  resolveLeagueHistoryChain,
  fetchUsers,
  fetchRosters,
  getNflPlayersLookup,
  rosterPlayerIds,
} from '../lib/sleeper.js';
import './Keepers.css';

function formatRevealLabel(isoRaw) {
  const ts = Date.parse(isoRaw);
  if (!Number.isFinite(ts)) return isoRaw;
  return new Date(ts).toLocaleString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function fmtNominationRow(n, lookup) {
  if (n.nomination_kind === 'freeform') {
    return [n.k1_text, n.k2_text, n.k3_text].join(' · ');
  }
  const ids = [n.k1_player_id, n.k2_player_id, n.k3_player_id];
  if (!lookup) return ids.join(' · ');
  return ids
    .map((id) => {
      const x = lookup.get(id);
      return x ? `${x.name} (${x.position || '?'})` : id;
    })
    .join(' · ');
}

export default function Keepers() {
  const [chain, setChain] = useState([]);
  const [chainLoading, setChainLoading] = useState(true);
  const [lookup, setLookup] = useState(null);
  const [lookupErr, setLookupErr] = useState(null);

  const [mode, setMode] = useState('roster');
  const [seasonLeagueId, setSeasonLeagueId] = useState('');
  const [seasonLabel, setSeasonLabel] = useState('');
  const [users, setUsers] = useState([]);
  const [rosters, setRosters] = useState([]);
  const [leagueLoading, setLeagueLoading] = useState(false);

  const [sleeperUserId, setSleeperUserId] = useState('');
  const [k1, setK1] = useState('');
  const [k2, setK2] = useState('');
  const [k3, setK3] = useState('');
  const [t1, setT1] = useState('');
  const [t2, setT2] = useState('');
  const [t3, setT3] = useState('');

  const [nameByUserId, setNameByUserId] = useState({});
  const [nominations, setNominations] = useState([]);
  const [listLoading, setListLoading] = useState(() => !areKeeperNominationsHiddenInUi());
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState(null);
  const [formErr, setFormErr] = useState(null);

  const nominationsHidden = areKeeperNominationsHiddenInUi();

  useEffect(() => {
    if (!config.leagueId) {
      setChain([]);
      setChainLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const c = await resolveLeagueHistoryChain(config.leagueId);
        if (!cancelled) {
          setChain(c);
          if (c[0]) {
            setSeasonLeagueId(c[0].leagueId);
            setSeasonLabel(String(c[0].season));
          }
        }
      } finally {
        if (!cancelled) setChainLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!config.leagueId) return;
    let cancelled = false;
    fetchUsers(config.leagueId)
      .then((users) => {
        if (!cancelled && Array.isArray(users)) {
          const m = {};
          for (const u of users) {
            m[u.user_id] = u.metadata?.team_name || u.display_name || u.user_id;
          }
          setNameByUserId(m);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getNflPlayersLookup()
      .then((m) => {
        if (!cancelled) setLookup(m);
      })
      .catch(() => {
        if (!cancelled) {
          setLookup(null);
          setLookupErr('Could not load NFL player names (offline or blocked). Roster mode still works by player id.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadNominations = useCallback(async () => {
    if (areKeeperNominationsHiddenInUi()) {
      setNominations([]);
      setListLoading(false);
      return;
    }
    setListLoading(true);
    try {
      const res = await fetch('/api/keeper-nominations', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setNominations(data.nominations || []);
    } catch (e) {
      setNominations([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNominations();
  }, [loadNominations]);

  useEffect(() => {
    if (!seasonLeagueId) {
      setUsers([]);
      setRosters([]);
      return;
    }
    let cancelled = false;
    setLeagueLoading(true);
    (async () => {
      try {
        const [u, r] = await Promise.all([fetchUsers(seasonLeagueId), fetchRosters(seasonLeagueId)]);
        if (!cancelled) {
          setUsers(Array.isArray(u) ? u : []);
          setRosters(Array.isArray(r) ? r : []);
        }
      } catch {
        if (!cancelled) {
          setUsers([]);
          setRosters([]);
        }
      } finally {
        if (!cancelled) setLeagueLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seasonLeagueId]);

  const userOptions = useMemo(() => {
    return [...users].sort((a, b) => {
      const na = (a.metadata?.team_name || a.display_name || a.user_id || '').toLowerCase();
      const nb = (b.metadata?.team_name || b.display_name || b.user_id || '').toLowerCase();
      return na.localeCompare(nb);
    });
  }, [users]);

  const rosterPickOptions = useMemo(() => {
    if (!sleeperUserId || !rosters.length) return [];
    const roster = rosters.find((x) => x.owner_id === sleeperUserId);
    const ids = rosterPlayerIds(roster);
    const opts = ids.map((id) => {
      const meta = lookup?.get(id);
      const label = meta ? `${meta.name} (${meta.position || '?'})` : id;
      return { id, label };
    });
    opts.sort((a, b) => a.label.localeCompare(b.label));
    return opts;
  }, [sleeperUserId, rosters, lookup]);

  async function onSubmit(e) {
    e.preventDefault();
    setFormMsg(null);
    setFormErr(null);

    if (!sleeperUserId) {
      setFormErr('Choose which manager you are (Sleeper account).');
      return;
    }
    if (!seasonLabel) {
      setFormErr('Choose which season this nomination is for.');
      return;
    }

    const body = {
      sleeper_user_id: sleeperUserId,
      source_season: seasonLabel,
      league_id_snapshot: seasonLeagueId || null,
      nomination_kind: mode,
    };

    if (mode === 'roster') {
      if (!k1 || !k2 || !k3) {
        setFormErr('Pick all three keepers from your roster.');
        return;
      }
      if (new Set([k1, k2, k3]).size !== 3) {
        setFormErr('Pick three different players.');
        return;
      }
      body.k1_player_id = k1;
      body.k2_player_id = k2;
      body.k3_player_id = k3;
    } else {
      const a = t1.trim();
      const b = t2.trim();
      const c = t3.trim();
      if (a.length < 2 || b.length < 2 || c.length < 2) {
        setFormErr('Enter all three keeper names (freeform).');
        return;
      }
      body.k1_text = a;
      body.k2_text = b;
      body.k3_text = c;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/keeper-nominations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setFormMsg(
        areKeeperNominationsHiddenInUi()
          ? 'Saved. Your nomination is stored; the league list stays hidden until the reveal date.'
          : 'Saved. The table below updates for everyone.',
      );
      await loadNominations();
    } catch (err) {
      setFormErr(err.message || 'Could not save');
    } finally {
      setSubmitting(false);
    }
  }

  if (!config.leagueId) {
    return (
      <div className="page">
        <p className="muted">Set VITE_SLEEPER_LEAGUE_ID to use keeper nominations.</p>
      </div>
    );
  }

  return (
    <div className="page keepers-page">
      <header className="page-header">
        <span className="eyebrow">Off-season</span>
        <h1>Keeper nominations</h1>
        <p className="muted">
          Log <strong>three</strong> keepers per manager per season. #1 is your lock; #2 and #3 are for your league’s
          random rules — this page only stores what everyone picked so the commissioner can see it.
        </p>
      </header>

      {lookupErr && (
        <p className="keepers-warn" role="status">
          {lookupErr}
        </p>
      )}

      {!chainLoading && chain.length === 0 && (
        <div className="card keepers-inline-notice" role="status">
          No linked league seasons found — roster source dropdown will be empty until the league chain resolves.
        </div>
      )}

      <div className="keepers-segment" role="group" aria-label="How to enter keepers">
        <button
          type="button"
          className={'keepers-segment__btn' + (mode === 'roster' ? ' keepers-segment__btn--active' : '')}
          onClick={() => setMode('roster')}
        >
          From Sleeper roster
        </button>
        <button
          type="button"
          className={'keepers-segment__btn' + (mode === 'freeform' ? ' keepers-segment__btn--active' : '')}
          onClick={() => setMode('freeform')}
        >
          Quick text (3 lines)
        </button>
      </div>

      <form className="card keepers-form keepers-form-card" onSubmit={onSubmit}>
        <label>
          <span className="keepers-label">Season this nomination applies to</span>
          <select
            value={seasonLeagueId}
            disabled={chainLoading || !chain.length}
            onChange={(e) => {
              const id = e.target.value;
              setSeasonLeagueId(id);
              const row = chain.find((c) => c.leagueId === id);
              setSeasonLabel(row ? String(row.season) : '');
            }}
          >
            {chain.map((c) => (
              <option key={c.leagueId} value={c.leagueId}>
                {c.season} roster ({c.name || c.leagueId})
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="keepers-label">You are (Sleeper manager)</span>
          <select
            value={sleeperUserId}
            disabled={leagueLoading || !userOptions.length}
            onChange={(e) => setSleeperUserId(e.target.value)}
            required
          >
            <option value="">Select your team…</option>
            {userOptions.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.metadata?.team_name || u.display_name || u.user_id}
              </option>
            ))}
          </select>
        </label>

        {mode === 'roster' && (
          <>
            <p className="keepers-hint">
              Keeper 1 = guaranteed. Pick from the roster for the season above (first load may take a few seconds while
              player names download from Sleeper).
            </p>
            <label>
              <span className="keepers-label">Keeper 1 (guaranteed)</span>
              <select value={k1} onChange={(e) => setK1(e.target.value)} required disabled={!rosterPickOptions.length}>
                <option value="">Select player…</option>
                {rosterPickOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="keepers-label">Keeper 2</span>
              <select value={k2} onChange={(e) => setK2(e.target.value)} required disabled={!rosterPickOptions.length}>
                <option value="">Select player…</option>
                {rosterPickOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="keepers-label">Keeper 3</span>
              <select value={k3} onChange={(e) => setK3(e.target.value)} required disabled={!rosterPickOptions.length}>
                <option value="">Select player…</option>
                {rosterPickOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {!sleeperUserId && <p className="keepers-hint keepers-hint--inline">Select yourself first to load your roster.</p>}
            {sleeperUserId && !leagueLoading && rosterPickOptions.length === 0 && (
              <p className="keepers-warn">No players found on your roster for this league/season.</p>
            )}
          </>
        )}

        {mode === 'freeform' && (
          <>
            <label>
              <span className="keepers-label">Keeper 1 (guaranteed)</span>
              <input value={t1} onChange={(e) => setT1(e.target.value)} maxLength={160} placeholder="e.g. Ja'Marr Chase" />
            </label>
            <label>
              <span className="keepers-label">Keeper 2</span>
              <input value={t2} onChange={(e) => setT2(e.target.value)} maxLength={160} />
            </label>
            <label>
              <span className="keepers-label">Keeper 3</span>
              <input value={t3} onChange={(e) => setT3(e.target.value)} maxLength={160} />
            </label>
          </>
        )}

        {formErr && <p className="keepers-err">{formErr}</p>}
        {formMsg && <p className="keepers-ok">{formMsg}</p>}

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save nomination'}
        </button>
      </form>

      <section className="card keepers-list-card">
        <h2 className="keepers-list-title">All nominations</h2>
        <p className="keepers-list-lead">
          {nominationsHidden ? (
            <>
              Everyone’s picks stay private until the reveal. You can still submit or update your own nomination above;
              the full list appears here after that time.
            </>
          ) : (
            <>One row per manager per season. Re-saving updates the same row.</>
          )}
        </p>
        {nominationsHidden ? (
          <div className="keepers-reveal-gate" role="status">
            <p className="keepers-reveal-gate__title">Nominations hidden</p>
            <p className="keepers-reveal-gate__body">
              The league table is hidden until{' '}
              <strong>{config.keepersRevealAt ? formatRevealLabel(config.keepersRevealAt) : 'the reveal date'}</strong>.
            </p>
          </div>
        ) : (
          <>
            {listLoading && <p className="muted">Loading…</p>}
            {!listLoading && nominations.length === 0 && <p className="muted">No nominations yet.</p>}
            {!listLoading && nominations.length > 0 && (
              <div className="scroll-x">
                <div className="keepers-table-wrap">
                  <table className="keepers-table">
                    <thead>
                      <tr>
                        <th>Season</th>
                        <th>Manager</th>
                        <th>Type</th>
                        <th>Keepers</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nominations.map((n) => (
                        <tr key={n.id}>
                          <td className="tabular">{n.source_season}</td>
                          <td>
                            <div>{nameByUserId[n.sleeper_user_id] || '—'}</div>
                            <div className="keepers-mono dim" style={{ fontSize: 11, marginTop: 2 }}>
                              {n.sleeper_user_id}
                            </div>
                          </td>
                          <td>
                            <span
                              className={
                                'keepers-type-pill' +
                                (n.nomination_kind === 'freeform' ? ' keepers-type-pill--freeform' : '')
                              }
                            >
                              {n.nomination_kind}
                            </span>
                          </td>
                          <td>{fmtNominationRow(n, lookup)}</td>
                          <td className="keepers-table-date">
                            {n.updated_at ? new Date(n.updated_at).toLocaleString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
