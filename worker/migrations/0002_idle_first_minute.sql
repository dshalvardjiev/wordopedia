-- A first minute without an answer also counts as idle (its previous answer count is 0).
DROP VIEW v_exercise_usage;

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
  FROM (SELECT course, ex, fmt, (n = COALESCE(LAG(n) OVER (PARTITION BY sess ORDER BY ts), 0)) AS idle FROM v_events WHERE kind = 'tick')
  GROUP BY course, ex, fmt
)
SELECT s.*, COALESCE(t.minutes, 0) AS tick_minutes, COALESCE(t.idle_minutes, 0) AS idle_minutes
FROM sess s LEFT JOIN ticks t ON t.course = s.course AND t.ex = s.ex AND t.fmt = s.fmt
ORDER BY s.course, s.started DESC;
