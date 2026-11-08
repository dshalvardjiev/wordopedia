import { useState } from 'react';
import { parseDictionary, full } from '../lib/dictionary.js';
import { audioBase, prefetchAll } from '../lib/audio.js';

// raw.githubusercontent.com/OWNER/REPO/BRANCH/path -> github.com edit page for that file
function editLink(url) {
  const m = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/.exec(url);
  return m ? `https://github.com/${m[1]}/${m[2]}/edit/${m[3]}/${m[4]}` : null;
}

export default function Dict({ store, update, dict, words, toast, defaultUrl, onBack }) {
  const [url, setUrl] = useState(store.dictUrl);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [audio, setAudio] = useState('');
  const src = store.dict;
  const edit = editLink(store.dictUrl);

  async function pull() {
    setBusy(true); setMsg(''); setAudio('');
    const u = store.dictUrl;
    try {
      const r = await fetch(u + (u.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status === 404 ? 'файлът не е намерен (404)' : 'грешка ' + r.status);
      const text = await r.text();
      const d = parseDictionary(text);
      const before = new Set(dict.words.map(w => w.id)), after = new Set(d.words.map(w => w.id));
      const added = [...after].filter(x => !before.has(x)).length, removed = [...before].filter(x => !after.has(x)).length;
      update(s => { s.dict = { csv: text, url: u, updatedAt: Date.now(), problems: d.problems }; });
      setMsg(`Речникът е обновен: ${d.words.length} думи, ${added} нови, ${removed} премахнати.` + (d.problems.length ? ` Пропуснати редове: ${d.problems.length}.` : ''));
      const b = audioBase(u);
      if (b) {
        const res = await prefetchAll(b, d.words.map(full), (i, n) => setAudio(`Записи: ${i} от ${n}…`));
        setAudio(`Записи за офлайн: ${res.have} от ${d.words.length}.` + (res.missing ? ` За ${res.missing} думи няма запис; за тях се ползва гласът на устройството, ако е немски.` : ''));
      }
    } catch (e) {
      setMsg(`Неуспешно обновяване: ${e.message === 'Failed to fetch' || e.name === 'TypeError' ? 'няма връзка или адресът е недостъпен' : e.message}. Остава досегашният речник.`);
    }
    setBusy(false);
  }
  function saveUrl(v) {
    try { new URL(v); } catch (e) { toast('Невалиден адрес'); return; }
    update(s => { s.dictUrl = v; }); setUrl(v); toast('Адресът е запазен. Натисни „Обнови речника“.');
  }

  return (
    <section>
      <header><h1>Речник</h1><button className="link" onClick={onBack}>← Назад</button></header>
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
        <p style={{ margin: 0 }}>Речникът е CSV файл. Промени го и натисни „Обнови речника“. Не е нужно ново издание на приложението.</p>
        {edit && <a className="ghost btnlink" href={edit} target="_blank" rel="noopener">Редактирай файла в GitHub</a>}
        <p style={{ margin: 0 }}>Колони: <code>set, article, german, bulgarian, type, plural, alt, note</code></p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li><b>set</b>: дата и име, напр. <code>2026-12 Декември</code>. Най-новата дата е „Последни“.</li>
          <li><b>bulgarian</b>: верните отговори, разделени с <code>;</code>. Първият се показва.</li>
          <li><b>type</b>: n съществително, v глагол, a прилагателно, o друго.</li>
          <li><b>alt</b>: други верни немски думи, напр. <code>das Bild</code>.</li>
        </ul>
        <p style={{ margin: 0 }}>Пример: <code>2026-12 Декември,der,Hund,куче; кученце,n,die Hunde,,</code></p>
        <p style={{ margin: 0 }}>Записите се търсят в папка <code>audio/</code> до файла. За нови думи GitHub ги създава автоматично за 1–2 минути след промяна на файла; после натисни „Обнови речника“ още веднъж.</p>
      </div>

      <h2>Адрес на речника</h2>
      <div className="card form">
        <input value={url} onChange={e => setUrl(e.target.value)} inputMode="url" autoCapitalize="off" spellCheck="false" aria-label="Адрес на речника" />
        <div className="row">
          <button className="ghost" onClick={() => saveUrl(url.trim())}>Запази</button>
          <button className="ghost" onClick={() => saveUrl(defaultUrl)}>По подразбиране</button>
        </div>
        <p className="small" style={{ margin: 0 }}>Може да е и публикувана като CSV Google таблица със същите колони.</p>
      </div>
    </section>
  );
}
