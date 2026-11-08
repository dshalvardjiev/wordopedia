import { useEffect, useRef, useState } from 'react';
import { full } from '../lib/dictionary.js';
import { evaluate, options } from '../lib/match.js';
import { prepare } from '../lib/audio.js';

const TYPE = { n: 'съществително', v: 'глагол', a: 'прилагателно / наречие', o: 'друга дума' };
const FINE = (() => { try { return matchMedia('(pointer: fine)').matches; } catch (e) { return true; } })();

export const Art = ({ w }) => (w.art ? <><span className={'a-' + w.art}>{w.art}</span> </> : null);
export function Pair({ w }) {
  const l = w.bg.map(x => x.replace(/\s*\(.*?\)/g, '')).filter((x, i, a) => a.indexOf(x) === i);
  return <><Art w={w} /><b>{w.de}</b>{w.pl ? <span className="pl"> (мн. ч. {w.pl})</span> : null} = {l.slice(0, 5).join(', ')}{l.length > 5 ? ', …' : ''}</>;
}
const Spk = ({ onClick }) => (
  <button type="button" className="spk" onClick={onClick}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></svg> Чуй
  </button>
);
const DeLabel = ({ text }) => { const m = /^(der|die|das) (.+)$/.exec(text); return m ? <><span className={'a-' + m[1]}>{m[1]}</span> {m[2]}</> : text; };

export default function Quiz({ S, settings, words, say, base, onSettle, onNext, onQuit, onAcceptOwn }) {
  const w = S.cur, dir = settings.dir, isTest = settings.mode === 'test' || dir === 'art';
  const [opts] = useState(() => (isTest ? options(w, dir, words) : null));
  const [picked, setPicked] = useState({});
  const [locked, setLocked] = useState(false);
  const [fb, setFb] = useState(null);           // {kind:'ok'|'bad', ...}
  const [value, setValue] = useState('');
  const [hint, setHint] = useState('');
  const [shake, setShake] = useState(0);
  const st = useRef({ clean: true, cleanBefore: undefined, lastWrong: '', hint: 0, locked: false });
  const inp = useRef(null), nextBtn = useRef(null), timer = useRef(0);
  // The auto-advance timer must not outlive this question (e.g. after "Край").
  useEffect(() => () => clearTimeout(timer.current), []);
  const again = S.seen.has(w.id);
  const answerText = dir === 'de-bg' ? w.bg[0] : full(w);

  useEffect(() => { prepare(base, full(w)); if (dir === 'de-bg' && settings.autoSpeak) say(full(w)); }, []); // eslint-disable-line
  useEffect(() => { if (!isTest && FINE && inp.current) inp.current.focus(); }, []); // eslint-disable-line
  // Restart the shake animation on the same element; never re-create the field, or a phone keyboard would close.
  useEffect(() => { const el = inp.current; if (!shake || !el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }, [shake]);

  function goNext() { if (st.current.locked) { clearTimeout(timer.current); onNext(); } }
  function lock() { st.current.locked = true; setLocked(true); }
  function showOk(warn, clean) {
    setFb({ kind: 'ok', clean, warn });
    if (settings.autoSpeak && dir !== 'de-bg') say(full(w));
    if (settings.mode === 'test' && clean) { timer.current = setTimeout(() => onNext(), 1000); }
    else setTimeout(() => nextBtn.current && nextBtn.current.focus({ preventScroll: true }), 20);
  }

  // ----- multiple choice and article buttons -----
  function choose(v) {
    if (st.current.locked || picked[v]) return;
    if (v === opts.right) {
      setPicked(p => ({ ...p, [v]: 'ok' })); lock();
      const clean = st.current.clean; onSettle(clean); showOk('', clean);
    } else if (settings.mode === 'test') {
      setPicked(p => ({ ...p, [v]: 'bad', [opts.right]: 'ok' })); lock();
      onSettle(false); setFb({ kind: 'bad', reveal: true });
      setTimeout(() => nextBtn.current && nextBtn.current.focus({ preventScroll: true }), 20);
    } else {
      st.current.clean = false;
      setPicked(p => ({ ...p, [v]: 'bad' })); setFb({ kind: 'bad', msg: 'Не е вярно. Опитай пак.' }); setShake(x => x + 1);
    }
  }

  // ----- typed answers -----
  function succeed(r) { lock(); const clean = st.current.clean; onSettle(clean); showOk(r.warn, clean); }
  function check(e) {
    e && e.preventDefault();
    if (st.current.locked) { goNext(); return; }
    if (!value.trim()) return;
    const r = evaluate(w, value, dir, settings.reqArt, words);
    if (r.ok) { succeed(r); return; }
    st.current.cleanBefore = st.current.clean; st.current.lastWrong = value; st.current.clean = false;
    setFb({ kind: 'bad', msg: r.msg, own: r.own }); setShake(x => x + 1);
    if (FINE && inp.current) inp.current.select();
  }
  function acceptOwn() {
    const v = st.current.lastWrong.trim().replace(/\s+/g, ' ');
    let val = v;
    if (dir === 'bg-de') {
      const m = /^(der|die|das)\s+(.+)$/i.exec(v);
      if (w.type === 'n' && !m) { setFb({ kind: 'bad', msg: 'Напиши синонима с члена, напр. „das Bild“, и натисни отново „Провери“.' }); return; }
      if (m) val = m[1].toLowerCase() + ' ' + m[2];
    }
    onAcceptOwn(w, val);
    st.current.clean = st.current.cleanBefore;
    succeed({ warn: `„${val}“ е добавен като верен отговор за тази дума.` });
  }
  function giveHint(all) {
    if (st.current.locked) return;
    st.current.clean = false; st.current.cleanBefore = false;
    st.current.hint = all ? answerText.length : Math.min(answerText.length, st.current.hint + 1);
    setHint(st.current.hint >= answerText.length ? `Отговор: ${answerText}. Напиши го, за да продължиш.` : answerText.slice(0, st.current.hint) + ' …');
    if (FINE && inp.current) inp.current.focus();
  }
  function insert(ch) {
    if (st.current.locked) return;
    const el = inp.current, a = el && document.activeElement === el ? el.selectionStart : value.length, z = el && document.activeElement === el ? el.selectionEnd : a;
    const nv = value.slice(0, a) + ch + value.slice(z); setValue(nv);
    setTimeout(() => { try { el.focus({ preventScroll: true }); el.setSelectionRange(a + 1, a + 1); } catch (e) {} }, 0);
  }

  useEffect(() => {
    const onKey = e => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (e.key === 'Enter' && st.current.locked && tag !== 'BUTTON' && tag !== 'INPUT') { e.preventDefault(); goNext(); }
      else if (/^[1-4]$/.test(e.key) && tag !== 'INPUT' && opts && !st.current.locked) { const v = opts.list[+e.key - 1]; if (v) choose(v); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });

  const done = S.seen.size;
  return (
    <section>
      <div className="qtop">
        <button className="link" onClick={onQuit}>← Край</button>
        <div className="prog"><div className="bar"><i style={{ width: (done / S.total * 100) + '%' }} /></div><span>{done} / {S.total}</span></div>
        <span className="score">✓ {S.firstOk}</span>
      </div>

      <div className="card prompt">
        {again && <span className="badge">повторение</span>}
        {dir === 'de-bg' && <><div className="big"><Art w={w} />{w.de}</div><div className="sub">{TYPE[w.type]}</div><Spk onClick={() => say(full(w))} /></>}
        {dir === 'bg-de' && <><div className="big">{w.bg[0]}</div><div className="sub">{TYPE[w.type]}{w.type === 'n' && w.art && settings.reqArt && settings.mode === 'open' ? ' · напиши го с члена' : ''}</div></>}
        {dir === 'art' && <><div className="big"><span className="blank">___</span> {w.de}</div><div className="sub">{w.bg[0]}</div></>}
      </div>

      <div className="answer">
        {isTest ? (
          <div className={'opts' + (dir === 'art' ? ' arts' : '')}>
            {opts.list.map((x, i) => (
              <button key={x} type="button" disabled={locked || !!picked[x]} onClick={() => choose(x)}
                className={['opt', dir === 'art' ? 'a-' + x : '', picked[x] || '', picked[x] === 'bad' && shake ? 'shake' : ''].join(' ')}>
                <span className="k">{i + 1}</span><span>{dir === 'bg-de' ? <DeLabel text={x} /> : x}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <form className="inrow" onSubmit={check} autoComplete="off">
              <input ref={inp} className={locked ? 'okin' : ''} type="text" value={value} readOnly={locked}
                onChange={e => setValue(e.target.value)} placeholder={dir === 'bg-de' ? 'напр. der Hund' : 'отговор на български'} aria-label="Отговор" />
              {!locked && <button className="primary" type="submit">Провери</button>}
            </form>
            {dir === 'bg-de' && <div className="keys">{['ä', 'ö', 'ü', 'ß'].map(k => <button key={k} type="button" disabled={locked} onMouseDown={e => e.preventDefault()} onClick={() => insert(k)}>{k}</button>)}</div>}
            <div className="helpers">
              <button className="ghost" type="button" disabled={locked} onClick={() => giveHint(false)}>Подсказка</button>
              <button className="ghost" type="button" disabled={locked} onClick={() => giveHint(true)}>Покажи отговора</button>
            </div>
            {hint && <div className="hint">{hint}</div>}
          </>
        )}
      </div>

      {fb && fb.kind === 'ok' && (
        <div className="fb ok">
          <b>{fb.clean ? 'Вярно.' : settings.retry ? 'Вярно, но с грешка или подсказка. Думата ще се появи пак.' : 'Вярно, но с грешка или подсказка.'}</b><br />
          <Pair w={w} />{fb.warn && <span className="note">{fb.warn}</span>}{w.note && <span className="note">{w.note}</span>}
          {dir !== 'de-bg' && <Spk onClick={() => say(full(w))} />}
        </div>
      )}
      {fb && fb.kind === 'bad' && (
        <div className="fb bad">
          {fb.reveal ? <><b>Грешно.</b> Вярно е:<br /><Pair w={w} />{w.note && <span className="note">{w.note}</span>}{dir !== 'de-bg' && <Spk onClick={() => say(full(w))} />}</>
            : <><b>{fb.msg}</b>{fb.own && <button type="button" className="ghost own" onClick={acceptOwn}>{dir === 'bg-de' ? 'Приеми моя отговор (верен немски синоним)' : 'Приеми моя отговор (верен синоним)'}</button>}</>}
        </div>
      )}
      {locked && <button ref={nextBtn} className="primary wide nextbtn" onClick={goNext}>Напред →</button>}
    </section>
  );
}
