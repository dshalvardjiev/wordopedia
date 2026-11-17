# Usage tracking: architecture plan

Status: planned, not implemented. Last updated 2026-11-17.

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
- Events are appended to a queue in localStorage (`wordopedia.<instance>.q`, capped at 500; oldest dropped first).
- Flush triggers:
  - every 60 seconds while a session is running (timer starts with the session, stops on end, quit or hide, resumes
    when visible);
  - session end; `visibilitychange` to hidden; app start; `online`.
- One flush at a time; a tick that finds a flush in flight is skipped.
- Transport: `fetch(url, { method: 'POST', keepalive: true, body })` with a `text/plain` body (CORS-safelisted, no
  preflight). Batches of at most 100 events, to stay under the keepalive body limit (to be confirmed in the prototype).
- Events leave the queue only after a 2xx response. Each event has a random id, so a resent batch is stored once.
- The timer and queue live outside React state: no re-render of the quiz screen (see the keyboard pitfall in CLAUDE.md).
- Switches:
  - per instance, in `dictionary/instances/<id>.json` (`"tracking": true`), effective after the automatic redeploy;
  - global kill switch in `dictionary/languages.json` (`"tracking": false`), fetched at runtime, no release needed.
- Device id: `crypto.randomUUID()` stored in localStorage. Used only to count learners per word and to exclude a device
  that sends junk; never a grouping key in reports.

## 2. Events
| Type | When | Fields beyond the common ones |
|---|---|---|
| `open` | app opened | |
| `session_start` | exercise started | exercise, format, list size |
| `answer` | every answer | word id (or maths fact), first attempt, result (`ok`, `typo`, `wrong`, `shown`, `hint`), response ms, wrong option picked (test format only) |
| `session_end` | finished, quit, or detected abandoned | answers given, size, status |
| `tick` (proposed) | every minute of a session | answers so far, active seconds |

Common fields: event id, client time, device id, app version, environment, course, session id.
Never sent: instance id, names, typed free text, IP.

## 3. Worker (`worker/`)
- Accepts `POST /e` only, and only from `https://dshalvardjiev.github.io` (plus localhost in development).
- Rate limiting binding, keyed by IP in memory only (for example 30 requests a minute). The IP is never stored.
- Validation: fixed lists for event type, exercise, format and result; length and range checks; client time within the
  last 30 days. Invalid events are dropped and counted.
- One statement per batch: `INSERT OR IGNORE INTO events (...) SELECT ... FROM json_each(?)` (one bound parameter).
- Observability: invocation logs off (`[observability.logs] invocation_logs = false`), so request metadata is not
  logged; only error counts are logged.
- Server-side switch: environment variable `ACCEPT` (`true`/`false`).

## 4. Database (D1)
- Created once with `wrangler d1 create wordopedia-events --jurisdiction eu` (the jurisdiction cannot be changed later).
- One `events` table with typed columns; primary key = event id; two indexes (`(course, kind, word)`, `(ts)`).
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

## 7. Open decisions
1. Include the `tick` event?
2. Which instances report: only the owner's children, or every instance whose parents agreed?
3. A visible on/off switch for parents in the app?
4. 12 months of raw events?

## 8. Cloudflare prerequisites
Done by the owner:
1. Create a Cloudflare account (Free plan) and open Workers & Pages once to register the account's `workers.dev`
   subdomain.
2. Create an API token (My Profile > API Tokens > Create Token > Custom token), limited to this account:
   - Account > Workers Scripts > Edit
   - Account > D1 > Edit
   - Account > Account Settings > Read
3. Add GitHub repository secrets: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (shown on the account's
   Workers & Pages overview).

Done in the repository after that: the setup workflow creates the database; its id (not a secret) goes into
`worker/wrangler.toml`; the deploy workflow publishes the Worker; the Worker URL goes into the app configuration.

## Sources
- D1 limits: https://developers.cloudflare.com/d1/platform/limits/
- D1 pricing (index writes): https://developers.cloudflare.com/d1/platform/pricing/
- D1 jurisdictions: https://developers.cloudflare.com/changelog/2025-11-05-d1-jurisdiction/
- D1 JSON functions: https://developers.cloudflare.com/d1/sql-api/query-json/
- Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Rate limiting binding: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- Workers Logs: https://developers.cloudflare.com/workers/observability/logs/workers-logs/
