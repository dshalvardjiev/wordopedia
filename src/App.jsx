import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import deCsv from '../dictionary/de/words.csv?raw';
import frCsv from '../dictionary/fr/words.csv?raw';
import enCsv from '../dictionary/en/words.csv?raw';
import bundledConf from '../dictionary/languages.json';
import { parseDictionary, full, EMPTY } from './lib/dictionary.js';
import { LANGS, LANG_ORDER } from './lib/langs.js';
import { loadStore, saveStore, sortSets, DEFAULT_DICT_BASE } from './lib/store.js';
import { audioBase, speak as speakAudio, prefetchAll, resetPrepared } from './lib/audio.js';
import { fetchLangConf, fetchDictionary } from './lib/sync.js';
import { shuffle } from './lib/match.js';
import LangPick from './components/LangPick.jsx';
import { LangMenu, TabBar } from './components/Chrome.jsx';
import Home from './components/Home.jsx';
import Quiz from './components/Quiz.jsx';
import Result from './components/Result.jsx';
import Words from './components/Words.jsx';
import Dict from './components/Dict.jsx';

const BUNDLED_CSV = { de: deCsv, fr: frCsv, en: enCsv };
function parseSafe(csv, L) { try { return parseDictionary(csv, L); } catch (e) { return null; } }
const BUNDLED = Object.fromEntries(LANG_ORDER.map(c => [c, parseSafe(BUNDLED_CSV[c], LANGS[c]) || EMPTY]));

export default function App() {
  const [store, setStore] = useState(loadStore);
  const [view, setView] = useState(() => 'home');
  const [toastMsg, setToastMsg] = useState('');
  const [, setTick] = useState(0);
  const session = useRef(null);
  const toastT = useRef(0);

  useEffect(() => { saveStore(store); }, [store]);
  const update = useCallback(fn => setStore(s => { const n = { ...s }; fn(n); return n; }), []);
  const toast = useCallback(msg => { setToastMsg(msg); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToastMsg(''), 2600); }, []);

  // Languages that are switched on in dictionary/languages.json (downloaded copy, or the one built into the app).
  const conf = store.langConf || bundledConf;
  const isActive = c => !!(conf.languages.find(l => l.code === c) || {}).active && !!LANGS[c];
  const lang = store.lang && isActive(store.lang) ? store.lang : null;
  const L = LANGS[lang || 'de'];
  const base = store.dictBase || DEFAULT_DICT_BASE;

  // Dictionary of the chosen language: downloaded copy, or the one built into the app; plus the learner's own additions.
  const dictFor = useCallback(code => (store.dicts[code] && parseSafe(store.dicts[code].csv, LANGS[code])) || BUNDLED[code], [store.dicts]);
  const dict = useMemo(() => dictFor(L.code), [dictFor, L.code]);
  const sets = useMemo(() => {
    const m = new Map(dict.sets.map(s => [s.id, s]));
    store.userSets.filter(s => s.lang === L.code).forEach(s => { if (!m.has(s.id)) m.set(s.id, s); });
    return sortSets([...m.values()]);
  }, [dict, store.userSets, L.code]);
  const words = useMemo(() => {
    const ids = new Set(dict.words.map(w => w.id));
    const all = [...dict.words, ...store.userWords.filter(w => w.lang === L.code && !ids.has(w.id))];
    return all.map(w => {
      const x = store.extra[w.id];
      return { ...w, user: !ids.has(w.id), on: !store.off[w.id], bg: x ? [...w.bg, ...x.bg.filter(b => !w.bg.includes(b))] : w.bg, alt: x ? [...w.alt, ...x.alt.filter(b => !w.alt.includes(b))] : w.alt };
    });
  }, [dict, store.userWords, store.extra, store.off, L.code]);
  const abase = audioBase(base, L.code);
  const say = useCallback(text => speakAudio(L, abase, text, toast), [L, abase, toast]);

  const s = store.settings;
  const dir = s.dir === 'art' && !L.quizArticles.length ? 'x-bg' : s.dir;   // no article exercise for English
  const setSel = store.setByLang[L.code] || 'all';
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

  // ----- downloads -----
  async function checkLangs() { const c = await fetchLangConf(base); update(n => { n.langConf = c; }); return c; }
  async function pullLang(code, onAudio) {
    const { text, parsed } = await fetchDictionary(base, LANGS[code]);
    const before = new Set(dictFor(code).words.map(w => w.id)), after = new Set(parsed.words.map(w => w.id));
    if (!after.size && before.size) throw new Error('във файла няма разпознати думи');
    update(n => { n.dicts = { ...n.dicts, [code]: { csv: text, updatedAt: Date.now(), problems: parsed.problems } }; });
    resetPrepared();
    const audio = await prefetchAll(audioBase(base, code), parsed.words.map(full), onAudio);
    return { parsed, audio, added: [...after].filter(x => !before.has(x)).length, removed: [...before].filter(x => !after.has(x)).length };
  }
  async function chooseLang(code) {
    update(n => { n.lang = code; });
    setView('home');
    // A language switched on after this version was built has no words inside the app yet: download them now.
    if (!dictFor(code).words.length) {
      toast('Изтеглям думите…');
      try { const r = await pullLang(code); toast(`Изтеглени думи: ${r.parsed.words.length}`); } catch (e) { toast('Неуспешно изтегляне: ' + e.message); }
    }
  }

  // ----- session -----
  function start(ids) {
    let pool = ids ? words.filter(w => ids.includes(w.id)) : eligible.slice();
    if (dir === 'art') pool = pool.filter(isArtWord);
    if (!pool.length) { toast('Няма думи за тези настройки'); return; }
    shuffle(pool);
    if (!ids && s.size !== 'all') pool = pool.slice(0, +s.size);
    session.current = { queue: pool.slice(), total: pool.length, firstOk: 0, seen: new Set(), missed: new Map(), reins: {}, cur: null, qid: 0, early: false };
    next();
    setView('quiz');
  }
  function next() {
    const S = session.current;
    if (!S) return;
    if (!S.queue.length) { setView('result'); setTick(t => t + 1); return; }
    S.cur = S.queue.shift(); S.qid++;
    setTick(t => t + 1);
  }
  function settle(clean) {
    const S = session.current, w = S.cur, first = !S.seen.has(w.id);
    S.seen.add(w.id);
    if (clean && first) S.firstOk++;
    if (!clean) S.missed.set(w.id, w);
    update(n => { const st = { ...(n.stats[w.id] || { c: 0, w: 0 }) }; clean ? st.c++ : st.w++; n.stats = { ...n.stats, [w.id]: st }; });
    if (!clean && s.retry && (S.reins[w.id] || 0) < 2) {
      S.reins[w.id] = (S.reins[w.id] || 0) + 1;
      S.queue.splice(Math.min(S.queue.length, 3 + Math.floor(Math.random() * 3)), 0, w);
    }
    setTick(t => t + 1);
  }
  function quit() {
    const S = session.current;
    if (!S || !S.seen.size) { session.current = null; setView('home'); return; }
    S.early = true; setView('result');
  }
  function acceptOwn(w, value) {
    update(n => {
      const x = n.extra[w.id] ? { bg: [...n.extra[w.id].bg], alt: [...n.extra[w.id].alt] } : { bg: [], alt: [] };
      if (dir === 'x-bg') x.bg.push(value); else x.alt.push(value);
      n.extra = { ...n.extra, [w.id]: x };
    });
    const S = session.current;
    if (S && S.cur && S.cur.id === w.id) S.cur = { ...S.cur, bg: dir === 'x-bg' ? [...S.cur.bg, value] : S.cur.bg, alt: dir === 'x-bg' ? S.cur.alt : [...S.cur.alt, value] };
  }

  const S = session.current;
  const shown = !lang ? 'lang' : view;
  const counts = Object.fromEntries(LANG_ORDER.map(c => [c, dictFor(c).words.length]));
  const withTabs = ['home', 'words', 'dict'].includes(shown);
  useEffect(() => { document.title = lang ? `Wordopedia: ${L.name.toLowerCase()}` : 'Wordopedia'; }, [lang, L.name]);
  return (
    <div className={'wrap' + (withTabs ? '' : ' notabs')}>
      {withTabs && (
        <div className="topbar">
          <LangMenu L={L} conf={conf} counts={counts} onPick={chooseLang} onCheck={checkLangs} toast={toast} />
        </div>
      )}
      {shown === 'lang' && <LangPick conf={conf} counts={counts} onPick={chooseLang} onCheck={checkLangs} toast={toast} />}
      {shown === 'home' && <Home L={L} dir={dir} store={store} update={update} sets={sets} words={words} eligibleCount={eligible.length} setSel={setSel}
        onStart={() => start()} onPractise={ids => start(ids)} />}
      {shown === 'quiz' && S && S.cur && <Quiz key={S.qid} L={L} dir={dir} S={S} settings={s} words={words} say={say} abase={abase}
        onSettle={settle} onNext={next} onQuit={quit} onAcceptOwn={acceptOwn} />}
      {shown === 'result' && S && <Result S={S} onAgain={() => start()} onMissed={ids => start(ids)} onHome={() => { session.current = null; setView('home'); }} />}
      {shown === 'words' && <Words L={L} store={store} update={update} sets={sets} words={words} toast={toast} />}
      {shown === 'dict' && <Dict L={L} store={store} update={update} dict={dict} base={base} defaultBase={DEFAULT_DICT_BASE} toast={toast}
        onPull={pullLang} onCheck={checkLangs} />}
      {withTabs && <TabBar view={shown} onView={setView} />}
      <div className={'toast' + (toastMsg ? ' show' : '')} role="status" aria-live="polite">{toastMsg}</div>
    </div>
  );
}
