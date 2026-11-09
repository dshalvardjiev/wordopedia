import { useState } from 'react';

// raw.githubusercontent.com/OWNER/REPO/BRANCH/path -> github.com edit page for that file
function editLink(url) {
  const m = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/.exec(url);
  return m ? `https://github.com/${m[1]}/${m[2]}/edit/${m[3]}/${m[4]}` : null;
}

export default function Dict({ L, store, update, dict, base, defaultBase, toast, onPull, onCheck, onBack }) {
  const [url, setUrl] = useState(base);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [audio, setAudio] = useState('');
  const src = store.dicts[L.code];
  const edit = editLink(base + L.code + '/words.csv'), editConf = editLink(base + 'languages.json');

  async function pull() {
    setBusy(true); setMsg(''); setAudio('');
    try { await onCheck(); } catch (e) { /* languages.json is optional for an update of the words */ }
    try {
      const r = await onPull(L.code, (i, n) => setAudio(`Записи: ${i} от ${n}…`));
      const n = r.parsed.words.length;
      setMsg(`Речникът е обновен: ${n} думи, ${r.added} нови, ${r.removed} премахнати.` + (r.parsed.problems.length ? ` Пропуснати редове: ${r.parsed.problems.length}.` : ''));
      setAudio(n ? `Записи за офлайн: ${r.audio.have} от ${n}.` + (r.audio.missing ? ` За ${r.audio.missing} думи още няма запис; тогава се ползва гласът на устройството, ако е ${L.adj}и.` : '') : '');
    } catch (e) {
      setMsg(`Неуспешно обновяване: ${e.message}. Остава досегашният речник.`); setAudio('');
    }
    setBusy(false);
  }
  function saveBase(v) {
    let u = v.trim(); if (u && !u.endsWith('/')) u += '/';
    try { new URL(u); } catch (e) { toast('Невалиден адрес'); return; }
    update(s => { s.dictBase = u === defaultBase ? null : u; }); setUrl(u); toast('Адресът е запазен. Натисни „Обнови речника“.');
  }

  return (
    <section>
      <header><h1>Речник: {L.name.toLowerCase()}</h1><button className="link" onClick={onBack}>← Назад</button></header>
      <div className="card form">
        <p style={{ margin: 0 }}><b>{dict.words.length} думи</b> в {dict.sets.length} списъка.<br />
          <span className="small">{src ? `Обновен на ${new Date(src.updatedAt).toLocaleString('bg-BG')}` : 'Ползва се речникът, вграден в приложението.'}</span></p>
        <button className="primary" disabled={busy} onClick={pull}>{busy ? 'Обновяване…' : 'Обнови речника'}</button>
        {msg && <p className="small" style={{ margin: 0 }}>{msg}</p>}
        {audio && <p className="small" style={{ margin: 0 }}>{audio}</p>}
        {src && src.problems && src.problems.length > 0 && <details className="small"><summary>Пропуснати редове ({src.problems.length})</summary>{src.problems.map((p, i) => <div key={i}>{p}</div>)}</details>}
      </div>

      <h2>Как се променя речникът</h2>
      <div className="card form small">
        <p style={{ margin: 0 }}>Думите за всеки език са във файл <code>{L.code}/words.csv</code>. Промени го и натисни „Обнови речника“. Не е нужно ново издание на приложението.</p>
        {edit && <a className="ghost btnlink" href={edit} target="_blank" rel="noopener">Редактирай {L.code}/words.csv в GitHub</a>}
        <p style={{ margin: 0 }}>Колони: <code>set, article, german (или foreign), bulgarian, type, plural, alt, note</code></p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li><b>set</b>: дата и име, напр. <code>2026-12 Декември</code>. Най-новата дата е „Последни“.</li>
          <li><b>article</b>: {L.articles.length ? L.articles.join(', ') + ' или празно' : 'празно (английският няма член в упражненията)'}.</li>
          <li><b>bulgarian</b>: верните отговори, разделени с <code>;</code>. Първият се показва.</li>
          <li><b>type</b>: n съществително, v глагол, a прилагателно, o друго.</li>
          <li><b>alt</b>: други верни думи на {L.adj}и, напр. <code>{L.exampleAlt}</code>.</li>
        </ul>
        <p style={{ margin: 0 }}>Пример: <code>{L.exampleRow}</code></p>
        <p style={{ margin: 0 }}>Записите за нови думи GitHub създава автоматично за 1–2 минути след промяна на файла; после натисни „Обнови речника“ още веднъж.</p>
        <p style={{ margin: 0 }}>Нов език се включва в <code>languages.json</code> („active“: true), след като в неговия файл има думи.</p>
        {editConf && <a className="ghost btnlink" href={editConf} target="_blank" rel="noopener">Редактирай languages.json в GitHub</a>}
      </div>

      <h2>Папка на речника</h2>
      <div className="card form">
        <input value={url} onChange={e => setUrl(e.target.value)} inputMode="url" autoCapitalize="off" spellCheck="false" aria-label="Папка на речника" />
        <div className="row">
          <button className="ghost" onClick={() => saveBase(url)}>Запази</button>
          <button className="ghost" onClick={() => saveBase(defaultBase)}>По подразбиране</button>
        </div>
      </div>
    </section>
  );
}
