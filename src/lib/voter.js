const TOKEN_KEY = 'voter:token';
const VOTES_KEY = 'voter:votes';

function cryptoId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `tok-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function getVoterToken() {
  try {
    let token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      token = cryptoId();
      localStorage.setItem(TOKEN_KEY, token);
    }
    return token;
  } catch {
    return cryptoId();
  }
}

export function loadMyVotes() {
  try {
    const raw = localStorage.getItem(VOTES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveMyVote(ruleId, value) {
  const votes = loadMyVotes();
  if (value === 0 || value == null) {
    delete votes[ruleId];
  } else {
    votes[ruleId] = value;
  }
  try {
    localStorage.setItem(VOTES_KEY, JSON.stringify(votes));
  } catch {}
}
