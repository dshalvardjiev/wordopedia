# Wordopedia

Web app for practising words in German, French and English with Bulgarian translations, plus maths (the
multiplication table). Bulgarian is always one side; there is no French–English practice. The app installs on
Android and iPhone and works offline.

**App:** https://dshalvardjiev.github.io/wordopedia/

## Install on a phone
- **Android (Chrome):** open the app link, then menu ⋮ → *Add to Home screen* / *Install app*.
- **iPhone (Safari):** open the app link, then Share → *Add to Home Screen*.

## What the app offers
- **Words** (per course): translate foreign → Bulgarian or Bulgarian → foreign, choosing from four answers or
  typing; German and French also practise the article. Typed answers must be correct to continue; hints and
  "show answer" help. Missed words come back in the same round.
- **Думи** tab: the vocabulary of the course, by set or A–Z, with search; tap a word to hear it; marks for learned
  and often-confused words.
- **Verb conjugation** (German): tables with every form hidden until tapped; tapping plays the form.
- **Maths**: multiplication table up to 12, typed answers only, with specific hints and the time taken.

Learners cannot add or change words, answers or verbs in the app. All content comes from the `dictionary/` folder.

## Changing content (no new release needed)
1. Edit the file on github.com (pencil icon) and commit to `main`.
2. The app updates by itself when it opens or comes back to the screen, at most every 6 hours per course.
   To update at once: language menu → **Обнови думите**.
3. The *Recordings for new words* workflow records new words and verb forms within 1–2 minutes; the next update
   in the app downloads them for offline use.

```
dictionary/
  languages.json            which languages and courses are on, and each language's voice
  de/words.csv              German words          de/verbs.csv   German conjugation tables
  de/audio/                 German recordings (all courses of a language share one folder)
  fr/words.csv              French words (inactive)
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

### verbs.csv (German)
Columns: `verb, bulgarian, ich, du, er, wir, ihr, sie` — for example `sein,съм,bin,bist,ist,sind,seid,sind`.

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

## Development
```
npm install
npm run dev      # local server
npm run build    # production build in dist/
python scripts/make_audio.py dictionary voice   # record missing words locally (needs piper-tts and ffmpeg)
```
Pushing app changes to `main` publishes them to GitHub Pages (workflow *Deploy app*). Changes under `dictionary/`
do not need a release. See `CLAUDE.md` for architecture notes.
