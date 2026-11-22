import { useState } from 'react';
import { Pair } from './Quiz.jsx';
import { fmtTime } from '../lib/math.js';
import Confetti from './Confetti.jsx';
import { NewAwards } from './Awards.jsx';

// A finished round in which every answer was right the first time: no mistake, no hint, nothing repeated.
export const isPerfect = S => !S.early && S.total > 0 && S.seen.size === S.total && S.firstOk === S.total && S.missed.size === 0;

// Gold medal on a ribbon: pops in, swings on the ribbon, a shine crosses it, small stars twinkle around it.
function Medal() {
  return (
    <div className="medal-wrap" role="img" aria-label="Медал">
      <svg className="medal" width="148" height="160" viewBox="0 0 148 160" aria-hidden="true">
        <defs><clipPath id="medal-face"><circle cx="74" cy="100" r="50" /></clipPath></defs>
        <path d="M46 4H70L84 56H60Z" fill="#2747D0" /><path d="M102 4H78L64 56H88Z" fill="#DC2626" />
        <circle cx="74" cy="100" r="50" fill="#E3A21A" /><circle cx="74" cy="100" r="41" fill="#FFC83D" />
        <path d="M74 72L82.2 88.6L100.5 91.3L87.3 104.2L90.4 122.4L74 113.8L57.6 122.4L60.7 104.2L47.5 91.3L65.8 88.6Z" fill="#FFF4CC" />
        <g clipPath="url(#medal-face)"><rect className="medal-shine" x="10" y="40" width="18" height="130" fill="#FFFFFF" opacity=".55" transform="rotate(25 74 100)" /></g>
      </svg>
      {[[6, 30, 0], [128, 22, .5], [14, 120, 1], [134, 104, .25], [70, 6, .75]].map(([x, y, d], i) => (
        <svg key={i} className="twinkle" style={{ left: x, top: y, animationDelay: `${.6 + d}s` }} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 0L9.8 6.2L16 8L9.8 9.8L8 16L6.2 9.8L0 8L6.2 6.2Z" fill="#FFC83D" />
        </svg>
      ))}
    </div>
  );
}

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

// news: achievements earned in this round (or outside rounds since the last one), listed after the score.
export default function Result({ S, item, news = [], onAgain, onMissed, onHome, onAwards }) {
  const answered = S.seen.size, pct = answered ? Math.round(S.firstOk / answered * 100) : 0;
  const missed = [...S.missed.values()];
  const perfect = isPerfect(S);
  const [party, setParty] = useState(perfect);
  return (
    <section>
      <div className="res">
        {perfect ? <>
          <Medal />
          <h1>Без нито една грешка</h1>
          <p className="perfect-sub center">Отличен кръг: {S.total} от {S.total} верни от първия опит</p>
        </> : <>
          <Ring pct={pct} />
          <h1>{pct === 100 ? 'Всичко вярно' : pct >= 80 ? 'Много добре' : pct >= 50 ? 'Добре' : 'Има какво да се упражнява'}</h1>
          <p className="muted center">{S.firstOk} от {answered} верни от първия опит{S.early && answered < S.total ? `; спряно при ${answered} от ${S.total}` : ''}</p>
        </>}
        {S.startedAt > 0 && S.finishedAt > 0 && <p className="small center">Време: {fmtTime(S.finishedAt - S.startedAt)}</p>}
      </div>
      {party && <Confetti pieces={240} onDone={() => setParty(false)} />}
      {news.length > 0 && <NewAwards list={news} />}
      {missed.length > 0 && <>
        <h2>За повторение: {missed.length}</h2>
        <div className="wlist miss">{missed.map(w => <div key={w.id}>{item ? <b>{item(w)}</b> : <Pair w={w} />}</div>)}</div>
      </>}
      <div className="stack" style={{ marginTop: 20 }}>
        {missed.length > 0 && <button className="primary" onClick={() => onMissed(missed.map(w => w.id))}>Упражнение на грешените ({missed.length})</button>}
        <button className={missed.length ? 'ghost' : 'primary'} onClick={onAgain}>Нов кръг</button>
        {news.length > 0 && <button className="ghost ach-ghost" onClick={onAwards}>Към наградите</button>}
        <button className="ghost" onClick={onHome}>Към началото</button>
      </div>
    </section>
  );
}
