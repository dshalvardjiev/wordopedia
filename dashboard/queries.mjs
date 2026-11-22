// Read-only report queries for the local dashboard (docs/tracking.md). They follow the views in
// worker/migrations/ (v_events: production events of devices that are not blocked; v_session_ends: one end per
// session), with filters for course, exercise and period. Filter values are validated and inlined, because the local
// source (wrangler d1 execute) cannot bind parameters.

const COURSE_RE = /^[a-z0-9-]{1,32}$/;
const EXERCISES = ['x-bg', 'bg-x', 'art', 'conj', 'conj-table', 'math'];
const DAY = 864e5;

// { course, ex, days, min } -> validated filter
export function parseFilter(q, now = Date.now()) {
  const course = COURSE_RE.test(q.course || '') ? q.course : '';
  const ex = EXERCISES.includes(q.ex) ? q.ex : '';
  const days = [7, 30, 90, 365].includes(+q.days) ? +q.days : 0;          // 0 = all time
  const min = [1, 3, 5, 10, 20].includes(+q.min) ? +q.min : 3;
  return { course, ex, days, min, since: days ? now - days * DAY : 0 };
}

// Course and exercise are the same for every event of a session; the period is applied per event.
function scope(f) {
  const c = ['1 = 1'];
  if (f.course) c.push(`course = '${f.course}'`);
  if (f.ex) c.push(`ex = '${f.ex}'`);
  return c.join(' AND ');
}
const where = f => `${scope(f)} AND ts >= ${f.since}`;

export function reportQueries(f) {
  const W = where(f), S = scope(f);
  return {
    // Courses and exercises that have data at all (for the filter menus) and when the last event arrived.
    meta: `SELECT course, ex, COUNT(*) AS sessions FROM v_events WHERE kind = 'session_start' GROUP BY course, ex
           ORDER BY course, sessions DESC`,
    freshness: `SELECT MAX(rx) AS last_rx, COUNT(*) AS events FROM events`,

    tiles: `SELECT
        (SELECT COUNT(DISTINCT dev) FROM v_events WHERE ${W} AND kind IN ('session_start', 'answer')) AS learners,
        (SELECT COUNT(*) FROM v_events WHERE ${W} AND kind = 'session_start') AS sessions,
        (SELECT COALESCE(SUM(secs), 0) FROM v_session_ends WHERE ${W}) AS active_secs,
        (SELECT COUNT(*) FROM v_session_ends WHERE ${W}) AS ended,
        (SELECT COUNT(*) FROM v_session_ends WHERE ${W} AND status = 'done') AS finished,
        (SELECT COUNT(*) FROM v_events WHERE ${W} AND kind = 'answer' AND first = 1) AS first_answers,
        (SELECT COUNT(*) FROM v_events WHERE ${W} AND kind = 'answer' AND first = 1 AND result IN ('ok', 'typo')) AS first_right`,

    // Per hour and device: the page groups hours into days in the viewer's own time zone (summer time included)
    // and counts distinct learners per day.
    hourly: `SELECT ts / 3600000 AS hour, dev, SUM(kind = 'session_start') AS sessions,
        SUM(CASE WHEN kind = 'session_end' THEN secs ELSE 0 END) AS active_secs
      FROM (SELECT ts, dev, kind, secs FROM v_events WHERE ${W} AND kind = 'session_start'
            UNION ALL SELECT ts, dev, kind, secs FROM v_session_ends WHERE ${W})
      GROUP BY hour, dev ORDER BY hour`,

    exercises: `WITH starts AS (
        SELECT course, ex, fmt, COUNT(*) AS started, COUNT(DISTINCT dev) AS learners
        FROM v_events WHERE ${W} AND kind = 'session_start' GROUP BY course, ex, fmt
      ), ends AS (
        SELECT course, ex, fmt, SUM(status = 'done') AS finished, SUM(status = 'quit') AS quit,
               SUM(status = 'abandoned') AS abandoned, SUM(status <> 'done' AND n < 3) AS dropped_early,
               ROUND(AVG(secs)) AS avg_secs
        FROM v_session_ends WHERE ${W} GROUP BY course, ex, fmt
      ), ans AS (
        SELECT course, ex, fmt, COUNT(*) AS answers, SUM(result IN ('hint', 'shown')) AS helped
        FROM v_events WHERE ${W} AND kind = 'answer' GROUP BY course, ex, fmt
      ), ticks AS (
        -- The previous tick is looked up before the period filter, so a session crossing the period start counts right.
        SELECT course, ex, fmt, COUNT(*) AS minutes, SUM(idle) AS idle
        FROM (SELECT course, ex, fmt, ts, (n = COALESCE(LAG(n) OVER (PARTITION BY sess ORDER BY ts), 0)) AS idle
              FROM v_events WHERE ${S} AND kind = 'tick')
        WHERE ts >= ${f.since}
        GROUP BY course, ex, fmt
      ), keys AS (
        SELECT course, ex, fmt FROM starts UNION SELECT course, ex, fmt FROM ends
        UNION SELECT course, ex, fmt FROM ans UNION SELECT course, ex, fmt FROM ticks
      )
      SELECT k.course, k.ex, k.fmt, COALESCE(s.started, 0) AS started, COALESCE(s.learners, 0) AS learners,
             COALESCE(e.finished, 0) AS finished, COALESCE(e.quit, 0) AS quit, COALESCE(e.abandoned, 0) AS abandoned,
             COALESCE(e.dropped_early, 0) AS dropped_early, e.avg_secs,
             COALESCE(a.answers, 0) AS answers, COALESCE(a.helped, 0) AS helped,
             COALESCE(t.minutes, 0) AS minutes, COALESCE(t.idle, 0) AS idle
      FROM keys k
      LEFT JOIN starts s ON s.course = k.course AND s.ex = k.ex AND s.fmt = k.fmt
      LEFT JOIN ends e ON e.course = k.course AND e.ex = k.ex AND e.fmt = k.fmt
      LEFT JOIN ans a ON a.course = k.course AND a.ex = k.ex AND a.fmt = k.fmt
      LEFT JOIN ticks t ON t.course = k.course AND t.ex = k.ex AND t.fmt = k.fmt
      ORDER BY started DESC, k.course, k.ex`,

    // First answers per word; smoothed_rate pulls words with few attempts towards their exercise's average
    // (same formula as v_word_stats). Errors: wrong, hint, shown, time; a spelling slip counts as correct.
    // All time also counts the monthly totals of answers older than the retention period (word_summary).
    words: `WITH raw AS (
        SELECT course, ex, fmt, word, COUNT(*) AS attempts, SUM(result NOT IN ('ok', 'typo')) AS errors,
               SUM(result = 'typo') AS typos, COUNT(DISTINCT dev) AS learners, ROUND(AVG(ms)) AS avg_ms
        FROM v_events WHERE ${W} AND kind = 'answer' AND first = 1 GROUP BY course, ex, fmt, word
      ), a AS (
        SELECT course, ex, fmt, word, SUM(attempts) AS attempts, SUM(errors) AS errors, SUM(typos) AS typos,
               MAX(learners) AS learners, MAX(avg_ms) AS avg_ms
        FROM (SELECT * FROM raw
              UNION ALL
              SELECT course, ex, fmt, word, attempts, errors, typos, NULL, NULL FROM word_summary
              WHERE ${f.since === 0 ? S : '0 = 1'})
        GROUP BY course, ex, fmt, word
      ), b AS (
        SELECT course, ex, fmt, 1.0 * SUM(errors) / SUM(attempts) AS p FROM a GROUP BY course, ex, fmt
      )
      SELECT a.*, ROUND(1.0 * a.errors / a.attempts, 3) AS error_rate,
             ROUND((a.errors + 5 * b.p) / (a.attempts + 5), 3) AS smoothed_rate
      FROM a JOIN b ON b.course = a.course AND b.ex = a.ex AND b.fmt = a.fmt
      WHERE a.attempts >= ${f.min}
      ORDER BY smoothed_rate DESC, a.attempts DESC
      LIMIT 25`,

    confusions: `SELECT course, ex, word, pick, COUNT(*) AS times, COUNT(DISTINCT dev) AS learners
      FROM v_events WHERE ${W} AND kind = 'answer' AND pick IS NOT NULL
      GROUP BY course, ex, word, pick ORDER BY times DESC, word LIMIT 12`,
  };
}

// ----- Sessions tab: devices, their sessions, one session's events -----
// Ids come from the browser: only the Worker's id format is accepted, so they are safe to inline.
const ID_RE = /^[0-9a-z-]{8,40}$/i;
const validId = id => typeof id === 'string' && ID_RE.test(id);

export function deviceQueries(f) {
  const W = where(f);
  return {
    meta: reportQueries(f).meta,
    freshness: reportQueries(f).freshness,
    devices: `WITH s AS (
        SELECT dev, COUNT(*) AS sessions, MIN(ts) AS first_ts, MAX(ts) AS last_ts, GROUP_CONCAT(DISTINCT course) AS courses
        FROM v_events WHERE ${W} AND kind = 'session_start' GROUP BY dev
      ), e AS (
        SELECT dev, SUM(secs) AS active_secs FROM v_session_ends WHERE ${W} GROUP BY dev
      ), a AS (
        SELECT dev, COUNT(*) AS first_answers, SUM(result IN ('ok', 'typo')) AS first_right
        FROM v_events WHERE ${W} AND kind = 'answer' AND first = 1 GROUP BY dev
      )
      SELECT s.dev, s.sessions, s.first_ts, s.last_ts, s.courses, COALESCE(e.active_secs, 0) AS active_secs,
             COALESCE(a.first_answers, 0) AS first_answers, COALESCE(a.first_right, 0) AS first_right
      FROM s LEFT JOIN e ON e.dev = s.dev LEFT JOIN a ON a.dev = s.dev
      ORDER BY s.last_ts DESC`,
  };
}

// Sessions of one device started in the period, newest first, with how each ended.
export function sessionsQueries(f, dev) {
  if (!validId(dev)) return null;
  return {
    sessions: `WITH st AS (
        SELECT sess, ts AS start_ts, course, ex, fmt, size FROM v_events
        WHERE ${where(f)} AND kind = 'session_start' AND dev = '${dev}'
      ), en AS (
        SELECT sess, status, secs, ts AS end_ts FROM v_session_ends WHERE dev = '${dev}'
      ), an AS (
        SELECT sess, COUNT(*) AS answers, SUM(first = 1) AS firsts, SUM(first = 1 AND result IN ('ok', 'typo')) AS first_right,
               SUM(result IN ('hint', 'shown')) AS helped
        FROM v_events WHERE dev = '${dev}' AND kind = 'answer' GROUP BY sess
      )
      SELECT st.*, en.status, en.secs, en.end_ts, COALESCE(an.answers, 0) AS answers, COALESCE(an.firsts, 0) AS firsts,
             COALESCE(an.first_right, 0) AS first_right, COALESCE(an.helped, 0) AS helped
      FROM st LEFT JOIN en ON en.sess = st.sess LEFT JOIN an ON an.sess = st.sess
      ORDER BY st.start_ts DESC LIMIT 300`,
  };
}

// Every event of one session in order, plus the end the reports count (done or quit preferred over abandoned).
export function sessionQueries(id) {
  if (!validId(id)) return null;
  return {
    events: `SELECT kind, ts, dev, course, ex, fmt, size, word, first, result, ms, pick, n, secs, status
      FROM v_events WHERE sess = '${id}'
      ORDER BY ts, CASE kind WHEN 'session_start' THEN 0 WHEN 'session_end' THEN 2 ELSE 1 END`,
    end: `SELECT status, n, secs, ts FROM v_session_ends WHERE sess = '${id}'`,
  };
}
