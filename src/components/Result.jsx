import { Pair } from './Quiz.jsx';

export default function Result({ S, onAgain, onMissed, onHome }) {
  const answered = S.seen.size, pct = answered ? Math.round(S.firstOk / answered * 100) : 0;
  const missed = [...S.missed.values()];
  return (
    <section>
      <header><h1>Резултат</h1></header>
      <div className="card res">
        <div className="pct">{pct}%</div>
        <div className="det">Верни от първия опит: {S.firstOk} от {answered}{S.early && answered < S.total ? ` (спряно при ${answered} от ${S.total})` : ''}</div>
      </div>
      {missed.length ? <>
        <h2>За повторение ({missed.length})</h2>
        <div className="card wlist miss">{missed.map(w => <div key={w.id}><Pair w={w} /></div>)}</div>
      </> : <p className="desc center">Без грешки.</p>}
      <div className="stack">
        {missed.length > 0 && <button className="primary" onClick={() => onMissed(missed.map(w => w.id))}>Упражни само тези</button>}
        <button className={missed.length ? 'ghost' : 'primary'} onClick={onAgain}>Нов кръг</button>
        <button className="ghost" onClick={onHome}>Начало</button>
      </div>
    </section>
  );
}
