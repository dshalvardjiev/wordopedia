import { useState } from 'react';
import { LANGS, LANG_ORDER } from '../lib/langs.js';

// First screen: the foreign language to practise. Bulgarian is always the other side.
export default function LangPick({ conf, current, counts, onPick, onCheck, toast, onBack }) {
  const [busy, setBusy] = useState(false);
  const active = c => !!(conf.languages.find(l => l.code === c) || {}).active;
  async function check() {
    setBusy(true);
    try {
      const c = await onCheck();
      const on = LANG_ORDER.filter(x => (c.languages.find(l => l.code === x) || {}).active).map(x => LANGS[x].name);
      toast('Активни езици: ' + on.join(', '));
    } catch (e) { toast('Неуспешна проверка: ' + e.message); }
    setBusy(false);
  }
  return (
    <section>
      <header><h1>Wordopedia</h1>{onBack && <button className="link" onClick={onBack}>← Назад</button>}</header>
      <p className="desc" style={{ marginTop: 0 }}>Избери езика, който учиш. Отговорите са на български.</p>
      <div className="langs">
        {LANG_ORDER.map(c => {
          const L = LANGS[c], on = active(c);
          return (
            <button key={c} className={'langcard' + (current === c ? ' cur' : '')} disabled={!on} onClick={() => onPick(c)}>
              <span className="lc-code">{c.toUpperCase()}</span>
              <span className="lc-name"><b>{L.name}</b><span className="small">{L.native} ↔ български</span></span>
              <span className="lc-meta">{on ? (counts[c] ? `${counts[c]} думи` : 'изтегли думи') : 'скоро'}</span>
            </button>
          );
        })}
      </div>
      <button className="ghost wide" style={{ marginTop: 16 }} disabled={busy} onClick={check}>{busy ? 'Проверка…' : 'Провери за нови езици'}</button>
    </section>
  );
}
