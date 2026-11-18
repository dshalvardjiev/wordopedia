// Conjugation exercise: one question per verb and pronoun, built from the course's verb tables (verbs.js).
// Pure module: works in plain Node.
import { formText } from './verbs.js';
import { norm, normApos } from './langs.js';
import { lev, shuffle } from './match.js';

// Pronouns accepted in a typed answer for a form: its label and its parts ("er/sie/es", "er", "sie", "es"), the column;
// only the elided pronoun when the form is elided ("j'ai", not "je ai").
const elided = f => /'$/.test(f.label);
// The whole label ("il/elle/on") counts too: it is what "Показване на отговора" shows.
const pronounsOf = f => (elided(f) ? [f.label] : [...new Set([f.label.toLowerCase(), f.col, ...f.label.split('/').map(x => x.trim().toLowerCase())])]);
// Pronoun + form as shown to the learner: "nous sommes", "j'ai", "er/sie/es ist".
export const formShown = f => (elided(f) ? f.label + f.form : `${f.label} ${f.form}`);

// Progress is stored under "<course key>:conj:<verb>:<column>", e.g. "fr:conj:être:nous" or "de:conj:sein:wir".
export function conjFacts(L, verbs) {
  return verbs.flatMap(v => v.forms.map(f => ({
    id: `${L.key}:conj:${v.verb}:${f.col}`, verb: v.verb, bg: v.bg, set: v.set, note: v.note,
    person: f.col, label: f.label, form: f.form, shown: formShown(f), full: formText(f), forms: v.forms,
  })));
}
// "nous sommes (être)": the line in the result list.
export const conjText = f => `${f.shown} (${f.verb})`;

const clean = s => normApos(s).toLowerCase().replace(/[.!?]/g, '').replace(/\s*'\s*/g, "'").replace(/\s+/g, ' ').trim();

// Splits a leading subject pronoun off a typed answer: "j'ai" -> {col:'je', rest:'ai'}; "elle est" -> {col:'il', rest:'est'}.
// The plain column ("je") is recognised too, so "je ai" can be answered with the elided spelling.
function subject(forms, t) {
  for (const f of forms) {
    for (const p of [...pronounsOf(f), f.col]) {
      if (/'$/.test(p) ? t.startsWith(p) : t.startsWith(p + ' ')) return { col: f.col, rest: t.slice(p.length).trim() };
    }
  }
  return null;
}

// Typed answer: the form alone ("sommes") or with a subject pronoun ("nous sommes", "elle est").
// Returns {ok, warn?} or {ok:false, msg} with a message that names the likely mistake.
export function checkConj(L, q, typed) {
  const t = clean(typed), flat = s => norm(L, s);
  const me = q.forms.find(f => f.col === q.person);
  const good = [q.form, ...pronounsOf(me).map(p => (/'$/.test(p) ? p + q.form : p + ' ' + q.form))].map(clean);
  if (good.includes(t)) return { ok: true };
  // Lenient spelling (accents, umlauts), but not for "je ai": norm() drops the apostrophe, so it is checked first.
  const sub = subject(q.forms, t), rest = sub ? sub.rest : t;
  if (!(sub && sub.col === q.person && elided(me) && !t.startsWith(me.label)) && good.map(flat).includes(flat(t))) return { ok: true, warn: `Правилно изписване: ${q.shown}.` };
  if (sub && flat(rest) === flat(q.form)) {
    if (sub.col === q.person) return { ok: false, msg: `Почти. Правилно изписване: ${q.shown}.` };
    return { ok: false, msg: `Формата е вярна, но лицето тук е „${q.label}“: ${q.shown}.` };
  }
  // Another pronoun's form: "parle" for "ils" -> "the form for je and il".
  const other = q.forms.filter(f => flat(f.form) !== flat(q.form) && (flat(rest) === flat(f.form) || flat(t) === flat(f.form)));
  if (other.length) return { ok: false, msg: `Това е формата за ${other.map(f => `„${f.label}“`).join(' и ')}: ${formShown(other[0])}. Тук лицето е „${q.label}“.` };
  if (flat(rest) === flat(q.verb)) return { ok: false, msg: `Това е инфинитивът. Нужна е формата за „${q.label}“.` };
  if (flat(q.form).length >= 3 && (lev(flat(rest), flat(q.form)) === 1 || lev(flat(t), flat(q.form)) === 1)) return { ok: false, msg: 'Почти. Правописът не е точен.' };
  return { ok: false, msg: 'Неверен отговор.' };
}

// Four forms to choose from: the right one, other forms of the same verb, then the same pronoun of other verbs.
export function conjOptions(L, q, facts) {
  const flat = s => norm(L, s);
  const right = q.form, seen = new Set([flat(right)]), pick = [];
  const own = shuffle(q.forms.map(f => f.form));
  const others = shuffle(facts.filter(x => x.verb !== q.verb && x.person === q.person).map(x => x.form));
  for (const x of [...own, ...others]) { if (seen.has(flat(x))) continue; seen.add(flat(x)); pick.push(x); if (pick.length === 3) break; }
  return { right, list: shuffle([right, ...pick]) };
}
