import { useEffect, useState } from 'react';
import { formText } from '../lib/verbs.js';
import Pic from './Pic.jsx';
import { prepare } from '../lib/audio.js';
import { Icon, Spk } from './ui.jsx';

// Conjugation: say the form aloud, then tap to see (and hear) it. Singular on the left, plural on the right, as in the notebook.
// hear: a tap on the speaker (counted for the listening achievements); say: playback the learner did not ask for.
export default function Conj({ verbs, abase, say, hear, ibase, picFor, onClose }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(() => new Set());
  const v = verbs[i];
  useEffect(() => { setShown(new Set()); v.forms.forEach(f => prepare(abase, formText(f))); prepare(abase, v.verb); }, [i]); // eslint-disable-line
  const reveal = (k, f) => { setShown(s => new Set(s).add(k)); say(formText(f)); };
  const all = shown.size === v.forms.length;
  const half = Math.ceil(v.forms.length / 2);
  const cols = [v.forms.slice(0, half), v.forms.slice(half)];

  return (
    <section>
      <div className="qtop">
        <button className="iconbtn" onClick={onClose} aria-label="Затваряне на спрежението"><Icon name="close" /></button>
        <div className="chips conj-chips" role="tablist" aria-label="Глагол">
          {verbs.map((x, n) => <button key={x.verb} role="tab" aria-selected={n === i} className={'chip' + (n === i ? ' on' : '')} onClick={() => setI(n)}>{x.verb}</button>)}
        </div>
      </div>

      <div className="sheet conj-sheet">
        <Pic base={ibase} file={picFor(v.verb)} className="qpic" />
        <div className="big">{v.verb}</div>
        <div className="sub">{v.bg}</div>
        <Spk onClick={() => hear(v.verb)} />
        <div className="conj-grid">
          {cols.map((col, c) => (
            <div key={c} className="conj-col">
              {col.map((f, r) => {
                const k = c * half + r, open = shown.has(k);
                return (
                  <div key={k} className="conj-row">
                    <span className="pron">{f.label}</span>
                    <button type="button" className={'cform' + (open ? ' open' : '')} aria-label={open ? `${f.label} ${f.form}, слушане` : `Показване на формата за ${f.label}`}
                      onClick={() => (open ? say(formText(f)) : reveal(k, f))}>{open ? f.form : '?'}</button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="hint center">Формата се казва на глас и се проверява с докосване.</p>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="ghost" onClick={() => setShown(all ? new Set() : new Set(v.forms.map((_, k) => k)))}>{all ? 'Скриване на всички' : 'Показване на всички'}</button>
        <button className="primary" onClick={() => setI((i + 1) % verbs.length)}>Следващ глагол</button>
      </div>
    </section>
  );
}
