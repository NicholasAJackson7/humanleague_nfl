import { leagueFormat } from '../config.js';
import { rosterPlayerIds } from './sleeper.js';

function costRoundForPlayer(pid, draftByPlayerId, undraftedRound) {
  const slot = draftByPlayerId?.get(String(pid));
  const ud = Number.isFinite(Number(undraftedRound)) ? Number(undraftedRound) : leagueFormat.undraftedKeeperRound;
  const raw = Number.isFinite(Number(slot?.round)) ? Number(slot.round) : ud;
  return Math.min(Math.max(1, Math.floor(raw)), leagueFormat.draftRounds);
}

/**
 * Up to `maxKeepers` roster players, each from a distinct startup cost round (undrafted shares one bucket).
 */
function pickKeeperIdsUniqueCostRound(sortedIds, draftByPlayerId, maxKeepers = 3) {
  const ud = leagueFormat.undraftedKeeperRound;
  const usedRounds = new Set();
  const out = [];
  const map = draftByPlayerId instanceof Map && draftByPlayerId.size > 0 ? draftByPlayerId : null;

  for (const pid of sortedIds) {
    if (out.length >= maxKeepers) break;
    const rr = map ? costRoundForPlayer(pid, map, ud) : ud;
    if (usedRounds.has(rr)) continue;
    usedRounds.add(rr);
    out.push(pid);
  }

  return out;
}

/**
 * Dev-only: fake `keeper_nominations`-shaped rows so Mock Draft can be tested without DB/API data.
 * Uses each manager's roster and picks keepers so **at most one per cost round** from last startup snake
 * (`draftByPlayerId`: Sleeper player id → `{ round }`). Undrafted / missing → round `undraftedKeeperRound`.
 * Without draft data, only **one** keeper per team is chosen (all unknown costs collapse to the same round).
 */
export function buildDevMockKeeperNominations(users, rosters, sourceSeason, draftByPlayerId = null) {
  const season = String(sourceSeason ?? '');
  const rosterByOwner = new Map();
  for (const r of rosters || []) {
    if (r?.owner_id) rosterByOwner.set(r.owner_id, r);
  }

  const rows = [];
  for (const u of users || []) {
    const uid = u?.user_id;
    if (!uid) continue;

    const roster = rosterByOwner.get(uid);
    const ids = [...rosterPlayerIds(roster)].sort();

    if (ids.length >= 1) {
      const picked = pickKeeperIdsUniqueCostRound(ids, draftByPlayerId, 3);
      const k1 = picked[0] ?? null;
      const k2 = picked[1] ?? null;
      const k3 = picked[2] ?? null;
      rows.push({
        id: `dev-mock-${uid}`,
        sleeper_user_id: uid,
        source_season: season,
        league_id_snapshot: null,
        nomination_kind: 'roster',
        k1_player_id: k1,
        k2_player_id: k2,
        k3_player_id: k3,
        k1_text: null,
        k2_text: null,
        k3_text: null,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } else {
      rows.push({
        id: `dev-mock-${uid}`,
        sleeper_user_id: uid,
        source_season: season,
        league_id_snapshot: null,
        nomination_kind: 'freeform',
        k1_player_id: null,
        k2_player_id: null,
        k3_player_id: null,
        k1_text: 'Dev mock — empty roster',
        k2_text: null,
        k3_text: null,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  return rows;
}
