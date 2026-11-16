import { useRef, useState } from 'react';
import { statsPrefix } from '../../lib/quiz.js';
import { Icon, Seg } from '../ui.jsx';
import { isLearned, isWeak } from '../Home.jsx';

const plural = n => (n === 1 ? 'въпрос' : 'въпроса');

// Start screen of a question bank: progress, which questions, how many.
export default function QuizHome({ course, bank, store, update, onStart, toast }) {
  const z = store.quiz, all = bank.questions;
  const setZ = (k, v) => update(n => { n.quiz = { ...n.quiz, [k]: v }; });
  const learned = all.filter(q => isLearned(store.stats[q.id])).length;
  const weak = all.filter(q => isWeak(store.stats[q.id]));
  const pool = z.filter === 'new' ? all.filter(q => !store.stats[q.id]) : z.filter === 'weak' ? weak : all;
  const sizes = course.sizes.map(String);
  const cur = z.size === 'all' || sizes.includes(z.size) ? z.size : sizes[0];
  const size = cur === 'all' ? pool.length : Math.min(pool.length, +cur);
  const [armed, setArmed] = useState(false); const t = useRef(0);
  function reset() {
    if (!armed) { setArmed(true); t.current = setTimeout(() => setArmed(false), 3000); return; }
    clearTimeout(t.current); setArmed(false);
    const p = statsPrefix(course.key);
    update(n => { n.stats = Object.fromEntries(Object.entries(n.stats).filter(([id]) => !id.startsWith(p))); });
    toast('Статистиката за въпросите е нулирана');
  }

  return (
    <section>
      <div className="progress">
        <div className="progress-top">
          <span className="progress-num">{learned} <span>от {all.length} научени</span></span>
          <span className="small">всички въпроси</span>
        </div>
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={all.length} aria-valuenow={learned}><i style={{ width: (all.length ? learned / all.length * 100 : 0) + '%' }} /></div>
        {weak.length > 0 && (
          <div className="weak">
            <span><b>{weak.length}</b> {weak.length === 1 ? 'въпрос често се бърка' : 'въпроса често се бъркат'}</span>
            <button className="small-btn" onClick={() => onStart(weak)}>Упражнение</button>
          </div>
        )}
      </div>

      <div className="section">
        <p className="label">Въпроси</p>
        <Seg label="Въпроси" value={z.filter} onChange={v => setZ('filter', v)} options={[['all', 'Всички'], ['new', 'Нови'], ['weak', 'Грешени']]} />
        <p className="hint">Един опит на въпрос. След проверката се показват верният отговор и обяснение.</p>
      </div>

      <div className="section">
        <p className="label">Брой въпроси</p>
        <Seg label="Брой въпроси" value={cur} onChange={v => setZ('size', v)} options={[...sizes.map(s => [s, s]), ['all', 'Всички']]} />
      </div>

      <details className="more">
        <summary>Още настройки <Icon name="chevron" /></summary>
        <div className="more-body">
          {bank.about && <p className="hint" lang="en">{bank.about}</p>}
          <button className="ghost danger" onClick={reset}>{armed ? 'Повторно натискане за потвърждение' : 'Нулиране на статистиката за въпросите'}</button>
        </div>
      </details>

      <div className="startbar">
        <button className="primary" disabled={!pool.length} onClick={() => onStart()}>
          {pool.length ? `Начало: ${size} ${plural(size)}` : !all.length ? 'Още няма въпроси' : z.filter === 'weak' ? 'Няма грешени въпроси' : 'Няма нови въпроси'}
        </button>
      </div>
    </section>
  );
}
