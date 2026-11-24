// Local usage dashboard (docs/tracking.md): serves dashboard/index.html on http://127.0.0.1:8788 and answers
// /api/report with the report queries, run against the live D1 database through the Cloudflare API.
//
//   npm run dashboard          live data; needs CLOUDFLARE_API_TOKEN (Account > D1 > Read) and CLOUDFLARE_ACCOUNT_ID,
//                              from the environment or dashboard/.env (KEY=value lines; the file is git-ignored)
//   npm run dashboard:local    the local database of `wrangler dev` in worker/ (development)
//
// The token stays in this process: the browser only ever talks to 127.0.0.1, and only fixed SELECT queries run.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseFilter, reportQueries, deviceQueries, sessionsQueries, sessionQueries } from './queries.mjs';
// Achievement names and symbols from the app's catalogue (pure module, no browser needed).
import { BY_ID } from '../src/lib/ach.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const LOCAL = process.argv.includes('--local');
const PORT = +(process.argv.find(a => a.startsWith('--port='))?.slice(7) || 8788);
const DB_NAME = 'wordopedia-events';

// dashboard/.env: KEY=value per line; the environment wins.
const envFile = path.join(DIR, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
// For tests only: another address that answers like the Cloudflare API.
const API = process.env.CLOUDFLARE_API_BASE || 'https://api.cloudflare.com/client/v4';
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;

class Problem extends Error {}

// ----- sources -----
let dbId = null;
async function cf(pathname, init) {
  if (!TOKEN || !ACCOUNT) throw new Problem('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are not set (environment or dashboard/.env).');
  let r;
  try {
    r = await fetch(`${API}/accounts/${ACCOUNT}${pathname}`,
      { ...init, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } });
  } catch (e) { throw new Problem('Cloudflare API not reachable: ' + e.message); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) {
    const msg = (j.errors || []).map(e => e.message).join('; ') || `HTTP ${r.status}`;
    throw new Problem(r.status === 401 || r.status === 403
      ? `Cloudflare refused the token (${msg}). It needs Account > D1 > Read for this account.` : `Cloudflare API: ${msg}`);
  }
  return j.result;
}
async function remoteQuery(sql) {
  if (!dbId) {
    const list = await cf(`/d1/database?name=${encodeURIComponent(DB_NAME)}`);
    const db = (list || []).find(d => d.name === DB_NAME);
    if (!db) throw new Problem(`No D1 database named ${DB_NAME} in this account.`);
    dbId = db.uuid;
  }
  const res = await cf(`/d1/database/${dbId}/query`, { method: 'POST', body: JSON.stringify({ sql }) });
  return (res && res[0] && res[0].results) || [];
}
function localQuery(sql) {
  return new Promise((resolve, reject) => {
    execFile('npx', ['wrangler', 'd1', 'execute', DB_NAME, '--local', '--json', '--command', sql],
      { cwd: path.join(DIR, '..', 'worker'), maxBuffer: 32 << 20 }, (err, stdout, stderr) => {
        if (err) return reject(new Problem('wrangler d1 execute --local failed: ' + (stderr || err.message).slice(0, 300)));
        try { resolve(JSON.parse(stdout)[0].results || []); } catch (e) { reject(new Problem('Unexpected wrangler output')); }
      });
  });
}

// API routes: each builds a set of named SELECT queries from the request (null = invalid request).
const ROUTES = {
  '/api/report': q => reportQueries(parseFilter(q)),
  '/api/devices': q => deviceQueries(parseFilter(q)),
  '/api/sessions': q => sessionsQueries(parseFilter(q), q.dev),
  '/api/session': q => sessionQueries(q.id),
};

async function run(route, query) {
  const f = parseFilter(query);
  const qs = ROUTES[route](query);
  if (!qs) throw new Problem('Invalid request.');
  const out = { filter: f, source: LOCAL ? 'local' : 'cloudflare', at: Date.now() };
  const names = Object.keys(qs);
  // The local source shares one SQLite file: one query at a time. Cloudflare: all at once.
  if (LOCAL) { for (const k of names) out[k] = await localQuery(qs[k]); }
  else { const rs = await Promise.all(names.map(k => remoteQuery(qs[k]))); names.forEach((k, i) => { out[k] = rs[i]; }); }
  if (out.tiles) out.tiles = out.tiles[0] || {};
  if (out.freshness) out.freshness = out.freshness[0] || {};
  if (out.end) out.end = out.end[0] || null;
  if (out.awards) out.awards = out.awards.map(a => ({ ...a, name: (BY_ID[a.item] || {}).name || a.item, emoji: (BY_ID[a.item] || {}).emoji || '' }));
  return out;
}

// ----- HTTP -----
const send = (res, status, type, body) => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
};
const server = http.createServer(async (req, res) => {
  // Only this machine, by name: a web page elsewhere cannot reach the API through DNS tricks.
  const host = (req.headers.host || '').replace(/:\d+$/, '');
  if (host !== '127.0.0.1' && host !== 'localhost') return send(res, 403, 'text/plain', 'forbidden');
  let url;
  try { url = new URL(req.url, 'http://127.0.0.1'); } catch (e) { return send(res, 400, 'text/plain', 'bad request'); }
  if (req.method !== 'GET') return send(res, 405, 'text/plain', 'method not allowed');
  if (url.pathname === '/' || url.pathname === '/index.html') {
    return send(res, 200, 'text/html; charset=utf-8', fs.readFileSync(path.join(DIR, 'index.html')));
  }
  if (ROUTES[url.pathname]) {
    // Only the dashboard page: another web page can make the browser send a request here (and spend the database's
    // daily read allowance) but cannot add this header without a CORS approval, which this server never gives.
    if (req.headers['x-dashboard'] !== '1' || req.headers['sec-fetch-site'] === 'cross-site') return send(res, 403, 'text/plain', 'forbidden');
    try {
      return send(res, 200, 'application/json', JSON.stringify(await run(url.pathname, Object.fromEntries(url.searchParams))));
    } catch (e) {
      const msg = e instanceof Problem ? e.message : 'Unexpected error: ' + e.message;
      if (!(e instanceof Problem)) console.error(e);
      return send(res, 502, 'application/json', JSON.stringify({ error: msg }));
    }
  }
  send(res, 404, 'text/plain', 'not found');
});
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Wordopedia dashboard (${LOCAL ? 'local wrangler database' : 'Cloudflare D1'}): http://127.0.0.1:${PORT}/`);
  if (!LOCAL && (!TOKEN || !ACCOUNT)) console.log('Note: set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (or dashboard/.env) to load data.');
});
