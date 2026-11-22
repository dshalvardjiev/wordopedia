import { useMemo, useEffect, useRef, useState } from 'react';
import { explain, hintFor } from '../../lib/math.js';
import { Icon } from '../ui.jsx';

// Typed answers only; the round continues only after the correct number is written.
// The same input element stays mounted across questions, so a phone keyboard does not close between them.
// With a time limit (S.limit, ms per answer), running out of time settles the fact as missed ("time") and shows the
// answer; as with "Показване на отговора", the round continues once it is written. The clock pauses while the page is
// hidden, stops when the answer is shown, and stops on the correct answer.
export default function MathQuiz({ S, onSettle, onNext, onQuit }) {
  const f = S.cur, limit = S.limit || 0;
  // Decided when the question appears (this component stays mounted across questions).
  const again = useMemo(() => S.seen.has(f.id), [S.qid]); // eslint-disable-line react-hooks/exhaustive-deps
  const [value, setValue] = useState('');
  const [fb, setFb] = useState(null);
  const [hint, setHint] = useState('');
  const [locked, setLocked] = useState(false);
  const [left, setLeft] = useState(0);          // whole seconds left, for the display
  const [clockOn, setClockOn] = useState(false); // the countdown bar runs (false: stopped or paused)
  // settled: onSettle was already called for this question (time ran out), so the correct answer only unlocks "Напред".
  const st = useRef({ clean: true, locked: false, settled: false, qid: S.qid, hint: 0 });
  const inp = useRef(null), timer = useRef(0);
  // Clock: end time while running, ms left while paused; 0/0 when stopped.
  const clock = useRef({ end: 0, rest: 0, out: 0, tick: 0 });

  function stopClock() { const c = clock.current; clearTimeout(c.out); clearInterval(c.tick); c.end = c.rest = 0; setClockOn(false); }
  function runClock() {
    const c = clock.current;
    if (!c.rest) return;
    c.end = Date.now() + c.rest; c.rest = 0;
    c.out = setTimeout(timeUp, c.end - Date.now());
    c.tick = setInterval(() => setLeft(Math.max(0, Math.ceil((c.end - Date.now()) / 1000))), 200);
    setClockOn(true);
  }
  function pauseClock() {
    const c = clock.current;
    if (!c.end) return;
    clearTimeout(c.out); clearInterval(c.tick);
    c.rest = Math.max(1, c.end - Date.now()); c.end = 0; setClockOn(false);
  }
  function timeUp() {
    stopClock(); setLeft(0);
    if (st.current.locked || st.current.settled) return;
    st.current.clean = false; st.current.settled = true;
    onSettle(false, { result: 'time' });
    setHint(''); setFb({ kind: 'time' });
    try { inp.current.select(); } catch (e) {}
  }

  useEffect(() => {
    st.current = { clean: true, locked: false, settled: false, qid: S.qid, hint: 0 };
    setValue(''); setFb(null); setHint(''); setLocked(false);
    stopClock();
    if (limit) { clock.current.rest = limit; setLeft(Math.ceil(limit / 1000)); runClock(); }
    try { inp.current && inp.current.focus({ preventScroll: true }); } catch (e) {}
  }, [S.qid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // A phone screen turned off or another app opened: the time does not run out meanwhile.
    const onVis = () => (document.visibilityState === 'visible' ? runClock() : pauseClock());
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); clearTimeout(timer.current); stopClock(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function next() { clearTimeout(timer.current); if (st.current.locked) onNext(); }
  function shake() { const el = inp.current; if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
  function submit(e) {
    e.preventDefault();
    if (st.current.locked) { next(); return; }
    const v = value.trim();
    if (!v) return;
    if (!/^\d+$/.test(v)) { setFb({ kind: 'bad', msg: 'Допустими са само цифри.' }); shake(); return; }
    const n = +v;
    if (n === f.answer) {
      stopClock();
      st.current.locked = true; setLocked(true);
      const clean = st.current.clean;
      if (!st.current.settled) onSettle(clean, { result: st.current.hint === 2 ? 'shown' : st.current.hint ? 'hint' : clean ? 'ok' : 'wrong' });
      setFb({ kind: 'ok', clean });
      if (clean) { const q = S.qid; timer.current = setTimeout(() => { if (st.current.qid === q) next(); }, 700); }
    } else {
      st.current.clean = false;
      setFb({ kind: 'bad', msg: explain(f, n) }); shake();
      try { inp.current.select(); } catch (e2) {}
    }
  }
  function giveHint(all) {
    if (st.current.locked || st.current.settled) return;
    st.current.clean = false; st.current.hint = all ? 2 : Math.max(st.current.hint, 1);
    // With the answer on screen, running out of time would mean nothing more.
    if (all) stopClock();
    setHint(all ? `${f.a} × ${f.b} = ${f.answer}. Упражнението продължава след въвеждането му.` : hintFor(f));
    try { inp.current.focus({ preventScroll: true }); } catch (e) {}
  }

  const done = S.seen.size;
  const timedOut = fb && fb.kind === 'time';
  return (
    <section>
      <div className="qtop">
        <button className="iconbtn" onClick={onQuit} aria-label="Край на упражнението"><Icon name="close" /></button>
        <div className="qprog">
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={S.total} aria-valuenow={done}><i style={{ width: (done / S.total * 100) + '%' }} /></div>
          <div className="qmeta"><span>{done} от {S.total}</span><span className="ok">{S.firstOk} верни от първия опит</span></div>
        </div>
      </div>

      <form onSubmit={submit} autoComplete="off">
        <div className="sheet grid">
          {again && <span className="badge">повторение</span>}
          <label className="expr">
            <span>{f.a} × {f.b} =</span>
            <input ref={inp} className={'slot' + (locked ? ' done' : '')} value={value} inputMode="numeric" pattern="[0-9]*" enterKeyHint={locked ? 'next' : 'done'}
              maxLength={3} aria-label={`${f.a} по ${f.b} е равно на`} onChange={e => { if (!st.current.locked) setValue(e.target.value.replace(/[^\d]/g, '')); }} />
          </label>
        </div>
        {limit > 0 && (
          // The bar is keyed by question, so its animation restarts; the input above is never re-keyed.
          // Red for the last quarter or so: 2 s of 5, 3 s of 10, 4 s of 15.
          <div className={'clock' + (left <= Math.max(2, Math.round(limit / 4000)) ? ' low' : '') + (timedOut ? ' out' : '')} aria-hidden="true">
            <div className="clock-bar"><i key={S.qid} style={{ animationDuration: limit + 'ms', animationPlayState: clockOn ? 'running' : 'paused' }} /></div>
            <span className="clock-num">{left} сек.</span>
          </div>
        )}
        <div className="answer">
          <button className="primary wide" type="submit">{locked ? 'Напред' : 'Проверка'}</button>
          {!locked && !timedOut && (
            <div className="helpers">
              <button className="ghost" type="button" onClick={() => giveHint(false)}>Подсказка</button>
              <button className="ghost" type="button" onClick={() => giveHint(true)}>Показване на отговора</button>
            </div>
          )}
          {hint && !locked && <div className="hinttxt">{hint}</div>}
        </div>
      </form>

      {fb && fb.kind === 'ok' && <div className="fb ok"><b>{fb.clean ? 'Вярно.' : 'Вярно. Примерът ще се появи пак.'}</b> {f.a} × {f.b} = {f.answer}</div>}
      {fb && fb.kind === 'bad' && <div className="fb bad"><b>{fb.msg}</b></div>}
      {timedOut && <div className="fb bad" role="status"><b>Времето изтече.</b> {f.a} × {f.b} = {f.answer}. Упражнението продължава след въвеждането му.</div>}
    </section>
  );
}
