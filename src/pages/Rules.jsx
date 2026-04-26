import React, { useCallback, useEffect, useState } from 'react';
import RuleCard from '../components/RuleCard.jsx';
import BottomSheet from '../components/BottomSheet.jsx';
import RuleDiscussionSheet from '../components/RuleDiscussionSheet.jsx';
import { getVoterToken, loadMyVotes, saveMyVote } from '../lib/voter.js';

export default function Rules() {
  const [rules, setRules] = useState(null);
  const [error, setError] = useState(null);
  const [showSheet, setShowSheet] = useState(false);
  const [discussionRule, setDiscussionRule] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyRule, setBusyRule] = useState(null);
  const [myVotes, setMyVotes] = useState(loadMyVotes);

  async function load() {
    try {
      const res = await fetch('/api/rules', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Failed (${res.status})`);
      }
      setRules(data.rules || []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Could not load rules');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitRule({ title, description, author }) {
    setSubmitting(true);
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title, description, author }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      setRules((list) => [data.rule, ...(list || [])]);
      setShowSheet(false);
    } catch (err) {
      alert(err.message || 'Could not submit rule');
    } finally {
      setSubmitting(false);
    }
  }

  async function vote(ruleId, value) {
    if (busyRule) return;
    const previousVote = myVotes[ruleId] || 0;
    const newVote = value;
    setBusyRule(ruleId);

    setRules((list) =>
      (list || []).map((r) => {
        if (r.id !== ruleId) return r;
        let up = r.up || 0;
        let down = r.down || 0;
        if (previousVote === 1) up -= 1;
        if (previousVote === -1) down -= 1;
        if (newVote === 1) up += 1;
        if (newVote === -1) down += 1;
        return { ...r, up, down };
      })
    );
    setMyVotes((m) => {
      const next = { ...m };
      if (newVote === 0) delete next[ruleId];
      else next[ruleId] = newVote;
      return next;
    });
    saveMyVote(ruleId, newVote);

    try {
      const voterToken = getVoterToken();
      const res =
        newVote === 0
          ? await fetch('/api/votes', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ rule_id: ruleId, voter_token: voterToken }),
            })
          : await fetch('/api/votes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                rule_id: ruleId,
                voter_token: voterToken,
                value: newVote,
              }),
            });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Vote failed');
      }
      const totals = await res.json();
      setRules((list) =>
        (list || []).map((r) =>
          r.id === ruleId ? { ...r, up: totals.up, down: totals.down } : r
        )
      );
    } catch (err) {
      load();
      setMyVotes((m) => {
        const next = { ...m };
        if (previousVote === 0) delete next[ruleId];
        else next[ruleId] = previousVote;
        return next;
      });
      saveMyVote(ruleId, previousVote);
      alert(err.message || 'Could not record vote');
    } finally {
      setBusyRule(null);
    }
  }

  const syncPostCount = useCallback((ruleId, count) => {
    setRules((list) =>
      list ? list.map((r) => (r.id === ruleId ? { ...r, post_count: count } : r)) : list
    );
  }, []);

  const sorted = rules
    ? [...rules].sort(
        (a, b) =>
          (b.up - b.down) - (a.up - a.down) ||
          new Date(b.created_at) - new Date(a.created_at)
      )
    : null;

  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">Vote on next season</span>
        <h1>Rule suggestions</h1>
        <p className="muted">
          Suggest a rule and vote on what should change.
        </p>
      </header>

      <div className="row">
        <button className="btn btn-primary" onClick={() => setShowSheet(true)}>
          Suggest a rule
        </button>
        <button className="btn btn-ghost" style={{ marginLeft: 'auto' }} onClick={load}>
          Refresh
        </button>
      </div>

      {error && (
        <div className="card">
          <h3>Could not load rules</h3>
          <p className="muted">{error}</p>
          <p className="dim">If you just deployed, make sure the database is initialised and DATABASE_URL is set.</p>
        </div>
      )}

      {!rules && !error && (
        <div className="card-grid">
          <div className="skeleton" style={{ height: 100 }} />
          <div className="skeleton" style={{ height: 100 }} />
          <div className="skeleton" style={{ height: 100 }} />
        </div>
      )}

      {sorted && sorted.length === 0 && (
        <div className="card empty">
          No rules yet. Be the first to suggest one!
        </div>
      )}

      {sorted && sorted.length > 0 && (
        <div className="card-grid">
          {sorted.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              myVote={myVotes[rule.id] || 0}
              busy={busyRule === rule.id}
              onVote={vote}
              postCount={rule.post_count ?? 0}
              onDiscuss={setDiscussionRule}
            />
          ))}
        </div>
      )}

      <BottomSheet
        open={showSheet}
        onClose={() => !submitting && setShowSheet(false)}
        title="Suggest a rule"
      >
        <SuggestForm onSubmit={submitRule} submitting={submitting} />
      </BottomSheet>

      {discussionRule ? (
        <RuleDiscussionSheet
          key={discussionRule.id}
          rule={discussionRule}
          onClose={() => setDiscussionRule(null)}
          onPostCount={syncPostCount}
        />
      ) : null}
    </div>
  );
}

function SuggestForm({ onSubmit, submitting }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState(() => {
    try {
      return localStorage.getItem('voter:name') || '';
    } catch {
      return '';
    }
  });

  function submit(e) {
    e.preventDefault();
    if (title.trim().length < 3) {
      alert('Give it a title (at least 3 characters).');
      return;
    }
    try {
      localStorage.setItem('voter:name', author.trim());
    } catch {}
    onSubmit({ title: title.trim(), description: description.trim(), author: author.trim() || null });
  }

  return (
    <form onSubmit={submit} className="suggest-form">
      <label>
        <span className="dim">Title</span>
        <input
          autoFocus
          required
          maxLength={140}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Increase keepers to 2"
          enterKeyHint="next"
        />
      </label>
      <label>
        <span className="dim">Why? (optional)</span>
        <textarea
          rows="4"
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add context, examples, or pros/cons."
        />
      </label>
      <label>
        <span className="dim">Your name (optional)</span>
        <input
          maxLength={60}
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="So people know who suggested it"
          autoComplete="given-name"
          enterKeyHint="done"
        />
      </label>
      <button className="btn btn-primary" type="submit" disabled={submitting} style={{ marginTop: 8 }}>
        {submitting ? 'Submitting…' : 'Submit suggestion'}
      </button>
      <style>{`
        .suggest-form { display: flex; flex-direction: column; gap: 12px; }
        .suggest-form label { display: flex; flex-direction: column; gap: 6px; }
      `}</style>
    </form>
  );
}
