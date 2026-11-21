-- Usage events from the app (see docs/tracking.md). One row per event; no names, no typed text, no IP addresses.
CREATE TABLE events (
  id      TEXT PRIMARY KEY,      -- random id from the app; a resent batch is stored once
  ts      INTEGER NOT NULL,      -- time on the device (ms)
  rx      INTEGER NOT NULL,      -- time received (ms)
  dev     TEXT NOT NULL,         -- random device id; never a grouping key in reports
  ver     TEXT,                  -- app build
  env     TEXT NOT NULL,         -- production, staging, development
  course  TEXT,                  -- de, fr, en-elementary, en-basic, math
  kind    TEXT NOT NULL,         -- open, session_start, answer, session_end, tick
  sess    TEXT,                  -- session id
  ex      TEXT,                  -- x-bg, bg-x, art, conj, conj-table, math
  fmt     TEXT,                  -- test, open, table
  word    TEXT,                  -- word id, conjugation fact id or maths fact id
  first   INTEGER,               -- 1 = first answer to this question in the session
  result  TEXT,                  -- ok, typo, wrong, hint, shown
  ms      INTEGER,               -- time to answer
  pick    TEXT,                  -- wrong option picked (test format only)
  n       INTEGER,               -- answers given in the session so far
  size    INTEGER,               -- questions in the session
  secs    INTEGER,               -- active seconds in the session so far
  status  TEXT                   -- session_end: done, quit, abandoned
);
CREATE INDEX events_word ON events (course, kind, word);
CREATE INDEX events_rx ON events (rx);

-- Devices whose data is left out of every report (for example one that sent junk).
CREATE TABLE blocked_devices (dev TEXT PRIMARY KEY, note TEXT);

-- First-answer totals per month for answers older than the retention period (filled by the monthly job).
CREATE TABLE word_summary (
  month TEXT NOT NULL, course TEXT NOT NULL, ex TEXT NOT NULL, fmt TEXT NOT NULL, word TEXT NOT NULL,
  attempts INTEGER NOT NULL, errors INTEGER NOT NULL, typos INTEGER NOT NULL,
  PRIMARY KEY (month, course, ex, fmt, word)
);

-- Events that count for reports.
CREATE VIEW v_events AS
SELECT * FROM events WHERE env = 'production' AND dev NOT IN (SELECT dev FROM blocked_devices);

-- Every word with its first-answer results, including summarised history; error_rate counts wrong, hint and shown
-- (a small spelling mistake counts as correct). smoothed_rate pulls words with few attempts towards the exercise average.
CREATE VIEW v_word_stats AS
WITH raw AS (
  SELECT course, ex, fmt, word, COUNT(*) AS attempts, SUM(result NOT IN ('ok', 'typo')) AS errors,
         SUM(result = 'typo') AS typos, COUNT(DISTINCT dev) AS learners
  FROM v_events WHERE kind = 'answer' AND first = 1
  GROUP BY course, ex, fmt, word
), alltime AS (
  SELECT course, ex, fmt, word, SUM(attempts) AS attempts, SUM(errors) AS errors, SUM(typos) AS typos, MAX(learners) AS learners
  FROM (SELECT course, ex, fmt, word, attempts, errors, typos, learners FROM raw
        UNION ALL
        SELECT course, ex, fmt, word, attempts, errors, typos, NULL FROM word_summary)
  GROUP BY course, ex, fmt, word
), base AS (
  SELECT course, ex, fmt, 1.0 * SUM(errors) / SUM(attempts) AS p FROM alltime GROUP BY course, ex, fmt
)
SELECT a.course, a.ex, a.fmt, a.word, a.attempts, a.learners, a.errors, a.typos,
       ROUND(1.0 * a.errors / a.attempts, 3) AS error_rate,
       ROUND((a.errors + 5 * b.p) / (a.attempts + 5), 3) AS smoothed_rate
FROM alltime a JOIN base b ON b.course = a.course AND b.ex = a.ex AND b.fmt = a.fmt;

-- The report: words with at least 10 first answers, hardest first.
CREATE VIEW v_word_difficulty AS
SELECT * FROM v_word_stats WHERE attempts >= 10 ORDER BY course, smoothed_rate DESC;

-- Wrong options picked in the test format, per word.
CREATE VIEW v_confusions AS
SELECT course, ex, word, pick, COUNT(*) AS times, COUNT(DISTINCT dev) AS learners
FROM v_events WHERE kind = 'answer' AND pick IS NOT NULL
GROUP BY course, ex, word, pick
ORDER BY course, times DESC;

-- Exercises: sessions started, finished, quit, abandoned (app closed), dropped within 3 answers, active time,
-- share of answers that needed a hint, and minutes with the screen open but no answer.
CREATE VIEW v_exercise_usage AS
WITH sess AS (
  SELECT course, ex, fmt,
         SUM(kind = 'session_start') AS started,
         SUM(kind = 'session_end' AND status = 'done') AS finished,
         SUM(kind = 'session_end' AND status = 'quit') AS quit,
         SUM(kind = 'session_end' AND status = 'abandoned') AS abandoned,
         SUM(kind = 'session_end' AND status <> 'done' AND n < 3) AS dropped_early,
         ROUND(AVG(CASE WHEN kind = 'session_end' THEN secs END)) AS avg_active_secs,
         SUM(kind = 'answer') AS answers,
         ROUND(1.0 * SUM(kind = 'answer' AND result IN ('hint', 'shown')) / NULLIF(SUM(kind = 'answer'), 0), 3) AS hint_share,
         COUNT(DISTINCT CASE WHEN kind = 'session_start' THEN dev END) AS learners
  FROM v_events WHERE kind IN ('session_start', 'session_end', 'answer')
  GROUP BY course, ex, fmt
), ticks AS (
  SELECT course, ex, fmt, COUNT(*) AS minutes, SUM(idle) AS idle_minutes
  FROM (SELECT course, ex, fmt, (n = LAG(n) OVER (PARTITION BY sess ORDER BY ts)) AS idle FROM v_events WHERE kind = 'tick')
  GROUP BY course, ex, fmt
)
SELECT s.*, COALESCE(t.minutes, 0) AS tick_minutes, COALESCE(t.idle_minutes, 0) AS idle_minutes
FROM sess s LEFT JOIN ticks t ON t.course = s.course AND t.ex = s.ex AND t.fmt = s.fmt
ORDER BY s.course, s.started DESC;

-- Activity per course and week: app opens, sessions, learners, active minutes.
CREATE VIEW v_activity AS
SELECT course, strftime('%Y-%W', ts / 1000, 'unixepoch') AS week,
       SUM(kind = 'open') AS opens,
       SUM(kind = 'session_start') AS sessions,
       COUNT(DISTINCT dev) AS learners,
       ROUND(SUM(CASE WHEN kind = 'session_end' THEN secs ELSE 0 END) / 60.0) AS active_minutes
FROM v_events
GROUP BY course, week
ORDER BY week DESC, course;
