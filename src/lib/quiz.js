// Question banks: choice and matrix questions from dictionary/quiz/<key>.json, offered like a course.
// Pure module: also used by scripts/check-content.mjs in plain Node.
import { ID_RE } from './courses.js';

export const DEFAULT_QUIZ = { filter: 'all', size: '20' };
export const EMPTY_BANK = { about: '', questions: [], problems: [] };

const isList = (a, min) => Array.isArray(a) && a.length >= min && a.every(x => typeof x === 'string' && x.trim());
const isIdx = (x, n) => Number.isInteger(x) && x >= 0 && x < n;

// File: { title, subtitle, about, sizes, questions: [...] }. A question is one of
//   { id, type: "choice", q, options: [...], answer: [option indexes] }       one or several correct options
//   { id, type: "matrix", q, rows: [...], choices: [...], answer: [...] }     one choice index per row
// plus optional "why" (explanation), "ref" (link), "note" and "key" ("source" | "twin" | "derived": where the answer comes from).
// Question id in the app: quiz:<bank key>:<id>. Progress is keyed by it, so ids must not change once published.
// Invalid questions are left out and listed in "problems".
export function parseBank(data, key) {
  const list = data && Array.isArray(data.questions) ? data.questions : null;
  if (!list) throw new Error('"questions" must be a list');
  const questions = [], problems = [], seen = new Set();
  list.forEach((r, i) => {
    const at = `question ${i + 1}${r && r.id ? ` (${r.id})` : ''}`;
    const bad = m => { problems.push(`${at}: ${m}`); };
    if (!r || typeof r.id !== 'string' || !ID_RE.test(r.id)) return bad('id must be lower case letters, digits and "-"');
    if (seen.has(r.id)) return bad('duplicate id');
    if (typeof r.q !== 'string' || !r.q.trim()) return bad('missing question text');
    const a = r.answer;
    if (!Array.isArray(a) || !a.length) return bad('missing answer');
    const q = { id: `quiz:${key}:${r.id}`, type: r.type, q: r.q.trim(), why: r.why || '', ref: r.ref || '', note: r.note || '', key: r.key || '' };
    if (r.type === 'choice') {
      if (!isList(r.options, 2)) return bad('needs at least two options');
      if (a.some(x => !isIdx(x, r.options.length)) || new Set(a).size !== a.length) return bad('answer must list distinct option indexes');
      if (a.length >= r.options.length) return bad('every option is marked correct');
      Object.assign(q, { options: r.options, answer: [...a].sort((x, y) => x - y) });
    } else if (r.type === 'matrix') {
      if (!isList(r.rows, 1) || !isList(r.choices, 2)) return bad('needs rows and at least two choices');
      if (a.length !== r.rows.length || a.some(x => !isIdx(x, r.choices.length))) return bad('answer must give one choice index per row');
      Object.assign(q, { rows: r.rows, choices: r.choices, answer: [...a] });
    } else return bad('type must be "choice" or "matrix"');
    seen.add(r.id);
    questions.push(q);
  });
  return { about: typeof data.about === 'string' ? data.about.trim() : '', questions, problems };
}

// choice: picked = chosen option indexes, in any order. matrix: picked = one choice index per row.
export function grade(q, picked) {
  if (!Array.isArray(picked)) return false;
  if (q.type === 'matrix') return picked.length === q.answer.length && q.answer.every((a, i) => a === picked[i]);
  const s = new Set(picked);
  return s.size === q.answer.length && q.answer.every(a => s.has(a));
}
// Enough has been chosen to check the answer.
export const complete = (q, picked) => (q.type === 'matrix' ? picked.length === q.rows.length && picked.every(x => x >= 0) : picked.length === q.answer.length);
export const statsPrefix = key => `quiz:${key}:`;
export const short = (t, n = 120) => (t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + ' …' : t);
