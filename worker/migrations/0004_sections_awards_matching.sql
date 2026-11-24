-- Sections, achievements and the matching exercise (docs/tracking.md).
-- view:          section = words | awards | award (an achievement's detail sheet, item = its id); secs = time on screen
-- award:         item = achievement id; result = new | retro (granted from earlier progress)
-- session_start: rounds = boards of the matching exercise
-- session_end:   score, max_score = points of a matching session
-- answer:        result pair | art | both = the matching step that went wrong
ALTER TABLE events ADD COLUMN section TEXT;
ALTER TABLE events ADD COLUMN item TEXT;
ALTER TABLE events ADD COLUMN score INTEGER;
ALTER TABLE events ADD COLUMN max_score INTEGER;
ALTER TABLE events ADD COLUMN rounds INTEGER;

-- Recreated so that their column lists include the new columns.
DROP VIEW v_session_ends;
DROP VIEW v_events;
CREATE VIEW v_events AS
SELECT * FROM events WHERE env = 'production' AND dev NOT IN (SELECT dev FROM blocked_devices);
CREATE VIEW v_session_ends AS
SELECT * FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY sess ORDER BY status = 'abandoned', rx DESC) AS k
  FROM v_events WHERE kind = 'session_end'
) WHERE k = 1;

-- Sections per course: visits, learners, time on screen. A visit interrupted by closing the app counts once, up to then.
CREATE VIEW v_sections AS
SELECT course, section, COUNT(*) AS visits, COUNT(DISTINCT dev) AS learners,
       ROUND(AVG(secs)) AS avg_secs, SUM(secs) AS total_secs
FROM v_events WHERE kind = 'view' AND section IN ('words', 'awards')
GROUP BY course, section
ORDER BY course, visits DESC;

-- Achievements: how often each was earned (in use or granted from earlier progress) and how often its sheet was opened.
CREATE VIEW v_awards AS
WITH got AS (
  SELECT item, SUM(result = 'new') AS earned, SUM(result = 'retro') AS retro, COUNT(DISTINCT dev) AS learners,
         MIN(ts) AS first_ts, MAX(ts) AS last_ts
  FROM v_events WHERE kind = 'award' GROUP BY item
), opened AS (
  SELECT item, COUNT(*) AS opened FROM v_events WHERE kind = 'view' AND section = 'award' GROUP BY item
)
SELECT k.item, COALESCE(g.earned, 0) AS earned, COALESCE(g.retro, 0) AS retro, COALESCE(g.learners, 0) AS learners,
       g.first_ts, g.last_ts, COALESCE(o.opened, 0) AS opened
FROM (SELECT item FROM got UNION SELECT item FROM opened) k
LEFT JOIN got g ON g.item = k.item LEFT JOIN opened o ON o.item = k.item
ORDER BY earned DESC, opened DESC;

-- Matching exercise per course: sessions, boards chosen, points share, and which step went wrong.
CREATE VIEW v_match AS
WITH st AS (
  SELECT course, COUNT(*) AS started, ROUND(AVG(rounds), 1) AS avg_rounds FROM v_events
  WHERE kind = 'session_start' AND ex = 'match' GROUP BY course
), en AS (
  SELECT course, SUM(status = 'done') AS finished, SUM(score) AS score, SUM(max_score) AS max_score
  FROM v_session_ends WHERE ex = 'match' GROUP BY course
), an AS (
  SELECT course, COUNT(*) AS words, SUM(result = 'ok') AS clean, SUM(result = 'pair') AS pair_only,
         SUM(result = 'art') AS art_only, SUM(result = 'both') AS both
  FROM v_events WHERE kind = 'answer' AND ex = 'match' GROUP BY course
)
SELECT st.course, st.started, st.avg_rounds, COALESCE(en.finished, 0) AS finished,
       ROUND(1.0 * en.score / NULLIF(en.max_score, 0), 3) AS score_share,
       COALESCE(an.words, 0) AS words, COALESCE(an.clean, 0) AS clean, COALESCE(an.pair_only, 0) AS pair_only,
       COALESCE(an.art_only, 0) AS art_only, COALESCE(an.both, 0) AS both
FROM st LEFT JOIN en ON en.course = st.course LEFT JOIN an ON an.course = st.course
ORDER BY st.started DESC;
