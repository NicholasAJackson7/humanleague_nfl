import {
  resolveLeagueHistoryChain,
  fetchLeagueDrafts,
  fetchDraftPicks,
  fetchUsers,
  fetchRosters,
} from './sleeper.js';
import { buildTeams } from './stats.js';

/** Prefer main snake draft; otherwise first draft returned by Sleeper. */
export function pickPrimaryDraft(drafts) {
  if (!Array.isArray(drafts) || drafts.length === 0) return null;
  const snake = drafts.find((d) => d.type === 'snake');
  if (snake) return snake;
  return drafts[0];
}

export function formatPickPlayer(pick) {
  if (!pick) return { name: '—', pos: '', team: '' };
  const m = pick?.metadata || {};
  const fn = String(m.first_name || '').trim();
  const ln = String(m.last_name || '').trim();
  const name = [fn, ln].filter(Boolean).join(' ').trim() || pick?.player_id || 'Unknown';
  const pos = String(m.position || '').trim();
  const team = String(m.team || m.team_abbr || '').trim();
  return { name, pos, team };
}

/**
 * Columns = draft slot (round-1 order). Rows = rounds. Each cell is the pick with that `round` + `draft_slot`.
 */
export function buildDraftGridModel(draft, picks, teamsByUserId) {
  const slotToUserId = {};
  const order = draft?.draft_order;
  if (order && typeof order === 'object') {
    for (const [uid, slot] of Object.entries(order)) {
      const s = Number(slot);
      if (Number.isFinite(s)) slotToUserId[s] = uid;
    }
  }

  const slotsFromPicks = [...new Set(picks.map((p) => Number(p.draft_slot)).filter(Number.isFinite))].sort(
    (a, b) => a - b
  );

  if (!Object.keys(slotToUserId).length) {
    for (const slot of slotsFromPicks) {
      const r1 = picks.find((p) => Number(p.round) === 1 && Number(p.draft_slot) === slot);
      if (r1?.picked_by) slotToUserId[slot] = r1.picked_by;
    }
  }

  let slotsFinal =
    Object.keys(slotToUserId).length > 0
      ? Object.keys(slotToUserId)
          .map(Number)
          .filter(Number.isFinite)
          .sort((a, b) => a - b)
      : [...slotsFromPicks];

  for (const slot of slotsFinal) {
    if (!slotToUserId[slot]) {
      const any = picks.find((p) => Number(p.draft_slot) === slot && p.picked_by);
      if (any) slotToUserId[slot] = any.picked_by;
    }
  }

  const columns = slotsFinal.map((slot) => {
    const userId = slotToUserId[slot];
    return {
      slot,
      userId: userId || null,
      team: userId ? teamsByUserId[userId] || null : null,
    };
  });

  const maxRound = picks.reduce((m, p) => Math.max(m, Number(p.round) || 0), 0);

  const pickByRoundSlot = new Map();
  for (const p of picks) {
    const r = Number(p.round);
    const s = Number(p.draft_slot);
    if (Number.isFinite(r) && Number.isFinite(s)) {
      pickByRoundSlot.set(`${r}-${s}`, p);
    }
  }

  function getPick(round, slot) {
    return pickByRoundSlot.get(`${round}-${slot}`) || null;
  }

  return { columns, maxRound, getPick, slotCount: columns.length };
}

/**
 * Draft + ordered picks + team map by Sleeper `user_id` (matches `picked_by` on picks).
 */
export async function fetchSeasonDraftBoard(leagueId) {
  const [drafts, users, rosters] = await Promise.all([
    fetchLeagueDrafts(leagueId).catch(() => []),
    fetchUsers(leagueId),
    fetchRosters(leagueId),
  ]);

  const draft = pickPrimaryDraft(drafts);
  if (!draft) {
    return {
      draft: null,
      picks: [],
      teamsByUserId: {},
      draftLabel: null,
    };
  }

  const rawPicks = await fetchDraftPicks(draft.draft_id).catch(() => []);
  const picks = Array.isArray(rawPicks)
    ? [...rawPicks].sort((a, b) => (a.pick_no || 0) - (b.pick_no || 0))
    : [];

  const teams = buildTeams(users, rosters);
  const teamsByUserId = Object.fromEntries(teams.map((t) => [t.ownerId, t]));

  const metaName = draft.metadata?.name;
  const draftLabel =
    (typeof metaName === 'string' && metaName.trim()) ||
    `${draft.season || ''} ${draft.type || 'draft'}`.trim();

  return {
    draft,
    picks,
    teamsByUserId,
    draftLabel,
  };
}

export async function loadDraftHistoryChain(currentLeagueId) {
  const chain = await resolveLeagueHistoryChain(currentLeagueId);
  return chain;
}

/**
 * First linked season (newest-first chain) whose primary draft has at least one player pick.
 * Skips e.g. the upcoming league before its draft runs.
 */
export async function findLatestSeasonWithSnakePicks(chain) {
  if (!Array.isArray(chain) || chain.length === 0) return null;
  for (const entry of chain) {
    const board = await fetchSeasonDraftBoard(entry.leagueId);
    if (board?.picks?.length) {
      return {
        season: entry.season,
        leagueId: entry.leagueId,
        name: entry.name,
        board,
      };
    }
  }
  return null;
}

/** Sleeper pick rows → first occurrence per `player_id` of `{ round, pick_no }`. */
export function buildDraftSlotByPlayerId(picks) {
  const map = new Map();
  if (!Array.isArray(picks)) return map;
  for (const p of picks) {
    const pid = p.player_id;
    if (!pid) continue;
    const key = String(pid);
    const round = Number(p.round);
    const pickNo = Number(p.pick_no);
    if (!Number.isFinite(round) || !Number.isFinite(pickNo)) continue;
    if (!map.has(key)) map.set(key, { round, pick_no: pickNo });
  }
  return map;
}
