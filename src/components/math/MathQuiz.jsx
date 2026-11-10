import { useEffect, useRef, useState } from 'react';
import { explain, hintFor } from '../../lib/math.js';
import { Icon } from '../ui.jsx';

// Typed answers only; the round continues only after the correct number is written.
// The same input element stays mounted across questions, so a phone keyboard does not close between them.
export default function MathQuiz({ S, onSettle, onNext, onQuit }) {
  const f = S.cur;
  const [value, setValue] = useState('');
  const [fb, setFb] = useState(null);
  const [hint, setHint] = useState('');
  const [locked, setLocked] = useState(false);
  const st = useRef({ clean: true, locked: false, qid: S.qid });
  const inp = useRef(null), timer = useRef(0);

  useEffect(() => {
    st.current = { clean: true, locked: false, qid: S.qid };
    setValue(''); setFb(null); setHint(''); setLocked(false);
    try { inp.current && inp.current.focus({ preventScroll: true }); } catch (e) {}
  }, [S.qid]);
  useEffect(() => () => clearTimeout(timer.current), []);

  function next() { clearTimeout(timer.current); if (st.current.locked) onNext(); }
  function shake() { const el = inp.current; if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
  function submit(e) {
    e.preventDefault();
    if (st.current.locked) { next(); return; }
    const v = value.trim();
    if (!v) return;
    if (!/^\d+$/.test(v)) { setFb({ kind: 'bad', msg: 'Напиши само число.' }); shake(); return; }
    const n = +v;
    if (n === f.answer) {
      st.current.locked = true; setLocked(true);
      const clean = st.current.clean; onSettle(clean);
      setFb({ kind: 'ok', clean });
      if (clean) { const q = S.qid; timer.current = setTimeout(() => { if (st.current.qid === q) next(); }, 700); }
    } else {
      st.current.clean = false;
      setFb({ kind: 'bad', msg: explain(f, n) }); shake();
      try { inp.current.select(); } catch (e2) {}
    }
  }
  function giveHint(all) {
    if (st.current.locked) return;
    st.current.clean = false;
    setHint(all ? `${f.a} × ${f.b} = ${f.answer}. Напиши го, за да продължиш.` : hintFor(f));
    try { inp.current.focus({ preventScroll: true }); } catch (e) {}
  }

  const done = S.seen.size;
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
          {S.seen.has(f.id) && <span className="badge">повторение</span>}
          <label className="expr">
            <span>{f.a} × {f.b} =</span>
            <input ref={inp} className={'slot' + (locked ? ' done' : '')} value={value} inputMode="numeric" pattern="[0-9]*" enterKeyHint={locked ? 'next' : 'done'}
              maxLength={3} aria-label={`${f.a} по ${f.b} е равно на`} onChange={e => { if (!st.current.locked) setValue(e.target.value.replace(/[^\d]/g, '')); }} />
          </label>
        </div>
        <div className="answer">
          <button className="primary wide" type="submit">{locked ? 'Напред' : 'Провери'}</button>
          {!locked && (
            <div className="helpers">
              <button className="ghost" type="button" onClick={() => giveHint(false)}>Подсказка</button>
              <button className="ghost" type="button" onClick={() => giveHint(true)}>Покажи отговора</button>
            </div>
          )}
          {hint && !locked && <div className="hinttxt">{hint}</div>}
        </div>
      </form>

      {fb && fb.kind === 'ok' && <div className="fb ok"><b>{fb.clean ? 'Вярно.' : 'Вярно. Примерът ще се появи пак.'}</b> {f.a} × {f.b} = {f.answer}</div>}
      {fb && fb.kind === 'bad' && <div className="fb bad"><b>{fb.msg}</b></div>}
    </section>
  );
}
