import { send } from './_db.js';
import { assertSiteAuth } from './_auth.js';

const ECR_URL = 'https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_fpecr_latest.csv';
const IDS_URL = 'https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_playerids.csv';
const VALUES_URL = 'https://raw.githubusercontent.com/dynastyprocess/data/master/files/values.csv';

/** Only page types the Human League app exposes; shrinks in-memory cache vs parsing the full upstream CSV. */
const ECR_PAGE_TYPES = new Set(['redraft-overall']);

/**
 * Synthetic page types served from `values.csv` (DynastyProcess trade-value chart, 1QB only).
 * Same JSON shape as the ECR page types, with extra fields `value`, `age`, `ecr_pos`.
 */
const VALUES_PAGE_TYPES = new Set(['keeper-values-1qb']);

const ALLOWED_PAGE_TYPES = new Set([...ECR_PAGE_TYPES, ...VALUES_PAGE_TYPES]);

const DEFAULT_PAGE_TYPE = 'redraft-overall';

/** ttl matches DynastyProcess's weekly-fantasypros cron — 1h is fine for warm cache hits. */
const CACHE_TTL_MS = 60 * 60 * 1000;
const STALE_TTL_MS = 24 * 60 * 60 * 1000;

let _cache = {
  fetchedAt: 0,
  ecrByPageType: null,
  idMap: null,
  scrapeDate: null,
  valuesScrapeDate: null,
};
let _inflight = null;

/** Minimal RFC 4180 CSV parser. Handles quoted fields and embedded commas/newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      // swallow \r so \r\n collapses to one row break
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const header = rows[0];
  const out = new Array(rows.length - 1);
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length === 1 && r[0] === '') continue; // trailing blank line
    const obj = {};
    for (let j = 0; j < header.length; j++) {
      obj[header[j]] = r[j];
    }
    out[i - 1] = obj;
  }
  return out.filter(Boolean);
}

function isMissing(v) {
  return v == null || v === '' || v === 'NA';
}

function toNum(v) {
  if (isMissing(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'humanleague-nfl/rankings' } });
  if (!res.ok) {
    throw new Error(`Upstream ${url} responded ${res.status}`);
  }
  return res.text();
}

async function buildCache() {
  const [ecrText, idsText, valuesText] = await Promise.all([
    fetchText(ECR_URL),
    fetchText(IDS_URL),
    fetchText(VALUES_URL),
  ]);

  // Build FP id -> sleeper id map first (also keep position/team as a fallback for when ECR is missing them).
  const idRows = rowsToObjects(parseCsv(idsText));
  const idMap = new Map();
  for (const r of idRows) {
    const fp = r.fantasypros_id;
    const sl = r.sleeper_id;
    if (isMissing(fp) || isMissing(sl)) continue;
    idMap.set(String(fp), String(sl));
  }

  const ecrRows = rowsToObjects(parseCsv(ecrText));
  const ecrByPageType = new Map();
  let scrapeDate = null;

  for (const r of ecrRows) {
    const pageType = r.page_type;
    if (!pageType || !ECR_PAGE_TYPES.has(pageType)) continue;
    const ecr = toNum(r.ecr);
    if (ecr == null) continue;
    if (!scrapeDate && r.scrape_date) scrapeDate = r.scrape_date;

    const fpId = isMissing(r.id) ? null : String(r.id);
    const sleeperId = fpId ? idMap.get(fpId) || null : null;

    const player = {
      ecr,
      sd: toNum(r.sd),
      best: toNum(r.best),
      worst: toNum(r.worst),
      name: r.player || '',
      pos: r.pos || '',
      team: r.tm || r.team || '',
      bye: toNum(r.bye),
      owned_avg: toNum(r.player_owned_avg),
      rank_delta: toNum(r.rank_delta),
      fp_id: fpId,
      sleeper_id: sleeperId,
    };

    let bucket = ecrByPageType.get(pageType);
    if (!bucket) {
      bucket = [];
      ecrByPageType.set(pageType, bucket);
    }
    bucket.push(player);
  }

  for (const list of ecrByPageType.values()) {
    list.sort((a, b) => a.ecr - b.ecr);
  }

  // Build the synthetic keeper-values buckets from values.csv. Same record shape as ECR
  // entries (so the client renders one table) plus value/age/ecr_pos for keeper context.
  const valueRows = rowsToObjects(parseCsv(valuesText));
  const buildValuesBucket = (valueKey, ecrKey) => {
    const players = [];
    for (const r of valueRows) {
      const val = toNum(r[valueKey]);
      if (val == null) continue;
      const dynastyEcr = toNum(r[ecrKey]);
      const fpId = isMissing(r.fp_id) ? null : String(r.fp_id);
      players.push({
        ecr: dynastyEcr, // dynasty consensus rank (1QB chart)
        sd: null,
        best: null,
        worst: null,
        name: r.player || '',
        pos: r.pos || '',
        team: r.team || '',
        bye: null,
        owned_avg: null,
        rank_delta: null,
        value: val,
        age: toNum(r.age),
        draft_year: toNum(r.draft_year),
        ecr_pos: toNum(r.ecr_pos),
        fp_id: fpId,
        sleeper_id: fpId ? idMap.get(fpId) || null : null,
      });
    }
    players.sort((a, b) => b.value - a.value);
    return players;
  };

  ecrByPageType.set('keeper-values-1qb', buildValuesBucket('value_1qb', 'ecr_1qb'));

  let valuesScrapeDate = null;
  for (const r of valueRows) {
    if (r.scrape_date) {
      valuesScrapeDate = r.scrape_date;
      break;
    }
  }

  return { ecrByPageType, idMap, scrapeDate, valuesScrapeDate, fetchedAt: Date.now() };
}

async function getCache() {
  const now = Date.now();
  if (_cache.ecrByPageType && now - _cache.fetchedAt < CACHE_TTL_MS) {
    return _cache;
  }
  if (_inflight) return _inflight;
  _inflight = (async () => {
    try {
      const next = await buildCache();
      _cache = next;
      return _cache;
    } catch (err) {
      // serve stale within STALE_TTL_MS so a transient upstream blip doesn't break the page
      if (_cache.ecrByPageType && now - _cache.fetchedAt < STALE_TTL_MS) {
        console.warn('rankings: upstream fetch failed, serving stale cache', err);
        return _cache;
      }
      throw err;
    } finally {
      _inflight = null;
    }
  })();
  return _inflight;
}

export default async function handler(req, res) {
  try {
    if (!assertSiteAuth(req, res, send)) return;

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return send(res, 405, { error: 'Method not allowed' });
    }

    const url = new URL(req.url, 'http://localhost');
    const requested = String(url.searchParams.get('page_type') || DEFAULT_PAGE_TYPE);
    const pageType = ALLOWED_PAGE_TYPES.has(requested) ? requested : DEFAULT_PAGE_TYPE;

    const cache = await getCache();
    const players = cache.ecrByPageType.get(pageType) || [];
    const isValues = VALUES_PAGE_TYPES.has(pageType);

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(
      JSON.stringify({
        page_type: pageType,
        scrape_date: isValues ? cache.valuesScrapeDate || cache.scrapeDate : cache.scrapeDate,
        fetched_at: cache.fetchedAt,
        count: players.length,
        players,
      }),
    );
  } catch (err) {
    console.error('rankings handler error', err);
    return send(res, 502, { error: 'Could not load rankings (upstream unavailable)' });
  }
}
