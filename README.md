# Wordopedia: Немски думи (BG и DE)

Web app for learning German words with Bulgarian translations. It installs on Android and iPhone and works offline.

## Install on a phone
- **Android (Chrome):** open the app link, then menu ⋮ → *Add to Home screen* / *Install app*.
- **iPhone (Safari):** open the app link, then Share → *Add to Home Screen*.

## Change the word list (no new release needed)
1. Edit `dictionary/words.csv` on github.com (pencil icon) and commit.
2. In the app: **Речник → Обнови речника**.

Columns: `set, article, german, bulgarian, type, plural, alt, note`

| column | meaning |
|---|---|
| set | date and name, e.g. `2026-12 Декември`; the newest date is "Последни" |
| article | `der`, `die`, `das` or empty |
| german | the German word |
| bulgarian | accepted answers separated by `;`; the first is shown |
| type | `n` noun, `v` verb, `a` adjective/adverb, `o` other |
| plural | e.g. `die Hunde` (shown after answering) |
| alt | other correct German words separated by `;`, e.g. `das Bild` |
| note | shown after answering |

Example row: `2026-12 Декември,der,Hund,куче; кученце,n,die Hunde,,`

After a change to the CSV, the *Recordings for new words* workflow creates German recordings (Piper TTS, voice de_DE-thorsten-high) in `dictionary/audio/` and commits them. It takes 1–2 minutes; tap **Обнови речника** again afterwards to download them for offline use.

## Development
```
npm install
npm run dev      # local server
npm run build    # production build in dist/
```
Pushing app changes to `main` publishes them to GitHub Pages (workflow *Deploy app*).
