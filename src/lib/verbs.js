// Verb conjugation tables: dictionary/<course>/verbs.csv with columns verb, bulgarian and one column per pronoun,
// plus optional set (verb group, shown in the conjugation exercise) and note (shown after answering).
// A verb is used only when every form is filled in.
import { parseCSV } from './csv.js';
import { normApos } from './langs.js';

// Elision before a vowel or a mute h ("je" + "ai" -> "j'ai"). Must match ELIDE/verb_texts() in scripts/make_audio.py.
const VOWEL = /^[aeiouyàâäéèêëîïôöûùüœæh]/i;

export function parseVerbs(text, L) {
  if (!L.pronouns || !text) return [];
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const head = rows[0].map(h => h.trim().toLowerCase());
  const col = n => head.indexOf(n);
  if (col('verb') < 0) return [];
  const get = (r, n) => (col(n) >= 0 ? normApos(r[col(n)] || '').trim().replace(/\s+/g, ' ') : '');
  return rows.slice(1).map(r => ({
    verb: get(r, 'verb'),
    bg: get(r, 'bulgarian'),
    set: get(r, 'set'),
    note: get(r, 'note'),
    forms: L.pronouns.map(([c, label, say]) => {
      const form = get(r, c), e = L.elide && L.elide[c];
      // Elided: shown and spoken as "j'" + "ai".
      return e && VOWEL.test(form) ? { col: c, label: e, say: e, form } : { col: c, label, say, form };
    }),
  })).filter(v => v.verb && v.forms.every(f => f.form));
}
// Text of one recorded form: "ich fliege", "er, sie, es fliegt", "j'ai".
export const formText = f => (/'$/.test(f.say) ? f.say + f.form : `${f.say} ${f.form}`);
