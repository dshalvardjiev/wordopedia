// Answer normalisation and checking for Bulgarian and the chosen foreign language.
import { full } from './dictionary.js';
import { joinArt, norm, splitArticle, normApos } from './langs.js';

const HOMO = { a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т' };
export function nbg(s) {
  s = String(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/ѝ/g, 'и').replace(/[.,!?;:"'„“”]/g, '').replace(/\s+/g, ' ').trim();
  if (/[а-я]/.test(s)) s = s.replace(/[aeopcxykmt]/g, ch => HOMO[ch]);
  return s;
}
export const nbgL = s => nbg(s).replace(/^да /, '').replace(/ (се|си)$/, '');

function adjForms(c) {
  // фин -> фина, фино, фини; добър -> добра, добро, добри; деликатен -> деликатна
  const out = [c], stems = [c];
  if (/[ъе][^аеиоуъюяй ]$/.test(c)) stems.push(c.slice(0, -2) + c.slice(-1));
  stems.forEach(st => ['а', 'о', 'и'].forEach(e => out.push(st + e)));
  return out;
}
const bgCands = w => w.bg.flatMap(x => (w.type === 'a' && !/ /.test(nbgL(x)) ? adjForms(nbgL(x)) : [nbgL(x)]));
export function lev(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function forms(L, x) {
  const f = [{ art: x.art, de: x.de, type: x.type }];
  (x.alt || []).forEach(a => { const s = splitArticle(L, a); f.push(s.art ? { art: s.art, de: s.word, type: 'n' } : { art: '', de: normApos(a), type: x.type }); });
  return f;
}
const hasArticles = L => L.articles.length > 0;
// English: "the dog", "a dog" and "to eat" count as "dog" and "eat", but only for that word type and only if the
// dictionary word does not itself start with the prefix ("a lot" stays "a lot").
function dropPrefix(L, typed, f) {
  const ps = (L.optionalPrefixes && L.optionalPrefixes[f.type]) || [];
  const low = typed.toLowerCase(), target = f.de.toLowerCase();
  for (const p of ps) if (low.startsWith(p + ' ') && !target.startsWith(p + ' ')) return typed.slice(p.length + 1);
  return typed;
}

// Returns {ok, warn?, msg?, own?}. "own" means the learner may accept the answer as a new synonym.
export function evaluate(L, w, v, dir, reqArt, allWords) {
  const WRONG = 'Не е вярно. Опитай пак.';
  if (dir === 'x-bg') {   // answer typed in Bulgarian
    const x = nbgL(v), cands = bgCands(w);
    if (cands.includes(x)) return { ok: true };
    const near = x.length >= 4 && cands.find(c => c.length >= 5 && lev(c, x) === 1);
    if (near) return { ok: true, warn: `Правописът е: ${near}.` };
    return { ok: false, msg: WRONG, own: true };
  }
  const { art, word } = hasArticles(L) ? splitArticle(L, v) : { art: '', word: normApos(v).trim().replace(/\s+/g, ' ') };
  const p = nbg(w.bg[0]);
  const targets = [w, ...allWords.filter(x => x.id !== w.id && x.bg.map(nbg).includes(p))];
  const fs = targets.flatMap(x => forms(L, x));
  const t = fs.find(f => norm(L, f.de) === norm(L, word) || norm(L, f.de) === norm(L, dropPrefix(L, word, f)));
  if (!t) {
    const near = fs.find(f => norm(L, f.de).length >= 4 && lev(norm(L, f.de), norm(L, word)) === 1);
    return { ok: false, msg: near ? 'Почти. Провери правописа.' : WRONG, own: !near };
  }
  if (L.code === 'fr' && t.de.length <= 3 && /[^\x00-\x7f]/.test(t.de) && word.toLowerCase() !== t.de.toLowerCase())
    return { ok: false, msg: `Почти. Провери знака над буквата: ${t.de}.` };
  const isNoun = t.type === 'n' && L.articles.includes(t.art);
  if (isNoun) {
    if (art && art !== t.art) return { ok: false, msg: 'Думата е вярна, членът не е. Опитай пак.' };
    if (!art && reqArt) return { ok: false, msg: `Думата е вярна. Добави члена: ${L.articles.join(', ')}.` };
  } else if (art) return { ok: false, msg: 'Почти. Тази дума се пише без член.' };
  const warns = [];
  const typed = dropPrefix(L, word, t);
  if (L.capNouns && isNoun && typed[0] && typed[0] !== typed[0].toUpperCase()) warns.push(`Съществителните се пишат с главна буква: ${t.de}.`);
  else if (typed.toLowerCase() !== t.de.toLowerCase() && /[^\x00-\x7f]/.test(t.de)) warns.push(`Правилно изписване: ${joinArt(t.art, t.de)}.`);
  if (t.de !== w.de) warns.push(`Също вярно. Основната дума в списъка е ${full(w)}.`);
  return { ok: true, warn: warns.join(' ') };
}

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export { shuffle };

// Multiple-choice options; distractors never include another correct answer.
export function options(L, w, dir, allWords) {
  if (dir === 'art') return { right: w.art, list: L.quizArticles.slice() };
  const others = allWords.filter(x => x.id !== w.id);
  let cand;
  if (dir === 'x-bg') { const bad = new Set(w.bg.map(nbg)); cand = others.filter(x => !bad.has(nbg(x.bg[0]))); }
  else { const p = nbg(w.bg[0]); cand = others.filter(x => !x.bg.map(nbg).includes(p) && norm(L, x.de) !== norm(L, w.de)); }
  const pool = [...shuffle(cand.filter(x => x.type === w.type)), ...shuffle(cand.filter(x => x.type !== w.type))];
  const right = dir === 'x-bg' ? w.bg[0] : full(w);
  const seen = new Set([right]), pick = [];
  for (const x of pool) { const l = dir === 'x-bg' ? x.bg[0] : full(x); if (seen.has(l)) continue; seen.add(l); pick.push(l); if (pick.length === 3) break; }
  return { right, list: shuffle([right, ...pick]) };
}
