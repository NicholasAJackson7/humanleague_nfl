import React, { useEffect, useMemo, useState } from 'react';
import './Rankings.css';

const FORMAT_OPTIONS = [
  { value: 'redraft-overall', label: 'Redraft rankings' },
  { value: 'keeper-values-1qb', label: 'Keeper values' },
];

function isKeeperValuesFormat(format) {
  return format === 'keeper-values-1qb';
}

/** League uses flex spots only — no kickers in filters or UX. */
const POSITION_FILTERS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'DST'];

const DEFAULT_FORMAT = 'redraft-overall';

function formatScrapeDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function ageInDays(iso) {
  if (!iso) return null;
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return null;
  return Math.floor((Date.now() - d) / 86400000);
}

function fmtNum(n, digits = 1) {
  if (n == null || !Number.isFinite(n)) return '—';
  return Number(n).toFixed(digits);
}

export default function Rankings() {
  const [format, setFormat] = useState(DEFAULT_FORMAT);
  const [position, setPosition] = useState('ALL');
  const [search, setSearch] = useState('');
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetch(`/api/rankings?page_type=${encodeURIComponent(format)}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || `Request failed (${res.status})`);
        }
        return data;
      })
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', message: err.message || String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [format]);

  const isValuesFormat = isKeeperValuesFormat(format);

  const filtered = useMemo(() => {
    if (state.status !== 'ready') return [];
    const term = search.trim().toLowerCase();
    return state.data.players.filter((p) => {
      if (position === 'ALL' && p.pos === 'K') return false;
      if (position !== 'ALL' && p.pos !== position) return false;
      if (term && !p.name.toLowerCase().includes(term) && !p.team.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [state, search, position]);

  const ageDays = state.status === 'ready' ? ageInDays(state.data.scrape_date) : null;
  const isStale = ageDays != null && ageDays > 14;

  return (
    <div className="page rankings-page">
      <header className="page-header">
        <span className="eyebrow">Draft prep</span>
        <h1>Expert rankings</h1>
        {state.status === 'ready' && (
          <p className="rankings-source">
            {isValuesFormat ? 'DynastyProcess trade-value chart' : 'FantasyPros Expert Consensus'}, via{' '}
            <a
              href="https://github.com/dynastyprocess/data"
              target="_blank"
              rel="noreferrer"
            >
              DynastyProcess
            </a>
            {state.data.scrape_date && (
              <>
                {' · '}as of <strong>{formatScrapeDate(state.data.scrape_date)}</strong>
                {ageDays != null && ageDays > 0 && (
                  <span className={isStale ? 'rankings-source__stale' : ''}>
                    {' '}({ageDays} day{ageDays === 1 ? '' : 's'} old{isStale ? ' — may be stale' : ''})
                  </span>
                )}
              </>
            )}
          </p>
        )}
      </header>

      <section className="card rankings-controls">
        <label className="rankings-control">
          <span className="rankings-control__label">View</span>
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            {FORMAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <div className="rankings-control rankings-control--pills">
          <span className="rankings-control__label">Position</span>
          <div className="rankings-pills" role="tablist" aria-label="Filter by position">
            {POSITION_FILTERS.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={position === p}
                className={'rankings-pill' + (position === p ? ' rankings-pill--active' : '')}
                onClick={() => setPosition(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <label className="rankings-control rankings-control--search">
          <span className="rankings-control__label">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or team (e.g. Kelce, KC)"
            inputMode="search"
            enterKeyHint="search"
          />
        </label>
      </section>

      {state.status === 'loading' && (
        <div className="card" aria-busy="true">
          <div className="skeleton" style={{ height: 18, width: '40%', marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 280, width: '100%' }} />
        </div>
      )}

      {state.status === 'error' && (
        <div className="card rankings-error" role="alert">
          <p>
            <strong>Could not load rankings.</strong> {state.message}
          </p>
          <p className="muted">
            The upstream data is mirrored on GitHub and refreshes weekly. Try again in a minute, or
            check{' '}
            <a
              href="https://github.com/dynastyprocess/data/actions"
              target="_blank"
              rel="noreferrer"
            >
              the upstream pipeline
            </a>
            .
          </p>
        </div>
      )}

      {state.status === 'ready' && (
        <section className="card rankings-table-card">
          <div className="rankings-meta">
            <span>
              <strong>{filtered.length.toLocaleString()}</strong>
              {filtered.length === state.data.count
                ? ' players'
                : ` of ${state.data.count.toLocaleString()} players`}
            </span>
          </div>

          {filtered.length === 0 && (
            <p className="muted rankings-empty">No players match the current filters.</p>
          )}

          {filtered.length > 0 && isValuesFormat && (
            <div className="scroll-x">
              <table className="rankings-table">
                <thead>
                  <tr>
                    <th className="rankings-th rankings-th--rank">Rank</th>
                    <th className="rankings-th">Player</th>
                    <th className="rankings-th rankings-th--num">Pos</th>
                    <th className="rankings-th rankings-th--num">Team</th>
                    <th className="rankings-th rankings-th--num" title="Player age in years">
                      Age
                    </th>
                    <th
                      className="rankings-th rankings-th--num"
                      title="DynastyProcess trade value (higher = more valuable to keep)"
                    >
                      Value
                    </th>
                    <th
                      className="rankings-th rankings-th--num"
                      title="Dynasty Expert Consensus Rank (overall)"
                    >
                      Dyn Rk
                    </th>
                    <th
                      className="rankings-th rankings-th--num"
                      title="Dynasty rank within position"
                    >
                      Pos Rk
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => (
                    <tr key={p.fp_id || `${p.name}-${p.pos}-${i}`} className="rankings-row">
                      <td className="rankings-td rankings-td--rank">
                        <span className="rankings-rank">{i + 1}</span>
                      </td>
                      <td className="rankings-td">
                        <span className="rankings-name">{p.name || '—'}</span>
                      </td>
                      <td className="rankings-td rankings-td--num">
                        <span className={`rankings-pos rankings-pos--${(p.pos || '').toLowerCase()}`}>
                          {p.pos || '—'}
                        </span>
                      </td>
                      <td className="rankings-td rankings-td--num rankings-td--team">{p.team || '—'}</td>
                      <td className="rankings-td rankings-td--num">{fmtNum(p.age, 1)}</td>
                      <td className="rankings-td rankings-td--num rankings-td--value">
                        {p.value != null ? p.value.toLocaleString() : '—'}
                      </td>
                      <td className="rankings-td rankings-td--num">{p.ecr ?? '—'}</td>
                      <td className="rankings-td rankings-td--num">{p.ecr_pos ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > 0 && !isValuesFormat && (
            <div className="scroll-x">
              <table className="rankings-table">
                <thead>
                  <tr>
                    <th className="rankings-th rankings-th--rank">Rank</th>
                    <th className="rankings-th">Player</th>
                    <th className="rankings-th rankings-th--num">Pos</th>
                    <th className="rankings-th rankings-th--num">Team</th>
                    <th className="rankings-th rankings-th--num" title="Bye week">
                      Bye
                    </th>
                    <th
                      className="rankings-th rankings-th--num"
                      title="Standard deviation across experts (lower = more agreement)"
                    >
                      SD
                    </th>
                    <th
                      className="rankings-th rankings-th--num"
                      title="Best / worst expert rank"
                    >
                      Best / Worst
                    </th>
                    <th
                      className="rankings-th rankings-th--num"
                      title="% of leagues that have this player rostered"
                    >
                      Owned
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.fp_id || `${p.name}-${p.pos}`} className="rankings-row">
                      <td className="rankings-td rankings-td--rank">
                        <span className="rankings-rank">{p.ecr}</span>
                      </td>
                      <td className="rankings-td">
                        <span className="rankings-name">{p.name || '—'}</span>
                      </td>
                      <td className="rankings-td rankings-td--num">
                        <span className={`rankings-pos rankings-pos--${(p.pos || '').toLowerCase()}`}>
                          {p.pos || '—'}
                        </span>
                      </td>
                      <td className="rankings-td rankings-td--num rankings-td--team">{p.team || '—'}</td>
                      <td className="rankings-td rankings-td--num">{p.bye ?? '—'}</td>
                      <td className="rankings-td rankings-td--num">{fmtNum(p.sd, 1)}</td>
                      <td className="rankings-td rankings-td--num">
                        {p.best != null && p.worst != null ? `${p.best} / ${p.worst}` : '—'}
                      </td>
                      <td className="rankings-td rankings-td--num">
                        {p.owned_avg != null ? `${Math.round(p.owned_avg)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
