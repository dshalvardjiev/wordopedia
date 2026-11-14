import { useEffect, useState } from 'react';
import { formText } from '../lib/verbs.js';
import { prepare } from '../lib/audio.js';
import { Icon } from './ui.jsx';

// Conjugation: say the form aloud, then tap to see (and hear) it. Singular on the left, plural on the right, as in the notebook.
export default function Conj({ verbs, abase, say, onClose }) {
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
        <button className="iconbtn" onClick={onClose} aria-label="Затвори спрежението"><Icon name="close" /></button>
        <div className="chips conj-chips" role="tablist" aria-label="Глагол">
          {verbs.map((x, n) => <button key={x.verb} role="tab" aria-selected={n === i} className={'chip' + (n === i ? ' on' : '')} onClick={() => setI(n)}>{x.verb}</button>)}
        </div>
      </div>

      <div className="sheet conj-sheet">
        <div className="big">{v.verb}</div>
        <div className="sub">{v.bg}</div>
        <button type="button" className="spk" onClick={() => say(v.verb)}><Icon name="speaker" size={16} />Чуй</button>
        <div className="conj-grid">
          {cols.map((col, c) => (
            <div key={c} className="conj-col">
              {col.map((f, r) => {
                const k = c * half + r, open = shown.has(k);
                return (
                  <div key={k} className="conj-row">
                    <span className="pron">{f.label}</span>
                    <button type="button" className={'form' + (open ? ' open' : '')} aria-label={open ? `${f.label} ${f.form}, чуй` : `Покажи формата за ${f.label}`}
                      onClick={() => (open ? say(formText(f)) : reveal(k, f))}>{open ? f.form : '?'}</button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="hint center">Кажи формата на глас, после я докосни, за да провериш.</p>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="ghost" onClick={() => setShown(all ? new Set() : new Set(v.forms.map((_, k) => k)))}>{all ? 'Скрий всички' : 'Покажи всички'}</button>
        <button className="primary" onClick={() => setI((i + 1) % verbs.length)}>Следващ глагол</button>
      </div>
    </section>
  );
}
