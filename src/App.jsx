import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import bundledCsv from '../dictionary/words.csv?raw';
import { parseDictionary, full, ARTS } from './lib/dictionary.js';
import { loadStore, saveStore, sortSets, DEFAULT_DICT_URL } from './lib/store.js';
import { audioBase, speak as speakAudio } from './lib/audio.js';
import { shuffle } from './lib/match.js';
import Home from './components/Home.jsx';
import Quiz from './components/Quiz.jsx';
import Result from './components/Result.jsx';
import Words from './components/Words.jsx';
import Dict from './components/Dict.jsx';

function parseSafe(csv) { try { return parseDictionary(csv); } catch (e) { return null; } }
const BUNDLED = parseDictionary(bundledCsv);

export default function App() {
  const [store, setStore] = useState(loadStore);
  const [view, setView] = useState('home');
  const [toastMsg, setToastMsg] = useState('');
  const [, setTick] = useState(0);
  const session = useRef(null);
  const toastT = useRef(0);

  // Persist on every change.
  useEffect(() => { saveStore(store); }, [store]);
  const update = useCallback(fn => setStore(s => { const n = { ...s }; fn(n); return n; }), []);
  const toast = useCallback(msg => { setToastMsg(msg); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToastMsg(''), 2600); }, []);

  // Effective dictionary: downloaded copy (or the one bundled with the app) + the learner's own additions.
  const dict = useMemo(() => (store.dict && parseSafe(store.dict.csv)) || BUNDLED, [store.dict]);
  const sets = useMemo(() => {
    const m = new Map(dict.sets.map(s => [s.id, s]));
    store.userSets.forEach(s => { if (!m.has(s.id)) m.set(s.id, s); });
    return sortSets([...m.values()]);
  }, [dict, store.userSets]);
  const words = useMemo(() => {
    const ids = new Set(dict.words.map(w => w.id));
    const all = [...dict.words, ...store.userWords.filter(w => !ids.has(w.id))];
    return all.map(w => {
      const x = store.extra[w.id];
      return { ...w, user: !ids.has(w.id), on: !store.off[w.id], bg: x ? [...w.bg, ...x.bg.filter(b => !w.bg.includes(b))] : w.bg, alt: x ? [...w.alt, ...x.alt.filter(b => !w.alt.includes(b))] : w.alt };
    });
  }, [dict, store.userWords, store.extra, store.off]);
  const base = useMemo(() => audioBase(store.dictUrl), [store.dictUrl]);
  const say = useCallback(text => speakAudio(base, text, toast), [base, toast]);

  const s = store.settings;
  const activeSet = s.set === 'latest' ? (sets[0] && sets[0].id) : (s.set !== 'all' && sets.some(x => x.id === s.set) ? s.set : null);
  const passFilter = w => {
    if (s.filter === 'n') return w.type === 'n';
    if (s.filter === 'v') return w.type === 'v';
    if (s.filter === 'other') return w.type !== 'n' && w.type !== 'v';
    if (s.filter === 'weak') { const st = store.stats[w.id]; return !!(st && st.w > 0 && st.w >= st.c); }
    return true;
  };
  const eligible = words.filter(w => w.on && (!activeSet || w.set === activeSet) && (s.dir !== 'art' || (w.type === 'n' && ARTS.includes(w.art))) && passFilter(w));

  // ----- session -----
  function start(ids) {
    let pool = ids ? words.filter(w => ids.includes(w.id)) : eligible.slice();
    if (s.dir === 'art') pool = pool.filter(w => w.type === 'n' && ARTS.includes(w.art));
    if (!pool.length) { toast('Няма думи за тези настройки'); return; }
    shuffle(pool);
    if (!ids && s.size !== 'all') pool = pool.slice(0, +s.size);
    session.current = { queue: pool.slice(), total: pool.length, firstOk: 0, seen: new Set(), missed: new Map(), reins: {}, cur: null, qid: 0, early: false };
    next();
    setView('quiz');
  }
  function next() {
    const S = session.current;
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
      if (s.dir === 'de-bg') x.bg.push(value); else x.alt.push(value);
      n.extra = { ...n.extra, [w.id]: x };
    });
    // Keep the running session in step with the saved synonym.
    const S = session.current;
    if (S && S.cur && S.cur.id === w.id) S.cur = { ...S.cur, bg: s.dir === 'de-bg' ? [...S.cur.bg, value] : S.cur.bg, alt: s.dir === 'de-bg' ? S.cur.alt : [...S.cur.alt, value] };
  }

  const S = session.current;
  return (
    <div className="wrap">
      {view === 'home' && <Home store={store} update={update} sets={sets} words={words} eligibleCount={eligible.length} activeSet={activeSet}
        onStart={() => start()} onWords={() => setView('words')} onDict={() => setView('dict')} dict={store.dict} />}
      {view === 'quiz' && S && S.cur && <Quiz key={S.qid} S={S} settings={s} words={words} say={say} base={base}
        onSettle={settle} onNext={next} onQuit={quit} onAcceptOwn={acceptOwn} />}
      {view === 'result' && S && <Result S={S} onAgain={() => start()} onMissed={ids => start(ids)} onHome={() => { session.current = null; setView('home'); }} />}
      {view === 'words' && <Words store={store} update={update} sets={sets} words={words} toast={toast} onBack={() => setView('home')} />}
      {view === 'dict' && <Dict store={store} update={update} dict={dict} words={words} base={base} toast={toast} defaultUrl={DEFAULT_DICT_URL} onBack={() => setView('home')} />}
      <div className={'toast' + (toastMsg ? ' show' : '')} role="status">{toastMsg}</div>
    </div>
  );
}

export { full };
