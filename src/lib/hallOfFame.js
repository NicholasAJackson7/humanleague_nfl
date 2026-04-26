import {
  resolveLeagueHistoryChain,
  fetchLeague,
  fetchUsers,
  fetchRosters,
  fetchPlayoffBracket,
} from './sleeper.js';
import {
  buildTeams,
  getChampionRosterId,
  getFinalsLoserRosterId,
} from './stats.js';

/**
 * One row per linked league season (newest first in chain): champion + finals runner-up when known.
 */
export async function fetchHallOfFame(currentLeagueId) {
  if (!currentLeagueId) return [];
  const chain = await resolveLeagueHistoryChain(currentLeagueId);
  if (!chain.length) return [];

  const rows = [];
  for (const { leagueId, season, name } of chain) {
    const [league, users, rosters, bracket] = await Promise.all([
      fetchLeague(leagueId),
      fetchUsers(leagueId),
      fetchRosters(leagueId),
      fetchPlayoffBracket(leagueId, 'winners').catch(() => null),
    ]);

    const championRosterId = getChampionRosterId(league, bracket);
    if (!Number.isFinite(championRosterId)) continue;

    const teams = buildTeams(users, rosters);
    const byRoster = Object.fromEntries(teams.map((t) => [t.rosterId, t]));
    const champ = byRoster[championRosterId];
    const secondId = getFinalsLoserRosterId(bracket);
    const second = Number.isFinite(secondId) ? byRoster[secondId] : null;

    rows.push({
      season: String(league.season ?? season),
      leagueName: league.name || name,
      champion: {
        rosterId: championRosterId,
        name: champ?.name || `Roster ${championRosterId}`,
        avatar: champ?.avatar || null,
      },
      runnerUp: second
        ? {
            rosterId: secondId,
            name: second.name,
            avatar: second.avatar || null,
          }
        : null,
    });
  }

  return rows.sort((a, b) => Number(b.season) - Number(a.season));
}
