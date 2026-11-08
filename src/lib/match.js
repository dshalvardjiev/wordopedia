// Answer normalisation and checking. Ported unchanged in behaviour from the single-page version.
import { ARTS, full } from './dictionary.js';

const HOMO = { a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т' };
export function nbg(s) {
  s = String(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/ѝ/g, 'и').replace(/[.,!?;:"'„“”]/g, '').replace(/\s+/g, ' ').trim();
  if (/[а-я]/.test(s)) s = s.replace(/[aeopcxykmt]/g, ch => HOMO[ch]);
  return s;
}
export const nbgL = s => nbg(s).replace(/^да /, '').replace(/ (се|си)$/, '');
export const nde = s => String(s).toLowerCase().replace(/ß/g, 'ss').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/[.,!?;:"'„“”]/g, '').replace(/\s+/g, ' ').trim();

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
function deForms(x) {
  const f = [{ art: x.art, de: x.de, type: x.type }];
  (x.alt || []).forEach(a => { const m = /^(der|die|das) (.+)$/.exec(a); f.push(m ? { art: m[1], de: m[2], type: 'n' } : { art: '', de: a, type: x.type }); });
  return f;
}

// Returns {ok, warn?, msg?, own?}. "own" means the learner may accept the answer as a new synonym.
export function evaluate(w, v, dir, reqArt, allWords) {
  const WRONG = 'Не е вярно. Опитай пак.';
  if (dir === 'de-bg') {
    const x = nbgL(v), cands = bgCands(w);
    if (cands.includes(x)) return { ok: true };
    const near = x.length >= 4 && cands.find(c => c.length >= 5 && lev(c, x) === 1);
    if (near) return { ok: true, warn: `Правописът е: ${near}.` };
    return { ok: false, msg: WRONG, own: true };
  }
  const raw = v.trim().replace(/\s+/g, ' ');
  let art = '', word = raw;
  const m = /^(der|die|das)\s+(.+)$/i.exec(raw);
  if (m) { art = m[1].toLowerCase(); word = m[2]; }
  const p = nbg(w.bg[0]);
  const targets = [w, ...allWords.filter(x => x.id !== w.id && x.bg.map(nbg).includes(p))];
  const forms = targets.flatMap(deForms);
  const t = forms.find(f => nde(f.de) === nde(word));
  if (!t) {
    const near = forms.find(f => nde(f.de).length >= 4 && lev(nde(f.de), nde(word)) === 1);
    return { ok: false, msg: near ? 'Почти. Провери правописа.' : WRONG, own: !near };
  }
  const isNoun = t.type === 'n' && ARTS.includes(t.art);
  if (isNoun) {
    if (art && art !== t.art) return { ok: false, msg: 'Думата е вярна, членът не е. Опитай пак.' };
    if (!art && reqArt) return { ok: false, msg: 'Думата е вярна. Добави члена: der, die или das.' };
  } else if (art) return { ok: false, msg: 'Почти. Тази дума не е съществително и няма член.' };
  const warns = [];
  if (isNoun && word[0] && word[0] !== word[0].toUpperCase()) warns.push(`Съществителните на немски се пишат с главна буква: ${t.de}.`);
  else if (word !== t.de && nde(word) === nde(t.de) && /[äöüß]/.test(t.de) && !/[äöüß]/.test(word)) warns.push(`Правилно изписване: ${t.de}.`);
  if (t.de !== w.de) warns.push(`Също вярно. Основната дума в списъка е ${full(w)}.`);
  return { ok: true, warn: warns.join(' ') };
}

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export { shuffle };

// Multiple-choice options; distractors never include another correct answer.
export function options(w, dir, allWords) {
  if (dir === 'art') return { right: w.art, list: ARTS.slice() };
  const others = allWords.filter(x => x.id !== w.id);
  let cand;
  if (dir === 'de-bg') { const bad = new Set(w.bg.map(nbg)); cand = others.filter(x => !bad.has(nbg(x.bg[0]))); }
  else { const p = nbg(w.bg[0]); cand = others.filter(x => !x.bg.map(nbg).includes(p) && nde(x.de) !== nde(w.de)); }
  const pool = [...shuffle(cand.filter(x => x.type === w.type)), ...shuffle(cand.filter(x => x.type !== w.type))];
  const right = dir === 'de-bg' ? w.bg[0] : full(w);
  const seen = new Set([right]), pick = [];
  for (const x of pool) { const l = dir === 'de-bg' ? x.bg[0] : full(x); if (seen.has(l)) continue; seen.add(l); pick.push(l); if (pick.length === 3) break; }
  return { right, list: shuffle([right, ...pick]) };
}
