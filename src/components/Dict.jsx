import { useState } from 'react';
import { Icon } from './ui.jsx';

// raw.githubusercontent.com/OWNER/REPO/BRANCH/path -> github.com edit page for that file
function editLink(url) {
  const m = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/.exec(url);
  return m ? `https://github.com/${m[1]}/${m[2]}/edit/${m[3]}/${m[4]}` : null;
}

export default function Dict({ L, store, update, dict, base, defaultBase, toast, onPull, onCheck }) {
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

  const when = src ? new Date(src.updatedAt).toLocaleString('bg-BG', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <section>
      <h1>Речник</h1>
      <p className="small" style={{ margin: '4px 0 14px' }}>Думите идват от файл в GitHub. Когато файлът се промени, обнови речника тук.</p>
      <div className="panel stack">
        <div className="status">
          <span className="status-ic"><Icon name="book" size={24} /></span>
          <div>
            <div className="status-num">{dict.words.length} думи, {dict.sets.length} {dict.sets.length === 1 ? 'списък' : 'списъка'}</div>
            <div className="note-line">{when ? `Обновен на ${when}` : 'Още не е обновяван; ползва се речникът от приложението.'}</div>
          </div>
        </div>
        <button className="primary" disabled={busy} onClick={pull}>{busy ? 'Обновявам…' : 'Обнови речника'}</button>
        {msg && <p className="note-line" role="status">{msg}</p>}
        {audio && <p className="note-line">{audio}</p>}
        {src && src.problems && src.problems.length > 0 && <details className="small"><summary>Пропуснати редове: {src.problems.length}</summary>{src.problems.map((p, i) => <div key={i}>{p}</div>)}</details>}
      </div>

      <details className="box">
        <summary><Icon name="plus" />Как се добавят думи<Icon name="chevron" /></summary>
        <div className="boxbody">
          <p>Думите на {L.adj}и са във файла <code>{L.code}/words.csv</code>. Добави ред, запази и натисни „Обнови речника“. Не е нужна нова версия на приложението.</p>
          {edit && <a className="ghost btnlink" href={edit} target="_blank" rel="noopener">Отвори {L.code}/words.csv в GitHub</a>}
          <p>Пример: <code>{L.exampleRow}</code></p>
          <ul>
            <li><b>set</b>: дата и име, напр. <code>2026-12 Декември</code>. Най-новата дата става „Последни“.</li>
            <li><b>article</b>: {L.articles.length ? L.articles.join(', ') + ' или празно' : 'празно; в английския няма упражнение за член'}.</li>
            <li><b>bulgarian</b>: верните отговори, разделени с <code>;</code>. Първият се показва.</li>
            <li><b>type</b>: n съществително, v глагол, a прилагателно, o друго.</li>
            <li><b>alt</b>: други верни думи на {L.adj}и, напр. <code>{L.exampleAlt}</code>.</li>
          </ul>
          <p>Записите на новите думи се правят автоматично за 1–2 минути след промяната. После обнови още веднъж, за да ги изтеглиш.</p>
          <p>Нов език се включва във файла <code>languages.json</code> с <code>"active": true</code>, след като в неговия файл има думи.</p>
          {editConf && <a className="ghost btnlink" href={editConf} target="_blank" rel="noopener">Отвори languages.json в GitHub</a>}
        </div>
      </details>

      <details className="box">
        <summary><Icon name="sync" />Адрес на речника<Icon name="chevron" /></summary>
        <div className="form">
          <p className="small">Папката, от която се изтеглят думите и записите. Променя се само ако речникът е преместен.</p>
          <input value={url} onChange={e => setUrl(e.target.value)} inputMode="url" autoCapitalize="off" spellCheck="false" aria-label="Папка на речника" />
          <div className="row">
            <button className="ghost" onClick={() => saveBase(url)}>Запази адреса</button>
            <button className="ghost" onClick={() => saveBase(defaultBase)}>Върни стандартния</button>
          </div>
        </div>
      </details>
    </section>
  );
}
