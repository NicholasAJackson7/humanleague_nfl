import { rosterPlayerIds } from './sleeper.js';

/** All Sleeper roster player ids across teams for one league season. */
export function rosterPlayerIdSet(rosters) {
  const s = new Set();
  if (!Array.isArray(rosters)) return s;
  for (const r of rosters) {
    for (const id of rosterPlayerIds(r)) {
      s.add(String(id));
    }
  }
  return s;
}

/**
 * Treat consensus rank as an overall draft slot: implied round = ceil(rank / teamCount).
 * Same for snake and linear (each round is exactly `teamCount` picks).
 */
export function impliedRoundFromEcrRank(ecrRank, teamCount) {
  const tc = Math.max(1, Math.floor(Number(teamCount)) || 10);
  const r = Number(ecrRank);
  if (!Number.isFinite(r) || r <= 0) return null;
  return Math.ceil(r / tc);
}

/** Maps each rostered NFL player id → Sleeper `owner_id` (fantasy manager). */
export function buildRosterPlayerToOwnerMap(rosters) {
  const m = new Map();
  if (!Array.isArray(rosters)) return m;
  for (const roster of rosters) {
    const oid = roster?.owner_id;
    if (oid == null || oid === '') continue;
    const oidStr = String(oid);
    for (const pid of rosterPlayerIds(roster)) {
      m.set(pid, oidStr);
    }
  }
  return m;
}

/**
 * Intersect FP/Sleeper ECR rows with last-season rostered NFL players only.
 * `draftByPlayerId`: sleeper player id → { round, pick_no } from startup/snake draft.
 * `playerToOwner`: optional map sleeper player id → owner_id (fantasy manager).
 * Undrafted players → round lost = `rules.undraftedKeeperRound`; Δ uses a mid-round overall pick in that round as proxy (no startup pick_no).
 * Rows include `ecr_implied_round` via {@link impliedRoundFromEcrRank}.
 */
export function mergeKeeperDraftVsEcr(ecrPlayers, rosterIds, draftByPlayerId, rules, playerToOwner) {
  const { undraftedKeeperRound, teamCount } = rules;
  const midUndraftedPick =
    (undraftedKeeperRound - 1) * teamCount + Math.ceil(teamCount / 2);
  const out = [];

  for (const p of ecrPlayers) {
    const sid = p.sleeper_id ? String(p.sleeper_id) : '';
    if (!sid || !rosterIds.has(sid)) continue;

    const draft = draftByPlayerId.get(sid);
    const roundDrafted = draft?.round ?? null;
    const pickNo = draft?.pick_no ?? null;
    const roundLost = roundDrafted ?? undraftedKeeperRound;
    let keeper_delta = null;
    if (p.ecr != null && Number.isFinite(Number(p.ecr))) {
      const ecrN = Number(p.ecr);
      keeper_delta =
        pickNo != null ? Number(pickNo) - ecrN : midUndraftedPick - ecrN;
    }
    const owner_id = playerToOwner?.get(sid) ?? null;
    const ecr_implied_round = impliedRoundFromEcrRank(p.ecr, teamCount);

    out.push({
      ...p,
      draft_round: roundDrafted,
      draft_pick_overall: pickNo,
      round_lost: roundLost,
      keeper_delta,
      ecr_implied_round,
      owner_id,
    });
  }

  out.sort((a, b) => {
    const sa = a.keeper_delta != null ? a.keeper_delta : midUndraftedPick - (a.ecr ?? 9999);
    const sb = b.keeper_delta != null ? b.keeper_delta : midUndraftedPick - (b.ecr ?? 9999);
    if (sb !== sa) return sb - sa;
    return (a.ecr ?? 9999) - (b.ecr ?? 9999);
  });

  return out;
}
