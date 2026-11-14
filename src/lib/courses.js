// A course is one word list: a language (rules, voice, recordings) plus its own file and progress.
// A language without "courses" in languages.json is a single course whose key is the language code ("de"),
// so data saved before courses existed keeps working.
import { LANGS, LANG_ORDER } from './langs.js';

export function coursesFrom(conf) {
  const out = [];
  for (const code of LANG_ORDER) {
    const entry = conf.languages.find(l => l.code === code) || {};
    const on = !!entry.active;
    if (Array.isArray(entry.courses) && entry.courses.length) {
      for (const c of entry.courses) {
        out.push({ key: `${code}-${c.id}`, lang: code, path: `${code}/${c.id}`, title: c.name || c.id, sub: LANGS[code].name, active: on && !!c.active });
      }
    } else {
      out.push({ key: code, lang: code, path: code, title: LANGS[code].name, sub: LANGS[code].native, active: on });
    }
  }
  return out;
}
// Language rules for a course, plus where its data lives. L.code is the language; L.key and L.path belong to the course.
export const courseL = c => ({ ...LANGS[c.lang], key: c.key, path: c.path, title: c.title });
