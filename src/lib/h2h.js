import {
  buildTeams,
  getPlayoffMatchupPairs,
  getRegularSeasonMatchupPairs,
  round2,
} from './stats.js';

function mergeUserMeta(usersById, bundle) {
  const teams = buildTeams(bundle.users, bundle.rosters);
  for (const t of teams) {
    if (!t.ownerId) continue;
    const prev = usersById[t.ownerId] || {};
    usersById[t.ownerId] = {
      displayName: t.handle || t.name || prev.displayName,
      avatar: t.avatar || prev.avatar || null,
    };
  }
}

/**
 * Aggregates regular-season head-to-head across all bundles (newest-first order
 * is best for mergeUserMeta if you pass entries reversed when merging — callers
 * should merge oldest→newest so the newest season wins display fields).
 */
export function computeHeadToHeadRecords(
  bundles,
  { scope = 'regular' } = {}
) {
  const usersById = {};
  for (let i = bundles.length - 1; i >= 0; i--) {
    mergeUserMeta(usersById, bundles[i]);
  }

  const rosterToOwner = (bundle) =>
    Object.fromEntries(
      bundle.rosters.map((r) => [String(r.roster_id), r.owner_id])
    );

  const pairMap = new Map();
  const getPairs =
    scope === 'playoff' ? getPlayoffMatchupPairs : getRegularSeasonMatchupPairs;

  for (const bundle of bundles) {
    const r2o = rosterToOwner(bundle);
    const pairs = getPairs(bundle);

    for (const [rowA, rowB] of pairs) {
      const oa = r2o[String(rowA.rosterId)];
      const ob = r2o[String(rowB.rosterId)];
      if (!oa || !ob || oa === ob) continue;

      const pa = rowA.points;
      const pb = rowB.points;
      const low = oa < ob ? oa : ob;
      const high = oa < ob ? ob : oa;
      const scoreLow = oa < ob ? pa : pb;
      const scoreHigh = oa < ob ? pb : pa;

      const key = `${low}\0${high}`;
      if (!pairMap.has(key)) {
        pairMap.set(key, {
          userA: low,
          userB: high,
          winsA: 0,
          winsB: 0,
          ties: 0,
          pfA: 0,
          pfB: 0,
          games: 0,
        });
      }
      const rec = pairMap.get(key);
      if (scoreLow > scoreHigh) rec.winsA += 1;
      else if (scoreHigh > scoreLow) rec.winsB += 1;
      else rec.ties += 1;
      rec.pfA += scoreLow;
      rec.pfB += scoreHigh;
      rec.games += 1;
    }
  }

  const rows = [...pairMap.values()]
    .map((r) => ({
      userA: r.userA,
      userB: r.userB,
      winsA: r.winsA,
      winsB: r.winsB,
      ties: r.ties,
      games: r.games,
      pfA: round2(r.pfA),
      pfB: round2(r.pfB),
      avgA: r.games ? round2(r.pfA / r.games) : 0,
      avgB: r.games ? round2(r.pfB / r.games) : 0,
    }))
    .sort((a, b) => b.games - a.games);

  return { rows, usersById };
}

export function collectAllOwnersFromBundles(bundles) {
  const usersById = {};
  for (let i = bundles.length - 1; i >= 0; i--) {
    mergeUserMeta(usersById, bundles[i]);
  }
  return usersById;
}

function matchupRowPoints(m) {
  const startersPoints = Array.isArray(m.starters_points) ? m.starters_points : [];
  if (typeof m.points === 'number') {
    return round2(m.points);
  }
  return round2(startersPoints.reduce((s, n) => s + (Number(n) || 0), 0));
}

function rosterOwnerMap(bundle) {
  return Object.fromEntries(
    (bundle.rosters || []).map((r) => [String(r.roster_id), r.owner_id])
  );
}

/** If Sleeper’s winners bracket lists this roster pair, return the highest round number found. */
function bracketRoundForPair(bracket, rosterId1, rosterId2) {
  if (!Array.isArray(bracket)) return null;
  const a = Number(rosterId1);
  const b = Number(rosterId2);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  let best = null;
  for (const row of bracket) {
    const t1 = Number(row.t1);
    const t2 = Number(row.t2);
    if (!Number.isFinite(t1) || !Number.isFinite(t2)) continue;
    if ((t1 === a && t2 === b) || (t1 === b && t2 === a)) {
      const r = Number(row.r);
      if (Number.isFinite(r) && (best == null || r > best)) best = r;
    }
  }
  return best;
}

/**
 * Every Sleeper week where these two owner user_ids faced each other (regular or playoff).
 * `bundles` should be newest season first (same order as fetchLeagueHistoryBundles).
 * Scores are ordered to match `userIdA` / `userIdB` arguments.
 */
export function listH2hGamesBetweenUsers(bundles, userIdA, userIdB) {
  if (!userIdA || !userIdB || userIdA === userIdB) return [];

  const out = [];
  for (const bundle of bundles) {
    const season = String(bundle.league?.season ?? '');
    const leagueName = bundle.league?.name || '';
    const lastRw = bundle.lastRegularWeek ?? 14;
    const r2o = rosterOwnerMap(bundle);
    const bracket = bundle.winnersBracket;

    const weeks = Object.keys(bundle.matchupsByWeek || {})
      .map(Number)
      .filter((w) => Number.isFinite(w))
      .sort((a, b) => a - b);

    for (const week of weeks) {
      const matches = bundle.matchupsByWeek[week];
      if (!Array.isArray(matches)) continue;

      const byMid = {};
      for (const m of matches) {
        const mid = m.matchup_id;
        if (mid == null) continue;
        if (!byMid[mid]) byMid[mid] = [];
        byMid[mid].push(m);
      }

      for (const group of Object.values(byMid)) {
        if (group.length !== 2) continue;
        const [m1, m2] = group;
        const rid1 = m1.roster_id;
        const rid2 = m2.roster_id;
        const o1 = r2o[String(rid1)];
        const o2 = r2o[String(rid2)];
        if (!o1 || !o2 || o1 === o2) continue;
        if (o1 !== userIdA && o2 !== userIdA) continue;
        if (o1 !== userIdB && o2 !== userIdB) continue;

        const p1 = matchupRowPoints(m1);
        const p2 = matchupRowPoints(m2);
        const scoreA = o1 === userIdA ? p1 : p2;
        const scoreB = o1 === userIdB ? p1 : p2;
        const phase = week > lastRw ? 'playoff' : 'regular';
        const moniker =
          phase === 'playoff'
            ? `Playoffs · Week ${week}`
            : `Regular season · Week ${week}`;
        const winnerUserId =
          scoreA > scoreB ? userIdA : scoreB > scoreA ? userIdB : null;
        const margin = round2(scoreA - scoreB);
        const bracketRound =
          phase === 'playoff' ? bracketRoundForPair(bracket, rid1, rid2) : null;

        out.push({
          season,
          leagueName,
          week,
          phase,
          moniker,
          bracketRound,
          scoreA,
          scoreB,
          margin,
          winnerUserId,
        });
      }
    }
  }

  out.sort((a, b) => {
    const ys = Number(b.season) - Number(a.season);
    if (ys !== 0) return ys;
    return b.week - a.week;
  });
  return out;
}

export function summarizeH2hGames(games, userIdA, userIdB) {
  let winsA = 0;
  let winsB = 0;
  let ties = 0;
  let pfA = 0;
  let pfB = 0;
  for (const g of games) {
    pfA += g.scoreA;
    pfB += g.scoreB;
    if (g.winnerUserId === userIdA) winsA += 1;
    else if (g.winnerUserId === userIdB) winsB += 1;
    else ties += 1;
  }
  const n = games.length || 1;
  return {
    winsA,
    winsB,
    ties,
    games: games.length,
    pfA: round2(pfA),
    pfB: round2(pfB),
    avgA: round2(pfA / n),
    avgB: round2(pfB / n),
    regGames: games.filter((g) => g.phase === 'regular').length,
    poGames: games.filter((g) => g.phase === 'playoff').length,
  };
}
