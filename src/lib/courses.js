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

// Maths is offered like a course so instances can include or leave it out. Its key is MATH ('math').
export const MATH_COURSE = { key: 'math', kind: 'math', title: 'Математика', sub: 'Таблица за умножение', active: true };
export const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
export const PRODUCTION = 'production', STAGING = 'staging';

// The courses an instance (dictionary/instances/<id>.json) offers, in its order. "courses": "all" means every course
// of languages.json plus maths, so new courses appear without editing the instance. Per entry, "label" and "subtitle"
// replace the course's title and subtitle in this instance only. Unknown course keys are left out.
export function instanceCourses(courses, inst) {
  const all = [...courses.map(c => ({ ...c, kind: 'vocab' })), MATH_COURSE];
  const sel = inst && inst.courses;
  if (sel === 'all') return all;
  if (!Array.isArray(sel)) return [];
  return sel.map(e => {
    const c = e && all.find(x => x.key === e.course);
    return c && { ...c, title: e.label || c.title, sub: e.subtitle || c.sub };
  }).filter(Boolean);
}
