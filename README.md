# Wordopedia

Web app for practising words in German, French and English with Bulgarian translations, plus maths (the
multiplication table). Bulgarian is always one side; there is no French–English practice. The app installs on
Android and iPhone and works offline.

The app is published as several **instances**, one folder each, each offering its own selection of courses
(defined in `dictionary/instances/<id>.json`):

| Address | Instance | Courses |
|---|---|---|
| https://dshalvardjiev.github.io/wordopedia/ | none: start page only | |
| …/wordopedia/production/ | `production` | all courses and maths |
| …/wordopedia/staging/ | `staging`, built from the `staging` branch | all courses and maths |
| …/wordopedia/lora/ | `lora` | German, maths |
| …/wordopedia/german/ | `german` | German |
| …/wordopedia/rada/ | `rada` | Elementary English, shown as "Английски" |

Instance folders are public: anyone with the address can open them, and all content is readable in this repository.

## Install on a phone
Open the instance's address (not the start page), then:
- **Android (Chrome):** menu ⋮ → *Add to Home screen* / *Install app*.
- **iPhone (Safari):** Share → *Add to Home Screen*.

Each instance installs as a separate app with its own progress.

## What the app offers
- **Words** (per course): translate foreign → Bulgarian or Bulgarian → foreign, choosing from four answers or
  typing; German and French also practise the article. Typed answers must be correct to continue; hints and
  "show answer" help. Missed words come back in the same round.
- **Думи** tab: the vocabulary of the course, by set or A–Z, with search; tap a word to hear it; marks for learned
  and often-confused words.
- **Verb conjugation** (German, French): three formats. **Таблица**: every form hidden until tapped; tapping plays
  the form. **Тест** / **Свободен отговор**: a pronoun and a verb (`nous` + `être`), the form chosen from four or typed
  (`sommes` or `nous sommes`), with specific feedback (another person's form, the infinitive, a missing `j'`); progress
  per verb and pronoun, missed forms come back in the same round.
- **Maths**: multiplication table up to 12, typed answers only, with specific hints and the time taken.

Learners cannot add or change words, answers or verbs in the app. All content comes from the `dictionary/` folder.

## Changing content (no new release needed)
1. Edit the file on github.com (pencil icon) and commit to `staging` to try it at …/wordopedia/staging/, or to
   `main` to publish it.
2. The app updates by itself when it opens or comes back to the screen, at most every 6 hours per course.
   To update at once: language menu → **Обновяване на думите**.
3. The *Recordings for new words* workflow records new words and verb forms within 1–2 minutes; the next update
   in the app downloads them for offline use.

```
dictionary/
  languages.json            which languages and courses are on, and each language's voice
  de/words.csv              German words          de/verbs.csv   German conjugation tables
  de/audio/                 German recordings (all courses of a language share one folder)
  fr/words.csv              French words (topics)  fr/verbs.csv   French conjugation tables
  en/elementary/words.csv   Elementary English (alphabet book, letters A–R)
  en/basic/words.csv        Basic English (inactive until it has words)
  en/audio/, fr/audio/
```

### words.csv
Columns: `set, article, german, bulgarian, type, plural, alt, note` (the third column may be called `foreign`).

| column | meaning |
|---|---|
| set | date and name, e.g. `2026-12 Декември`; the newest date is "Последни". Sets without a date (e.g. `Букви M–R`) count in file order: the last one is "Последни" |
| article | German `der/die/das`, French `le/la/l'/les`, English empty |
| german / foreign | the foreign word |
| bulgarian | accepted answers separated by `;`; the first one is shown |
| type | `n` noun, `v` verb, `a` adjective/adverb (Bulgarian gender forms are accepted automatically), `o` other |
| plural | e.g. `die Hunde`, shown after answering and in the vocabulary |
| alt | other correct foreign words separated by `;`, e.g. `das Bild` |
| note | shown after answering and in the vocabulary |

```
2026-12 Декември,der,Hund,куче; кученце,n,die Hunde,,
2026-12 Декември,l',eau,вода,n,,,
2026-12 Декември,,dog,куче,n,dogs,,
```

### verbs.csv
Columns: `verb, bulgarian`, one column per pronoun, and optionally `set` (verb group, offered in the Тест / Свободен
отговор formats) and `note` (shown after answering).

| language | pronoun columns | example |
|---|---|---|
| de | `ich, du, er, wir, ihr, sie` | `sein,съм,bin,bist,ist,sind,seid,sind` |
| fr | `je, tu, il, nous, vous, ils` | `Основни,être,съм,suis,es,est,sommes,êtes,sont,` (with `set` first and `note` last) |

- Every pronoun column must be filled in; an incomplete row is left out (`npm run check` reports it).
- Forms are written without the subject pronoun; reflexive verbs keep their own: `m'habille`, `nous habillons`.
- French `je` becomes `j'` before a vowel or `h` (`j'ai`, `j'habite`), in the table and in the recordings.
- Progress is stored per verb and pronoun under `<course key>:conj:<verb>:<column>` (e.g. `fr:conj:être:nous`):
  renaming a verb resets it, moving it to another group does not.

### languages.json
A language or course with `"active": false` is shown as "скоро" and cannot be chosen. To switch one on, add words to
its file first, then set `"active": true`. A language can have courses, each with its own words and progress:
```json
{ "code": "en", "active": true, "voice": "en/en_GB/cori/high/en_GB-cori-high",
  "courses": [ { "id": "elementary", "name": "Elementary English", "active": true },
               { "id": "basic", "name": "Basic English", "active": false } ] }
```

| code | voice (Piper TTS) | articles in the exercises |
|---|---|---|
| de | de_DE-thorsten-high | der, die, das |
| fr | fr_FR-siwis-medium | le, la, l', les |
| en | en_GB-cori-high | none; "the", "a/an" and "to" are optional in answers |

### instances/&lt;id&gt;.json
Which courses an instance offers, in display order. The file name is the folder name (lower case letters, digits,
`-`). Course keys: a language code (`de`, `fr`), `<code>-<course id>` for languages with courses (`en-elementary`),
and `math`.
```json
{ "name": "Wordopedia", "courses": [ { "course": "en-elementary", "label": "Английски" } ] }
```
- `"courses": "all"` offers every course and maths (used by `production` and `staging`, so new courses appear there
  without editing them).
- `label` and `subtitle` replace the course's title and subtitle in this instance only.
- `name` is the installed app's name.
- An instance with a single course opens it directly, without the course picker; its menu only offers
  **Обновяване на думите**.

To add an instance, add its file and push to `main`: the deploy publishes …/wordopedia/&lt;id&gt;/ within a few minutes.
Changing the course list of an existing instance needs no release: the app downloads its instance file with the
other content. `npm run check` (also run in CI) rejects unknown courses, duplicates and two courses with the same
visible title in one instance.

## Usage statistics
Instances with `"tracking": true` send anonymous usage events (exercise, word, result, timing; no names, no typed
text, no instance name) to a Cloudflare Worker with a database in the EU. Reports are per course: which words are hard,
which exercises are finished or dropped. Parents can switch it off in the course menu (**Анонимна статистика**);
`"tracking": {"enabled": false}` in `languages.json` stops it everywhere. Details and report queries:
[docs/tracking.md](docs/tracking.md).

## Development
```
npm install
npm run dev                       # local server, "production" instance
VITE_INSTANCE=lora npm run dev    # another instance
npm run check                     # validate languages, instances and word lists
npm run build                     # one instance in dist/ (VITE_INSTANCE, default production)
npm run build:all                 # start page + every instance except staging in dist/
python scripts/make_audio.py dictionary voice   # record missing words locally (needs piper-tts and ffmpeg)
```
Changes under `dictionary/` do not need a release, except a new instance file. See `CLAUDE.md` for architecture
notes.

### Branches and deployment
- A push to `main` runs *Deploy app*. A push to `staging` runs *Deploy staging*, which starts *Deploy app* on
  `main`. *Deploy app* builds the start page and every instance from `main`, plus the `staging` instance from the
  `staging` branch (if it exists), and publishes them together. GitHub Pages serves one site per repository.
- The staging instance reads its content from the `staging` branch and shows a red "staging" tag. If its build
  fails, production is still published, without /staging/.
- To create or reset the staging branch: `git push origin main:staging`.

### Former root app
Until November 2026 the app itself lived at the root address, storing data under `woerter.v1`. Now:
- The start page shows a link to `production/` to visitors who still have that data.
- On its first start, `production` copies that data and leaves the original as it is.
- `landing/sw.js` replaces the old app's service worker on installed phones. It deletes only that worker's cached
  files and reloads the window.
