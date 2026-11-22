import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import bundledConf from '../dictionary/languages.json';
import { parseDictionary, full, EMPTY } from './lib/dictionary.js';
import { LANGS } from './lib/langs.js';
import { coursesFrom, courseL, instanceCourses } from './lib/courses.js';
import { BUNDLED_INSTANCE, INSTANCE, ENV } from './lib/content.js';
import { loadStore, saveStore, sortSets, DEFAULT_DICT_BASE } from './lib/store.js';
import { audioBase, speak as speakAudio, prefetchAll, resetPrepared } from './lib/audio.js';
import { fetchLangConf, fetchInstance, fetchDictionary, fetchVerbs, fetchImages } from './lib/sync.js';
import { imgBase, parseImages, prefetchImages } from './lib/images.js';
import { shuffle } from './lib/match.js';
import LangPick from './components/LangPick.jsx';
import { LangMenu, TabBar } from './components/Chrome.jsx';
import MathHome from './components/math/MathHome.jsx';
import MathQuiz from './components/math/MathQuiz.jsx';
import { MATH, TESTS, factText, limitMs } from './lib/math.js';
import Home from './components/Home.jsx';
import Quiz from './components/Quiz.jsx';
import Result, { isPerfect } from './components/Result.jsx';
import Confetti from './components/Confetti.jsx';
import Words from './components/Words.jsx';
import Conj from './components/Conj.jsx';
import ConjQuiz from './components/ConjQuiz.jsx';
import { conjFacts, conjText } from './lib/conj.js';
import { parseVerbs, formText } from './lib/verbs.js';
import * as track from './lib/track.js';

// Every dictionary/<path>/words.csv is built into the app, so the first start works without a network.
const BUNDLED_CSV = import.meta.glob('../dictionary/**/words.csv', { query: '?raw', import: 'default', eager: true });
function parseSafe(csv, L) { try { return parseDictionary(csv, L); } catch (e) { return null; } }
const bundledFor = L => parseSafe(BUNDLED_CSV[`../dictionary/${L.path}/words.csv`] || '', L) || EMPTY;
const BUNDLED_VERBS = import.meta.glob('../dictionary/**/verbs.csv', { query: '?raw', import: 'default', eager: true });
// Picture lists (not the pictures): dictionary/<lang>/images.json.
const BUNDLED_IMAGES = import.meta.glob('../dictionary/*/images.json', { import: 'default', eager: true });

export default function App() {
  const [store, setStore] = useState(loadStore);
  const [view, setView] = useState(() => 'home');
  const [toastMsg, setToastMsg] = useState('');
  const [, setTick] = useState(0);
  const session = useRef(null);
  const [party, setParty] = useState(null);   // confetti: {id, n} while it plays
  const okTotal = useRef(store.okTotal || 0);  // correct answers ever; saved as store.okTotal
  const toastT = useRef(0);

  useEffect(() => { saveStore(store); }, [store]);
  const update = useCallback(fn => setStore(s => { const n = { ...s }; fn(n); return n; }), []);
  const toast = useCallback(msg => { setToastMsg(msg); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToastMsg(''), 2600); }, []);

  // Languages that are switched on in dictionary/languages.json (downloaded copy, or the one built into the app).
  const conf = store.langConf || bundledConf;
  const courses = useMemo(() => coursesFrom(conf), [conf]);
  const byKey = k => courses.find(c => c.key === k);
  // What this instance offers (dictionary/instances/<instance>.json), with its own labels; maths is one of them.
  const inst = store.instConf || BUNDLED_INSTANCE;
  const offered = useMemo(() => instanceCourses(courses, inst), [courses, inst]);
  const usable = offered.filter(c => c.active);
  // An instance with a single course opens it directly, without the course picker.
  const cur = usable.find(c => c.key === store.lang) || (offered.length === 1 && usable.length === 1 ? usable[0] : null);
  const lang = cur ? cur.key : null;
  const isMath = lang === MATH;
  const L = courseL((cur && !isMath && cur) || byKey('de') || courses[0]);
  const base = store.dictBase || DEFAULT_DICT_BASE;

  // Dictionary of the chosen course: the downloaded copy, or the one built into the app.
  const dictFor = useCallback(key => {
    const c = courses.find(x => x.key === key); if (!c) return EMPTY;
    const CL = courseL(c);
    return (store.dicts[key] && parseSafe(store.dicts[key].csv, CL)) || bundledFor(CL);
  }, [store.dicts, courses]);
  const dict = useMemo(() => dictFor(L.key), [dictFor, L.key]);
  const verbs = useMemo(() => parseVerbs((store.verbs[L.key] && store.verbs[L.key].csv) || BUNDLED_VERBS[`../dictionary/${L.path}/verbs.csv`] || '', L), [store.verbs, L]);
  const sets = useMemo(() => {
    const m = new Map(dict.sets.map(s => [s.id, s]));
    return sortSets([...m.values()]);
  }, [dict]);
  // Pictures of this course's language: the downloaded list, or the one built into the app.
  const images = useMemo(() => parseImages((store.images[L.code] && store.images[L.code].json) || BUNDLED_IMAGES[`../dictionary/${L.code}/images.json`] || null), [store.images, L.code]);
  const ibase = imgBase(base, L.code);
  const picFor = useCallback(text => images.byWord.get(text) || '', [images]);
  // Words come only from the curated dictionary; learners cannot add words or answers.
  const words = useMemo(() => dict.words.map(w => ({ ...w, on: true, img: images.byWord.get(full(w)) || '' })), [dict, images]);
  const abase = audioBase(base, L.code);
  const say = useCallback(text => speakAudio(L, abase, text, toast), [L, abase, toast]);

  const s = store.settings;
  // No article exercise for English; conjugation only where the course has verb tables.
  const dir = (s.dir === 'art' && !L.quizArticles.length) || (s.dir === 'conj' && !verbs.length) ? 'x-bg' : s.dir;
  const setSel = store.setByLang[L.key] || 'all';
  const activeSet = setSel === 'latest' ? (sets[0] && sets[0].id) : (setSel !== 'all' && sets.some(x => x.id === setSel) ? setSel : null);
  const passFilter = w => {
    if (s.filter === 'n') return w.type === 'n';
    if (s.filter === 'v') return w.type === 'v';
    if (s.filter === 'other') return w.type !== 'n' && w.type !== 'v';
    if (s.filter === 'weak') { const st = store.stats[w.id]; return !!(st && st.w > 0 && st.w >= st.c); }
    return true;
  };
  const isArtWord = w => w.type === 'n' && L.quizArticles.includes(w.art);
  const eligible = words.filter(w => w.on && (!activeSet || w.set === activeSet) && (dir !== 'art' || isArtWord(w)) && passFilter(w));
  // Conjugation exercise: one question per verb and pronoun; verb group stored under "<course key>:conj".
  const conjAll = useMemo(() => conjFacts(L, verbs), [L, verbs]);
  const conjGroups = useMemo(() => [...new Set(verbs.map(v => v.set).filter(Boolean))], [verbs]);
  const conjSel = conjGroups.includes(store.setByLang[L.key + ':conj']) ? store.setByLang[L.key + ':conj'] : 'all';
  const conjEligible = conjAll.filter(f => conjSel === 'all' || f.set === conjSel);
  const conjMode = s.conjMode || 'table';

  // ----- usage tracking (docs/tracking.md) -----
  // On when this instance allows it ("tracking": true), languages.json gives a URL and has not switched it off,
  // and the parent's switch in the menu is on.
  // A copy of languages.json or the instance file downloaded before tracking existed has no "tracking" key: then the
  // files built into this version decide, rather than tracking staying off until the next update (up to 6 hours).
  const trackConf = store.langConf && 'tracking' in store.langConf ? store.langConf.tracking : bundledConf.tracking;
  const instTracking = store.instConf && 'tracking' in store.instConf ? store.instConf.tracking : BUNDLED_INSTANCE.tracking;
  const trackUrl = import.meta.env.VITE_TRACK_URL || (trackConf && trackConf.url) || '';
  const trackAllowed = instTracking === true && !(trackConf && trackConf.enabled === false) && !!trackUrl;
  const trackOn = trackAllowed && s.track !== false;
  useEffect(() => { track.configure({ on: trackOn, url: trackUrl }); track.appOpened(lang); }, [trackOn, trackUrl, lang]);

  // ----- downloads -----
  // Downloads languages.json and this instance's file; returns the titles of the courses now available here.
  async function checkLangs() {
    const [c, i] = await Promise.all([fetchLangConf(base), fetchInstance(base, INSTANCE).catch(() => null)]);
    update(n => { n.langConf = c; if (i) n.instConf = i; });
    return instanceCourses(coursesFrom(c), i || inst).filter(x => x.active).map(x => x.title);
  }
  async function pullLang(code, onAudio) {
    const c = byKey(code); if (!c) throw new Error('непознат курс');
    const CL = courseL(c);
    const { text, parsed } = await fetchDictionary(base, CL);
    const before = new Set(dictFor(code).words.map(w => w.id)), after = new Set(parsed.words.map(w => w.id));
    if (!after.size && before.size) throw new Error('във файла няма разпознати думи');
    update(n => { n.dicts = { ...n.dicts, [code]: { csv: text, updatedAt: Date.now(), problems: parsed.problems } }; });
    resetPrepared();
    // Verb tables are optional: a course without verbs.csv keeps working.
    let vb = [];
    try { const vt = await fetchVerbs(base, CL); if (vt !== null) { update(n => { n.verbs = { ...n.verbs, [code]: { csv: vt, updatedAt: Date.now() } }; }); vb = parseVerbs(vt, CL); } } catch (e) { /* keep the previous tables */ }
    const texts = [...parsed.words.map(full), ...vb.flatMap(v => v.forms.map(formText))];
    const audio = await prefetchAll(audioBase(base, CL.code), texts, onAudio);
    // Pictures are optional: without images.json (or offline) the words simply show none.
    try {
      const ij = await fetchImages(base, CL);
      if (ij) { update(n => { n.images = { ...n.images, [CL.code]: { json: ij, updatedAt: Date.now() } }; }); await prefetchImages(imgBase(base, CL.code), [...new Set(parseImages(ij).byWord.values())]); }
    } catch (e) { /* keep the previous list */ }
    return { parsed, audio, added: [...after].filter(x => !before.has(x)).length, removed: [...before].filter(x => !after.has(x)).length };
  }
  // Automatic updates: when the app opens or comes back to the screen, at most every 6 hours per course.
  const syncing = useRef(false), storeRef = useRef(store);
  storeRef.current = store;
  async function syncCourse(key, force) {
    if (syncing.current || !key || (typeof navigator !== 'undefined' && navigator.onLine === false)) return null;
    const last = (storeRef.current.syncAt || {})[key] || 0;
    if (!force && Date.now() - last < 6 * 3600e3) return null;
    syncing.current = true;
    try {
      try { await checkLangs(); } catch (e) { /* languages.json is optional for a word update */ }
      // Maths has no words: only the course list (languages.json, the instance file) is updated.
      if (key === MATH) { update(n => { n.syncAt = { ...(n.syncAt || {}), [key]: Date.now() }; }); return null; }
      const r = await pullLang(key);
      update(n => { n.syncAt = { ...(n.syncAt || {}), [key]: Date.now() }; });
      return r;
    } finally { syncing.current = false; }
  }
  useEffect(() => {
    const run = () => {
      syncCourse(lang).then(r => {
        if (!r || !r.added) return;
        toast(r.added === r.parsed.words.length ? `Изтеглени думи: ${r.added}` : `Нови думи: ${r.added}`);
      }).catch(e => { if (lang && lang !== MATH && !dictFor(lang).words.length) toast('Неуспешно изтегляне: ' + e.message); });
    };
    run();
    const onVis = () => { if (document.visibilityState === 'visible') run(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [lang]); // eslint-disable-line
  // "Обновяване на думите" in the language menu: courses and the current course's words, now.
  async function refreshNow() {
    if (isMath) return 'Налични курсове: ' + (await checkLangs()).join(', ');
    const r = await syncCourse(lang, true);
    if (!r) return 'Обновяването вече тече';
    return `Думите са обновени: ${r.parsed.words.length}` + (r.added ? `, нови ${r.added}` : '') + (r.audio.missing ? `. Без запис: ${r.audio.missing}` : '');
  }
  async function chooseLang(code) {
    update(n => { n.lang = code; });
    setView('home');
    // A course switched on after this version was built has no words inside the app yet:
    // the automatic update (effect on lang) downloads them; no second download here.
    if (code !== MATH && !dictFor(code).words.length) toast('Изтегляне на думите…');
  }

  // ----- session -----
  // extra: fields added to the session, e.g. limit (ms per answer in maths; 0 = none).
  function run(pool, retry, kind, info, extra) {
    session.current = { ...extra, kind: kind || 'words', queue: pool.slice(), total: pool.length, firstOk: 0, seen: new Set(), missed: new Map(), reins: {}, cur: null, qid: 0, early: false, retry, startedAt: Date.now(), finishedAt: 0, shownAt: 0 };
    track.sessionStart({ ...info, size: pool.length });
    next();
    setView('quiz');
  }
  function start(ids) {
    let pool = ids ? words.filter(w => ids.includes(w.id)) : eligible.slice();
    if (dir === 'art') pool = pool.filter(isArtWord);
    if (!pool.length) { toast('Няма думи за тези настройки'); return; }
    shuffle(pool);
    if (!ids && s.size !== 'all') pool = pool.slice(0, +s.size);
    run(pool, s.retry, 'words', { course: L.key, ex: dir, fmt: s.mode });
  }
  // Conjugation: the given questions (missed or often confused ones), or the chosen verb group.
  function startConj(ids) {
    let pool = ids ? conjAll.filter(f => ids.includes(f.id)) : conjEligible.slice();
    if (!pool.length) { toast('Няма глаголи за тези настройки'); return; }
    shuffle(pool);
    if (!ids && s.size !== 'all') pool = pool.slice(0, +s.size);
    run(pool, s.retry, 'conj', { course: L.key, ex: 'conj', fmt: conjMode });
  }
  // Maths: a given list of facts (e.g. the often-confused ones), or the chosen tables in the chosen order.
  function startMath(list) {
    const m = store.math;
    let pool = list ? list.slice() : TESTS[m.test].facts(m.tables);
    if (!pool.length) { toast('Няма избрана таблица'); return; }
    if (list || m.order === 'mixed') shuffle(pool);
    if (!list && m.size !== 'all') pool = pool.slice(0, +m.size);
    run(pool, true, 'math', { course: MATH, ex: 'math', fmt: 'open' }, { limit: limitMs(m.timer) });
  }
  // The conjugation table: no answers, but opening and time spent count as a session.
  function openTable() { track.sessionStart({ course: L.key, ex: 'conj-table', fmt: 'table', size: verbs.length }); setView('conj'); }
  function next() {
    const S = session.current;
    if (!S) return;
    if (!S.queue.length) {
      S.finishedAt = Date.now(); track.sessionEnd('done');
      // A round without a single mistake gets its own celebration on the result screen; it replaces a milestone label.
      if (isPerfect(S)) setParty(null);
      setView('result'); setTick(t => t + 1); return;
    }
    S.cur = S.queue.shift(); S.qid++; S.shownAt = Date.now();
    setTick(t => t + 1);
  }
  // info: { result: ok | typo | wrong | hint | shown | time, pick: wrong option chosen in the test format }.
  function settle(clean, info) {
    const S = session.current, w = S.cur, first = !S.seen.has(w.id);
    track.answer({ word: w.id, first, result: (info && info.result) || (clean ? 'ok' : 'wrong'), ms: Math.max(0, Date.now() - S.shownAt), pick: info && info.pick });
    S.seen.add(w.id);
    if (clean && first) S.firstOk++;
    // Reward: confetti after every 10 correct answers (no mistake, no hint; a repeated word counts too), counted across
    // rounds and exercises and kept on the device, so 10, 20, 30, ... whatever the length of a round.
    if (clean) {
      const n = ++okTotal.current;
      update(x => { x.okTotal = n; });
      if (n % 10 === 0) setParty({ id: Date.now(), n });
    }
    if (!clean) S.missed.set(w.id, w);
    update(n => { const st = { ...(n.stats[w.id] || { c: 0, w: 0 }) }; clean ? st.c++ : st.w++; n.stats = { ...n.stats, [w.id]: st }; });
    if (!clean && S.retry && (S.reins[w.id] || 0) < 2) {
      S.reins[w.id] = (S.reins[w.id] || 0) + 1;
      S.queue.splice(Math.min(S.queue.length, 3 + Math.floor(Math.random() * 3)), 0, w);
    }
    setTick(t => t + 1);
  }
  function quit() {
    const S = session.current;
    track.sessionEnd('quit');
    if (!S || !S.seen.size) { session.current = null; setView('home'); return; }
    S.early = true; S.finishedAt = Date.now(); setView('result');
  }


  const S = session.current;
  const shown = !lang ? 'lang' : view;
  const counts = Object.fromEntries(courses.map(c => [c.key, dictFor(c.key).words.length]));
  const withTabs = !isMath && ['home', 'words'].includes(shown);
  const withTop = withTabs || (isMath && shown === 'home');
  useEffect(() => { document.title = cur ? `Wordopedia: ${cur.title}` : 'Wordopedia'; }, [cur && cur.title]); // eslint-disable-line
  return (
    <div className={'wrap' + (withTabs ? '' : ' notabs') + (isMath && shown === 'home' ? ' solo' : '')}>
      {withTop && (
        <div className="topbar">
          <LangMenu L={L} isMath={isMath} courses={offered} counts={counts} onPick={chooseLang} onRefresh={refreshNow} toast={toast}
            stats={trackAllowed ? s.track !== false : null} onStats={v => update(n => { n.settings = { ...n.settings, track: v }; })} />
        </div>
      )}
      {shown === 'lang' && <LangPick courses={offered} counts={counts} onPick={chooseLang} onCheck={checkLangs} toast={toast} />}
      {isMath && shown === 'home' && <MathHome store={store} update={update} toast={toast} onStart={startMath} />}
      {isMath && shown === 'quiz' && S && S.cur && <MathQuiz S={S} onSettle={settle} onNext={next} onQuit={quit} />}
      {isMath && shown === 'result' && S && <Result S={S} item={f => `${factText(f)} = ${f.answer}`} onAgain={() => startMath()} onMissed={ids => startMath([...S.missed.values()].filter(f => ids.includes(f.id)))} onHome={() => { session.current = null; setView('home'); }} />}
      {!isMath && shown === 'home' && <Home L={L} dir={dir} store={store} update={update} sets={sets} words={words} eligibleCount={eligible.length} setSel={setSel}
        verbs={verbs} conjAll={conjAll} conjGroups={conjGroups} conjSel={conjSel} conjCount={conjEligible.length}
        onStart={() => (dir !== 'conj' ? start() : conjMode === 'table' ? openTable() : startConj())} onPractise={ids => (dir === 'conj' ? startConj(ids) : start(ids))} />}
      {!isMath && shown === 'conj' && verbs.length > 0 && <Conj verbs={verbs} abase={abase} say={say} ibase={ibase} picFor={picFor} onClose={() => { track.sessionEnd('done'); setView('home'); }} />}
      {!isMath && shown === 'quiz' && S && S.cur && S.kind === 'conj' && <ConjQuiz L={L} S={S} facts={conjAll} mode={conjMode} retry={s.retry} autoSpeak={s.autoSpeak}
        say={say} abase={abase} ibase={ibase} picFor={picFor} onSettle={settle} onNext={next} onQuit={quit} />}
      {!isMath && shown === 'quiz' && S && S.cur && S.kind !== 'conj' && <Quiz key={S.qid} L={L} dir={dir} S={S} settings={s} words={words} say={say} abase={abase} ibase={ibase}
        onSettle={settle} onNext={next} onQuit={quit} />}
      {!isMath && shown === 'result' && S && <Result S={S} item={S.kind === 'conj' ? conjText : null}
        onAgain={() => (S.kind === 'conj' ? startConj() : start())} onMissed={ids => (S.kind === 'conj' ? startConj(ids) : start(ids))} onHome={() => { session.current = null; setView('home'); }} />}
      {shown === 'words' && <Words L={L} store={store} sets={sets} words={words} say={say} abase={abase} ibase={ibase} images={images} />}
      {withTabs && <TabBar view={shown} onView={setView} />}
      {party && <Confetti key={party.id} label={`${party.n} верни отговора`} onDone={() => setParty(null)} />}
      {ENV !== 'production' && <div className="envtag" aria-hidden="true">{ENV}</div>}
      <div className={'toast' + (toastMsg ? ' show' : '')} role="status" aria-live="polite">{toastMsg}</div>
    </div>
  );
}
