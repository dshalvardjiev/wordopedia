import { Pair } from './Quiz.jsx';

function Ring({ pct }) {
  const r = 64, c = 2 * Math.PI * r;
  return (
    <div className="ring" role="img" aria-label={`${pct}% верни от първия опит`}>
      <svg width="148" height="148" viewBox="0 0 148 148">
        <circle cx="74" cy="74" r={r} fill="none" stroke="var(--pen-soft)" strokeWidth="12" />
        <circle cx="74" cy="74" r={r} fill="none" stroke={pct >= 80 ? 'var(--ok)' : 'var(--pen)'} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <span className="pct">{pct}%</span>
    </div>
  );
}

export default function Result({ S, onAgain, onMissed, onHome }) {
  const answered = S.seen.size, pct = answered ? Math.round(S.firstOk / answered * 100) : 0;
  const missed = [...S.missed.values()];
  return (
    <section>
      <div className="res">
        <Ring pct={pct} />
        <h1>{pct === 100 ? 'Всичко вярно' : pct >= 80 ? 'Много добре' : pct >= 50 ? 'Добре' : 'Има какво да се упражнява'}</h1>
        <p className="muted center">{S.firstOk} от {answered} верни от първия опит{S.early && answered < S.total ? `; спряно при ${answered} от ${S.total}` : ''}</p>
      </div>
      {missed.length > 0 && <>
        <h2>За повторение: {missed.length}</h2>
        <div className="wlist miss">{missed.map(w => <div key={w.id}><Pair w={w} /></div>)}</div>
      </>}
      <div className="stack" style={{ marginTop: 20 }}>
        {missed.length > 0 && <button className="primary" onClick={() => onMissed(missed.map(w => w.id))}>Упражни тези {missed.length}</button>}
        <button className={missed.length ? 'ghost' : 'primary'} onClick={onAgain}>Нов кръг</button>
        <button className="ghost" onClick={onHome}>Към началото</button>
      </div>
    </section>
  );
}
