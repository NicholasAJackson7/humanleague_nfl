export const config = {
  leagueId: import.meta.env.VITE_SLEEPER_LEAGUE_ID || '',
  /** ISO 8601, e.g. `2026-08-20` or `2026-08-20T17:00:00-04:00`. Empty = nominations list shows as usual. */
  keepersRevealAt: (import.meta.env.VITE_KEEPERS_REVEAL_AT || '').trim(),
};

/** Human League roster/draft shape — used for keeper cost vs consensus view on Rankings. */
export const leagueFormat = {
  teamCount: 10,
  draftRounds: 14,
  /** Waivers / trades: sacrifice this round if kept (no draft slot in league startup). */
  undraftedKeeperRound: 14,
};

/** Mock draft UI + `/mock-draft`: commissioners only in production; local dev allows session bypass (see AuthContext). */
export function canAccessMockDraft(user, devBypass) {
  if (user?.role === 'commissioner') return true;
  if (import.meta.env.DEV && devBypass) return true;
  return false;
}

export function isConfigured() {
  return Boolean(config.leagueId);
}

/** Milliseconds at which keeper nominations become visible in the UI, or null if not configured / invalid. */
export function getKeepersRevealTimestamp() {
  if (!config.keepersRevealAt) return null;
  const t = Date.parse(config.keepersRevealAt);
  return Number.isFinite(t) ? t : null;
}

/** When true, the All nominations table is not shown (and the list is not fetched). */
export function areKeeperNominationsHiddenInUi() {
  const ts = getKeepersRevealTimestamp();
  return ts != null && Date.now() < ts;
}
