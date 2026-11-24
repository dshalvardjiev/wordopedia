import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui.jsx';
import { Art } from './Quiz.jsx';
import Pic from './Pic.jsx';
import { prepare } from '../lib/audio.js';
import { shuffle } from '../lib/match.js';
import { artStep, tileText, doneText, bgText, maxPoints } from '../lib/pairs.js';

const artCls = a => 'a-' + a.replace("'", '');
const order = list => shuffle(list.map(w => w.id));

// Matching exercise: each round is a board of up to 10 words (S.rounds). A foreign word and a Bulgarian translation
// are tapped in either order; a noun then needs its article. +1 point for every right pair or article, -1 for every
// wrong one (shown as 0 at least). The article has one try: a wrong one is a mistake that cannot be corrected (the word
// turns red, the right article is shown). A word paired wrongly first also ends red. A word counts as right (onSettle) when it was paired and given its article
// without a mistake; a wrong pair is held against the foreign word of that pair.
// say: automatic playback; hear: a tap on a finished word (counted for the listening achievements).
export default function MatchQuiz({ L, S, settings, say, hear, abase, ibase, onSettle, onFinish, onQuit }) {
  const [r, setR] = useState(0);
  const board = S.rounds[r];
  const byId = new Map(board.map(w => [w.id, w]));
  const [left, setLeft] = useState(() => order(board));
  const [right, setRight] = useState(() => order(board));
  const [sel, setSel] = useState(null);            // {side: 'l' | 'r', id}
  const [paired, setPaired] = useState(() => new Set());
  const [done, setDone] = useState(() => new Set());
  const [artFor, setArtFor] = useState(null);      // word whose article is being chosen
  const [artBad, setArtBad] = useState('');        // the wrong article chosen for that word: no second try
  const [red, setRed] = useState(() => new Set()); // words finished with a mistake (wrong pair or article)
  const [flash, setFlash] = useState(null);        // {l, r}: a wrong pair, shown briefly
  const [points, setPoints] = useState(S.points || 0);
  const [between, setBetween] = useState(false);  // a round is finished and another follows
  const miss = useRef({ pair: new Map(), art: new Map() }); // word id -> first wrong translation / article
  const flashT = useRef(0), artT = useRef(0);

  useEffect(() => { board.forEach(w => prepare(abase, doneText(L, w))); }, [r]); // eslint-disable-line
  useEffect(() => () => { clearTimeout(flashT.current); clearTimeout(artT.current); }, []);

  // The sum can go below 0 (a mistake before the first right move still counts); it is shown as 0 at least.
  function score(d) { setPoints(p => { const n = p + d; S.points = n; return n; }); }
  const shown = Math.max(0, points);
  function complete(w) {
    const pick = miss.current.pair.get(w.id) || miss.current.art.get(w.id);
    const clean = !pick;
    const nd = new Set(done).add(w.id);
    setDone(nd); setArtFor(null); setArtBad('');
    if (!clean) setRed(s => new Set(s).add(w.id));
    onSettle(w, clean, { result: clean ? 'ok' : 'wrong', pick });
    if (settings.autoSpeak) say(doneText(L, w));
    if (nd.size === board.length) {
      if (r + 1 < S.rounds.length) setBetween(true);
      else setTimeout(onFinish, 600);
    }
  }
  function tap(side, id) {
    if (artFor || between) return;
    if (paired.has(id)) { if (side === 'l' && done.has(id)) hear(doneText(L, byId.get(id))); return; }
    if (!sel || sel.side === side) { setSel(sel && sel.id === id && sel.side === side ? null : { side, id }); return; }
    const l = side === 'l' ? id : sel.id, rt = side === 'r' ? id : sel.id;
    setSel(null);
    if (l === rt) {
      const w = byId.get(l);
      setPaired(p => new Set(p).add(l));
      score(1);
      if (artStep(L, w)) setArtFor(w); else complete(w);
      return;
    }
    score(-1);
    if (!miss.current.pair.has(l)) miss.current.pair.set(l, bgText(byId.get(rt)));
    clearTimeout(flashT.current);
    setFlash({ l, r: rt });
    flashT.current = setTimeout(() => setFlash(null), 600);
  }
  function chooseArt(a) {
    const w = artFor, step = artStep(L, w);
    if (artBad) return;
    if (a === step.right) { score(1); complete(w); return; }
    // One try: the wrong article stays a mistake; the right one is shown, then the board continues.
    score(-1);
    miss.current.art.set(w.id, a);
    setArtBad(a);
    setRed(s => new Set(s).add(w.id));
    artT.current = setTimeout(() => complete(w), 1600);
  }
  function nextRound() {
    const nr = r + 1, nb = S.rounds[nr];
    setR(nr); setLeft(order(nb)); setRight(order(nb));
    setSel(null); setPaired(new Set()); setDone(new Set()); setRed(new Set()); setArtFor(null); setArtBad(''); setFlash(null); setBetween(false);
  }

  const total = S.total, finished = S.seen.size, step = artFor && artStep(L, artFor);
  const cls = (side, id) => ['mq-t', done.has(id) ? (red.has(id) ? 'miss' : 'ok') : paired.has(id) ? 'half' : '',
    sel && sel.side === side && sel.id === id ? 'sel' : '', flash && flash[side] === id ? 'bad shake' : ''].join(' ');
  const maxSoFar = S.rounds.slice(0, r + 1).reduce((n, list) => n + maxPoints(L, list), 0);
  return (
    <section className={'mq' + (artFor ? ' withart' : '')}>
      <div className="qtop">
        <button className="iconbtn" onClick={onQuit} aria-label="Край на упражнението"><Icon name="close" /></button>
        <div className="qprog">
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={finished}><i style={{ width: (finished / total * 100) + '%' }} /></div>
          <div className="qmeta"><span>Кръг {r + 1} от {S.rounds.length}</span><span className="ok" aria-live="polite">Точки: {shown}</span></div>
        </div>
      </div>

      {between ? (
        <div className="sheet mq-between">
          <div className="big">Край на кръг {r + 1} от {S.rounds.length}</div>
          <p className="sub">Точки досега: {shown} от {maxSoFar}</p>
          <button className="primary" onClick={nextRound}>Следващ кръг</button>
        </div>
      ) : <>
        <p className="hint mq-hint">Дума и превод: докосване на двете. Съществителните получават и член.</p>
        <div className="mq-board" aria-disabled={!!artFor}>
          <div className="mq-col" role="group" aria-label={L.name}>
            {left.map(id => { const w = byId.get(id); return (
              <button key={id} type="button" className={cls('l', id)} aria-pressed={!!(sel && sel.side === 'l' && sel.id === id)} onClick={() => tap('l', id)}>
                {done.has(id) && artStep(L, w) && L.quizArticles.length ? <><Art w={w} />{w.de}</> : done.has(id) ? doneText(L, w) : tileText(L, w)}
              </button>
            ); })}
          </div>
          <div className="mq-col" role="group" aria-label="Български">
            {right.map(id => (
              <button key={id} type="button" className={cls('r', id)} aria-pressed={!!(sel && sel.side === 'r' && sel.id === id)} onClick={() => tap('r', id)}>
                {bgText(byId.get(id))}
              </button>
            ))}
          </div>
        </div>
      </>}

      {artFor && (
        <div className="mq-art" role="dialog" aria-label="Член">
          <div className="mq-art-in">
            <div className="mq-art-word">
              <Pic base={ibase} file={artFor.img} className="mq-pic" />
              <span><span className="blank" aria-label="член" />{artFor.de} <span className="muted">= {bgText(artFor)}</span></span>
            </div>
            <div className="opts arts">
              {step.list.map(a => (
                <button key={a} type="button" disabled={!!artBad} onClick={() => chooseArt(a)}
                  className={['opt', L.quizArticles.length ? artCls(a) : '', artBad === a ? 'bad shake' : artBad && a === step.right ? 'ok' : ''].join(' ')}>
                  <span>{a}</span>
                </button>
              ))}
            </div>
            {artBad && <p className="mq-art-fb" role="status">Грешен член. Вярно е: <b>{doneText(L, artFor)}</b>.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
