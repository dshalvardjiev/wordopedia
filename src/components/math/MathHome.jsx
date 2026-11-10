import { useRef, useState } from 'react';
import { TESTS } from '../../lib/math.js';
import { Icon, Seg } from '../ui.jsx';
import { isLearned, isWeak } from '../Home.jsx';

export default function MathHome({ store, update, onStart, toast }) {
  const m = store.math, T = TESTS[m.test];
  const setM = (k, v) => update(n => { n.math = { ...n.math, [k]: v }; });
  const facts = T.facts(m.tables);
  const learned = facts.filter(f => isLearned(store.stats[f.id])).length;
  const weak = facts.filter(f => isWeak(store.stats[f.id]));
  const all = Array.from({ length: 12 }, (_, i) => i + 1);
  const toggle = t => setM('tables', m.tables.includes(t) ? m.tables.filter(x => x !== t) : [...m.tables, t].sort((a, b) => a - b));
  const size = m.size === 'all' ? facts.length : Math.min(facts.length, +m.size);
  const [armed, setArmed] = useState(false); const t = useRef(0);
  function reset() {
    if (!armed) { setArmed(true); t.current = setTimeout(() => setArmed(false), 3000); return; }
    clearTimeout(t.current); setArmed(false);
    update(n => { n.stats = Object.fromEntries(Object.entries(n.stats).filter(([id]) => !id.startsWith('math:' + m.test + ':'))); });
    toast('Статистиката за таблицата е нулирана');
  }

  return (
    <section>
      <div className="progress">
        <div className="progress-top">
          <span className="progress-num">{learned} <span>от {facts.length} научени</span></span>
          <span className="small">{m.tables.length === 12 ? 'всички таблици' : `${m.tables.length} ${m.tables.length === 1 ? 'таблица' : 'таблици'}`}</span>
        </div>
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={facts.length} aria-valuenow={learned}><i style={{ width: (facts.length ? learned / facts.length * 100 : 0) + '%' }} /></div>
        {weak.length > 0 && (
          <div className="weak">
            <span><b>{weak.length}</b> {weak.length === 1 ? 'пример често се бърка' : 'примера често се бъркат'}</span>
            <button className="small-btn" onClick={() => onStart(weak)}>Упражни ги</button>
          </div>
        )}
      </div>

      <div className="section">
        <p className="label">Тест</p>
        <div className="tiles">
          <button className="tile on" aria-pressed="true"><span className="tile-big">7 × 8</span><span className="tile-sub">{T.short}</span></button>
        </div>
      </div>

      <div className="section">
        <div className="label-row"><p className="label">Таблици</p>
          <button className="link" onClick={() => setM('tables', m.tables.length === 12 ? [] : all)}>{m.tables.length === 12 ? 'Махни всички' : 'Избери всички'}</button></div>
        <div className="numgrid" role="group" aria-label="Таблици за умножение">
          {all.map(n => <button key={n} className={'num' + (m.tables.includes(n) ? ' on' : '')} aria-pressed={m.tables.includes(n)} onClick={() => toggle(n)}>{n}</button>)}
        </div>
        <p className="hint">Например 7 означава 7 × 1 до 7 × 12.</p>
      </div>

      <div className="section">
        <p className="label">Ред</p>
        <Seg label="Ред" value={m.order} onChange={v => setM('order', v)} options={[['mixed', 'Разбъркано'], ['seq', 'Подред']]} />
      </div>

      <details className="more">
        <summary>Още настройки <Icon name="chevron" /></summary>
        <div className="more-body">
          <div>
            <p className="label">Брой въпроси</p>
            <Seg label="Брой въпроси" value={m.size} onChange={v => setM('size', v)} options={[['10', '10'], ['20', '20'], ['all', 'Всички']]} />
          </div>
          <button className="ghost danger" onClick={reset}>{armed ? 'Натисни отново за потвърждение' : 'Нулирай статистиката за таблицата'}</button>
        </div>
      </details>

      <div className="startbar">
        <button className="primary" disabled={!facts.length} onClick={() => onStart()}>
          {facts.length ? `Започни: ${size} ${size === 1 ? 'пример' : 'примера'}` : 'Избери поне една таблица'}
        </button>
      </div>
    </section>
  );
}
