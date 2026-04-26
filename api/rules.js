import { getSql, rateLimit, clientIp, readJsonBody, send } from './_db.js';
import { assertSiteAuth } from './_auth.js';
import { isUndefinedRelation } from './_pgErrors.js';

export default async function handler(req, res) {
  try {
    if (!assertSiteAuth(req, res, send)) return;

    const sql = getSql();

    if (req.method === 'GET') {
      const queryWithPosts = () => sql`
        select
          r.id,
          r.title,
          r.description,
          r.author,
          r.created_at,
          coalesce(sum(case when v.value = 1 then 1 else 0 end), 0)::int  as up,
          coalesce(sum(case when v.value = -1 then 1 else 0 end), 0)::int as down,
          coalesce(sum(v.value), 0)::int                                  as score,
          coalesce(
            (select count(*)::int from rule_posts p where p.rule_id = r.id),
            0
          ) as post_count
        from rules r
        left join votes v on v.rule_id = r.id
        group by r.id
        order by score desc, r.created_at desc
      `;

      const queryLegacy = () => sql`
        select
          r.id,
          r.title,
          r.description,
          r.author,
          r.created_at,
          coalesce(sum(case when v.value = 1 then 1 else 0 end), 0)::int  as up,
          coalesce(sum(case when v.value = -1 then 1 else 0 end), 0)::int as down,
          coalesce(sum(v.value), 0)::int                                  as score
        from rules r
        left join votes v on v.rule_id = r.id
        group by r.id
        order by score desc, r.created_at desc
      `;

      let rows;
      try {
        rows = await queryWithPosts();
      } catch (e) {
        if (isUndefinedRelation(e, 'rule_posts')) {
          rows = (await queryLegacy()).map((r) => ({ ...r, post_count: 0 }));
        } else {
          throw e;
        }
      }
      return send(res, 200, { rules: rows });
    }

    if (req.method === 'POST') {
      const ip = clientIp(req);
      if (!rateLimit(`rules:${ip}`, { max: 8, windowMs: 60_000 })) {
        return send(res, 429, { error: 'Too many requests, slow down a sec.' });
      }

      const body = await readJsonBody(req);
      if (!body || typeof body !== 'object') {
        return send(res, 400, { error: 'Invalid JSON body' });
      }
      const title = String(body.title || '').trim();
      const description = String(body.description || '').trim();
      const authorRaw = body.author == null ? null : String(body.author).trim();
      const author = authorRaw && authorRaw.length > 0 ? authorRaw.slice(0, 60) : null;

      if (title.length < 3 || title.length > 140) {
        return send(res, 400, { error: 'Title must be 3-140 characters' });
      }
      if (description.length > 2000) {
        return send(res, 400, { error: 'Description is too long (max 2000)' });
      }

      const [rule] = await sql`
        insert into rules (title, description, author)
        values (${title}, ${description}, ${author})
        returning id, title, description, author, created_at
      `;
      return send(res, 201, {
        rule: { ...rule, up: 0, down: 0, score: 0, post_count: 0 },
      });
    }

    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('rules handler error', err);
    return send(res, 500, { error: 'Server error' });
  }
}
