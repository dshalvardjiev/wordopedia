import { useState, useRef } from 'react';
import { Art } from './Quiz.jsx';
import { Icon } from './ui.jsx';
import { nbg } from '../lib/match.js';
import { norm } from '../lib/langs.js';
import { full, guessType } from '../lib/dictionary.js';
import { splitArticle, joinArt } from '../lib/langs.js';

const q = v => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);

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

export default function Words({ L, store, update, sets, words, toast }) {
  const mine = id => id.startsWith(L.code + ':');
  const latest = sets[0] ? sets[0].id : '__new';
  const [fSet, setFSet] = useState(latest), [fSetName, setFSetName] = useState('');
  const [bSet, setBSet] = useState(latest), [bSetName, setBSetName] = useState('');
  const [art, setArt] = useState(''), [de, setDe] = useState(''), [bg, setBg] = useState(''), [type, setType] = useState('n');
  const [bulk, setBulk] = useState('');
  const [q, setQ] = useState('');

  function pickSet(v, name, clearName) {
    if (v !== '__new') return v;
    const n = name.trim(); if (!n) { toast('Въведи име на новия списък'); return null; }
    const ex = sets.find(x => x.name.toLowerCase() === n.toLowerCase()); if (ex) return ex.id;
    const d = new Date(), id = d.toISOString().slice(0, 16);
    update(s => { s.userSets = [...s.userSets, { id, name: n, lang: L.code }]; });
    clearName(''); return id;
  }
  function addWords(list, set) {
    let ok = 0, dup = 0;
    const add = [];
    list.forEach(x => {
      const id = L.code + ':' + set + '|' + joinArt(x.art, x.de);
      if (words.some(w => w.id === id) || add.some(w => w.id === id)) { dup++; return; }
      add.push({ id, lang: L.code, set, art: x.art, de: x.de, bg: x.bg, type: x.type, pl: '', alt: [], note: '' }); ok++;
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
      const sp = L.articles.length ? splitArticle(L, parts[0]) : { art: '', word: parts[0].trim() };
      const a = sp.art, left = sp.word;
      const b = parts.slice(1).join(',').split(/[,;]/).map(x => x.trim()).filter(Boolean);
      if (!left || !b.length) { bad++; return; }
      list.push({ art: a, de: left, bg: b, type: guessType(L, a, left) });
    });
    const r = addWords(list, set);
    toast(`Добавени: ${r.ok}` + (r.dup ? `, повторени: ${r.dup}` : '') + (bad ? `, неразпознати редове: ${bad}` : ''));
    if (r.ok) setBulk('');
  }
  async function copyCsv() {
    // Words added in the app, as rows for dictionary/words.csv, so they can move into the shared dictionary.
    const name = id => (sets.find(x => x.id === id) || {}).name || id;
    const rows = store.userWords.filter(w => w.lang === L.code).map(w => [/^\d/.test(w.set) ? `${w.set.slice(0, 7)} ${name(w.set)}` : name(w.set), w.art, w.de, w.bg.join('; '), w.type, '', '', ''].map(q).join(','));
    const extra = Object.entries(store.extra).filter(([id, x]) => mine(id) && (x.bg.length || x.alt.length));
    const txt = rows.join('\n') + (extra.length ? '\n\n# Добавени синоними:\n' + extra.map(([id, x]) => `${id}: ${[...x.bg, ...x.alt].join('; ')}`).join('\n') : '');
    if (!txt.trim()) { toast('Няма добавени думи или синоними'); return; }
    try { await navigator.clipboard.writeText(txt); toast('Копирано'); } catch (e) { setBulk(txt); toast('Копирането е блокирано. Текстът е в полето по-долу.'); }
  }

  const on = words.filter(w => w.on).length;
  // Search matches the foreign word (without accents) or any Bulgarian answer.
  const qq = q.trim();
  const match = w => !qq || norm(L, w.de).includes(norm(L, qq)) || w.bg.some(b => nbg(b).includes(nbg(qq)));
  const groups = sets.map(x => ({ x, g: words.filter(w => w.set === x.id && match(w)) })).filter(({ g }) => g.length);
  const toggle = (w, val) => update(s => { const o = { ...s.off }; if (val) delete o[w.id]; else o[w.id] = true; s.off = o; });
  return (
    <section>
      <h1>Думи</h1>
      <p className="small" style={{ margin: '4px 0 14px' }}>{on} от {words.length} участват в упражненията. Махни отметката, за да изключиш дума.</p>
      <div className="search form"><Icon name="search" size={18} /><input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={`Търси на ${L.adj}и или на български`} aria-label="Търсене" /></div>
      <div className="wlist">
        {groups.map(({ x, g }) => (
          <div key={x.id}>
            <div className="sethead"><span>{x.name}</span><span>{g.length}</span></div>
            {g.map(w => { const st = store.stats[w.id]; return (
              <div key={w.id} className={'wrow' + (w.on ? '' : ' off')}>
                <input type="checkbox" checked={w.on} aria-label={`${full(w)} участва в упражненията`} onChange={e => toggle(w, e.target.checked)} />
                <div><div className="de"><Art w={w} />{w.de}{w.pl && <span className="bg pl">, мн. ч. {w.pl}</span>}{w.user && <span className="tag">мое</span>}</div><div className="bg">{w.bg.join(', ')}</div></div>
                <span className="st" title="верни / грешни">{st ? <><span style={{ color: 'var(--ok)' }}>{st.c}</span> / <span style={{ color: 'var(--bad)' }}>{st.w}</span></> : ''}</span>
                {w.user ? <button className="del" aria-label={`Изтрий ${full(w)}`} onClick={() => { update(s => { s.userWords = s.userWords.filter(u => u.id !== w.id); const n = { ...s.stats }; delete n[w.id]; s.stats = n; }); toast(`Изтрита: ${full(w)}`); }}>×</button> : <span />}
              </div>); })}
          </div>
        ))}
        {!groups.length && <p className="empty">{qq ? `Няма дума, която съдържа „${qq}“.` : 'Още няма думи. Добави от речника или по-долу.'}</p>}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="ghost" onClick={() => update(s => { s.off = Object.fromEntries(Object.entries(s.off).filter(([id]) => !mine(id))); })}>Включи всички</button>
        <button className="ghost" onClick={() => update(s => { s.off = { ...s.off, ...Object.fromEntries(words.map(w => [w.id, true])) }; })}>Изключи всички</button>
      </div>

      <details className="box">
        <summary><Icon name="plus" />Добави дума<Icon name="chevron" /></summary>
        <div className="form">
          <SetPicker sets={sets} value={fSet} onChange={setFSet} name={fSetName} onName={setFSetName} />
          <div className="row">
            {L.articles.length > 0 && <select value={art} onChange={e => { setArt(e.target.value); if (e.target.value) setType('n'); }} style={{ flex: '0 0 96px' }} aria-label="Член">
              <option value="">без член</option>{L.articles.map(a => <option key={a}>{a}</option>)}
            </select>}
            <input value={de} onChange={e => setDe(e.target.value)} placeholder={`на ${L.adj}и, напр. ${L.exampleNoun.replace(/^\S+\s|^l'/, '')}`} autoCapitalize="off" aria-label={`Дума на ${L.adj}и`} />
          </div>
          <input value={bg} onChange={e => setBg(e.target.value)} placeholder="на български; няколко със запетая" aria-label="Превод на български" />
          <select value={type} onChange={e => setType(e.target.value)} aria-label="Вид дума">
            <option value="n">съществително</option><option value="v">глагол</option><option value="a">прилагателно / наречие</option><option value="o">друга дума</option>
          </select>
          <button className="primary" onClick={addOne}>Добави думата</button>
        </div>
      </details>

      <details className="box">
        <summary><Icon name="book" />Добави много наведнъж<Icon name="chevron" /></summary>
        <div className="form">
          <p className="small">По една дума на ред, напр. <b>{L.exampleNoun} = …</b></p>
          <SetPicker sets={sets} value={bSet} onChange={setBSet} name={bSetName} onName={setBSetName} />
          <textarea value={bulk} onChange={e => setBulk(e.target.value)} placeholder={`${L.exampleNoun} = …`} aria-label="Думи, по една на ред" />
          <button className="primary" onClick={addBulk}>Добави думите</button>
        </div>
      </details>

      <details className="box">
        <summary><Icon name="repeat" />Още действия<Icon name="chevron" /></summary>
        <div className="boxbody">
          <button className="ghost" onClick={copyCsv}>Копирай моите думи и синоними за речника</button>
          <TwoStep className="ghost" label="Нулирай статистиката" onConfirm={() => { update(s => { s.stats = Object.fromEntries(Object.entries(s.stats).filter(([id]) => !mine(id))); }); toast('Статистиката е нулирана'); }} />
          <TwoStep className="ghost danger" label="Изтрий моите думи и синоними" onConfirm={() => { update(s => {
            s.userWords = s.userWords.filter(w => w.lang !== L.code); s.userSets = s.userSets.filter(x => x.lang !== L.code);
            s.extra = Object.fromEntries(Object.entries(s.extra).filter(([id]) => !mine(id))); }); toast('Изтрити'); }} />
        </div>
      </details>
    </section>
  );
}
