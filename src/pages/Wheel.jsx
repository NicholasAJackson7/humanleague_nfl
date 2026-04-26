import React, { useEffect, useState } from 'react';
import Wheel from '../components/Wheel.jsx';
import BottomSheet from '../components/BottomSheet.jsx';

const ENTRIES_KEY = 'wheel:entries';
const HISTORY_KEY = 'wheel:history';

function loadEntries() {
  try {
    const raw = localStorage.getItem(ENTRIES_KEY);
    if (!raw) return defaultEntries();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultEntries();
    return parsed;
  } catch {
    return defaultEntries();
  }
}

function defaultEntries() {
  return [
    { id: cryptoId(), name: 'Player 1', weight: 1 },
    { id: cryptoId(), name: 'Player 2', weight: 1 },
    { id: cryptoId(), name: 'Player 3', weight: 1 },
    { id: cryptoId(), name: 'Player 4', weight: 1 },
  ];
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function cryptoId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export default function WheelPage() {
  const [entries, setEntries] = useState(loadEntries);
  const [history, setHistory] = useState(loadHistory);
  const [result, setResult] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
    } catch {}
  }, [entries]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 25)));
    } catch {}
  }, [history]);

  function updateEntry(id, patch) {
    setEntries((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }
  function addEntry() {
    setEntries((list) => [...list, { id: cryptoId(), name: '', weight: 1 }]);
  }
  function removeEntry(id) {
    setEntries((list) => list.filter((e) => e.id !== id));
  }
  function clearAll() {
    if (!confirm('Clear all entries?')) return;
    setEntries([{ id: cryptoId(), name: '', weight: 1 }]);
  }
  function resetDefaults() {
    setEntries(defaultEntries());
  }

  function handleResult(entry) {
    setResult(entry);
    setHistory((h) => [{ name: entry.name, at: Date.now() }, ...h].slice(0, 25));
  }

  const validEntries = entries.filter((e) => e.name.trim().length > 0);

  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">Decision time</span>
        <h1>Spin the wheel</h1>
        <p className="muted">
          Add names, weight them however you like, and let the wheel decide. Saves locally.
        </p>
      </header>

      <Wheel entries={validEntries} onResult={handleResult} />

      <section className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Entries</h3>
          <span className="dim" style={{ marginLeft: 'auto' }}>{validEntries.length} active</span>
        </div>
        <div className="entries">
          {entries.map((e, idx) => (
            <div key={e.id} className="entry-row">
              <span className="entry-index">{idx + 1}</span>
              <input
                className="entry-name"
                placeholder="Name"
                value={e.name}
                onChange={(ev) => updateEntry(e.id, { name: ev.target.value })}
                enterKeyHint="next"
                autoComplete="off"
              />
              <input
                className="entry-weight"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                placeholder="1"
                value={e.weight}
                onChange={(ev) =>
                  updateEntry(e.id, { weight: Math.max(0, Number(ev.target.value) || 0) })
                }
                aria-label="Weight"
              />
              <button
                className="btn btn-ghost entry-remove"
                onClick={() => removeEntry(e.id)}
                aria-label="Remove entry"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <div className="row" style={{ flexWrap: 'wrap', marginTop: 12 }}>
          <button className="btn btn-primary" onClick={addEntry}>+ Add</button>
          <button className="btn" onClick={resetDefaults}>Reset</button>
          <button className="btn btn-danger" onClick={clearAll}>Clear</button>
        </div>
      </section>

      {history.length > 0 && (
        <section className="card">
          <h3>Recent winners</h3>
          <ul className="history">
            {history.slice(0, 10).map((h, i) => (
              <li key={i}>
                <span className="truncate">{h.name}</span>
                <span className="dim">{new Date(h.at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <BottomSheet
        open={!!result}
        onClose={() => setResult(null)}
        title="Winner"
        footer={
          <>
            <button className="btn btn-primary" onClick={() => setResult(null)}>
              Spin again
            </button>
            <button
              className="btn"
              onClick={() => {
                if (result) removeEntry(result.id);
                setResult(null);
              }}
            >
              Remove winner and spin again
            </button>
          </>
        }
      >
        {result && (
          <div className="winner-card">
            <div className="dim">The wheel chose</div>
            <div className="winner-name">{result.name}</div>
          </div>
        )}
      </BottomSheet>

      <style>{`
        .entries { display: flex; flex-direction: column; gap: 8px; }
        .entry-row {
          display: grid;
          grid-template-columns: 28px 1fr 80px 44px;
          gap: 8px;
          align-items: center;
        }
        .entry-index { color: var(--color-text-mute); font-size: var(--fs-sm); text-align: center; }
        .entry-name { padding: 12px; }
        .entry-weight { padding: 12px; text-align: center; }
        .entry-remove { min-width: 44px; min-height: 44px; padding: 0; }
        .history { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
        .history li { display: flex; gap: 12px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--color-border); }
        .history li:last-child { border-bottom: none; }
        .history .dim { margin-left: auto; }
        .winner-card { padding: 24px 0 8px; text-align: center; }
        .winner-name {
          font-size: clamp(2rem, 8vw, 3rem);
          font-weight: 800;
          margin-top: 8px;
          word-break: break-word;
        }
      `}</style>
    </div>
  );
}
