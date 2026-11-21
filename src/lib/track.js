// Usage tracking (see docs/tracking.md): events go into a queue in localStorage and are sent in batches to the
// events Worker. Nothing here touches React state, so tracking never re-renders a quiz (phone keyboards stay open).
// Sent: random ids, course, exercise, word ids, results, timings. Never: the instance, names, typed text.
import { INSTANCE, ENV } from './content.js';

const QKEY = `wordopedia.${INSTANCE}.q`;      // queue of unsent events
const DKEY = `wordopedia.${INSTANCE}.dev`;    // random device id
const AKEY = `wordopedia.${INSTANCE}.sess`;   // running sessions by id, to report them as abandoned after a restart
const MAX_QUEUE = 2000, BATCH = 100, TICK_MS = 60e3, STALE_MS = 3 * TICK_MS;
const VER = typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : 'dev';

const read = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const write = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } };
const uid = () => { try { return crypto.randomUUID(); } catch (e) { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12); } };
// This browser tab (sessionStorage survives a reload of the tab, not other tabs): a running session left by an earlier
// page in the same tab is abandoned at once; one from another tab only when it has not been seen for STALE_MS.
const TAB = (() => { try { let t = sessionStorage.getItem('wordopedia.tab'); if (!t) { t = uid(); sessionStorage.setItem('wordopedia.tab', t); } return t; } catch (e) { return uid(); } })();

let cfg = { on: false, url: '' };
let active = null;        // { sess, course, ex, fmt, size, n, secs, visibleSince }
let timer = 0, inflight = false, again = false, started = false, opened = false;

function device() { let d = read(DKEY, null); if (!d) { d = uid(); write(DKEY, d); } return d; }

function push(kind, fields) {
  if (!cfg.on) return;
  const q = read(QKEY, []);
  q.push({ id: uid(), ts: Date.now(), dev: device(), ver: VER, env: ENV, kind, ...fields });
  write(QKEY, q.length > MAX_QUEUE ? q.slice(q.length - MAX_QUEUE) : q);
}

// Sends up to BATCH queued events. They leave the queue only after the Worker accepted the batch; a 4xx other than
// 429 means the batch can never be accepted, so it is dropped too. Network errors, 429/5xx and a refused origin or wrong
// address (no CORS headers, so the browser reports a network error) keep it for later, until the setting is fixed.
// A flush asked for while one is running runs right after it, so the end of a session never waits for the next tick.
async function flush() {
  if (!cfg.on || !cfg.url) return;
  if (inflight) { again = true; return; }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const batch = read(QKEY, []).slice(0, BATCH);
  if (!batch.length) return;
  inflight = true; again = false;
  let sentOk = false;
  try {
    // A string body is sent as text/plain: no CORS preflight. keepalive lets it finish while the page is hidden.
    // "sent" lets the Worker correct event times from a device whose clock is wrong.
    const r = await fetch(cfg.url, { method: 'POST', body: JSON.stringify({ sent: Date.now(), events: batch }), keepalive: true, credentials: 'omit' });
    if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429)) {
      const sent = new Set(batch.map(e => e.id));
      write(QKEY, read(QKEY, []).filter(e => !sent.has(e.id)));
      sentOk = true;
    }
  } catch (e) { /* offline or blocked: try again later */ } finally { inflight = false; }
  // More waiting (a larger queue, or events added meanwhile): send them now, but only after a successful send.
  if (sentOk && (again || read(QKEY, []).length)) { again = false; flush(); } else again = false;
}

// ----- session clock: active seconds count only while the page is visible -----
const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';
function secsNow() {
  if (!active) return 0;
  return Math.round(active.secs + (active.visibleSince ? (Date.now() - active.visibleSince) / 1000 : 0));
}
function save() {
  if (!active) return;
  const all = read(AKEY, {});
  all[active.sess] = { ...active, secs: secsNow(), visibleSince: 0, tab: TAB, seen: Date.now() };
  write(AKEY, all);
}
function forget(sess) { const all = read(AKEY, {}); delete all[sess]; write(AKEY, Object.keys(all).length ? all : null); }
// Reports running sessions that no page is continuing: an earlier page of this tab, or another tab not seen for a while.
function sweep() {
  const all = read(AKEY, {}), now = Date.now();
  for (const [id, x] of Object.entries(all && typeof all === 'object' ? all : {})) {
    if (active && id === active.sess) continue;
    if (x && x.sess && (x.tab === TAB || now - (x.seen || 0) > STALE_MS)) {
      push('session_end', { course: x.course, sess: x.sess, ex: x.ex, fmt: x.fmt, n: x.n, size: x.size, secs: x.secs, status: 'abandoned' });
      forget(id);
    }
  }
}
function stopTimer() { clearInterval(timer); timer = 0; }
function startTimer() {
  stopTimer();
  if (!active || !visible()) return;
  timer = setInterval(() => {
    if (!active) { stopTimer(); return; }
    push('tick', { ...meta(), n: active.n, secs: secsNow() });
    save(); sweep(); flush();
  }, TICK_MS);
}
const meta = () => ({ course: active.course, sess: active.sess, ex: active.ex, fmt: active.fmt });

function onVisibility() {
  if (!active) { if (!visible()) flush(); return; }
  if (visible()) { active.visibleSince = Date.now(); startTimer(); }
  else { active.secs = secsNow(); active.visibleSince = 0; stopTimer(); save(); flush(); }
}

// ----- public API -----
// Called on every render with the current settings: tracking is on when the instance allows it, languages.json has
// not switched it off and gives a URL, and the parent's switch is on.
export function configure({ on, url }) {
  const was = cfg.on;
  cfg = { on: !!(on && url), url: url || '' };
  // Switched off: forget everything, including the device id, so switching on again starts as a new device.
  if (was && !cfg.on) { write(QKEY, null); write(AKEY, null); write(DKEY, null); active = null; stopTimer(); }
  if (cfg.on && !started) {
    started = true;
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', () => { if (active) { active.secs = secsNow(); active.visibleSince = 0; save(); } flush(); });
    window.addEventListener('online', () => flush());
    // Sessions still marked as running from an earlier page load: the app was closed or reloaded during them.
    sweep();
    flush();
  }
}

export function appOpened(course) {
  if (!cfg.on || opened) return;
  opened = true;
  push('open', course ? { course } : {});
  flush();
}

export function sessionStart({ course, ex, fmt, size }) {
  if (!cfg.on) return;
  if (active) sessionEnd('quit');
  sweep();
  active = { sess: uid(), course, ex, fmt, size, n: 0, secs: 0, visibleSince: visible() ? Date.now() : 0 };
  push('session_start', { ...meta(), size });
  save(); startTimer();
}

export function answer({ word, first, result, ms, pick }) {
  if (!cfg.on || !active) return;
  active.n++;
  push('answer', { ...meta(), word, first: first ? 1 : 0, result, ms, ...(pick ? { pick } : {}) });
  save();
}

export function sessionEnd(status) {
  if (!cfg.on || !active) return;
  push('session_end', { ...meta(), n: active.n, size: active.size, secs: secsNow(), status });
  forget(active.sess); active = null; stopTimer();
  flush();
}
