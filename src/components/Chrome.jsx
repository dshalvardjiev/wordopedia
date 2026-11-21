import { useEffect, useRef, useState } from 'react';
import { Flag, Icon, MathBadge } from './ui.jsx';

// Flag of the course's language, or the maths badge.
export const CourseIcon = ({ c, size }) => (c.kind === 'math' ? <MathBadge size={size} /> : <Flag code={c.lang} size={size} />);

// Course dropdown: the instance's courses with flag + title; inactive ones are listed but cannot be picked.
// An instance with a single course lists no courses; the menu then only offers the update.
// stats: the parent's switch for anonymous usage statistics (null when this instance does not collect them).
export function LangMenu({ L, isMath, courses, counts, onPick, onRefresh, toast, stats, onStats }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  async function check() {
    // Close the menu at once; the result arrives as a message.
    setOpen(false); setBusy(true); toast('Обновяване на думите…');
    try { toast(await onRefresh()); } catch (e) { toast('Неуспешно обновяване: ' + e.message); }
    setBusy(false);
  }

  const label = isMath ? <><MathBadge size={26} /><span>{(courses.find(c => c.kind === 'math') || {}).title || 'Математика'}</span></> : <><Flag code={L.code} size={26} /><span>{L.title}</span></>;
  return (
    <div className="menu-wrap" ref={ref}>
      <button className="langbtn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {label}<Icon name="chevron" size={18} />
      </button>
      {open && (
        <div className="menu" role="menu">
          {courses.length > 1 && courses.map(c => {
            const here = c.kind === 'math' ? isMath : !isMath && c.key === L.key;
            return (
              <button key={c.key} role="menuitem" className={'menu-item' + (here ? ' cur' : '')} disabled={!c.active}
                onClick={() => { setOpen(false); if (!here) onPick(c.key); }}>
                <CourseIcon c={c} size={28} />
                <span><b>{c.title}</b><span className="small">{c.sub}</span></span>
                {c.kind !== 'math' && <span className="meta">{c.active ? (counts[c.key] ? `${counts[c.key]} думи` : 'за изтегляне') : 'скоро'}</span>}
              </button>
            );
          })}
          {courses.length > 1 && <div className="menu-sep" />}
          <button className="menu-foot" disabled={busy} onClick={check}><Icon name="sync" size={18} />{busy ? 'Обновяване…' : isMath ? 'Проверка за нови курсове' : 'Обновяване на думите'}</button>
          {stats !== null && stats !== undefined && (
            <label className="menu-tog"><span><b>Анонимна статистика</b><span className="small">Кои думи и упражнения затрудняват, без лични данни</span></span>
              <input type="checkbox" checked={stats} onChange={e => onStats(e.target.checked)} /></label>
          )}
        </div>
      )}
    </div>
  );
}

const TABS = [['home', 'pencil', 'Упражнение'], ['words', 'book', 'Думи']];
export function TabBar({ view, onView }) {
  return (
    <nav className="tabs" aria-label="Раздели">
      <div className="tabs-in">
        {TABS.map(([v, ic, label]) => (
          <button key={v} className={'tab' + (view === v ? ' on' : '')} aria-current={view === v ? 'page' : undefined} onClick={() => onView(v)}>
            <Icon name={ic} size={22} />{label}
          </button>
        ))}
      </div>
    </nav>
  );
}
