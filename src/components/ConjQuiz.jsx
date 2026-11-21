import { useEffect, useMemo, useRef, useState } from 'react';
import { checkConj, conjOptions, formShown } from '../lib/conj.js';
import { prepare } from '../lib/audio.js';
import { Icon, Spk } from './ui.jsx';
import Pic from './Pic.jsx';

const FINE = (() => { try { return matchMedia('(pointer: fine)').matches; } catch (e) { return true; } })();

// The verb's table after answering: singular on the left, plural on the right; the asked form is marked.
function Table({ q }) {
  return (
    <div className="cq-tab" aria-label={`Спрежение на ${q.verb}`}>
      {q.forms.map(f => <span key={f.col} className={f.col === q.person ? 'cur' : ''}>{formShown(f)}</span>)}
    </div>
  );
}

// Conjugation exercise: pronoun + verb ("nous", être) -> the form ("sommes"), chosen from four or typed.
// Not keyed by question: the same input stays mounted, so a phone keyboard does not close between questions.
export default function ConjQuiz({ L, S, facts, mode, retry, autoSpeak, say, abase, ibase, picFor, onSettle, onNext, onQuit }) {
  const q = S.cur, isTest = mode === 'test';
  const opts = useMemo(() => (isTest ? conjOptions(L, q, facts) : null), [S.qid]); // eslint-disable-line react-hooks/exhaustive-deps
  // Decided when the question appears: answering it adds it to S.seen.
  const again = useMemo(() => S.seen.has(q.id), [S.qid]); // eslint-disable-line react-hooks/exhaustive-deps
  const [picked, setPicked] = useState({});
  const [value, setValue] = useState('');
  const [fb, setFb] = useState(null);
  const [hint, setHint] = useState('');
  const [locked, setLocked] = useState(false);
  const st = useRef({ clean: true, locked: false, hint: 0 });
  const inp = useRef(null), nextBtn = useRef(null);

  // A new question: reset during render, so the previous answer and feedback never show with it.
  const [shownQid, setShownQid] = useState(S.qid);
  if (shownQid !== S.qid) {
    setShownQid(S.qid);
    st.current = { clean: true, locked: false, hint: 0 };
    setPicked({}); setValue(''); setFb(null); setHint(''); setLocked(false);
  }
  useEffect(() => {
    prepare(abase, q.full);
    if (!isTest && FINE) try { inp.current && inp.current.focus({ preventScroll: true }); } catch (e) {}
  }, [S.qid]); // eslint-disable-line react-hooks/exhaustive-deps

  // How the answer went, for usage statistics (any accepted variant reported by checkConj is a spelling slip).
  const outcome = warn => (st.current.hint >= q.form.length ? 'shown' : st.current.hint > 0 ? 'hint' : !st.current.clean ? 'wrong' : warn ? 'typo' : 'ok');
  function next() { if (st.current.locked) onNext(); }
  function shake(el) { if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
  // No auto-advance, as in the word exercises: the answer can be read and heard first.
  function focusNext() { if (isTest) setTimeout(() => nextBtn.current && nextBtn.current.focus({ preventScroll: true }), 20); }
  function succeed(warn) {
    st.current.locked = true; setLocked(true);
    const clean = st.current.clean; onSettle(clean, { result: outcome(warn) });
    setFb({ kind: 'ok', clean, warn });
    if (autoSpeak) say(q.full);
    focusNext();
  }

  // ----- choosing -----
  function choose(v) {
    if (st.current.locked || picked[v]) return;
    if (v === opts.right) { setPicked(p => ({ ...p, [v]: 'ok' })); succeed(''); return; }
    st.current.locked = true; setLocked(true);
    setPicked(p => ({ ...p, [v]: 'bad', [opts.right]: 'ok' }));
    onSettle(false, { result: 'wrong', pick: v }); setFb({ kind: 'bad', reveal: true });
    focusNext();
  }

  // ----- typing -----
  function submit(e) {
    e.preventDefault();
    if (st.current.locked) { next(); return; }
    if (!value.trim()) return;
    const r = checkConj(L, q, value);
    if (r.ok) { succeed(r.warn); return; }
    st.current.clean = false;
    setFb({ kind: 'bad', msg: r.msg }); shake(inp.current);
    if (FINE) try { inp.current.select(); } catch (e2) {}
  }
  function giveHint(all) {
    if (st.current.locked) return;
    st.current.clean = false;
    st.current.hint = all ? q.form.length : Math.min(q.form.length, st.current.hint + 1);
    setHint(st.current.hint >= q.form.length ? `Отговор: ${q.shown}. Упражнението продължава след въвеждането му.` : q.form.slice(0, st.current.hint) + ' …');
    if (FINE) try { inp.current.focus({ preventScroll: true }); } catch (e) {}
  }
  function insert(ch) {
    if (st.current.locked) return;
    const el = inp.current, act = el && document.activeElement === el;
    const a = act ? el.selectionStart : value.length, z = act ? el.selectionEnd : a;
    setValue(value.slice(0, a) + ch + value.slice(z));
    setTimeout(() => { try { el.focus({ preventScroll: true }); el.setSelectionRange(a + 1, a + 1); } catch (e) {} }, 0);
  }

  useEffect(() => {
    const onKey = e => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (e.key === 'Enter' && st.current.locked && tag !== 'BUTTON' && tag !== 'INPUT') { e.preventDefault(); next(); }
      else if (/^[1-4]$/.test(e.key) && tag !== 'INPUT' && opts && !st.current.locked) { const v = opts.list[+e.key - 1]; if (v) choose(v); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });

  const done = S.seen.size;
  const extra = fb && (fb.kind === 'ok' || fb.reveal) && <>
    <Table q={q} />
    {fb.warn && <span className="note">{fb.warn}</span>}{q.note && <span className="note">{q.note}</span>}
  </>;
  return (
    <section>
      <div className="qtop">
        <button className="iconbtn" onClick={onQuit} aria-label="Край на упражнението"><Icon name="close" /></button>
        <div className="qprog">
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={S.total} aria-valuenow={done}><i style={{ width: (done / S.total * 100) + '%' }} /></div>
          <div className="qmeta"><span>{done} от {S.total}</span><span className="ok">{S.firstOk} верни от първия опит</span></div>
        </div>
      </div>

      <div className="sheet">
        <Pic base={ibase} file={picFor(q.verb)} className="qpic" />
        {again && <span className="badge">повторение</span>}
        <div className="big">{q.label} <span className="blank" aria-label="форма на глагола" /></div>
        <div className="sub"><b className="cq-verb">{q.verb}</b>{q.bg ? ` (${q.bg})` : ''}, сегашно време</div>
      </div>

      <div className="answer">
        {isTest ? (
          <div className="opts">
            {opts.list.map((x, i) => (
              <button key={x} type="button" disabled={locked || !!picked[x]} onClick={() => choose(x)} className={['opt', picked[x] || ''].join(' ')}>
                <span className="k">{i + 1}</span><span>{x}</span>
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={submit} autoComplete="off">
            <div className="inrow">
              <input ref={inp} className={locked ? 'okin' : ''} type="text" value={value} readOnly={locked} autoCapitalize="off" autoCorrect="off" spellCheck="false"
                enterKeyHint={locked ? 'next' : 'done'} onChange={e => { if (!st.current.locked) setValue(e.target.value); }}
                placeholder="форма на глагола" aria-label={`Формата на ${q.verb} за ${q.label}`} />
              <button className="primary" type="submit">{locked ? 'Напред' : 'Проверка'}</button>
            </div>
            {L.keys.length > 0 && <div className="keys">{L.keys.map(k => <button key={k} type="button" disabled={locked} onMouseDown={e => e.preventDefault()} onClick={() => insert(k)}>{k}</button>)}</div>}
            {!locked && (
              <div className="helpers">
                <button className="ghost" type="button" onClick={() => giveHint(false)}>Подсказка</button>
                <button className="ghost" type="button" onClick={() => giveHint(true)}>Показване на отговора</button>
              </div>
            )}
            {hint && !locked && <div className="hinttxt">{hint}</div>}
          </form>
        )}
      </div>

      {fb && fb.kind === 'ok' && (
        <div className="fb ok">
          <div className="fbtxt">
            <b>{fb.clean ? 'Вярно.' : retry ? 'Вярно, но с грешка или подсказка. Формата ще се появи пак.' : 'Вярно, но с грешка или подсказка.'}</b> {q.shown}
            {extra}
          </div>
          <Spk onClick={() => say(q.full)} />
        </div>
      )}
      {fb && fb.kind === 'bad' && (
        <div className="fb bad">
          {fb.reveal ? <><div className="fbtxt"><b>Грешно.</b> Вярно е: <b>{q.shown}</b>{extra}</div><Spk onClick={() => say(q.full)} /></> : <b>{fb.msg}</b>}
        </div>
      )}
      {isTest && locked && <button ref={nextBtn} className="primary nextbtn" onClick={next}>Напред</button>}
    </section>
  );
}
