import { useEffect, useRef, useState } from 'react';
import { LANGS, LANG_ORDER } from '../lib/langs.js';
import { Flag, Icon } from './ui.jsx';

// Language dropdown: flag + name; inactive languages are listed but cannot be picked.
export function LangMenu({ L, conf, counts, onPick, onCheck, toast }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const active = c => !!(conf.languages.find(l => l.code === c) || {}).active;
  useEffect(() => {
    if (!open) return;
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
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
    <div className="menu-wrap" ref={ref}>
      <button className="langbtn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <Flag code={L.code} size={26} /><span>{L.name}</span><Icon name="chevron" size={18} />
      </button>
      {open && (
        <div className="menu" role="menu">
          {LANG_ORDER.map(c => {
            const on = active(c);
            return (
              <button key={c} role="menuitem" className={'menu-item' + (c === L.code ? ' cur' : '')} disabled={!on}
                onClick={() => { setOpen(false); if (c !== L.code) onPick(c); }}>
                <Flag code={c} size={28} />
                <span><b>{LANGS[c].name}</b><span className="small">{LANGS[c].native}</span></span>
                <span className="meta">{on ? (counts[c] ? `${counts[c]} думи` : 'изтегли') : 'скоро'}</span>
              </button>
            );
          })}
          <div className="menu-sep" />
          <button className="menu-foot" disabled={busy} onClick={check}><Icon name="sync" size={18} />{busy ? 'Проверявам…' : 'Провери за нови езици'}</button>
        </div>
      )}
    </div>
  );
}

const TABS = [['home', 'pencil', 'Упражнение'], ['words', 'book', 'Думи'], ['dict', 'sync', 'Речник']];
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
