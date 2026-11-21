// Checks dictionary/languages.json, dictionary/instances/*.json and every course's word list.
// Errors (exit code 1) block the deploy; warnings are printed only.
// Usage: node scripts/check-content.mjs
import fs from 'node:fs';
import { parseDictionary } from '../src/lib/dictionary.js';
import { parseVerbs } from '../src/lib/verbs.js';
import { parseCSV } from '../src/lib/csv.js';
import { coursesFrom, courseL, instanceCourses, ID_RE, PRODUCTION, STAGING } from '../src/lib/courses.js';
import { parseImages } from '../src/lib/images.js';
import { full } from '../src/lib/dictionary.js';

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
  // Optional verb tables: every row needs all pronoun columns filled in, or the app leaves the verb out.
  const vfile = `${c.path}/verbs.csv`;
  if (fs.existsSync(D + vfile)) {
    const L = courseL(c), text = fs.readFileSync(D + vfile, 'utf8');
    if (!L.pronouns) { err(`${vfile}: ${c.lang} has no pronouns in src/lib/langs.js, so its verbs cannot be shown`); continue; }
    const head = (parseCSV(text)[0] || []).map(h => h.trim().toLowerCase());
    ['verb', 'bulgarian', ...L.pronouns.map(p => p[0])].filter(n => !head.includes(n)).forEach(n => err(`${vfile}: column "${n}" is missing`));
    const names = parseCSV(text).slice(1).map(r => (r[head.indexOf('verb')] || '').trim()), kept = new Set(parseVerbs(text, L).map(v => v.verb));
    names.forEach((v, i) => { if (!kept.has(v)) err(`${vfile}: row ${i + 2} (${v || 'no verb'}) is incomplete and is not shown`); });
    names.filter((v, i) => v && names.indexOf(v) !== i).forEach(v => err(`${vfile}: ${v} is listed twice`));
  }
}

// Usage tracking settings (docs/tracking.md): {"url": "https://…/e", "enabled": false to switch it off everywhere}.
if (conf && 'tracking' in conf) {
  const t = conf.tracking;
  if (!t || typeof t !== 'object') err('languages.json: "tracking" must be an object');
  else {
    if ('url' in t && !/^https:\/\/[^\s]+\/e$/.test(String(t.url))) err('languages.json: tracking.url must be an https address ending in /e');
    if ('enabled' in t && typeof t.enabled !== 'boolean') err('languages.json: tracking.enabled must be true or false');
  }
}

// Pictures (optional): dictionary/<lang>/images.json, files in dictionary/<lang>/img/. Each entry must point to an
// existing file and name a source or its own licence; a picture for a word that no course of the language has is a warning.
for (const lang of [...new Set(courses.map(c => c.lang))]) {
  const f = `${lang}/images.json`;
  if (!fs.existsSync(D + f)) continue;
  const data = readJson(f);
  if (!data) continue;
  const im = parseImages(data);
  im.problems.forEach(x => err(`${f}: ${x}`));
  const known = new Set();
  for (const c of courses.filter(x => x.lang === lang)) {
    const L = courseL(c);
    try { parseDictionary(fs.readFileSync(D + c.path + '/words.csv', 'utf8'), L).words.forEach(w => known.add(full(w))); } catch (e) { /* reported above */ }
    try { if (fs.existsSync(D + c.path + '/verbs.csv') && L.pronouns) parseVerbs(fs.readFileSync(D + c.path + '/verbs.csv', 'utf8'), L).forEach(v => known.add(v.verb)); } catch (e) { /* reported above */ }
  }
  for (const [word, file] of im.byWord) {
    if (!fs.existsSync(`${D}${lang}/img/${file}`)) err(`${f}: ${word}: file img/${file} not found`);
    if (!known.has(word)) warn(`${f}: ${word} is not a word or verb of any ${lang} course`);
  }
  const used = new Set(im.byWord.values());
  for (const x of fs.existsSync(`${D}${lang}/img`) ? fs.readdirSync(`${D}${lang}/img`) : []) {
    if (/\.(svg|png|jpg|webp)$/.test(x) && !used.has(x)) warn(`${lang}/img/${x} is not listed in ${f}`);
  }
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
  if ('tracking' in inst && typeof inst.tracking !== 'boolean') err(`${at}: "tracking" must be true or false`);
}

warnings.forEach(w => console.warn('warning: ' + w));
errors.forEach(e => console.error('error: ' + e));
console.log(`${courses.length} course(s) + maths, ${ids.length} instance(s): ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
