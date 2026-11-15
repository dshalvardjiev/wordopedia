import { useState } from 'react';
import { Icon } from './ui.jsx';
import { CourseIcon } from './Chrome.jsx';

// First start: which of this instance's courses to practise. For languages, Bulgarian is always the other side.
export default function LangPick({ courses, counts, onPick, onCheck, toast }) {
  const [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true);
    try {
      toast('Налични курсове: ' + ((await onCheck()).join(', ') || 'няма'));
    } catch (e) { toast('Неуспешна проверка: ' + e.message); }
    setBusy(false);
  }
  return (
    <section>
      <div className="hero">
        <h1>Wordopedia</h1>
        <p>Избор на курс. При езиците отговорите са на български.</p>
      </div>
      <div className="langs">
        {courses.map(c => (
          <button key={c.key} className="langcard" disabled={!c.active} onClick={() => onPick(c.key)}>
            <CourseIcon c={c} size={40} />
            <span><b>{c.title}</b><span className="small">{c.sub}</span></span>
            {c.kind !== 'math' && <span className="meta">{c.active ? (counts[c.key] ? `${counts[c.key]} думи` : 'за изтегляне') : <span className="soon">скоро</span>}</span>}
          </button>
        ))}
        {!courses.length && <p className="empty">Тук още няма курсове.</p>}
      </div>
      <button className="link wide" style={{ marginTop: 18, display: 'flex', justifyContent: 'center', gap: 8 }} disabled={busy} onClick={check}>
        <Icon name="sync" size={18} />{busy ? 'Проверка…' : 'Проверка за нови курсове'}
      </button>
    </section>
  );
}
