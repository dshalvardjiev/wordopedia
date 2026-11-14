# Wordopedia

Web app for learning German, French and English words with Bulgarian translations, plus a maths section (multiplication table). It installs on Android and iPhone and works offline. Bulgarian is always one side; there is no French–English practice.

## Install on a phone
- **Android (Chrome):** open the app link, then menu ⋮ → *Add to Home screen* / *Install app*.
- **iPhone (Safari):** open the app link, then Share → *Add to Home Screen*.

## Languages
`dictionary/languages.json` decides which languages the app offers. A language with `"active": false` is shown as "скоро" and cannot be chosen.
To switch on French: add words to `dictionary/fr/words.csv`, set `"active": true`, then in the app open the language menu and tap **Провери за нови курсове**.

### Courses
A language can have several courses, each with its own word list and progress; recordings are shared.
English has two: **Elementary English** (`dictionary/en/elementary/words.csv`, the alphabet book, letters A–R so far)
and **Basic English** (`dictionary/en/basic/words.csv`, inactive until it has words). A course is listed in `languages.json`:
```json
{ "code": "en", "active": true, "courses": [
  { "id": "elementary", "name": "Elementary English", "active": true },
  { "id": "basic", "name": "Basic English", "active": false } ] }
```
To switch on Basic English: add words to its file, set its `"active": true`, then **Провери за нови курсове** in the app.
Sets without a date (e.g. `Букви M–R`) count in file order: the last one in the file is "Последни".

| code | voice (Piper TTS) | articles in the exercises |
|---|---|---|
| de | de_DE-thorsten-high | der, die, das |
| fr | fr_FR-siwis-medium | le, la, l', les |
| en | en_GB-cori-high | none; "the", "a/an" and "to" are optional in answers |

## Maths
Choose **Математика** in the top menu (or on the first screen). The first test is the multiplication table up to 12:
pick the tables (1–12), shuffled or in order, 10 / 20 / all questions. Answers are typed; the next question comes only
after the correct number. Wrong answers get a specific hint (e.g. "this is 7 + 8" or "close: that is 7 × 9"), and the
result shows the time taken and the facts to practise again. New tests go into `src/lib/math.js` (`TESTS`).

## Verb conjugation (German)
`dictionary/de/verbs.csv` holds the tables (`verb,bulgarian,ich,du,er,wir,ihr,sie`); currently fliegen, haben, sein.
In the app: German, exercise **ich, du…**. Each form is hidden until tapped; tapping plays its recording.
Add a verb as a new row and tap **Обнови речника**; the recordings workflow records its forms.

## Change the word list (no new release needed)
1. Edit `dictionary/<code>/words.csv` (or `dictionary/<code>/<course>/words.csv`) on github.com (pencil icon) and commit.
2. In the app: **Речник → Обнови речника**.

Columns: `set, article, german, bulgarian, type, plural, alt, note` (French and English files may call the third column `foreign`).

| column | meaning |
|---|---|
| set | date and name, e.g. `2026-12 Декември`; the newest date is "Последни" |
| article | German `der/die/das`, French `le/la/l'/les`, English empty |
| german / foreign | the foreign word |
| bulgarian | accepted answers separated by `;`; the first is shown |
| type | `n` noun, `v` verb, `a` adjective/adverb, `o` other |
| plural | e.g. `die Hunde` (shown after answering) |
| alt | other correct foreign words separated by `;`, e.g. `das Bild` |
| note | shown after answering |

Example rows:
```
2026-12 Декември,der,Hund,куче; кученце,n,die Hunde,,
2026-12 Декември,l',eau,вода,n,,,
2026-12 Декември,,dog,куче,n,dogs,,
```

After a change to a CSV, the *Recordings for new words* workflow creates recordings in `dictionary/<code>/audio/` with that language's voice and commits them. It takes 1–2 minutes; tap **Обнови речника** again afterwards to download them for offline use.

и речника** again afterwards to download them for offline use.

## Development
```
npm install
npm run dev      # local server
npm run build    # production build in dist/
```
Pushing app changes to `main` publishes them to GitHub Pages (workflow *Deploy app*).
