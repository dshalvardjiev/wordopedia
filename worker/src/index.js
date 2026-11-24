// Wordopedia usage events: receives batches from the app and stores them in D1 (see docs/tracking.md).
// POST /e      a batch: {"events": [...]}; answers {"ok": n, "bad": m}
// GET  /health "ok", for smoke tests
// Monthly cron: first-answer totals of events older than 12 months go to word_summary, then those events are deleted.

const KINDS = new Set(['open', 'session_start', 'answer', 'session_end', 'tick', 'view', 'award']);
const SESSION_KINDS = new Set(['session_start', 'answer', 'session_end', 'tick']);
const EXERCISES = new Set(['x-bg', 'bg-x', 'art', 'conj', 'conj-table', 'match', 'dialog', 'math']);
const FORMATS = new Set(['test', 'open', 'table', 'order']); // order: lines of a dialogue put in order
// Answers; the matching exercise tells a wrong pair, a wrong article or both apart.
const RESULTS = new Set(['ok', 'typo', 'wrong', 'hint', 'shown', 'time', 'pair', 'art', 'both']);
const AWARD_HOW = new Set(['new', 'retro']);         // award: earned now, or granted from earlier progress
const SECTIONS = new Set(['words', 'awards', 'award']); // view: Думи tab, Награди tab, one achievement's detail sheet
const ITEM = /^[a-z0-9-]{1,40}$/;                    // achievement id
const STATUSES = new Set(['done', 'quit', 'abandoned']);
const ENVS = new Set(['production', 'staging', 'development']);
const ID = /^[0-9a-z-]{8,40}$/i;
const COURSE = /^[a-z0-9-]{1,32}$/;
const MAX_BODY = 64 * 1024;
const MAX_EVENTS = 200;
const DAY = 864e5;
const RETENTION = 365 * DAY;
export const COLUMNS = ['id', 'ts', 'rx', 'dev', 'ver', 'env', 'course', 'kind', 'sess', 'ex', 'fmt', 'word', 'first',
  'result', 'ms', 'pick', 'n', 'size', 'secs', 'status', 'section', 'item', 'score', 'max_score', 'rounds'];
// Fields beyond the common ones (id, ts, rx, dev, ver, env, course, kind) that each kind keeps; the rest are emptied.
const KEEP = {
  open: [],
  session_start: ['sess', 'ex', 'fmt', 'n', 'size', 'secs', 'status', 'rounds'],
  answer: ['sess', 'ex', 'fmt', 'word', 'first', 'result', 'ms', 'pick', 'n', 'size', 'secs', 'status'],
  session_end: ['sess', 'ex', 'fmt', 'n', 'size', 'secs', 'status', 'score', 'max_score'],
  tick: ['sess', 'ex', 'fmt', 'n', 'size', 'secs', 'status'],
  view: ['section', 'item', 'secs'],
  award: ['item', 'result'],
};

const str = (v, max) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);
const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);
const oneOf = (v, set) => (set.has(v) ? v : null);

// A valid event as a row, or null. Unknown fields are ignored; a wrong optional field is dropped, a wrong required one
// rejects the event.
// offset: the device clock's error (server time minus the device's "sent" time), added to the event time. An event time
// that is still implausible is replaced by the receive time rather than rejected, so a wrong clock never loses data.
export function toRow(e, now, offset = 0) {
  if (!e || typeof e !== 'object') return null;
  const id = typeof e.id === 'string' && ID.test(e.id) ? e.id : null;
  const dev = typeof e.dev === 'string' && ID.test(e.dev) ? e.dev : null;
  const kind = oneOf(e.kind, KINDS);
  const env = oneOf(e.env, ENVS);
  const t = Number.isInteger(e.ts) ? e.ts + offset : null;
  const ts = t !== null && t >= now - 400 * DAY && t <= now + 5 * 60e3 ? t : now;
  if (!id || !dev || !kind || !env) return null;
  const course = typeof e.course === 'string' && COURSE.test(e.course) ? e.course : null;
  const row = {
    id, ts, rx: now, dev, env, kind, course,
    ver: str(e.ver, 40),
    sess: typeof e.sess === 'string' && ID.test(e.sess) ? e.sess : null,
    ex: oneOf(e.ex, EXERCISES), fmt: oneOf(e.fmt, FORMATS),
    word: str(e.word, 160), first: e.first === 1 || e.first === true ? 1 : e.first === 0 || e.first === false ? 0 : null,
    result: oneOf(e.result, kind === 'award' ? AWARD_HOW : RESULTS), ms: int(e.ms, 0, 36e5), pick: str(e.pick, 160),
    n: int(e.n, 0, 1e4), size: int(e.size, 0, 1e4), secs: int(e.secs, 0, 86400), status: oneOf(e.status, STATUSES),
    section: oneOf(e.section, SECTIONS), item: typeof e.item === 'string' && ITEM.test(e.item) ? e.item : null,
    score: int(e.score, 0, 1e4), max_score: int(e.max_score, 0, 1e4), rounds: int(e.rounds, 1, 100),
  };
  // Required per kind.
  if (SESSION_KINDS.has(kind) && (!row.sess || !row.course || !row.ex || !row.fmt)) return null;
  if (kind === 'view' && !row.section) return null;
  if (kind === 'award' && (!row.item || !row.result)) return null;
  if (kind === 'answer' && (!row.word || row.first === null || !row.result)) return null;
  if (kind === 'session_end' && !row.status) return null;
  for (const c of COLUMNS.slice(8)) if (!KEEP[kind].includes(c)) row[c] = null;
  return row;
}

const INSERT = `INSERT OR IGNORE INTO events (${COLUMNS.join(', ')})
  SELECT ${COLUMNS.map(c => `json_extract(value, '$.${c}')`).join(', ')} FROM json_each(?1)`;

function corsHeaders(origin) {
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
}
const json = (body, status, headers) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') return new Response('ok');
    if (url.pathname !== '/e') return new Response('not found', { status: 404 });

    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!allowed.includes(origin)) return new Response('forbidden', { status: 403 });
    const cors = corsHeaders(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors });

    // Collection paused on the server: accept and drop, so the app clears its queue.
    if (env.ACCEPT === 'false') return json({ ok: 0, bad: 0, paused: true }, 200, cors);

    // The IP is used only as the rate-limit key, in memory; it is never stored or logged.
    if (env.RL) {
      const { success } = await env.RL.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' });
      if (!success) return json({ error: 'rate limited' }, 429, cors);
    }

    const length = +(request.headers.get('Content-Length') || 0);
    if (length > MAX_BODY) return json({ error: 'too large' }, 413, cors);
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ error: 'too large' }, 413, cors);
    let body;
    try { body = JSON.parse(text); } catch (e) { return json({ error: 'bad json' }, 400, cors); }
    const list = Array.isArray(body) ? body : body && Array.isArray(body.events) ? body.events : null;
    if (!list || list.length > MAX_EVENTS) return json({ error: 'bad batch' }, 400, cors);

    const now = Date.now();
    const sent = body && Number.isInteger(body.sent) ? body.sent : null;
    const offset = sent !== null && Math.abs(now - sent) < 3650 * DAY ? now - sent : 0;
    const rows = list.map(e => toRow(e, now, offset)).filter(Boolean);
    const bad = list.length - rows.length;
    if (rows.length) {
      try {
        await env.DB.prepare(INSERT).bind(JSON.stringify(rows)).run();
      } catch (e) {
        console.error('insert failed', String(e && e.message || e).slice(0, 200));
        return json({ error: 'storage' }, 503, cors);
      }
    }
    if (bad) console.log('rejected events', bad);
    return json({ ok: rows.length, bad }, 200, cors);
  },

  async scheduled(controller, env) {
    const cut = Date.now() - RETENTION;
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO word_summary (month, course, ex, fmt, word, attempts, errors, typos)
        SELECT strftime('%Y-%m', ts / 1000, 'unixepoch'), course, ex, fmt, word,
               COUNT(*), SUM(result NOT IN ('ok', 'typo')), SUM(result = 'typo')
        FROM events
        WHERE kind = 'answer' AND first = 1 AND env = 'production' AND rx < ?1
          AND dev NOT IN (SELECT dev FROM blocked_devices)
        GROUP BY 1, 2, 3, 4, 5
        ON CONFLICT (month, course, ex, fmt, word) DO UPDATE SET
          attempts = attempts + excluded.attempts, errors = errors + excluded.errors, typos = typos + excluded.typos`).bind(cut),
      env.DB.prepare('DELETE FROM events WHERE rx < ?1').bind(cut),
    ]);
  },
};
