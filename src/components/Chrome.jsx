import { useEffect, useRef, useState } from 'react';
import { Flag, Icon, MathBadge } from './ui.jsx';
import { MATH } from '../lib/math.js';

// Language dropdown: flag + name; inactive languages are listed but cannot be picked.
export function LangMenu({ L, isMath, courses, counts, onPick, onRefresh, toast }) {
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
    setOpen(false); setBusy(true); toast('Обновявам думите…');
    try { toast(await onRefresh()); } catch (e) { toast('Неуспешно обновяване: ' + e.message); }
    setBusy(false);
  }

  return (
    <div className="menu-wrap" ref={ref}>
      <button className="langbtn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {isMath ? <><MathBadge size={26} /><span>Математика</span></> : <><Flag code={L.code} size={26} /><span>{L.title}</span></>}<Icon name="chevron" size={18} />
      </button>
      {open && (
        <div className="menu" role="menu">
          {courses.map(c => (
            <button key={c.key} role="menuitem" className={'menu-item' + (!isMath && c.key === L.key ? ' cur' : '')} disabled={!c.active}
              onClick={() => { setOpen(false); if (isMath || c.key !== L.key) onPick(c.key); }}>
              <Flag code={c.lang} size={28} />
              <span><b>{c.title}</b><span className="small">{c.sub}</span></span>
              <span className="meta">{c.active ? (counts[c.key] ? `${counts[c.key]} думи` : 'изтегли') : 'скоро'}</span>
            </button>
          ))}
          <div className="menu-sep" />
          <button role="menuitem" className={'menu-item' + (isMath ? ' cur' : '')} onClick={() => { setOpen(false); if (!isMath) onPick(MATH); }}>
            <MathBadge size={28} /><span><b>Математика</b><span className="small">Таблица за умножение</span></span>
          </button>
          <div className="menu-sep" />
          <button className="menu-foot" disabled={busy} onClick={check}><Icon name="sync" size={18} />{busy ? 'Обновявам…' : isMath ? 'Провери за нови курсове' : 'Обнови думите'}</button>
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
