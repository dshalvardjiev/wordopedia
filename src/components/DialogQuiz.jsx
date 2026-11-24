import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui.jsx';
import Pic from './Pic.jsx';
import { prepare } from '../lib/audio.js';
import { shuffledOrder, placed } from '../lib/dialogues.js';

const GAP = 8; // px between lines, as in .dl-list

// Dialogue exercise: the lines of a short conversation in a random order are put in the right one by dragging the
// handle (or with the arrow keys on it), then checked. Lines in the wrong place turn red; the order can be changed and
// checked again. A dialogue counts as right (onSettle) when the first check is right. Once in order, each line shows
// its Bulgarian translation. A tap on a line plays it (hear).
// Keyed by question in App: every dialogue starts with a fresh order. There is no text input on this screen.
export default function DialogQuiz({ S, retry, hear, abase, picBase, picFor, onSettle, onNext, onQuit }) {
  const d = S.cur;
  const [order, setOrder] = useState(() => shuffledOrder(d.lines.length));
  const [marks, setMarks] = useState(null);       // after a check: per position, right or not
  const [tries, setTries] = useState(0);
  const [solved, setSolved] = useState(false);
  const [dragging, setDragging] = useState(-1);    // position of the line being dragged
  const [say, setSay] = useState('');               // announcement for screen readers
  const [again] = useState(() => S.seen.has(d.id)); // decided when the dialogue appears
  const orderRef = useRef(order), drag = useRef(null), list = useRef(null), nextBtn = useRef(null);
  orderRef.current = order;

  useEffect(() => { d.lines.forEach(x => prepare(abase, x.text)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function apply(next, pos) {
    orderRef.current = next; setOrder(next); setMarks(null);
    if (pos !== undefined) setSay(`Място ${pos + 1} от ${next.length}`);
  }
  function move(from, to) {
    const o = orderRef.current;
    if (to < 0 || to >= o.length || from === to) return;
    const n = o.slice(); const [x] = n.splice(from, 1); n.splice(to, 0, x);
    apply(n, to);
  }

  // ----- dragging by the handle: the line follows the finger and swaps with a neighbour once past its middle -----
  function down(e, pos) {
    if (solved) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) {}
    drag.current = { pos, y: e.clientY, el: list.current.children[pos] };
    setDragging(pos);
  }
  function moveDrag(e) {
    const g = drag.current;
    if (!g) return;
    const items = list.current.children;
    let dy = e.clientY - g.y;
    const next = items[g.pos + 1], prev = items[g.pos - 1];
    if (next && dy > next.offsetHeight / 2 + GAP) { g.y += next.offsetHeight + GAP; move(g.pos, g.pos + 1); g.pos++; }
    else if (prev && dy < -(prev.offsetHeight / 2 + GAP)) { g.y -= prev.offsetHeight + GAP; move(g.pos, g.pos - 1); g.pos--; }
    dy = e.clientY - g.y;
    g.el.style.transform = `translateY(${dy}px)`;
    setDragging(g.pos);
  }
  function up() {
    const g = drag.current;
    if (!g) return;
    g.el.style.transform = '';
    drag.current = null; setDragging(-1);
  }
  function key(e, pos) {
    if (solved) return;
    if (e.key === 'ArrowUp') { e.preventDefault(); move(pos, pos - 1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); move(pos, pos + 1); }
  }

  function check() {
    const m = placed(orderRef.current), ok = m.every(Boolean);
    setMarks(m); setTries(t => t + 1);
    if (!ok) { setSay(`Вярно подредени: ${m.filter(Boolean).length} от ${m.length}`); return; }
    setSolved(true);
    onSettle(tries === 0, { result: tries === 0 ? 'ok' : 'wrong' });
    setTimeout(() => nextBtn.current && nextBtn.current.focus({ preventScroll: true }), 20);
  }

  const done = S.seen.size, right = marks ? marks.filter(Boolean).length : 0;
  return (
    <section className="dl">
      <div className="qtop">
        <button className="iconbtn" onClick={onQuit} aria-label="Край на упражнението"><Icon name="close" /></button>
        <div className="qprog">
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={S.total} aria-valuenow={done}><i style={{ width: (done / S.total * 100) + '%' }} /></div>
          <div className="qmeta"><span>{done} от {S.total}</span><span className="ok">{S.firstOk} подредени от първия опит</span></div>
        </div>
      </div>

      <div className="sheet dl-head">
        {again && <span className="badge">повторение</span>}
        <Pic base={picBase} file={picFor(d.img)} className="dl-scene" />
        <div><div className="dl-title">{d.title}</div><div className="sub">{solved ? 'Разговорът е подреден.' : 'Подреждане на репликите'}</div></div>
      </div>

      <ol className="dl-list" ref={list} aria-label="Реплики">
        {order.map((li, pos) => {
          const x = d.lines[li];
          const st = marks ? (marks[pos] ? 'ok' : 'bad') : solved ? 'ok' : '';
          return (
            <li key={li} className={['dl-line', st, dragging === pos ? 'drag' : ''].join(' ')}>
              <Pic base={picBase} file={picFor(x.img)} className="dl-who-pic" />
              <button type="button" className="dl-text" onClick={() => hear(x.text)} aria-label={`${x.name}: ${x.text}. Слушане`}>
                <span className="dl-who">{x.name}</span>
                <span className="dl-say">{x.text}</span>
                {solved && <span className="dl-bg">{x.bg}</span>}
              </button>
              {!solved && (
                <button type="button" className="dl-handle" aria-label={`Преместване: ${x.text}. Стрелки нагоре и надолу`}
                  onPointerDown={e => down(e, pos)} onPointerMove={moveDrag} onPointerUp={up} onPointerCancel={up} onKeyDown={e => key(e, pos)}>
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><g fill="currentColor">
                    <circle cx="7" cy="4" r="1.7" /><circle cx="13" cy="4" r="1.7" /><circle cx="7" cy="10" r="1.7" />
                    <circle cx="13" cy="10" r="1.7" /><circle cx="7" cy="16" r="1.7" /><circle cx="13" cy="16" r="1.7" /></g></svg>
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <div className="sr" aria-live="polite">{say}</div>

      {marks && !solved && <div className="fb bad"><b>Вярно подредени: {right} от {marks.length}.</b> Червените реплики не са на мястото си.</div>}
      {solved && <div className="fb ok"><b>{tries === 1 ? 'Вярно.' : retry ? 'Вярно, след грешка. Диалогът ще се появи пак.' : 'Вярно, след грешка.'}</b> Докосване на реплика: слушане.</div>}
      {!solved && <button className="primary nextbtn" onClick={check}>Проверка</button>}
      {solved && <button ref={nextBtn} className="primary nextbtn" onClick={onNext}>Напред</button>}
    </section>
  );
}
