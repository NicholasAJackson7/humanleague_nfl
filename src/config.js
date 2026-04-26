export const config = {
  leagueId: import.meta.env.VITE_SLEEPER_LEAGUE_ID || '',
};

export function isConfigured() {
  return Boolean(config.leagueId);
}
