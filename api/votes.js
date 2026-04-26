import { getSql, rateLimit, clientIp, readJsonBody, send } from './_db.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST' && req.method !== 'DELETE') {
      res.setHeader('Allow', 'POST, DELETE');
      return send(res, 405, { error: 'Method not allowed' });
    }

    const ip = clientIp(req);
    if (!rateLimit(`votes:${ip}`, { max: 60, windowMs: 60_000 })) {
      return send(res, 429, { error: 'Too many requests, slow down a sec.' });
    }

    const body = await readJsonBody(req);
    if (!body || typeof body !== 'object') {
      return send(res, 400, { error: 'Invalid JSON body' });
    }

    const ruleId = String(body.rule_id || '').trim();
    const voterToken = String(body.voter_token || '').trim();
    if (!/^[0-9a-f-]{8,80}$/i.test(ruleId)) {
      return send(res, 400, { error: 'Invalid rule_id' });
    }
    if (voterToken.length < 8 || voterToken.length > 80) {
      return send(res, 400, { error: 'Invalid voter_token' });
    }

    const sql = getSql();

    if (req.method === 'DELETE') {
      await sql`delete from votes where rule_id = ${ruleId} and voter_token = ${voterToken}`;
    } else {
      const value = body.value === -1 || body.value === 1 ? body.value : null;
      if (value === null) {
        return send(res, 400, { error: 'value must be 1 or -1' });
      }
      await sql`
        insert into votes (rule_id, voter_token, value)
        values (${ruleId}, ${voterToken}, ${value})
        on conflict (rule_id, voter_token)
        do update set value = excluded.value, created_at = now()
      `;
    }

    const [totals] = await sql`
      select
        coalesce(sum(case when value = 1 then 1 else 0 end), 0)::int  as up,
        coalesce(sum(case when value = -1 then 1 else 0 end), 0)::int as down,
        coalesce(sum(value), 0)::int                                  as score
      from votes
      where rule_id = ${ruleId}
    `;
    return send(res, 200, { rule_id: ruleId, ...totals });
  } catch (err) {
    console.error('votes handler error', err);
    return send(res, 500, { error: 'Server error' });
  }
}
