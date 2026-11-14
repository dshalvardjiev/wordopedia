import { useState } from 'react';
import { coursesFrom } from '../lib/courses.js';
import { Flag, Icon, MathBadge } from './ui.jsx';
import { MATH } from '../lib/math.js';

// First start: which language to practise. Bulgarian is always the other side.
export default function LangPick({ courses, counts, onPick, onCheck, toast }) {
  const [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true);
    try {
      const c = await onCheck();
      toast('Налични курсове: ' + coursesFrom(c).filter(x => x.active).map(x => x.title).join(', '));
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
        {courses.map(c => (
          <button key={c.key} className="langcard" disabled={!c.active} onClick={() => onPick(c.key)}>
            <Flag code={c.lang} size={40} />
            <span><b>{c.title}</b><span className="small">{c.sub}</span></span>
            <span className="meta">{c.active ? (counts[c.key] ? `${counts[c.key]} думи` : 'изтегли думите') : <span className="soon">скоро</span>}</span>
          </button>
        ))}
        <button className="langcard" onClick={() => onPick(MATH)}>
          <MathBadge size={40} />
          <span><b>Математика</b><span className="small">Таблица за умножение до 12</span></span>
        </button>
      </div>
      <button className="link wide" style={{ marginTop: 18, display: 'flex', justifyContent: 'center', gap: 8 }} disabled={busy} onClick={check}>
        <Icon name="sync" size={18} />{busy ? 'Проверявам…' : 'Провери за нови курсове'}
      </button>
    </section>
  );
}
