import { parseCSV } from './csv.js';
import { joinArt, normApos } from './langs.js';

const split = v => (v || '').split(';').map(x => x.trim()).filter(Boolean);
export const full = w => joinArt(w.art, w.de);

function guessType(L, art, de) {
  if (art) return 'n';
  if (L.code === 'de') return de[0] && de[0] !== de[0].toLowerCase() ? 'n' : /n$/.test(de) ? 'v' : 'o';
  if (L.code === 'fr') return /(er|ir|re)$/.test(de) ? 'v' : 'o';
  return 'o';
}
export { guessType };

// "2026-11 Ноември" -> {id:'2026-11', name:'Ноември'}; any other text is its own id and name.
export function parseSet(v) {
  const m = /^(\S+)\s+(.+)$/.exec((v || '').trim());
  if (m && /\d/.test(m[1])) return { id: m[1], name: m[2] };
  const t = (v || '').trim() || 'Без списък';
  return { id: t, name: t };
}

export const EMPTY = { words: [], sets: [], problems: [] };

// Columns: set, article, german (foreign word, any language), bulgarian (";"-separated), type, plural, alt, note.
// "foreign" is accepted as a synonym of "german" so French and English files can use a neutral header.
export function parseDictionary(text, L) {
  const rows = parseCSV(text);
  if (!rows.length) throw new Error('Файлът е празен.');
  const head = rows[0].map(h => h.trim().toLowerCase());
  const col = n => (n === 'german' && head.indexOf('german') < 0 ? head.indexOf('foreign') : head.indexOf(n));
  for (const need of ['set', 'german', 'bulgarian']) if (col(need) < 0) throw new Error(`Липсва колона „${need === 'german' ? 'german (или foreign)' : need}“.`);
  const get = (r, n) => (col(n) >= 0 ? (r[col(n)] || '').trim() : '');
  const sets = new Map(), words = [], seen = new Set(), problems = [];
  rows.slice(1).forEach((r, i) => {
    const de = get(r, 'german'), bg = split(get(r, 'bulgarian'));
    let art = normApos(get(r, 'article')).toLowerCase();
    if (!de || !bg.length) { problems.push(`ред ${i + 2}: липсва чуждата или българската дума`); return; }
    if (art && !L.articles.includes(art)) { problems.push(`ред ${i + 2}: непознат член „${art}“`); art = ''; }
    const s = parseSet(get(r, 'set'));
    if (!sets.has(s.id)) sets.set(s.id, s);
    const id = L.code + ':' + s.id + '|' + joinArt(art, de);
    if (seen.has(id)) { problems.push(`ред ${i + 2}: повторена дума ${de}`); return; }
    seen.add(id);
    const type = (get(r, 'type') || guessType(L, art, de)).toLowerCase()[0];
    words.push({ id, lang: L.code, set: s.id, art, de, bg, type: 'nvao'.includes(type) ? type : 'o', pl: get(r, 'plural'), alt: split(get(r, 'alt')).map(normApos), note: get(r, 'note') });
  });
  return { words, sets: [...sets.values()], problems };
}
