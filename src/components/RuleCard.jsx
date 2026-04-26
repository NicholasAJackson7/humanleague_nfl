import React from 'react';
import './RuleCard.css';

export default function RuleCard({ rule, myVote, onVote, busy, postCount = 0, onDiscuss }) {
  const score = (rule.up || 0) - (rule.down || 0);
  return (
    <div className="rule-card">
      <div className="rule-votes">
        <button
          className={'vote-btn up' + (myVote === 1 ? ' active' : '')}
          onClick={() => onVote(rule.id, myVote === 1 ? 0 : 1)}
          disabled={busy}
          aria-label="Upvote"
          aria-pressed={myVote === 1}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 14 12 8 18 14" />
          </svg>
        </button>
        <span className={'vote-score' + (score > 0 ? ' pos' : score < 0 ? ' neg' : '')}>
          {score > 0 ? `+${score}` : score}
        </span>
        <button
          className={'vote-btn down' + (myVote === -1 ? ' active' : '')}
          onClick={() => onVote(rule.id, myVote === -1 ? 0 : -1)}
          disabled={busy}
          aria-label="Downvote"
          aria-pressed={myVote === -1}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 10 12 16 18 10" />
          </svg>
        </button>
      </div>
      <div className="rule-body">
        <h4 className="rule-title">{rule.title}</h4>
        {rule.description && <p className="rule-desc">{rule.description}</p>}
        <div className="rule-meta">
          {rule.author && <span>by {rule.author}</span>}
          <span>{(rule.up || 0)} up · {(rule.down || 0)} down</span>
        </div>
        {onDiscuss && (
          <button type="button" className="rule-discuss-btn" onClick={() => onDiscuss(rule)}>
            Discussion
            {postCount > 0 ? <span className="rule-discuss-count">{postCount}</span> : null}
          </button>
        )}
      </div>
    </div>
  );
}
