// Checks dictionary/languages.json, dictionary/instances/*.json, every course's word list and every question bank.
// Errors (exit code 1) block the deploy; warnings are printed only.
// Usage: node scripts/check-content.mjs
import fs from 'node:fs';
import { parseDictionary } from '../src/lib/dictionary.js';
import { coursesFrom, courseL, instanceCourses, quizCourse, ID_RE, PRODUCTION, STAGING } from '../src/lib/courses.js';
import { parseBank } from '../src/lib/quiz.js';

const D = 'dictionary/';
const errors = [], warnings = [];
const err = m => errors.push(m), warn = m => warnings.push(m);
const readJson = f => { try { return JSON.parse(fs.readFileSync(D + f, 'utf8')); } catch (e) { err(`${f}: ${e.message}`); return null; } };

const conf = readJson('languages.json');
const courses = conf ? coursesFrom(conf) : [];
for (const c of courses) {
  const file = `${c.path}/words.csv`;
  if (!fs.existsSync(D + file)) { if (c.active) err(`${file}: missing for active course "${c.key}"`); continue; }
  try {
    const p = parseDictionary(fs.readFileSync(D + file, 'utf8'), courseL(c));
    p.problems.forEach(x => err(`${file}: ${x}`));
    if (c.active && !p.words.length) warn(`course "${c.key}" is active but has no words`);
  } catch (e) { err(`${file}: ${e.message}`); }
}

// Question banks: dictionary/quiz/<key>.json, offered like courses.
const quizzes = [];
for (const f of fs.existsSync(D + 'quiz') ? fs.readdirSync(D + 'quiz').filter(x => x.endsWith('.json')).sort() : []) {
  const key = f.slice(0, -5), file = `quiz/${f}`;
  if (!ID_RE.test(key)) { err(`${file}: invalid file name (lower case letters, digits and "-" only)`); continue; }
  if (key === 'math' || courses.some(c => c.key === key)) { err(`${file}: "${key}" is already the key of a course`); continue; }
  const data = readJson(file);
  if (!data) continue;
  try {
    const b = parseBank(data, key);
    b.problems.forEach(x => err(`${file}: ${x}`));
    if (!b.questions.length) warn(`${file}: no questions`);
    if (data.sizes !== undefined && !(Array.isArray(data.sizes) && data.sizes.length && data.sizes.every(n => Number.isInteger(n) && n > 0))) err(`${file}: "sizes" must be a list of positive whole numbers`);
    quizzes.push(quizCourse(key, data));
  } catch (e) { err(`${file}: ${e.message}`); }
}

const keys = new Set([...courses.map(c => c.key), 'math', ...quizzes.map(q => q.key)]);
const ids = fs.readdirSync(D + 'instances').filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
if (!ids.includes(PRODUCTION)) err(`instances/${PRODUCTION}.json is missing`);
if (!ids.includes(STAGING)) warn(`instances/${STAGING}.json is missing, so the staging branch cannot be built`);
for (const id of ids) {
  const at = `instances/${id}.json`;
  if (!ID_RE.test(id)) err(`${at}: invalid file name (lower case letters, digits and "-" only)`);
  const inst = readJson(`instances/${id}.json`);
  if (!inst) continue;
  if ((id === PRODUCTION || id === STAGING) && inst.courses !== 'all') warn(`${at}: expected "courses": "all"`);
  if (inst.courses !== 'all' && (!Array.isArray(inst.courses) || !inst.courses.length)) { err(`${at}: "courses" must be "all" or list at least one course`); continue; }
  const sel = inst.courses === 'all' ? [] : inst.courses;
  const refs = sel.map(e => e && e.course);
  refs.filter(r => !keys.has(r)).forEach(r => err(`${at}: unknown course "${r}" (known: ${[...keys].join(', ')})`));
  refs.filter((r, i) => refs.indexOf(r) !== i).forEach(r => err(`${at}: course "${r}" listed twice`));
  sel.filter(e => e && 'label' in e && !String(e.label).trim()).forEach(e => err(`${at}: empty label for "${e.course}"`));
  const shown = instanceCourses(courses, inst, quizzes);
  const titles = shown.map(c => c.title);
  titles.filter((t, i) => titles.indexOf(t) !== i).forEach(t => err(`${at}: two courses are shown as "${t}"; set a "label"`));
  if (!shown.some(c => c.active)) warn(`${at}: no active course`);
}

warnings.forEach(w => console.warn('warning: ' + w));
errors.forEach(e => console.error('error: ' + e));
console.log(`${courses.length} course(s) + maths, ${quizzes.length} question bank(s), ${ids.length} instance(s): ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
