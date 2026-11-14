// Verb conjugation tables: dictionary/<course>/verbs.csv with columns verb, bulgarian and one column per pronoun.
import { parseCSV } from './csv.js';

export function parseVerbs(text, L) {
  if (!L.pronouns || !text) return [];
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const head = rows[0].map(h => h.trim().toLowerCase());
  const col = n => head.indexOf(n);
  if (col('verb') < 0) return [];
  return rows.slice(1).map(r => ({
    verb: (r[col('verb')] || '').trim(),
    bg: col('bulgarian') >= 0 ? (r[col('bulgarian')] || '').trim() : '',
    forms: L.pronouns.map(([c, label, say]) => ({ label, say, form: col(c) >= 0 ? (r[col(c)] || '').trim() : '' })),
  })).filter(v => v.verb && v.forms.every(f => f.form));
}
// Text of one recorded form: "ich fliege", "er, sie, es fliegt".
export const formText = f => `${f.say} ${f.form}`;
