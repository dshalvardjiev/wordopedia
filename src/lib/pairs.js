// Matching exercise ("Свързване"): rounds of up to 10 words, each paired with its Bulgarian translation; a noun then
// also gets its article (der/die/das, le/la/l'/les, a/an). Pure: no React, no browser.
import { full } from './dictionary.js';
import { norm } from './langs.js';
import { nbg } from './match.js';

export const PER_ROUND = 10;
export const ROUNDS = ['1', '2', '3', '5'];

// The article step of a word, or null: German and French nouns with an article of the article exercise; English
// countable nouns with "a" or "an" (decided from the word, see langs.js).
export function artStep(L, w) {
  if (w.type !== 'n') return null;
  if (L.quizArticles.length) return L.quizArticles.includes(w.art) ? { right: w.art, list: L.quizArticles.slice() } : null;
  const a = L.indef ? L.indef(w.de) : '';
  return a ? { right: a, list: ['a', 'an'] } : null;
}
// The foreign word on its tile: without the article while the article is still to be chosen.
export const tileText = (L, w) => (artStep(L, w) ? w.de : full(w));
// The word with its article once the step is done (English: "an apple").
export const doneText = (L, w) => { const s = artStep(L, w); return s && !L.quizArticles.length ? `${s.right} ${w.de}` : full(w); };
export const bgText = w => w.bg[0];

// Two words that cannot share a board: the same foreign tile (der See / die See), or a translation that would also fit
// the other word (one word's shown translation is among the other's answers).
function clash(L, a, b) {
  if (norm(L, tileText(L, a)) === norm(L, tileText(L, b))) return true;
  const ab = a.bg.map(nbg), bb = b.bg.map(nbg);
  return ab.includes(nbg(b.bg[0])) || bb.includes(nbg(a.bg[0]));
}

// Splits shuffled words into at most `rounds` boards of up to PER_ROUND words without clashes. A word that clashes
// with every board so far waits for a later one. Boards of fewer than 2 words are dropped.
export function buildRounds(L, words, rounds) {
  const out = [];
  let rest = words.slice();
  for (let r = 0; r < rounds && rest.length; r++) {
    const cur = [], left = [];
    for (const w of rest) (cur.length < PER_ROUND && !cur.some(x => clash(L, x, w)) ? cur : left).push(w);
    if (cur.length < 2) break;
    out.push(cur);
    rest = left;
  }
  return out;
}
// Highest score of a board: one point per pair, one per article.
export const maxPoints = (L, list) => list.reduce((n, w) => n + 1 + (artStep(L, w) ? 1 : 0), 0);
