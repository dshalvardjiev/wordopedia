// Checks dictionary/languages.json, dictionary/instances/*.json and every course's word list.
// Errors (exit code 1) block the deploy; warnings are printed only.
// Usage: node scripts/check-content.mjs
import fs from 'node:fs';
import { parseDictionary } from '../src/lib/dictionary.js';
import { coursesFrom, courseL, instanceCourses, ID_RE, PRODUCTION, STAGING } from '../src/lib/courses.js';

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

const keys = new Set([...courses.map(c => c.key), 'math']);
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
  const shown = instanceCourses(courses, inst);
  const titles = shown.map(c => c.title);
  titles.filter((t, i) => titles.indexOf(t) !== i).forEach(t => err(`${at}: two courses are shown as "${t}"; set a "label"`));
  if (!shown.some(c => c.active)) warn(`${at}: no active course`);
}

warnings.forEach(w => console.warn('warning: ' + w));
errors.forEach(e => console.error('error: ' + e));
console.log(`${courses.length} course(s) + maths, ${ids.length} instance(s): ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
