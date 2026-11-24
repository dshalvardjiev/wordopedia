import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CATS, TIERS, LOCKED, BY_ID, visibleAch, progress, closest, nextInSeries, fmtDay, streakNow, tableFacts } from '../lib/ach.js';
import { Icon } from './ui.jsx';

// ----- medal -----
// Shape carries the tier: bronze circle, silver double ring, gold rosette, diamond hexagon, secret dashed circle with
// "?" until earned. Earned medals hang on the blue and red ribbons of the round medal; locked ones are grey with a padlock.
const CX = 32, CY = 28, R = 26;
const pts = (n, r, f) => 'M' + Array.from({ length: n }, (_, i) => { const [a, rr] = f(i); return `${(CX + rr * Math.cos(a)).toFixed(2)},${(CY + rr * Math.sin(a)).toFixed(2)}`; }).join('L') + 'Z';
const ROSETTE = pts(28, R + 1, i => [Math.PI * i / 14 - Math.PI / 2, i % 2 ? (R + 1) * 0.88 : R + 1]);
const HEXAGON = pts(6, R + 1.5, i => [Math.PI / 3 * i - Math.PI / 2, R + 1.5]);
const EMOJI_FONT = "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
const INK2 = '#5A6782';

function AchMedal({ e, on, size = 64 }) {
  const fid = 'ach-gs' + useId().replace(/:/g, '');
  const t = e.tier, T = on ? TIERS[t] : LOCKED;
  const secret = t === 'x' && !on;
  const grey = on ? {} : { filter: `url(#${fid})`, opacity: 0.45 };
  const mt = /^mt-\d+$/.exec(e.id) && e.id.slice(3);
  let mid;
  if (secret) mid = <text x={CX} y={CY + 1} textAnchor="middle" dominantBaseline="central" fontSize="24" fontWeight="900" fill={INK2}>?</text>;
  else if (mt) mid = <text x={CX} y={CY + 1} textAnchor="middle" dominantBaseline="central" fontSize={mt.length === 1 ? 19 : 16} fontWeight="900" fill={T.text}><tspan fontSize="13" dy="-1">×</tspan><tspan dy="1">{mt}</tspan></text>;
  else if (e.id === 'art-perfect') mid = <g {...grey}><circle cx={CX - 9} cy={CY} r="4.6" fill="#2563EB" /><circle cx={CX} cy={CY} r="4.6" fill="#DC2626" /><circle cx={CX + 9} cy={CY} r="4.6" fill="#15803D" /></g>;
  else mid = <text x={CX} y={CY + 1.5} textAnchor="middle" dominantBaseline="central" fontFamily={EMOJI_FONT} fontSize="22" {...grey}>{e.emoji}</text>;
  return (
    <svg className="ach-medal" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {!on && <defs><filter id={fid}><feColorMatrix type="saturate" values="0" /></filter></defs>}
      {!on && <ellipse cx={CX} cy={CY + R + 3} rx={R - 6} ry="2.5" fill="#1B2A4A" opacity=".10" />}
      {on && <><path d="M20 42L14 62l6.5-3.5L25 63l5-17z" fill="#2747D0" /><path d="M44 42l6 20-6.5-3.5L39 63l-5-17z" fill="#DC2626" /></>}
      {t === 'g' ? <path d={ROSETTE} fill={T.ring} />
        : t === 'p' ? <path d={HEXAGON} fill={T.ring} stroke={T.ring} strokeWidth="2" strokeLinejoin="round" />
        : secret ? <circle cx={CX} cy={CY} r={R - 1} fill="#FFFFFF" stroke={T.ring} strokeWidth="2.5" strokeDasharray="4.5 3.5" />
        : <circle cx={CX} cy={CY} r={R} fill={T.ring} />}
      {!secret && <circle cx={CX} cy={CY} r={R - 5.5} fill={T.fill} />}
      {!secret && t === 's' && <circle cx={CX} cy={CY} r={R - 2.8} fill="none" stroke="#FFFFFF" strokeWidth="1" opacity=".7" />}
      {on && <path d={`M${CX - 14} ${CY - 6}a15 15 0 0 1 10-9`} fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" opacity=".85" />}
      {mid}
      {!on && t !== 'x' && <><circle cx="50" cy="46" r="8" fill="#FFFFFF" stroke="#D9E1EF" strokeWidth="1.5" />
        <path d="M46.5 45.5h7v5h-7zM48 45.5v-1.8a2 2 0 0 1 4 0v1.8" fill="none" stroke={INK2} strokeWidth="1.6" strokeLinejoin="round" /></>}
    </svg>
  );
}

const secretLocked = (e, earned) => e.tier === 'x' && !earned[e.id];
const nameOf = (e, earned) => (secretLocked(e, earned) ? 'Тайна награда' : e.name);
const Bar = ({ p }) => (
  <div className="bar ach-bar" role="progressbar" aria-valuemin={0} aria-valuemax={p.b} aria-valuenow={p.a}><i style={{ width: (p.a / p.b * 100) + '%' }} /></div>
);
const progText = p => `${p.a} от ${p.b}${p.unit ? ' ' + p.unit : ''}`;
const days = n => `${n} ${n === 1 ? 'ден' : 'дни'}`;

// New achievements on the result screen, after the round.
export function NewAwards({ list }) {
  return (
    <>
      <h2>{list.length === 1 ? 'Нова награда' : 'Нови награди'}</h2>
      <div className="ach-news">
        {list.map(e => (
          <div key={e.id} className="ach-new">
            <AchMedal e={e} on size={56} />
            <div className="ach-txt"><b>{e.name}</b><span className="small">{e.cond}</span></div>
            <span className="ach-pill">Нова</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ----- detail sheet -----
function Sheet({ e, x, D, earned, vis, onClose }) {
  const close = useRef(null);
  useEffect(() => {
    const back = document.activeElement;
    close.current && close.current.focus({ preventScroll: true });
    const esc = ev => { if (ev.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('keydown', esc); try { back && back.focus({ preventScroll: true }); } catch (err) { /* gone */ } };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const on = !!earned[e.id], secret = secretLocked(e, earned), T = TIERS[e.tier];
  const p = !on && !secret ? progress(e, x, D) : null;
  const nx = on ? nextInSeries(e.id, vis, earned) : null;
  const np = nx && progress(nx, x, D);
  const mt = !on && /^mt-\d+$/.test(e.id) ? tableFacts(+e.id.slice(3), D.stats) : null;
  return (
    <div className="ach-scrim" onClick={ev => { if (ev.target === ev.currentTarget) onClose(); }}>
      <section className="ach-sheet" role="dialog" aria-modal="true" aria-labelledby="ach-sheet-title">
        <div className="ach-grip" aria-hidden="true" />
        <AchMedal e={e} on={on} size={132} />
        <span className="ach-chip" style={{ color: T.text, background: T.fill }}>{T.name} · {e.cat}</span>
        <h1 id="ach-sheet-title">{nameOf(e, earned)}</h1>
        <p className="ach-cond">{secret ? 'Тайните награди се разкриват след получаване.' : e.cond}</p>
        {on && <p className="ach-date">Получена на {fmtDay(earned[e.id])}</p>}
        {p && p.b > 1 && <div className="ach-prog"><Bar p={p} /><span>{progText(p)}{mt ? ` · остават ${p.b - p.a}` : ''}</span></div>}
        {p && p.b === 1 && <p className="small">Още не е получена.</p>}
        {!p && !on && !secret && <p className="small">Получава се в един кръг.</p>}
        {mt && <div className="ach-facts">{mt.map(f => <span key={f.id} className={f.ok ? 'ok' : ''}>{e.id.slice(3)} × {f.b}</span>)}</div>}
        {nx && (
          <div className="ach-nextcard">
            <AchMedal e={nx} on={false} size={44} />
            <div className="ach-txt">
              <span className="small">Следваща в поредицата</span>
              <b>{nx.name}</b>
              {np && np.b > 1 && <><Bar p={np} /><span className="ach-pen">{progText(np)}</span></>}
              {(!np || np.b === 1) && <span className="small">{nx.cond}</span>}
            </div>
          </div>
        )}
        <button ref={close} className="primary ach-close" onClick={onClose}>Затваряне</button>
      </section>
    </div>
  );
}

// ----- first opening: achievements granted from earlier progress -----
function Retro({ ids, onGo, onLater }) {
  const list = ids.map(id => BY_ID[id]).filter(Boolean);
  const shown = list.slice(0, 12), rest = list.length - shown.length;
  return (
    <div className="ach-retro">
      <div className="ach-retro-in">
        <span className="ach-tag">Нов раздел</span>
        <h1>Награди за досегашната работа</h1>
        <p className="muted center">Вече научените думи, верните отговори и спреженията носят {list.length} {list.length === 1 ? 'награда' : 'награди'}.</p>
        <div className="ach-retro-grid">{shown.map(e => <div key={e.id} title={e.name}><AchMedal e={e} on size={64} /></div>)}</div>
        <p className="muted center ach-retro-more">{rest > 0 ? `И още ${rest} ${rest === 1 ? 'награда' : 'награди'}. ` : ''}Поредиците, бързината и дните се броят от днес.</p>
        <div className="stack ach-retro-btns">
          <button className="primary" onClick={onGo}>Разглеждане на наградите</button>
          <button className="ghost ach-ghost" onClick={onLater}>По-късно</button>
        </div>
      </div>
    </div>
  );
}

// ----- the tab -----
// x: the device's courses (achContext), D: {stats, ok, c, now}, A: store.ach.
export default function Awards({ x, D, A, onSeen, onRetroDone, onLater }) {
  const earned = A.earned;
  const vis = useMemo(() => visibleAch(x, earned), [x, earned]);
  // Earned and not opened before: marked "Нова" during this visit, then counted as seen.
  const [fresh] = useState(() => new Set(vis.filter(e => earned[e.id] && !A.seen.includes(e.id)).map(e => e.id)));
  const retro = A.retro && A.retro.length ? A.retro : null;
  const [cat, setCat] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => { if (!retro && fresh.size) onSeen([...fresh]); }, [retro]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { window.scrollTo(0, 0); } catch (e) { /* no window */ } }, [cat]);

  if (retro) return <Retro ids={retro} onGo={onRetroDone} onLater={onLater} />;

  const got = vis.filter(e => earned[e.id]).length;
  const cats = CATS.map(c => ({ ...c, list: vis.filter(e => e.cat === c.name) })).filter(c => c.list.length);
  const sheet = open && <Sheet e={open} x={x} D={D} earned={earned} vis={vis} onClose={() => setOpen(null)} />;

  if (cat) {
    const c = cats.find(k => k.name === cat);
    if (c) {
      const n = c.list.filter(e => earned[e.id]).length;
      const st = c.name === 'Всеки ден' ? streakNow(D.c, D.now) : 0;
      return (
        <section className="ach">
          <div className="ach-head">
            <button className="ach-back" onClick={() => setCat(null)} aria-label="Назад към наградите"><Icon name="back" size={22} /></button>
            <span className="ach-crumb" aria-hidden="true">Награди</span>
          </div>
          <h1 className="ach-h1">{c.name}</h1>
          <p className="ach-sub">{n} от {c.list.length}{st > 0 ? ` · текуща поредица: ${days(st)}` : ''}</p>
          <div className="ach-grid">
            {c.list.map(e => {
              const on = !!earned[e.id], secret = secretLocked(e, earned), p = !on && !secret ? progress(e, x, D) : null;
              const status = on ? `получена на ${fmtDay(earned[e.id])}` : secret ? 'тайна' : p && p.b > 1 ? progText(p) : 'неполучена';
              return (
                <button key={e.id} className="ach-tile" onClick={() => setOpen(e)} aria-label={`${nameOf(e, earned)}, ${status}${fresh.has(e.id) ? ', нова' : ''}`}>
                  {fresh.has(e.id) && <span className="ach-pill ach-corner" aria-hidden="true">Нова</span>}
                  <AchMedal e={e} on={on} size={64} />
                  <span className="ach-name">{nameOf(e, earned)}</span>
                  {on ? <span className="ach-date small">{fmtDay(earned[e.id], false)}</span>
                    : p && p.b > 1 ? <span className="ach-tprog"><Bar p={p} /><span className="small">{progText(p)}</span></span>
                    : <span className="small">{secret ? '?' : 'Предстои'}</span>}
                </button>
              );
            })}
          </div>
          {sheet}
        </section>
      );
    }
  }

  const tiers = ['b', 's', 'g', 'p', 'x'].map(t => ({ t, all: vis.filter(e => e.tier === t).length, on: vis.filter(e => e.tier === t && earned[e.id]).length })).filter(r => r.all);
  const near = closest(vis, x, D, earned);
  const pct = vis.length ? got / vis.length : 0, rr = 40, circ = 2 * Math.PI * rr;
  return (
    <section className="ach">
      <h1 className="ach-h1">Награди</h1>
      <div className="ach-sum">
        <svg width="104" height="104" viewBox="0 0 104 104" role="img" aria-label={`${got} от ${vis.length} награди`} className="ach-ring">
          <circle cx="52" cy="52" r={rr} fill="none" stroke="var(--rule)" strokeWidth="10" />
          {got > 0 && <circle cx="52" cy="52" r={rr} fill="none" stroke="var(--pen)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(pct * circ).toFixed(1)} ${circ.toFixed(1)}`} transform="rotate(-90 52 52)" />}
          <text x="52" y="54" textAnchor="middle" fontSize="28" fontWeight="900" fill="var(--ink)">{got}</text>
          <text x="52" y="72" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--ink-2)">от {vis.length}</text>
        </svg>
        <ul className="ach-tiers">
          {tiers.map(r => (
            <li key={r.t}><AchMedal e={{ id: 'tier-' + r.t, tier: r.t, emoji: '⭐' }} on size={22} /><span>{TIERS[r.t].name}</span><b>{r.on} от {r.all}</b></li>
          ))}
        </ul>
      </div>

      {near.length > 0 && <>
        <h2>Най-близо до получаване</h2>
        <div className="ach-near">
          {near.map(({ e, p }) => (
            <button key={e.id} className="ach-card" onClick={() => setOpen(e)} aria-label={`${e.name}, ${TIERS[e.tier].name}, ${progText(p)}`}>
              <AchMedal e={e} on={false} size={44} />
              <span className="ach-txt">
                <span className="ach-row"><b>{e.name}</b><span className="ach-tiername">{TIERS[e.tier].name}</span></span>
                <span className="small">{e.cond}</span>
                <Bar p={p} />
                <span className="ach-pen">{progText(p)}</span>
              </span>
            </button>
          ))}
        </div>
      </>}

      <h2>Всички награди</h2>
      <div className="ach-cats">
        {cats.map(c => {
          const on = c.list.filter(e => earned[e.id]), nNew = c.list.filter(e => fresh.has(e.id)).length;
          return (
            <button key={c.name} className="ach-cat" onClick={() => setCat(c.name)} aria-label={`${c.name}, ${on.length} от ${c.list.length}${nNew ? `, нови: ${nNew}` : ''}`}>
              <span className="ach-emo" aria-hidden="true">{c.emoji}</span>
              <span className="ach-txt">
                <span className="ach-row"><b>{c.name}</b><span className="ach-n">{nNew > 0 && <span className="ach-pill">{nNew === 1 ? 'Нова' : `Нови: ${nNew}`}</span>}{on.length} от {c.list.length}</span></span>
                {on.length ? <span className="ach-minis">{on.map(e => <AchMedal key={e.id} e={e} on size={24} />)}</span>
                  : <span className="small">Все още няма получени</span>}
              </span>
              <Icon name="next" size={20} />
            </button>
          );
        })}
      </div>
      {cats.some(c => c.name === 'Тайни') && <p className="small center ach-foot">Тайните награди се разкриват след получаване.</p>}
      {sheet}
    </section>
  );
}
