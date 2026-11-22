// Achievements ("Награди"): catalogue, visibility per device, progress, counters and grants.
// Pure module: works in plain Node. Everything is kept on the device in store.ach (see store.js):
//   earned: {id: ISO date}, seen: [ids opened in the tab], c: counters, q: ids waiting for the next result screen,
//   retro: ids granted from earlier progress on the first start with achievements (null once that panel is closed).
import { isLearned } from './progress.js';
import { letterOf } from './dictionary.js';

// [category, category emoji, [[id, name, condition, tier, emoji, scope, need, retro], ...]]
// tier: b bronze, s silver, g gold, p diamond, x secret. need: [kind, n], visible only when the device's courses
// together have at least n of that kind. retro: 1 when earlier progress (stats, okTotal) can prove it.
// mt-1 ... mt-12 show "×N" and art-perfect three dots instead of an emoji, so their emoji is empty.
// Deferred to a later release (not in the app):
//   new-week: Навреме. Целият нов списък е научен до 7 дни след датата му
//   new-3: Винаги навреме. 3 нови списъка, научени до 7 дни
//   dir-both: В двете посоки. Една и съща дума вярно в двете посоки в един ден
//   umlaut: Ä, Ö, Ü. 20 верни написани думи с ä, ö, ü или ß
//   th-animals: Зоопарк. Всички животни са научени (Affe, Delfin, Hund, Katze …)
//   th-food: Готвач. Всички храни са научени (Brot, Butter, Ei, Tomate …)
//   th-colours: Дъга. Всички цветове са научени (blau, rot, lila, rosa …)
//   th-numbers: Числа. Всички числа са научени (Null, vier, sechs, zehn …)
//   th-family: Семейство. Всички думи за семейство са научени (Mutter, Vater, Opa …)
//   th-clothes: Гардероб. Всички дрехи са научени (Hose, Jacke, Hut, Schuh …)
//   th-school: Училище. Всички училищни думи са научени (Schule, Lineal, Kuli, Schere …)
//   th-nature: Природа. Всички думи за природа са научени (Sonne, Regen, Schnee, Pilz …)
//   th-music: Оркестър. Всички думи за музика са научени (Gitarre, Cello, Musik, Glocke)
//   th-weather: Синоптик. Всички думи за времето са научени (Regen, Nebel, Schnee, Sonne)
//   t-10m: Десет минути. 10 минути упражнение общо
//   t-1h: Един час. 1 час упражнение общо
//   t-5h: Пет часа. 5 часа упражнение общо
//   t-winter: Зимна ваканция. Упражнение през коледната ваканция
const RAW = [
  ['Верни отговори', '✅', [
    ['ok-10', 'Първи стъпки', '10 верни отговора', 'b', '👣', 'all', null, 1],
    ['ok-50', 'Набиране на скорост', '50 верни отговора', 'b', '🚲', 'all', null, 1],
    ['ok-100', 'Стотица', '100 верни отговора', 's', '💯', 'all', null, 1],
    ['ok-250', 'Четвърт хиляда', '250 верни отговора', 's', '🎯', 'all', null, 1],
    ['ok-500', 'Половин хиляда', '500 верни отговора', 'g', '🚀', 'all', null, 1],
    ['ok-1000', 'Хиляда', '1000 верни отговора', 'g', '🏔️', 'all', null, 1],
    ['ok-2500', 'Две и половина хиляди', '2500 верни отговора', 'p', '💪', 'all', null, 1],
    ['ok-5000', 'Легенда', '5000 верни отговора', 'p', '👑', 'all', null, 1],
  ]],
  ['Без грешка', '🥇', [
    ['pf-1', 'Първи медал', 'Кръг от поне 10 въпроса без нито една грешка', 'b', '🥇', 'all'],
    ['pf-3', 'Три медала', '3 кръга без грешка', 'b', '🎖️', 'all'],
    ['pf-10', 'Колекция медали', '10 кръга без грешка', 's', '🏅', 'all'],
    ['pf-25', 'Витрина с медали', '25 кръга без грешка', 'g', '🏆', 'all'],
    ['pf-50', 'Златна витрина', '50 кръга без грешка', 'p', '🌟', 'all'],
    ['pf-20', 'Голям медал', 'Кръг от 20 въпроса без грешка', 's', '⭐', 'all'],
    ['pf-set', 'Цял списък без грешка', 'Кръг без грешка с всички думи от един списък (поне 20 думи)', 'g', '📜', 'vocab'],
    ['pf-day', 'Безупречен ден', '3 кръга без грешка в един ден', 's', '☀️', 'all'],
  ]],
  ['Подред', '🔗', [
    ['row-5', 'Петица', '5 верни отговора подред', 'b', '✋', 'all'],
    ['row-10', 'Десетка', '10 верни отговора подред', 'b', '🎳', 'all'],
    ['row-20', 'Двайсет подред', '20 верни отговора подред', 's', '🌊', 'all'],
    ['row-30', 'Трийсет подред', '30 верни отговора подред', 'g', '🛡️', 'all'],
    ['row-50', 'Без спиране', '50 верни отговора подред', 'p', '🚂', 'all'],
  ]],
  ['Научени думи', '📚', [
    ['lw-10', 'Първите десет', '10 научени думи', 'b', '🌱', 'vocab', ['words', 10], 1],
    ['lw-25', 'Малък речник', '25 научени думи', 'b', '📗', 'vocab', ['words', 25], 1],
    ['lw-50', 'Джобен речник', '50 научени думи', 's', '📒', 'vocab', ['words', 50], 1],
    ['lw-100', 'Сто думи', '100 научени думи', 's', '📚', 'vocab', ['words', 100], 1],
    ['lw-150', 'Голям речник', '150 научени думи', 'g', '📖', 'vocab', ['words', 150], 1],
    ['lw-200', 'Ходеща енциклопедия', '200 научени думи', 'g', '🦉', 'vocab', ['words', 200], 1],
    ['lw-300', 'Уордопедия', '300 научени думи', 'p', '🧠', 'vocab', ['words', 300], 1],
    ['lw-set', 'Цял списък', 'Всички думи от един списък са научени', 's', '✅', 'vocab', null, 1],
    ['lw-4sets', 'Четири списъка', '4 списъка изцяло научени', 'g', '🗂️', 'vocab', ['sets', 4], 1],
    ['lw-course', 'Целият курс', 'Всички думи от курса са научени', 'p', '🎓', 'vocab', null, 1],
  ]],
  ['Новият списък', '🆕', [
    ['new-first', 'Първа нова дума', 'Първа научена дума от най-новия списък', 'b', '🆕', 'dated', null, 1],
    ['new-half', 'Половината нови', 'Половината от най-новия списък е научена', 's', '🌗', 'dated', null, 1],
  ]],
  ['Всеки ден', '📅', [
    ['day-2', 'Пак тук', 'Упражнение 2 дни подред', 'b', '👋', 'all'],
    ['day-3', 'Три дни', 'Упражнение 3 дни подред', 'b', '🌤️', 'all'],
    ['day-5', 'Учебна седмица', 'Упражнение от понеделник до петък', 's', '🎒', 'all'],
    ['day-7', 'Цяла седмица', 'Упражнение 7 дни подред', 's', '🗓️', 'all'],
    ['day-14', 'Две седмици', 'Упражнение 14 дни подред', 'g', '🔥', 'all'],
    ['day-30', 'Цял месец', 'Упражнение 30 дни подред', 'g', '🌕', 'all'],
    ['day-50', 'Петдесет дни', 'Упражнение в 50 различни дни', 'p', '🌳', 'all'],
    ['day-100', 'Сто дни', 'Упражнение в 100 различни дни', 'p', '🏰', 'all'],
    ['day-wknd', 'Уикенд', 'Упражнение в събота и неделя от един уикенд', 'b', '🎈', 'all'],
    ['days-total-20', 'Двайсет дни', 'Упражнение в 20 различни дни', 's', '🧩', 'all'],
  ]],
  ['Членове', '🎨', [
    ['art-25', 'Член по член', '25 верни члена', 'b', '🔤', 'articles'],
    ['art-100', 'Сто члена', '100 верни члена', 's', '🎨', 'articles'],
    ['art-250', 'Двеста и петдесет члена', '250 верни члена', 'g', '🖌️', 'articles'],
    ['art-der', 'Синя звезда', '25 верни „der“', 's', '🔵', 'de'],
    ['art-die', 'Червена звезда', '25 верни „die“', 's', '🔴', 'de'],
    ['art-das', 'Зелена звезда', '25 верни „das“', 's', '🟢', 'de'],
    ['art-perfect', 'Три цвята', 'Кръг „Членове“ без грешка', 'g', '', 'articles'],
  ]],
  ['Посоки и писане', '🔁', [
    ['dir-xbg', 'Към български', '50 верни превода към български', 'b', '⬅️', 'vocab'],
    ['dir-bgx', 'От български', '50 верни превода от български', 's', '➡️', 'vocab'],
    ['typed-25', 'Писане', '25 верни написани отговора', 'b', '✏️', 'vocab'],
    ['typed-100', 'Сто написани', '100 верни написани отговора', 's', '🖋️', 'vocab'],
    ['typed-nohint', 'Без подсказка', '25 написани отговора подред без подсказка', 'g', '🙈', 'vocab'],
    ['accent', 'Специални букви', '20 верни написани френски думи с é, è, ç или друга буква със знак', 's', '🥐', 'fr'],
  ]],
  ['Спрежение', '📋', [
    ['cj-table', 'Първа таблица', 'Отворена таблица за спрежение', 'b', '📋', 'verbs'],
    ['cj-verb', 'Първи глагол', 'Всички 6 форми на един глагол са научени', 'b', '🏃', 'verbs', null, 1],
    ['cj-5', 'Пет глагола', '5 глагола с всички научени форми', 's', '🖐️', 'verbs', ['verbs', 5], 1],
    ['cj-all', 'Всички глаголи', 'Всички глаголи от курса са научени', 'g', '🔑', 'verbs', null, 1],
    ['cj-pillars', 'Двата стълба', 'sein и haben (или être и avoir) изцяло научени', 's', '🏛️', 'verbs', null, 1],
    ['cj-irregular', 'Неправилен', 'Неправилен глагол (напр. schlafen) изцяло научен', 's', '🦄', 'verbs', null, 1],
    ['cj-perfect', 'Спрежение без грешка', 'Кръг спрежение без грешка', 'g', '💫', 'verbs'],
  ]],
  ['Таблица за умножение', '✖️', [
    ['mt-1', 'Умножение по 1', 'Всички примери от 1 × 1 до 1 × 12 са научени', 'b', '', 'math', null, 1],
    ['mt-2', 'Умножение по 2', 'Всички примери от 2 × 1 до 2 × 12 са научени', 'b', '', 'math', null, 1],
    ['mt-3', 'Умножение по 3', 'Всички примери от 3 × 1 до 3 × 12 са научени', 's', '', 'math', null, 1],
    ['mt-4', 'Умножение по 4', 'Всички примери от 4 × 1 до 4 × 12 са научени', 's', '', 'math', null, 1],
    ['mt-5', 'Умножение по 5', 'Всички примери от 5 × 1 до 5 × 12 са научени', 'b', '', 'math', null, 1],
    ['mt-6', 'Умножение по 6', 'Всички примери от 6 × 1 до 6 × 12 са научени', 's', '', 'math', null, 1],
    ['mt-7', 'Умножение по 7', 'Всички примери от 7 × 1 до 7 × 12 са научени', 'g', '', 'math', null, 1],
    ['mt-8', 'Умножение по 8', 'Всички примери от 8 × 1 до 8 × 12 са научени', 'g', '', 'math', null, 1],
    ['mt-9', 'Умножение по 9', 'Всички примери от 9 × 1 до 9 × 12 са научени', 'g', '', 'math', null, 1],
    ['mt-10', 'Умножение по 10', 'Всички примери от 10 × 1 до 10 × 12 са научени', 'b', '', 'math', null, 1],
    ['mt-11', 'Умножение по 11', 'Всички примери от 11 × 1 до 11 × 12 са научени', 's', '', 'math', null, 1],
    ['mt-12', 'Умножение по 12', 'Всички примери от 12 × 1 до 12 × 12 са научени', 'g', '', 'math', null, 1],
    ['mt-all', 'Цялата таблица', 'Всички 144 примера са научени', 'p', '🧮', 'math', null, 1],
    ['mt-100', 'Сто сметки', '100 верни примера', 's', '', 'math', null, 1],
    ['mt-fast', 'Бърз ум', '20 верни примера от поне 3 таблици за по-малко от 1 минута', 'g', '🐆', 'math'],
  ]],
  ['Бързина', '⚡', [
    ['fast-round', 'Ракета', 'Кръг от 10 въпроса без грешка за по-малко от 1 минута', 'g', '🏎️', 'all'],
  ]],
  ['Упоритост', '💪', [
    ['fix-1', 'Вече не се бърка', 'Често грешен въпрос става научен', 'b', '🩹', 'all'],
    ['fix-10', 'Поправени грешки', '10 често грешени въпроса стават научени', 's', '🔧', 'all'],
    ['fix-25', 'Без слаби места', '25 често грешени въпроса стават научени', 'g', '🛠️', 'all'],
    ['weak-5', 'Работа по грешките', '5 упражнения на грешените въпроси', 'b', '🏋️', 'all'],
    ['finish-10', 'Довършено', '10 кръга, довършени докрай', 'b', '🏁', 'all'],
    ['finish-50', 'Докрай', '50 кръга, довършени докрай', 's', '🧗', 'all'],
  ]],
  ['Откриване', '🧭', [
    ['ex-listen-25', 'Слушане', '25 изслушани думи', 'b', '🎧', 'vocab'],
    ['ex-listen-100', 'Добро ухо', '100 изслушани думи', 's', '👂', 'vocab'],
    ['ex-vocab', 'Речникът', 'Отворен раздел „Думи“', 'b', '🔍', 'vocab'],
    ['ex-all-ex', 'Всички упражнения', 'Поне по един кръг от всеки вид упражнение', 's', '🗺️', 'vocab'],
    ['ex-course2', 'Нов курс', 'Упражнение във втори курс', 'b', '🚪', 'multi2'],
    ['ex-two-lang', 'Два езика', 'Верни отговори на два езика в един ден', 's', '💬', 'langs2'],
    ['ex-three-lang', 'Три езика', 'Научени думи и на трите езика', 'g', '🌍', 'lang3', null, 1],
  ]],
  ['Време и сезони', '⏳', [
    ['t-early', 'Ранно утро', 'Упражнение преди 8:00', 's', '🐓', 'all'],
    ['t-summer', 'Лятна ваканция', 'Упражнение през юли или август', 's', '🏖️', 'all'],
  ]],
  ['Тайни', '❓', [
    ['t-newyear', 'Нова година', 'Упражнение на 1 януари', 'x', '🎆', 'all'],
    ['sx-paw', 'Котешка лапа', 'Katze и Tatze верни в един кръг', 'x', '🐾', 'de'],
    ['sx-letters', 'Азбука', 'Научени думи с 15 различни начални букви', 'x', '🔠', 'vocab', ['letters', 18], 1],
    ['sx-comeback', 'Обрат', 'Кръг, започнал с 3 грешки и завършен с 10 верни отговора подред', 'x', '🔄', 'all'],
  ]],
];

export const CATS = RAW.map(([name, emoji]) => ({ name, emoji }));
const ACH = RAW.flatMap(([cat, , list]) => list.map(([id, name, cond, tier, emoji, scope, need, retro]) =>
  ({ id, cat, name, cond, tier, emoji, scope, need: need || null, retro: !!retro })));
export const BY_ID = Object.fromEntries(ACH.map(e => [e.id, e]));

// Colours of the medal per tier: ring, face, text. Locked medals are grey.
export const TIERS = {
  b: { name: 'Бронз', ring: '#B8733A', fill: '#F7E6D6', text: '#7A4518' },
  s: { name: 'Сребро', ring: '#8A97AD', fill: '#EBEFF5', text: '#46536B' },
  g: { name: 'Злато', ring: '#D99A0B', fill: '#FFF1C7', text: '#7A5200' },
  p: { name: 'Диамант', ring: '#7C3AED', fill: '#EFE7FD', text: '#5B21B6' },
  x: { name: 'Тайна', ring: '#1B2A4A', fill: '#F2F5FA', text: '#1B2A4A' },
};
export const LOCKED = { ring: '#C3CDDF', fill: '#F2F5FA', text: '#8995AD' };

// Strong or irregular verbs (cj-irregular), matched against the course's verbs.csv.
// de: present-tense irregulars; fr: the "Неправилни" group plus être, avoir, aller, faire.
const IRREGULAR = {
  de: ['sein', 'haben', 'werden', 'lesen', 'schlafen', 'sehen', 'essen', 'geben', 'nehmen', 'sprechen', 'helfen', 'fahren',
    'laufen', 'tragen', 'fallen', 'halten', 'lassen', 'treffen', 'vergessen', 'werfen', 'waschen', 'wissen'],
  fr: ['être', 'avoir', 'aller', 'faire', 'prendre', 'mettre', 'venir', 'vouloir', 'pouvoir', 'savoir'],
};
const PILLARS = { de: ['sein', 'haben'], fr: ['être', 'avoir'] };
const LATIN_EXTRA = /[^\x00-\x7f]/;

// Series for "Следваща в поредицата" in the detail sheet.
const SERIES = [
  ['ok-10', 'ok-50', 'ok-100', 'ok-250', 'ok-500', 'ok-1000', 'ok-2500', 'ok-5000'],
  ['pf-1', 'pf-3', 'pf-10', 'pf-25', 'pf-50'],
  ['row-5', 'row-10', 'row-20', 'row-30', 'row-50'],
  ['lw-10', 'lw-25', 'lw-50', 'lw-100', 'lw-150', 'lw-200', 'lw-300'],
  ['lw-set', 'lw-4sets', 'lw-course'],
  ['new-first', 'new-half'],
  ['day-2', 'day-3', 'day-7', 'day-14', 'day-30'],
  ['days-total-20', 'day-50', 'day-100'],
  ['art-25', 'art-100', 'art-250'],
  ['dir-xbg', 'dir-bgx'],
  ['typed-25', 'typed-100', 'typed-nohint'],
  ['cj-verb', 'cj-5', 'cj-all'],
  ['mt-1', 'mt-2', 'mt-3', 'mt-4', 'mt-5', 'mt-6', 'mt-7', 'mt-8', 'mt-9', 'mt-10', 'mt-11', 'mt-12', 'mt-all'],
  ['fix-1', 'fix-10', 'fix-25'],
  ['finish-10', 'finish-50'],
  ['ex-listen-25', 'ex-listen-100'],
  ['ex-two-lang', 'ex-three-lang'],
];

// ----- dates (local time) -----
const pad = n => String(n).padStart(2, '0');
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shift = (d, days) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
const MONTHS = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември'];
// "14 ноември 2026" (or without the year).
export function fmtDay(iso, year = true) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}` + (year ? ` ${d.getFullYear()}` : '');
}

// ----- what this device offers -----
// courses: the instance's active courses, each {key, kind: 'vocab' | 'math', lang, arts (has an article exercise),
// words, sets (sorted, newest first), verbs: [{verb, ids: progress ids of its forms}]}.
const DATED = /^\d{4}-\d{2}/;
export function achContext(courses) {
  const vocab = courses.filter(c => c.kind === 'vocab').map(c => {
    const bySet = new Map(c.sets.map(s => [s.id, []]));
    c.words.forEach(w => { if (!bySet.has(w.set)) bySet.set(w.set, []); bySet.get(w.set).push(w); });
    const latest = c.sets[0] && DATED.test(c.sets[0].id) ? bySet.get(c.sets[0].id) || [] : null;
    const tiles = ['x-bg', 'bg-x', ...(c.arts ? ['art'] : []), ...(c.verbs.length ? ['conj'] : [])];
    return { ...c, bySet, latest, tiles, heads: new Set(c.words.map(w => w.de)) };
  });
  const words = vocab.flatMap(c => c.words);
  return {
    courses, vocab,
    langs: new Set(vocab.map(c => c.lang)),
    math: courses.some(c => c.kind === 'math'),
    n: {
      words: words.length,
      sets: vocab.reduce((a, c) => a + c.bySet.size, 0),
      verbs: vocab.reduce((a, c) => a + c.verbs.length, 0),
      letters: new Set(words.map(letterOf)).size,
    },
  };
}

const SCOPES = {
  all: x => x.courses.length > 0,
  vocab: x => x.vocab.length > 0,
  de: x => x.langs.has('de'),
  fr: x => x.langs.has('fr'),
  verbs: x => x.vocab.some(c => c.verbs.length > 0),
  math: x => x.math,
  articles: x => x.vocab.some(c => c.arts),
  dated: x => x.vocab.some(c => c.latest && c.latest.length > 0),
  multi2: x => x.courses.length >= 2,
  langs2: x => x.langs.size >= 2,
  lang3: x => x.langs.size >= 3,
};
// Conditions that only some content can meet: kept hidden where they cannot be earned.
const hasVerbs = (x, list) => x.vocab.some(c => c.verbs.some(v => (list[c.lang] || []).includes(v.verb)));
const EXTRA = {
  'cj-pillars': x => x.vocab.some(c => (PILLARS[c.lang] || []).length > 0 && PILLARS[c.lang].every(p => c.verbs.some(v => v.verb === p))),
  'cj-irregular': x => hasVerbs(x, IRREGULAR),
  'pf-set': x => x.vocab.some(c => [...c.bySet.values()].some(l => l.length >= 20)),
  'sx-paw': x => x.vocab.some(c => c.lang === 'de' && c.heads.has('Katze') && c.heads.has('Tatze')),
};
const available = (e, x) => SCOPES[e.scope](x) && (!e.need || x.n[e.need[0]] >= e.need[1]) && (!EXTRA[e.id] || EXTRA[e.id](x));

// Achievements this device shows: those its courses can earn, plus every one already earned.
export const visibleAch = (x, earned) => ACH.filter(e => earned[e.id] || available(e, x));

// ----- progress -----
// D: {stats, ok: correct answers ever (store.okTotal), c: counters, now: Date}.
const learnedOf = (D, list) => list.filter(w => isLearned(D.stats[w.id])).length;
const okCount = D => (D.ok || 0) + (D.c.ok0 || 0);
const verbForms = (D, v) => v.ids.filter(id => isLearned(D.stats[id])).length;
const fullVerb = (D, v) => v.ids.length > 0 && verbForms(D, v) === v.ids.length;
const mathIds = a => Array.from({ length: 12 }, (_, i) => `math:mul:${a}x${i + 1}`);
const ALL_MATH = Array.from({ length: 12 }, (_, i) => mathIds(i + 1)).flat();
const bits = n => { let k = 0; for (; n; n &= n - 1) k++; return k; };
const best = list => list.reduce((m, p) => (!m || p[0] / p[1] > m[0] / m[1] || (p[0] / p[1] === m[0] / m[1] && p[1] > m[1]) ? p : m), null) || [0, 1];
const today = D => dayKey(D.now || new Date());
// Current run of days: still running if the last day was today or yesterday.
export function streakNow(c, now = new Date()) {
  return c.d === dayKey(now) || c.d === dayKey(shift(now, -1)) ? c.st || 0 : 0;
}
const weekBits = D => (D.c.wk === dayKey(monday(D.now || new Date())) ? D.c.wb || 0 : 0);
function monday(d) { return shift(d, -((d.getDay() + 6) % 7)); }

// [have, target, unit, done?] for one achievement; null when it is decided within one round (no progress to show).
function raw(id, x, D) {
  const c = D.c, n = +id.split('-').pop();
  const pre = id.replace(/-[^-]*$/, '');
  const vocabSets = () => x.vocab.flatMap(k => [...k.bySet.values()].filter(l => l.length));
  const verbsAll = () => x.vocab.flatMap(k => k.verbs);
  switch (pre) {
    case 'ok': return [okCount(D), n, 'верни отговора'];
    case 'row': return [c.runB || 0, n, 'подред'];
    case 'finish': return [c.fin || 0, n, 'кръга'];
    case 'fix': return [c.fix || 0, n, 'поправени въпроса'];
    case 'ex-listen': return [c.listen || 0, n, 'изслушани думи'];
    case 'typed': if (id !== 'typed-nohint') return [c.typed || 0, n, 'написани отговора']; break;
    case 'art': if (n) return [c.art || 0, n, 'верни члена']; break;
    case 'lw': if (n) return [x.vocab.reduce((a, k) => a + learnedOf(D, k.words), 0), n, 'научени думи']; break;
    case 'pf': if (n && n !== 20) return [c.pf || 0, n, 'кръга без грешка']; break;
    case 'day': if (n && n !== 5) {
      if (n >= 50) return [c.dt || 0, n, 'дни'];
      return [streakNow(c, D.now), n, 'дни подред', (c.stB || 0) >= n];
    } break;
    case 'mt': if (n && n <= 12) return [learnedOf(D, mathIds(n).map(id => ({ id }))), 12, 'примера']; break;
    default:
  }
  switch (id) {
    case 'pf-day': return [c.pfd && c.pfd.d === today(D) ? c.pfd.n : 0, 3, 'кръга днес'];
    case 'lw-set': return [...best(vocabSets().map(l => [learnedOf(D, l), l.length])), 'научени думи'];
    case 'lw-4sets': return [vocabSets().filter(l => learnedOf(D, l) === l.length).length, 4, 'списъка'];
    case 'lw-course': return [...best(x.vocab.filter(k => k.words.length).map(k => [learnedOf(D, k.words), k.words.length])), 'научени думи'];
    case 'new-first': return [Math.min(1, Math.max(0, ...x.vocab.filter(k => k.latest).map(k => learnedOf(D, k.latest)))), 1, 'научени думи'];
    case 'new-half': return [...best(x.vocab.filter(k => k.latest && k.latest.length).map(k => [learnedOf(D, k.latest), Math.ceil(k.latest.length / 2)])), 'научени думи'];
    case 'day-5': return [bits(weekBits(D) & 31), 5, 'дни'];
    case 'day-wknd': return [bits(weekBits(D) & 96), 2, 'дни'];
    case 'days-total-20': return [c.dt || 0, 20, 'дни'];
    case 'art-der': case 'art-die': case 'art-das': return [c[id.slice(4)] || 0, 25, `верни „${id.slice(4)}“`];
    case 'dir-xbg': return [c.xbg || 0, 50, 'верни превода'];
    case 'dir-bgx': return [c.bgx || 0, 50, 'верни превода'];
    case 'typed-nohint': return [c.tnhB || 0, 25, 'подред'];
    case 'accent': return [c.acc || 0, 20, 'написани думи'];
    case 'cj-table': return [c.table ? 1 : 0, 1, ''];
    case 'cj-verb': return [Math.max(0, ...verbsAll().map(v => verbForms(D, v))), 6, 'форми'];
    case 'cj-5': return [verbsAll().filter(v => fullVerb(D, v)).length, 5, 'глагола'];
    case 'cj-all': return [...best(x.vocab.filter(k => k.verbs.length).map(k => [k.verbs.filter(v => fullVerb(D, v)).length, k.verbs.length])), 'глагола'];
    case 'cj-pillars': return [...best(x.vocab.filter(k => PILLARS[k.lang]).map(k => [k.verbs.filter(v => PILLARS[k.lang].includes(v.verb) && fullVerb(D, v)).length, 2])), 'глагола'];
    case 'cj-irregular': return [Math.max(0, ...x.vocab.flatMap(k => k.verbs.filter(v => (IRREGULAR[k.lang] || []).includes(v.verb)).map(v => verbForms(D, v)))), 6, 'форми'];
    case 'mt-all': return [learnedOf(D, ALL_MATH.map(id => ({ id }))), 144, 'примера'];
    case 'mt-100': return [ALL_MATH.reduce((a, id) => a + ((D.stats[id] && D.stats[id].c) || 0), 0), 100, 'верни примера'];
    case 'weak-5': return [c.weak || 0, 5, 'упражнения'];
    case 'ex-vocab': return [c.words ? 1 : 0, 1, ''];
    case 'ex-all-ex': return [...best(x.vocab.map(k => [((c.ex || {})[k.key] || []).filter(t => k.tiles.includes(t)).length, k.tiles.length])), 'упражнения'];
    case 'ex-course2': return [Math.min(2, (c.crs || []).length), 2, 'курса'];
    case 'ex-two-lang': return [c.tl && c.tl.d === today(D) ? c.tl.l.length : 0, 2, 'езика днес'];
    case 'ex-three-lang': return [['de', 'fr', 'en'].filter(l => x.vocab.some(k => k.lang === l && learnedOf(D, k.words) > 0)).length, 3, 'езика'];
    case 'sx-letters': return [new Set(x.vocab.flatMap(k => k.words.filter(w => isLearned(D.stats[w.id])).map(letterOf))).size, 15, 'букви'];
    default: return null;
  }
  return null;
}
// {a, b, unit} for display (a never above b), or null for achievements decided within a round.
export function progress(e, x, D) {
  const r = raw(e.id, x, D);
  return r && { a: Math.min(r[0], r[1]), b: r[1], unit: r[2] };
}
function met(e, x, D) {
  const r = raw(e.id, x, D);
  return !!r && r[1] > 0 && (r[3] !== undefined ? r[3] : r[0] >= r[1]);
}

// Ids not earned yet that this device can show and that are now met (hits: decided within the round just finished).
export function grants(x, D, earned, hits = []) {
  return ACH.filter(e => !earned[e.id] && available(e, x) && (hits.includes(e.id) || met(e, x, D))).map(e => e.id);
}

// First start with achievements: everything earlier progress proves. Correct answers ever: the larger of okTotal and
// the correct answers stored for the current questions (okTotal is newer than the stats); the difference is kept as ok0.
export function retro(x, stats, okTotal, now = new Date()) {
  const ids = [...x.vocab.flatMap(k => [...k.words.map(w => w.id), ...k.verbs.flatMap(v => v.ids)]), ...(x.math ? ALL_MATH : [])];
  const sum = ids.reduce((a, id) => a + ((stats[id] && stats[id].c) || 0), 0);
  const c = { ok0: Math.max(0, sum - (okTotal || 0)) };
  const D = { stats, ok: okTotal, c, now };
  return { c, ids: ACH.filter(e => e.retro && available(e, x) && met(e, x, D)).map(e => e.id) };
}

// ----- counters -----
const add = (list, v) => (!v || (list || []).includes(v) ? list || [] : [...(list || []), v]);

// One settled question. a: {clean, result, kind: words | conj | math, ex, fmt, lang, art, word, fixed, now}.
export function onAnswer(c0, a) {
  const c = { ...c0 };
  const inc = k => { c[k] = (c[k] || 0) + 1; };
  c.run = a.clean ? (c.run || 0) + 1 : 0;
  c.runB = Math.max(c.runB || 0, c.run);
  if (a.clean && a.kind === 'words') {
    if (a.ex === 'art') { inc('art'); if (a.lang === 'de' && ['der', 'die', 'das'].includes(a.art)) inc(a.art); }
    else if (a.ex === 'x-bg') inc('xbg');
    else if (a.ex === 'bg-x') inc('bgx');
  }
  // Typed answers (words and verb forms). A hint, the shown answer or a wrong try ends the run without a hint.
  const typed = a.fmt === 'open' && (a.kind === 'conj' || (a.kind === 'words' && a.ex !== 'art'));
  if (typed) {
    if (a.clean) inc('typed');
    c.tnh = a.clean ? (c.tnh || 0) + 1 : 0;
    c.tnhB = Math.max(c.tnhB || 0, c.tnh);
    // French word with an accent, typed exactly (an answer accepted with "Правилно изписване" does not count).
    if (a.clean && a.result === 'ok' && a.kind === 'words' && a.ex === 'bg-x' && a.lang === 'fr' && LATIN_EXTRA.test(a.word || '')) inc('acc');
  }
  if (a.fixed) inc('fix');
  if (a.clean && a.lang && a.kind !== 'math') {
    const d = dayKey(a.now);
    c.tl = c.tl && c.tl.d === d ? { d, l: add(c.tl.l, a.lang) } : { d, l: [a.lang] };
  }
  return c;
}

// Something done outside a round: 'listen' (a tap on a speaker or a word), 'words' (the Думи tab), 'table' (the
// conjugation table of a course).
export function onEvent(c0, kind, course) {
  if (kind === 'listen') return { ...c0, listen: (c0.listen || 0) + 1 };
  if (kind === 'words') return c0.words ? c0 : { ...c0, words: 1 };
  if (kind === 'table') return { ...c0, table: 1, crs: add(c0.crs, course), ex: { ...(c0.ex || {}), [course]: add((c0.ex || {})[course], 'conj') } };
  return c0;
}

// The end of a round (finished or stopped with at least one answer).
// R: {kind, ex, course, lang, weak, total, answered, firstOk, done, perfect, start, end: Date, log: [clean per answer],
//     okWords: [foreign words answered correctly], ids: [question ids of the round], tables: number of maths tables}.
// Returns the new counters and the achievements decided by this round alone.
export function onRound(c0, R, x) {
  const c = { ...c0 }, hits = [];
  if (!R.answered) return { c, hits };
  const now = R.end, day = dayKey(now);
  if (c.d !== day) {
    c.st = c.d === dayKey(shift(now, -1)) ? (c.st || 0) + 1 : 1;
    c.stB = Math.max(c.stB || 0, c.st);
    c.dt = (c.dt || 0) + 1;
    c.d = day;
  }
  const wk = dayKey(monday(now));
  c.wb = (c.wk === wk ? c.wb || 0 : 0) | (1 << ((now.getDay() + 6) % 7));
  c.wk = wk;
  if (R.done) c.fin = (c.fin || 0) + 1;
  if (R.weak) c.weak = (c.weak || 0) + 1;
  c.crs = add(c.crs, R.course);
  if (R.kind !== 'math') c.ex = { ...(c.ex || {}), [R.course]: add((c.ex || {})[R.course], R.ex) };

  // Rounds without a mistake count from 10 questions on.
  const perfect = R.perfect && R.total >= 10;
  if (perfect) {
    c.pf = (c.pf || 0) + 1;
    c.pfd = c.pfd && c.pfd.d === day ? { d: day, n: c.pfd.n + 1 } : { d: day, n: 1 };
  }
  const ms = R.end - R.start;
  if (perfect && R.total >= 20) hits.push('pf-20');
  if (perfect && R.kind === 'words') {
    const k = x.vocab.find(v => v.key === R.course), ids = new Set(R.ids);
    if (k && [...k.bySet.values()].some(l => l.length >= 20 && l.every(w => ids.has(w.id)))) hits.push('pf-set');
  }
  if (perfect && R.kind === 'words' && R.ex === 'art') hits.push('art-perfect');
  if (perfect && R.kind === 'conj') hits.push('cj-perfect');
  if (perfect && ms < 60e3) hits.push('fast-round');
  if (R.kind === 'math' && R.firstOk >= 20 && R.tables >= 3 && ms < 60e3) hits.push('mt-fast');
  if (R.start.getHours() < 8) hits.push('t-early');
  if ([6, 7].includes(R.start.getMonth())) hits.push('t-summer');
  if (R.start.getMonth() === 0 && R.start.getDate() === 1) hits.push('t-newyear');
  if (R.lang === 'de' && R.okWords.includes('Katze') && R.okWords.includes('Tatze')) hits.push('sx-paw');
  const L = R.log;
  if (L.length >= 13 && L.slice(0, 3).every(v => !v) && L.slice(-10).every(Boolean)) hits.push('sx-comeback');
  return { c, hits };
}

// ----- screens -----
export function nextInSeries(id, vis, earned) {
  const s = SERIES.find(l => l.includes(id));
  if (!s) return null;
  const ids = new Set(vis.map(e => e.id));
  const nx = s.slice(s.indexOf(id) + 1).find(k => ids.has(k) && !earned[k]);
  return nx ? BY_ID[nx] : null;
}
// The three locked, non-secret achievements closest to being earned.
export function closest(vis, x, D, earned, n = 3) {
  return vis.filter(e => !earned[e.id] && e.tier !== 'x')
    .map(e => ({ e, p: progress(e, x, D) }))
    .filter(({ p }) => p && p.b > 1 && p.a > 0)
    .sort((u, v) => v.p.a / v.p.b - u.p.a / u.p.b || u.p.b - v.p.b)
    .slice(0, n);
}
// Learned facts of one multiplication table (detail sheet of mt-N).
export const tableFacts = (a, stats) => mathIds(a).map((id, i) => ({ id, b: i + 1, ok: isLearned(stats[id]) }));
