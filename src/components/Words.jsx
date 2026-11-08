import { useState, useRef } from 'react';
import { Art } from './Quiz.jsx';
import { ARTS, full } from '../lib/dictionary.js';
import { nde } from '../lib/match.js';

const q = v => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
const guessType = (art, de) => (art ? 'n' : de[0] && de[0] !== de[0].toLowerCase() ? 'n' : /n$/.test(de) ? 'v' : 'o');

function SetPicker({ sets, value, onChange, name, onName }) {
  return <>
    <select value={value} onChange={e => onChange(e.target.value)} aria-label="Списък">
      {sets.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
      <option value="__new">+ Нов списък…</option>
    </select>
    {value === '__new' && <input value={name} onChange={e => onName(e.target.value)} placeholder="име на новия списък, напр. Декември" />}
  </>;
}

// Two-tap confirmation instead of confirm(), which some browsers block.
function TwoStep({ label, className, onConfirm }) {
  const [armed, setArmed] = useState(false); const t = useRef(0);
  return <button className={className} onClick={() => {
    if (!armed) { setArmed(true); t.current = setTimeout(() => setArmed(false), 3000); return; }
    clearTimeout(t.current); setArmed(false); onConfirm();
  }}>{armed ? 'Натисни отново за потвърждение' : label}</button>;
}

export default function Words({ store, update, sets, words, toast, onBack }) {
  const latest = sets[0] ? sets[0].id : '__new';
  const [fSet, setFSet] = useState(latest), [fSetName, setFSetName] = useState('');
  const [bSet, setBSet] = useState(latest), [bSetName, setBSetName] = useState('');
  const [art, setArt] = useState(''), [de, setDe] = useState(''), [bg, setBg] = useState(''), [type, setType] = useState('n');
  const [bulk, setBulk] = useState('');

  function pickSet(v, name, clearName) {
    if (v !== '__new') return v;
    const n = name.trim(); if (!n) { toast('Въведи име на новия списък'); return null; }
    const ex = sets.find(x => x.name.toLowerCase() === n.toLowerCase()); if (ex) return ex.id;
    const d = new Date(), id = d.toISOString().slice(0, 16);
    update(s => { s.userSets = [...s.userSets, { id, name: n }]; });
    clearName(''); return id;
  }
  function addWords(list, set) {
    let ok = 0, dup = 0;
    const add = [];
    list.forEach(x => {
      const id = set + '|' + (x.art ? x.art + ' ' : '') + x.de;
      if (words.some(w => w.id === id) || add.some(w => w.id === id)) { dup++; return; }
      add.push({ id, set, art: x.art, de: x.de, bg: x.bg, type: x.type, pl: '', alt: [], note: '' }); ok++;
    });
    if (add.length) update(s => { s.userWords = [...s.userWords, ...add]; });
    return { ok, dup };
  }
  function addOne() {
    const b = bg.split(/[,;]/).map(x => x.trim()).filter(Boolean);
    if (!de.trim() || !b.length) { toast('Попълни немската и българската дума'); return; }
    const set = pickSet(fSet, fSetName, setFSetName); if (!set) return;
    if (fSet === '__new') setFSet(set);
    const r = addWords([{ art, de: de.trim(), bg: b, type }], set);
    if (r.ok) { toast('Добавена'); setDe(''); setBg(''); setArt(''); } else toast('Тази дума вече е в този списък');
  }
  function addBulk() {
    if (!bulk.trim()) return;
    const set = pickSet(bSet, bSetName, setBSetName); if (!set) return;
    if (bSet === '__new') setBSet(set);
    let bad = 0; const list = [];
    bulk.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
      const parts = line.split(/\s*(?:=|\t|\s[–—-]\s)\s*/);
      if (parts.length < 2) { bad++; return; }
      let left = parts[0].trim(), a = '';
      const m = /^(der|die|das)\s+(.+)$/i.exec(left); if (m) { a = m[1].toLowerCase(); left = m[2]; }
      const b = parts.slice(1).join(',').split(/[,;]/).map(x => x.trim()).filter(Boolean);
      if (!left || !b.length) { bad++; return; }
      list.push({ art: a, de: left, bg: b, type: guessType(a, left) });
    });
    const r = addWords(list, set);
    toast(`Добавени: ${r.ok}` + (r.dup ? `, повторени: ${r.dup}` : '') + (bad ? `, неразпознати редове: ${bad}` : ''));
    if (r.ok) setBulk('');
  }
  async function copyCsv() {
    // Words added in the app, as rows for dictionary/words.csv, so they can move into the shared dictionary.
    const name = id => (sets.find(x => x.id === id) || {}).name || id;
    const rows = store.userWords.map(w => [/^\d/.test(w.set) ? `${w.set.slice(0, 7)} ${name(w.set)}` : name(w.set), w.art, w.de, w.bg.join('; '), w.type, '', '', ''].map(q).join(','));
    const extra = Object.entries(store.extra).filter(([, x]) => x.bg.length || x.alt.length);
    const txt = rows.join('\n') + (extra.length ? '\n\n# Добавени синоними:\n' + extra.map(([id, x]) => `${id}: ${[...x.bg, ...x.alt].join('; ')}`).join('\n') : '');
    if (!txt.trim()) { toast('Няма добавени думи или синоними'); return; }
    try { await navigator.clipboard.writeText(txt); toast('Копирано'); } catch (e) { setBulk(txt); toast('Копирането е блокирано. Текстът е в полето по-долу.'); }
  }

  const on = words.filter(w => w.on).length;
  return (
    <section>
      <header><h1>Думи</h1><button className="link" onClick={onBack}>← Назад</button></header>
      <p className="small">{words.length} думи, {on} включени. Изключените не участват в упражненията. Думите от речника се променят в речника; тук може да ги изключиш.</p>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="ghost" onClick={() => update(s => { s.off = {}; })}>Включи всички</button>
        <button className="ghost" onClick={() => update(s => { s.off = Object.fromEntries(words.map(w => [w.id, true])); })}>Изключи всички</button>
      </div>
      <div className="card wlist">
        {sets.map(x => {
          const g = words.filter(w => w.set === x.id); if (!g.length) return null;
          return <div key={x.id}>
            <div className="sethead">{x.name} · {g.length}</div>
            {g.map(w => { const st = store.stats[w.id]; return (
              <div key={w.id} className={'wrow' + (w.on ? '' : ' off')}>
                <input type="checkbox" checked={w.on} aria-label="включена" onChange={e => update(s => { const o = { ...s.off }; if (e.target.checked) delete o[w.id]; else o[w.id] = true; s.off = o; })} />
                <div><div className="de"><Art w={w} />{w.de}{w.pl && <span className="bg pl"> · мн. ч. {w.pl}</span>}{w.user && <span className="tag">мое</span>}</div><div className="bg">{w.bg.join(', ')}</div></div>
                <span className="st">{st ? `✓${st.c} ✗${st.w}` : ''}</span>
                {w.user ? <button className="del" aria-label="изтрий" onClick={() => { update(s => { s.userWords = s.userWords.filter(u => u.id !== w.id); const n = { ...s.stats }; delete n[w.id]; s.stats = n; }); toast(`Изтрита: ${full(w)}`); }}>×</button> : <span />}
              </div>); })}
          </div>;
        })}
      </div>

      <h2>Добави дума</h2>
      <div className="card form">
        <SetPicker sets={sets} value={fSet} onChange={setFSet} name={fSetName} onName={setFSetName} />
        <div className="row">
          <select value={art} onChange={e => { setArt(e.target.value); if (e.target.value) setType('n'); }} style={{ flex: '0 0 96px' }} aria-label="Член">
            <option value="">—</option>{ARTS.map(a => <option key={a}>{a}</option>)}
          </select>
          <input value={de} onChange={e => setDe(e.target.value)} placeholder="немски, напр. Hund" autoCapitalize="off" />
        </div>
        <input value={bg} onChange={e => setBg(e.target.value)} placeholder="български, напр. куче (няколко със запетая)" />
        <select value={type} onChange={e => setType(e.target.value)} aria-label="Вид дума">
          <option value="n">съществително</option><option value="v">глагол</option><option value="a">прилагателно / наречие</option><option value="o">друга дума</option>
        </select>
        <button className="primary" onClick={addOne}>Добави</button>
      </div>

      <h2>Добави много наведнъж</h2>
      <div className="card form">
        <p className="small" style={{ margin: 0 }}>По една дума на ред: <b>der Hund = куче</b>, <b>laufen = тичам, бягам</b>.</p>
        <SetPicker sets={sets} value={bSet} onChange={setBSet} name={bSetName} onName={setBSetName} />
        <textarea value={bulk} onChange={e => setBulk(e.target.value)} placeholder={'der Hund = куче\ndie Katze = котка\nlaufen = тичам, бягам'} />
        <button className="primary" onClick={addBulk}>Добави от текста</button>
      </div>

      <h2>Други</h2>
      <div className="stack" style={{ marginTop: 0 }}>
        <button className="ghost" onClick={copyCsv}>Копирай моите думи и синоними (за речника)</button>
        <TwoStep className="ghost" label="Нулирай статистиката" onConfirm={() => { update(s => { s.stats = {}; }); toast('Статистиката е нулирана'); }} />
        <TwoStep className="ghost danger" label="Изтрий моите думи и синоними" onConfirm={() => { update(s => { s.userWords = []; s.userSets = []; s.extra = {}; s.off = {}; }); toast('Изтрити'); }} />
      </div>
    </section>
  );
}
