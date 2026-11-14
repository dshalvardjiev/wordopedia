# Wordopedia: notes for Claude

Vocabulary and maths practice PWA for a Bulgarian-speaking learner (a child). Owner: D (dshalvardjiev).
UI text is Bulgarian; code, comments, commits and docs are English. See README.md for content formats.

## Stack and deployment
- React 18 + Vite 5 + vite-plugin-pwa (`registerType: 'autoUpdate'`). No backend, no test suite in the repo.
- GitHub Pages via `.github/workflows/deploy.yml` on push to `main` (paths outside `dictionary/`, plus
  `dictionary/instances/`); a push to `staging` starts it on `main` through `staging.yml`, because the Pages
  environment deploys from the default branch. One Vite build per instance (`scripts/build-all.mjs`): start page `landing/` at the
  root, `<instance>/` folders from `main`, the `staging` instance from the `staging` branch into `staging/`.
  `.github/workflows/audio.yml` records missing words/verb forms with Piper TTS and commits them to the same branch.
  `.github/workflows/check.yml` runs `npm run check` (content validation) and builds all instances for PRs.
- Commit directly to `main` (owner's instruction). Content in `dictionary/` is fetched at runtime from
  raw.githubusercontent.com, so content changes need no release; the bundled copy is only the first-start fallback.

## Code map
- `src/App.jsx`: state, course selection, session engine (`run/next/settle`), automatic updates (`syncCourse`).
- `src/lib/langs.js`: per-language rules (articles, letter keys, pronouns, normalisation). `courses.js`: courses from
  `languages.json`, and `instanceCourses()` for an instance's selection and labels. `content.js`: build-time
  instance (`VITE_INSTANCE`), environment (`VITE_ENV`), bundled instance file, storage key. `dictionary.js`/`csv.js`/`verbs.js`: parsing. `match.js`: answer checking and quiz options.
  `audio.js`: recordings (Cache Storage) and device-voice fallback. `sync.js`: downloads. `store.js`: localStorage.
  `math.js`: maths tests.
- `src/components/`: `Home`, `Quiz`, `Result`, `Words` (vocabulary), `Conj` (conjugation), `LangPick`,
  `Chrome` (language menu, tab bar), `ui` (flags, icons, segmented control), `math/`.
- `scripts/make_audio.py`: used by the recordings workflow; runs locally with piper-tts and ffmpeg.

## Invariants (break these and saved progress or audio silently breaks)
- Course key vs language: `L.code` is the language (rules, voice, `dictionary/<code>/audio/`); `L.key` and `L.path`
  belong to the course (storage, word ids, `dictionary/<path>/words.csv`). Single-course languages use key = code.
- Word id = `<courseKey>:<setId>|<article word>`; progress (`stats`) is keyed by it. Changing a set id or a word
  resets that word's progress.
- localStorage key `wordopedia.<instance>`, `version: 2`. All instances share one origin, so the key is the only
  separation. `production` copies the former root app's `woerter.v1` on first start: never delete that key.
  Migrate in `store.js` when the shape changes. The audio cache `woerter-audio-v1` is shared by all instances.
- Instance ids (folder names) and course keys must not be renamed once published.
- `navigateFallback: null` in `vite.config.js`: otherwise one folder's service worker answers navigations to another
  folder. `landing/sw.js` must stay: it retires the former root app's service worker on installed phones.
- Must match between JS and Python: `slug` (audio.js ↔ make_audio.py), article lists (langs.js `articles` ↔
  `ARTICLES`), German pronouns (langs.js `pronouns` ↔ `PRONOUNS`).
- Learners must not be able to add or change words, answers or verbs in the app (owner's decision).

## Pitfalls already hit
- Phone keyboards: never re-mount or re-key the answer `<input>` while typing (Android/iOS keyboards close or drop
  composed text). Shake via `classList`; `MathQuiz` keeps one input mounted across questions.
- iOS audio: `play()` must run inside the tap. `prepare()` builds blob URLs ahead; blobs need type `audio/mpeg`.
- Never fall back to a voice of another language; show a message instead.
- CSS class names are global: `.form` was once reused for conjugation cells and broke the search field.
- Two downloads for one course must not run at once: only `syncCourse` downloads (it has a lock).

## Verifying changes
- `npm run check`, `npm run build:all` (and `node scripts/build-all.mjs --env staging --out <dir>`); serve the output
  under a `/wordopedia/` path to reproduce GitHub Pages.
- `npx vite build`, then headless Chromium (Playwright, `is_mobile`, `has_touch`) against `dist/` served locally.
- Point the app at a local dictionary copy with `VITE_DICT_BASE=http://127.0.0.1:8081/<dir>/ npx vite build
  --outDir dist-test` and a static server that sends `Access-Control-Allow-Origin: *`.
- Simulate phone keyboards with CDP `Input.imeSetComposition` + `Input.insertText`, not `keyboard.type`.
- Playwright `text=` selectors match substrings; prefer class or `aria-label` selectors.
- Unused code: `npx -y knip@5`.
- Transcribing handwritten lists: check line by line, flag notebook mistakes instead of copying them
  (e.g. "der Ente" was stored as die Ente), and have a second pass compare the CSV with the photos.

## Design
Exercise-book theme: ruled sheet with red margin for words, squared sheet for maths; ink-blue actions
(`--pen`); der/die/das colours are a teaching code (blue/red/green), keep them. Copy: plain Bulgarian, sentence
case, no all-caps labels.
