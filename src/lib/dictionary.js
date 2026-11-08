import { parseCSV } from './csv.js';

export const ARTS = ['der', 'die', 'das'];
const split = v => (v || '').split(';').map(x => x.trim()).filter(Boolean);
export const full = w => (w.art ? w.art + ' ' : '') + w.de;

function guessType(art, de) {
  if (art) return 'n';
  if (de[0] && de[0] !== de[0].toLowerCase()) return 'n';
  return /n$/.test(de) ? 'v' : 'o';
}

// "2026-11 Ноември" -> {id:'2026-11', name:'Ноември'}; any other text is its own id and name.
export function parseSet(v) {
  const m = /^(\S+)\s+(.+)$/.exec((v || '').trim());
  if (m && /\d/.test(m[1])) return { id: m[1], name: m[2] };
  const t = (v || '').trim() || 'Без списък';
  return { id: t, name: t };
}

// Columns: set, article, german, bulgarian (";"-separated), type (n/v/a/o), plural, alt (";"-separated German), note
export function parseDictionary(text) {
  const rows = parseCSV(text);
  if (!rows.length) throw new Error('Файлът е празен.');
  const head = rows[0].map(h => h.trim().toLowerCase());
  const col = n => head.indexOf(n);
  for (const need of ['set', 'german', 'bulgarian']) if (col(need) < 0) throw new Error(`Липсва колона „${need}“.`);
  const get = (r, n) => (col(n) >= 0 ? (r[col(n)] || '').trim() : '');
  const sets = new Map(), words = [], seen = new Set(), problems = [];
  rows.slice(1).forEach((r, i) => {
    const de = get(r, 'german'), bg = split(get(r, 'bulgarian'));
    let art = get(r, 'article').toLowerCase();
    if (!de || !bg.length) { problems.push(`ред ${i + 2}: липсва немска или българска дума`); return; }
    if (art && !ARTS.includes(art)) { problems.push(`ред ${i + 2}: непознат член „${art}“`); art = ''; }
    const s = parseSet(get(r, 'set'));
    if (!sets.has(s.id)) sets.set(s.id, s);
    const id = s.id + '|' + (art ? art + ' ' : '') + de;
    if (seen.has(id)) { problems.push(`ред ${i + 2}: повторена дума ${de}`); return; }
    seen.add(id);
    const type = (get(r, 'type') || guessType(art, de)).toLowerCase()[0];
    words.push({ id, set: s.id, art, de, bg, type: 'nvao'.includes(type) ? type : 'o', pl: get(r, 'plural'), alt: split(get(r, 'alt')), note: get(r, 'note') });
  });
  if (!words.length) throw new Error('Няма разпознати думи.');
  return { words, sets: [...sets.values()], problems };
}
