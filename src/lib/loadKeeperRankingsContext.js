import { config, leagueFormat } from '../config.js';
import { resolveLeagueHistoryChain, fetchRosters, fetchUsers } from './sleeper.js';
import { findLatestSeasonWithSnakePicks, buildDraftSlotByPlayerId } from './drafts.js';
import {
  rosterPlayerIdSet,
  mergeKeeperDraftVsEcr,
  buildRosterPlayerToOwnerMap,
} from './keeperRankings.js';

function buildManagerLabels(users) {
  if (!Array.isArray(users)) return new Map();
  return new Map(
    users
      .filter((u) => u.user_id)
      .map((u) => {
        const id = String(u.user_id);
        const label =
          String(u.metadata?.team_name || u.display_name || u.user_id || '').trim() || id;
        return [id, label];
      }),
  );
}

/**
 * Same keeper-vs-ECR dataset as the Rankings page: latest league season with a completed snake draft.
 *
 * @param {Array<object>} ecrPlayers `players` from GET /api/rankings?page_type=redraft-overall
 */
export async function loadKeeperRankingsContext(ecrPlayers) {
  if (!config.leagueId) {
    return { status: 'no-league' };
  }
  const chain = await resolveLeagueHistoryChain(config.leagueId);
  const hit = await findLatestSeasonWithSnakePicks(chain);
  if (!hit) {
    return {
      status: 'no-draft',
      message: 'No completed draft found in linked league seasons yet.',
    };
  }
  const draftBy = buildDraftSlotByPlayerId(hit.board.picks);
  const [rosters, users] = await Promise.all([fetchRosters(hit.leagueId), fetchUsers(hit.leagueId)]);
  const rosterIds = rosterPlayerIdSet(rosters);
  const playerToOwner = buildRosterPlayerToOwnerMap(rosters);
  const labelByOwnerId = buildManagerLabels(users);
  const rawRows = mergeKeeperDraftVsEcr(
    ecrPlayers,
    rosterIds,
    draftBy,
    leagueFormat,
    playerToOwner,
  );
  const rows = rawRows.map((r) => ({
    ...r,
    manager_label:
      r.owner_id != null ? labelByOwnerId.get(String(r.owner_id)) || String(r.owner_id) : '—',
  }));
  return {
    status: 'ready',
    season: String(hit.season),
    leagueName: hit.name || '',
    draftLabel: hit.board.draftLabel || '',
    sourceLeagueId: hit.leagueId,
    rows,
  };
}
