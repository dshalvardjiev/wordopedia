import { useState } from 'react';
import { LANGS, LANG_ORDER } from '../lib/langs.js';
import { Flag, Icon, MathBadge } from './ui.jsx';
import { MATH } from '../lib/math.js';

// First start: which language to practise. Bulgarian is always the other side.
export default function LangPick({ conf, counts, onPick, onCheck, toast }) {
  const [busy, setBusy] = useState(false);
  const active = c => !!(conf.languages.find(l => l.code === c) || {}).active;
  async function check() {
    setBusy(true);
    try {
      const c = await onCheck();
      const on = LANG_ORDER.filter(x => (c.languages.find(l => l.code === x) || {}).active).map(x => LANGS[x].name);
      toast('Налични езици: ' + on.join(', '));
    } catch (e) { toast('Неуспешна проверка: ' + e.message); }
    setBusy(false);
  }
  return (
    <section>
      <div className="hero">
        <h1>Wordopedia</h1>
        <p>Какво ще упражняваш? При езиците отговорите са на български.</p>
      </div>
      <div className="langs">
        {LANG_ORDER.map(c => {
          const L = LANGS[c], on = active(c);
          return (
            <button key={c} className="langcard" disabled={!on} onClick={() => onPick(c)}>
              <Flag code={c} size={40} />
              <span><b>{L.name}</b><span className="small">{L.native}</span></span>
              <span className="meta">{on ? (counts[c] ? `${counts[c]} думи` : 'изтегли думите') : <span className="soon">скоро</span>}</span>
            </button>
          );
        })}
        <button className="langcard" onClick={() => onPick(MATH)}>
          <MathBadge size={40} />
          <span><b>Математика</b><span className="small">Таблица за умножение до 12</span></span>
        </button>
      </div>
      <button className="link wide" style={{ marginTop: 18, display: 'flex', justifyContent: 'center', gap: 8 }} disabled={busy} onClick={check}>
        <Icon name="sync" size={18} />{busy ? 'Проверявам…' : 'Провери за нови езици'}
      </button>
    </section>
  );
}
