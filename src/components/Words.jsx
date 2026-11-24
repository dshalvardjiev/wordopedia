import { useEffect, useMemo, useState } from 'react';
import { Art } from './Quiz.jsx';
import { full, sortKey, letterOf } from '../lib/dictionary.js';
import { norm } from '../lib/langs.js';
import { nbg } from '../lib/match.js';
import { prepare } from '../lib/audio.js';
import { isLearned, isWeak } from '../lib/progress.js';
import { Icon, Seg } from './ui.jsx';
import Pic from './Pic.jsx';

const clean = s => s.replace(/\s*\(.*?\)/g, '');

// The vocabulary: a ruled exercise-book page per group, foreign word on the left, Bulgarian on the right.
export default function Words({ L, store, sets, words, say, abase, ibase, images }) {
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('sets');
  const qq = q.trim();
  const match = w => !qq || norm(L, w.de).includes(norm(L, qq)) || w.bg.some(b => nbg(b).includes(nbg(qq)));
  const shown = words.filter(match);
  const groups = useMemo(() => {
    if (mode === 'sets') return sets.map(x => ({ id: 'set-' + x.id, title: x.name, items: shown.filter(w => w.set === x.id) })).filter(g => g.items.length);
    const sorted = [...shown].sort((a, b) => sortKey(a).localeCompare(sortKey(b), L.code, { sensitivity: 'base' }));
    const m = new Map();
    sorted.forEach(w => { const k = letterOf(w); if (!m.has(k)) m.set(k, []); m.get(k).push(w); });
    return [...m.entries()].map(([k, items]) => ({ id: 'letter-' + k, title: k, items }));
  }, [mode, shown, sets, L.code]); // eslint-disable-line
  // Load recordings ahead so a tap plays at once (iPhones only allow sound started directly by the tap).
  useEffect(() => { words.forEach(w => prepare(abase, full(w))); }, [words, abase]);
  const learned = words.filter(w => isLearned(store.stats[w.id])).length;

  return (
    <section>
      <h1>Думи</h1>
      <p className="small" style={{ margin: '4px 0 14px' }}>{words.length} думи, {learned} научени. Думата се произнася при докосване.</p>
      <div className="search form"><Icon name="search" size={18} /><input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={`Търси на ${L.adj}и или на български`} aria-label="Търсене" /></div>
      <Seg label="Подредба" value={mode} onChange={setMode} options={[['sets', 'По списъци'], ['abc', 'По азбука']]} />
      {mode === 'abc' && groups.length > 1 && (
        <nav className="az" aria-label="Букви">
          {groups.map(g => <button key={g.id} onClick={() => document.getElementById(g.id).scrollIntoView({ behavior: 'smooth', block: 'start' })}>{g.title}</button>)}
        </nav>
      )}
      {groups.map(g => (
        <section key={g.id} id={g.id} className="vgroup">
          <h2 className="vhead"><span>{g.title}</span><span className="vcount">{g.items.length}</span></h2>
          <div className="vsheet">
            {g.items.map(w => {
              const st = store.stats[w.id], mark = isLearned(st) ? 'ok' : isWeak(st) ? 'bad' : '';
              return (
                <button key={w.id} className="ventry" onClick={() => say(full(w))} aria-label={`${full(w)}: ${w.bg.join(', ')}. Слушане`}>
                  <span className={'vmark ' + mark} aria-hidden="true">{mark === 'ok' ? '✓' : mark === 'bad' ? '•' : ''}</span>
                  <span className="vde"><Art w={w} /><b>{w.de}</b>{w.pl && <span className="vpl">{w.pl}</span>}</span>
                  <span className="vbg">{w.bg.map(clean).filter((x, i, a) => a.indexOf(x) === i).slice(0, 3).join(', ')}{w.note && <span className="vnote">{w.note}</span>}</span>
                  <span className="vpic"><Pic base={ibase} file={w.img} /></span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {!groups.length && <p className="empty">{qq ? `Няма дума, която съдържа „${qq}“.` : 'Още няма думи в този курс.'}</p>}
      {words.length > 0 && <p className="small center" style={{ marginTop: 16 }}><span className="vmark ok inline">✓</span> научена <span className="vmark bad inline">•</span> често се бърка</p>}
      {images.byWord.size > 0 && (
        <details className="credits">
          <summary>Източници на изображенията <Icon name="chevron" /></summary>
          <div className="boxbody">
            {images.sources.map(x => <p key={x.id}>{x.url ? <a href={x.url} target="_blank" rel="noreferrer">{x.name}</a> : x.name}, лиценз {x.license}.</p>)}
            {images.credits.length > 0 && <ul>{images.credits.map(c => <li key={c.word}><b>{c.word}</b>: <a href={c.url} target="_blank" rel="noreferrer">{c.author || 'Wikimedia Commons'}</a>, {c.license}</li>)}</ul>}
          </div>
        </details>
      )}
    </section>
  );
}
