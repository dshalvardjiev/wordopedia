import { useEffect, useRef, useState } from 'react';
import { complete, grade } from '../../lib/quiz.js';
import { shuffle } from '../../lib/match.js';
import { Icon } from '../ui.jsx';

const KEY_NOTE = { derived: 'Отговорът е изведен: в източника няма ключ за този въпрос.' };

// One question from a bank. Choice, then "Проверка": one attempt, after which the right answer and the explanation are shown.
// App keys this component by S.qid, so every question starts with fresh state (there is no text field to keep mounted).
export default function QuizCard({ S, onSettle, onNext, onQuit }) {
  const q = S.cur, matrix = q.type === 'matrix', multi = !matrix && q.answer.length > 1;
  // Options are shown in a new order each time, so their position is not what gets memorised.
  const [order] = useState(() => (matrix ? [] : shuffle(q.options.map((_, i) => i))));
  const [again] = useState(() => S.seen.has(q.id));
  const [sel, setSel] = useState(() => (matrix ? q.rows.map(() => -1) : []));
  const [res, setRes] = useState(null);   // null until checked, then true | false
  const nextBtn = useRef(null);
  const ready = complete(q, sel);

  function check() {
    if (res !== null || !ready) return;
    const ok = grade(q, sel);
    setRes(ok); onSettle(ok);
    setTimeout(() => nextBtn.current && nextBtn.current.focus({ preventScroll: true }), 20);
  }
  function tap(i) {
    if (res !== null) return;
    setSel(s => (s.includes(i) ? s.filter(x => x !== i) : multi ? (s.length < q.answer.length ? [...s, i] : s) : [i]));
  }
  function tapRow(r, c) { if (res === null) setSel(s => s.map((x, k) => (k === r ? c : x))); }

  useEffect(() => {
    const onKey = e => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (e.key === 'Enter' && tag !== 'BUTTON' && tag !== 'A') { e.preventDefault(); res === null ? check() : onNext(); }
      else if (!matrix && res === null && /^[1-9]$/.test(e.key) && +e.key <= order.length) tap(order[+e.key - 1]);
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });

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

      <div className="sheet plain" lang="en">
        {again && <span className="badge" lang="bg">повторение</span>}
        <p className="qtext">{q.q}</p>
      </div>
      <p className="hint">{matrix ? 'Избор на отговор за всеки ред.' : multi ? `Избор на ${q.answer.length} отговора.` : 'Избор на един отговор.'}</p>

      <div className="answer" lang="en">
        {matrix ? (
          <div className="mrows">
            {q.rows.map((row, r) => (
              <div key={r} className={'mrow' + (res === null ? '' : sel[r] === q.answer[r] ? ' ok' : ' bad')}>
                <p>{row}</p>
                <div className="mchoices" role="radiogroup" aria-label={row}>
                  {q.choices.map((c, k) => (
                    <button key={k} type="button" role="radio" aria-checked={sel[r] === k} disabled={res !== null} onClick={() => tapRow(r, k)}
                      className={'mchoice' + (res === null ? (sel[r] === k ? ' on' : '') : q.answer[r] === k ? ' ok' : sel[r] === k ? ' bad' : '')}>{c}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="opts long" role={multi ? 'group' : 'radiogroup'} aria-label="Отговори">
            {order.map((i, pos) => {
              const on = sel.includes(i);
              return (
                <button key={i} type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={on} disabled={res !== null} onClick={() => tap(i)}
                  className={'opt ' + (res === null ? (on ? 'on' : '') : q.answer.includes(i) ? 'ok' : on ? 'bad' : '')}>
                  <span className="k">{pos + 1}</span><span>{q.options[i]}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {res === null && <button className="primary nextbtn" disabled={!ready} onClick={check}>Проверка</button>}
      {res !== null && (
        <div className={'fb ' + (res ? 'ok' : 'bad')}>
          <b>{res ? 'Вярно.' : 'Грешно. Верният отговор е отбелязан в зелено.'}</b>
          {q.why && <span className="note" lang="en">{q.why}</span>}
          {q.note && <span className="note" lang="en">{q.note}</span>}
          {KEY_NOTE[q.key] && <span className="note">{KEY_NOTE[q.key]}</span>}
          {q.ref && <a className="note" href={q.ref} target="_blank" rel="noreferrer">Източник</a>}
        </div>
      )}
      {res !== null && <button ref={nextBtn} className="primary nextbtn" onClick={onNext}>Напред</button>}
    </section>
  );
}
