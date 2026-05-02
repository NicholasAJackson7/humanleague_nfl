import { leagueFormat } from '../config.js';

/** Fisher–Yates shuffle; optional `rng` for tests (`() => 0..1`). */
export function shuffleDraftSlots(userIds, rng = Math.random) {
  const a = [...userIds];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Round 1 = slot index order 0..n-1; round 2 = reverse; snake thereafter. */
export function snakeRoundUserIds(slotOrderUserIds, roundNumber) {
  const n = slotOrderUserIds.length;
  if (n === 0) return [];
  const forward = roundNumber % 2 === 1;
  const out = [];
  if (forward) {
    for (let i = 0; i < n; i++) out.push(slotOrderUserIds[i]);
  } else {
    for (let i = n - 1; i >= 0; i--) out.push(slotOrderUserIds[i]);
  }
  return out;
}

export function keeperSlotsFilled(nomination) {
  if (!nomination) return 0;
  if (nomination.nomination_kind === 'freeform') {
    return [nomination.k1_text, nomination.k2_text, nomination.k3_text].filter(Boolean).length;
  }
  return [nomination.k1_player_id, nomination.k2_player_id, nomination.k3_player_id].filter(Boolean).length;
}

export function keeperPlayerIdsFromNomination(nomination) {
  if (!nomination || nomination.nomination_kind !== 'roster') return [];
  return [nomination.k1_player_id, nomination.k2_player_id, nomination.k3_player_id]
    .filter(Boolean)
    .map(String);
}

/** Sleeper ids removed from the draft pool (roster keeper nominations only). */
export function takenIdsFromKeeperNominations(nominationsByUserId) {
  const set = new Set();
  if (!nominationsByUserId) return set;
  for (const n of nominationsByUserId.values()) {
    for (const id of keeperPlayerIdsFromNomination(n)) {
      set.add(id);
    }
  }
  return set;
}

export function remainingPicksPerUser(users, nominationByUserId, targetRosterSize) {
  const m = new Map();
  for (const u of users) {
    const uid = u?.user_id;
    if (!uid) continue;
    const kept = keeperSlotsFilled(nominationByUserId.get(uid));
    m.set(uid, Math.max(0, targetRosterSize - kept));
  }
  return m;
}

/**
 * @param {'ecr' | 'owned'} strategy
 */
export function pickBestAvailable(rankingsPlayers, takenIds, strategy) {
  const candidates = (rankingsPlayers || []).filter((p) => p.sleeper_id && !takenIds.has(String(p.sleeper_id)));
  if (!candidates.length) return null;

  const ranked = [...candidates];
  if (strategy === 'owned') {
    ranked.sort((a, b) => {
      const ao = a.owned_avg;
      const bo = b.owned_avg;
      if (ao != null && bo != null && ao !== bo) return bo - ao;
      if (ao != null && bo == null) return -1;
      if (ao == null && bo != null) return 1;
      return (a.ecr ?? 99999) - (b.ecr ?? 99999);
    });
  } else {
    ranked.sort((a, b) => (a.ecr ?? 99999) - (b.ecr ?? 99999));
  }
  return ranked[0];
}

/**
 * Snake draft until each team reaches `targetRosterSize` (keepers count toward roster).
 *
 * @param {object} opts
 * @param {string[]} opts.slotOrderUserIds — round-1 draft slot order (length = teams)
 * @param {object[]} opts.users — Sleeper users (need user_id)
 * @param {Map<string, object>} opts.nominationByUserId
 * @param {object[]} opts.rankingsPlayers — `/api/rankings` rows with sleeper_id, ecr, owned_avg
 * @param {'ecr' | 'owned'} opts.strategy
 */
/**
 * Who picks when — same traversal order as {@link simulateSnakeDraft}.
 *
 * @returns {Array<{ round: number, userId: string, slotIndex: number }>}
 */
export function buildPickQueue(
  slotOrderUserIds,
  users,
  nominationByUserId,
  targetRosterSize = leagueFormat.draftRounds,
) {
  const queue = [];
  if (!slotOrderUserIds?.length || !users?.length) return queue;

  const remaining = remainingPicksPerUser(users, nominationByUserId, targetRosterSize);
  let totalLeft = [...remaining.values()].reduce((a, b) => a + b, 0);
  let round = 1;
  const maxRounds = Math.max(targetRosterSize * 3, 64);

  while (totalLeft > 0 && round <= maxRounds) {
    const order = snakeRoundUserIds(slotOrderUserIds, round);
    let pickedThisRound = false;
    for (const userId of order) {
      const left = remaining.get(userId) ?? 0;
      if (left <= 0) continue;
      const slotIndex = slotOrderUserIds.indexOf(userId);
      queue.push({ round, userId, slotIndex });
      remaining.set(userId, left - 1);
      totalLeft--;
      pickedThisRound = true;
    }
    if (!pickedThisRound) break;
    round++;
  }

  return queue;
}

export function draftPickRecord(meta, overallPick, player, pickKind) {
  const sid = String(player.sleeper_id);
  return {
    overallPick,
    round: meta.round,
    userId: meta.userId,
    slotIndex: meta.slotIndex,
    sleeperId: sid,
    name: player.name || sid,
    pos: player.pos || '',
    team: player.team || '',
    ecr: player.ecr ?? null,
    pickKind,
  };
}

/** Keeper ids plus drafted ids (draft picks must use `.sleeperId`). */
export function combinedTakenIds(draftPicks, nominationByUserId) {
  const taken = takenIdsFromKeeperNominations(nominationByUserId);
  for (const p of draftPicks || []) {
    if (p?.sleeperId) taken.add(String(p.sleeperId));
  }
  return taken;
}

/** Sleeper startup/snake pick map → round cost per keeper (undrafted → penalty round). */
export function buildKeeperCostRoundPlacements(
  users,
  nominationByUserId,
  draftByPlayerId,
  undraftedKeeperRound = leagueFormat.undraftedKeeperRound,
) {
  const fallback = Number(undraftedKeeperRound);
  const ud = Number.isFinite(fallback) ? fallback : leagueFormat.undraftedKeeperRound;
  const maxR = leagueFormat.draftRounds;
  const placements = new Map();

  for (const u of users || []) {
    const uid = u?.user_id;
    if (!uid) continue;
    const nom = nominationByUserId.get(uid);
    if (!nom || nom.nomination_kind !== 'roster') continue;
    const ids = keeperPlayerIdsFromNomination(nom);
    if (!ids.length) continue;

    const byRound = new Map();
    for (const pid of ids) {
      const slot = draftByPlayerId?.get(String(pid));
      const rRaw = slot?.round;
      const base = Number.isFinite(Number(rRaw)) ? Number(rRaw) : ud;
      const rr = Math.min(Math.max(1, Math.floor(base)), maxR);
      if (!byRound.has(rr)) byRound.set(rr, []);
      const arr = byRound.get(rr);
      const ps = String(pid);
      if (!arr.includes(ps)) arr.push(ps);
    }
    placements.set(uid, byRound);
  }

  return placements;
}

export function simulateSnakeDraft({
  slotOrderUserIds,
  users,
  nominationByUserId,
  rankingsPlayers,
  strategy,
  targetRosterSize = leagueFormat.draftRounds,
}) {
  const picks = [];
  if (!slotOrderUserIds?.length || !users?.length) return picks;

  const queue = buildPickQueue(slotOrderUserIds, users, nominationByUserId, targetRosterSize);
  const taken = takenIdsFromKeeperNominations(nominationByUserId);

  for (const meta of queue) {
    const player = pickBestAvailable(rankingsPlayers, taken, strategy);
    if (!player) break;
    const sid = String(player.sleeper_id);
    taken.add(sid);
    picks.push(draftPickRecord(meta, picks.length + 1, player, 'auto'));
  }

  return picks;
}
