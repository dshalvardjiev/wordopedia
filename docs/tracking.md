# Usage tracking

Status: live since 2026-11-21. Worker: `https://wordopedia-events.code-runners-account.workers.dev`
(D1 database `wordopedia-events`, jurisdiction `eu`). Code: `src/lib/track.js`, `worker/`.

## Goals
1. Word difficulty across all learners of a course.
2. Usability of exercises: which are chosen, which are dropped early, which are finished.

Reports are aggregated per course (`de`, `en-elementary`, `en-basic`, `math`). Nothing is reported per instance or per
learner.

## Overview

```
App (PWA, GitHub Pages)
  src/lib/track.js: queue in localStorage, POST batches (text/plain, keepalive)
        |
        v
Worker "wordopedia-events" (workers.dev)
  origin check -> rate limit -> validate -> INSERT OR IGNORE
        |
        v
D1 "wordopedia-events" (jurisdiction: eu)
  events table + SQL views; reports via the D1 console or `wrangler d1 execute --remote`
  monthly Cron Trigger: aggregate, then delete raw events older than 12 months
```

Expected volume (3 learners, 3 sessions a day, about 10 minutes each): about 90 requests and about 900 rows written a
day, a few MB a year. Workers Free allows 100,000 requests a day; D1 Free allows 100,000 rows written a day and 500 MB
per database.

## 1. Client (`src/lib/track.js`)
- Events are appended to a queue in localStorage (`wordopedia.<instance>.q`, capped at 2,000, about 600 KB; oldest
  dropped first).
- Flush triggers:
  - every 60 seconds while a session is running (timer starts with the session, stops on end, quit or hide, resumes
    when visible);
  - session end; `visibilitychange` to hidden; app start; `online`.
- One flush at a time; a tick that finds a flush in flight is skipped.
- Transport: `fetch(url, { method: 'POST', keepalive: true, body })` with a `text/plain` body (CORS-safelisted, no
  preflight). Batches of at most 100 events (about 30 KB), under the 64 KB keepalive limit. A send requested while one
  is running follows right after it.
- Events leave the queue after a 2xx response, or a 4xx other than 429 (a batch that can never be accepted). Network
  errors, 429 and 5xx keep them; so does a refused origin or wrong address, because those answers carry no CORS headers
  and the browser reports a network error. Each event has a random id, so a resent batch is stored once.
- Each batch carries the device's clock time (`sent`); the Worker adds the difference to event times, so a wrong
  device clock does not distort or lose data.
- Running sessions are kept by id with their tab (sessionStorage) and last-seen time. One left by an earlier page of
  the same tab is reported as abandoned at once; one from another tab only after 3 minutes unseen. Reports count one
  end per session (`v_session_ends`), preferring done or quit over abandoned.
- The timer and queue live outside React state: no re-render of the quiz screen (see the keyboard pitfall in CLAUDE.md).
- Switches:
  - per instance, in `dictionary/instances/<id>.json` (`"tracking": true`), effective after the automatic redeploy;
    to stop an instance set `"tracking": false` (a downloaded copy without the key falls back to the built-in file);
  - global, in `dictionary/languages.json`: `"tracking": {"url": "…/e", "enabled": true}`; `false` (or no URL) stops it
    everywhere, fetched at runtime, no release needed;
  - the parent's switch in the app's course menu.
- Device id: `crypto.randomUUID()` stored in localStorage. Used only to count learners per word and to exclude a device
  that sends junk, and in the local dashboard's Sessions tab to list sessions per device; never a grouping key in the
  aggregate reports. Deleted when the parent's switch is turned off.

## 2. Events
| Type | When | Fields beyond the common ones |
|---|---|---|
| `open` | app opened | |
| `session_start` | exercise started | exercise, format, list size |
| `answer` | every answer | word id (or maths fact), first attempt, result (`ok`, `typo`, `wrong`, `shown`, `hint`, `time`: maths time limit ran out), response ms, wrong option picked (choice exercises; with repeated tries, the first wrong one) |
| `session_end` | finished, quit, or detected abandoned | answers given, size, status |
| `tick` | every minute of a session | answers so far, active seconds |

Common fields: event id, client time, device id, app version, environment, course, session id.
Never sent: instance id, names, typed free text, IP.

## 3. Worker (`worker/`)
- Accepts `POST /e` only, and only from origins listed in `ORIGINS` (`https://dshalvardjiev.github.io`; local
  development passes its own with `wrangler dev --var ORIGINS:…`).
- Rate limiting binding, keyed by IP in memory only (for example 30 requests a minute). The IP is never stored.
- Validation: fixed lists for event type, exercise, format, result and status; length and range checks. Invalid events
  are dropped and counted. An implausible event time (after clock correction) is replaced by the receive time.
- One statement per batch: `INSERT OR IGNORE INTO events (...) SELECT ... FROM json_each(?)` (one bound parameter).
- Observability: invocation logs off (`[observability.logs] invocation_logs = false`), so request metadata is not
  logged; only error counts are logged.
- Server-side switch: environment variable `ACCEPT` (`true`/`false`).

## 4. Database (D1)
- Created once with `wrangler d1 create wordopedia-events --jurisdiction eu` (the jurisdiction cannot be changed later).
- One `events` table with typed columns; primary key = event id; two indexes (`(course, kind, word)`, `(rx)`).
- Views:
  - `v_word_difficulty`: per course, word, exercise, format; first-attempt error rate (smoothed), attempts, learners.
  - `v_confusions`: per course and word; wrong options picked.
  - `v_exercise_usage`: per course, exercise, format; sessions started and finished, abandoned within 3 answers,
    median and active time, use of hints and "Показване на отговора".
  - Rows below a minimum number of attempts (for example 10) are hidden.
- Retention: a monthly Cron Trigger adds raw events older than 12 months to a per-word summary table, then deletes them.
- Backups: D1 Time Travel (7 days on the Free plan). Exports must never be committed to this public repository.

## 5. Delivery and tests
- `.github/workflows/worker.yml` on changes under `worker/`: `wrangler d1 migrations apply --remote`, then
  `wrangler deploy`.
- One-off `workflow_dispatch` setup job: creates the D1 database in the EU jurisdiction and prints its id.
- Local: `wrangler dev` with a local D1; Playwright against a build pointed at it (`VITE_TRACK_URL`), covering offline,
  retry and duplicate batches. Then one live smoke test.
- The staging instance does not report by default.

## 6. Risks
- The endpoint is public; fake data is possible. Mitigated by the origin check, validation, rate limit and device
  exclusion.
- iOS may not complete a send when the app is closed; the queue sends at the next start.
- A school or parental filter might block `workers.dev`; a custom domain would fix it.
- Per-course figures mix learners. A per-learner view would need an instance column, and data collected before then
  could not be split.

## 7. Decisions
Taken as defaults on 2026-11-21 (the owner did not choose otherwise); each can be changed in one place.
1. `tick` events: included.
2. Instances that report: every instance except `staging` (`"tracking": true` in its file).
3. Parent switch: "Анонимна статистика" in the course menu, on by default; off clears the queue and stops events.
4. Raw events kept 12 months, then summarised per word and month (`word_summary`).

## 8. Operations
- Reports: Cloudflare dashboard > Storage & Databases > D1 > `wordopedia-events` > Console, for example
  `SELECT * FROM v_word_difficulty WHERE course = 'de' LIMIT 30;`. Views: `v_word_difficulty` (10+ first answers),
  `v_word_stats` (all words), `v_confusions`, `v_exercise_usage`, `v_activity`.
  From a terminal: `cd worker && npx wrangler d1 execute wordopedia-events --remote --command "..."`.
- Pause everywhere without a release: `"tracking": {"enabled": false}` in `dictionary/languages.json`, or
  `ACCEPT = "false"` in `worker/wrangler.toml` (batches are then accepted and dropped).
- Exclude a device from reports: `INSERT INTO blocked_devices (dev, note) VALUES ('<id>', '<reason>');`.
- Schema changes: add a new file under `worker/migrations/`; never edit one that has been applied.
- Deploys: `.github/workflows/worker.yml` on changes under `worker/` (or run it by hand).

## 9. Dashboard
A local page with the reports, filtered by period, course and exercise: `dashboard/` (no dependencies; Node 18+).

1. Create a read-only API token: Cloudflare > My Profile > API Tokens > Create Token > Custom token, permission
   **Account > D1 > Read**, limited to this account. Read-only tokens cannot change data (D1 writes over the API need
   D1 Edit).
2. Create `dashboard/.env` (git-ignored):
   ```
   CLOUDFLARE_API_TOKEN=<the read-only token>
   CLOUDFLARE_ACCOUNT_ID=<account id>
   ```
3. `npm run dashboard`, then open http://127.0.0.1:8788/.

The token stays in the local Node process; the page talks only to 127.0.0.1, which runs a fixed set of SELECT queries
(`dashboard/queries.mjs`, the views' logic plus filters) and answers only requests addressed to 127.0.0.1 or
localhost. `npm run dashboard:local` reads the database of `wrangler dev` in `worker/` instead (slower: one
`wrangler d1 execute` per query); `CLOUDFLARE_API_BASE` points the server at a stand-in API for tests.

Overview tab: learners, sessions, active time, finished share, right-first-time share; sessions per day; exercises
(how sessions ended, dropped within 3 answers, active time, help used, idle minutes); hardest words (adjusted
first-answer error rate, with a minimum number of first answers); most frequent wrong picks. Every chart has a table
view.

Sessions tab (owner's request, 2026-11-21): devices by their random id (names can be given; they are kept only in that
browser's localStorage), the sessions of the chosen device, and a replay of one session: its answers on a time line
with idle minutes shaded, the list of answers (result, time to answer, wrong option picked) and Play at 1×, 10× or 60×.
This is the one place where the device id groups data; it shows one device's usage, so it stays in the local
dashboard.

## 10. Cloudflare prerequisites
Done by the owner (done 2026-11-21):
1. Create a Cloudflare account (Free plan) and open Workers & Pages once to register the account's `workers.dev`
   subdomain.
2. Create an API token (My Profile > API Tokens > Create Token > Custom token), limited to this account:
   - Account > Workers Scripts > Edit
   - Account > D1 > Edit
   - Account > Account Settings > Read
3. Add GitHub repository secrets: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (shown on the account's
   Workers & Pages overview).

The deploy workflow finds or creates the database in the EU jurisdiction, puts its id into `wrangler.toml` at deploy
time (the file in the repository keeps a placeholder), applies migrations, deploys and checks `/health`.

## Sources
- D1 limits: https://developers.cloudflare.com/d1/platform/limits/
- D1 pricing (index writes): https://developers.cloudflare.com/d1/platform/pricing/
- D1 jurisdictions: https://developers.cloudflare.com/changelog/2025-11-05-d1-jurisdiction/
- D1 JSON functions: https://developers.cloudflare.com/d1/sql-api/query-json/
- Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Rate limiting binding: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- Workers Logs: https://developers.cloudflare.com/workers/observability/logs/workers-logs/
