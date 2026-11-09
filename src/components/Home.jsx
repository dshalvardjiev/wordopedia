const dirDesc = (L, d) => ({
  'x-bg': `Виждаш ${L.adj}ата дума и отговаряш на български.`,
  'bg-x': `Виждаш българската дума и отговаряш на ${L.adj}и.`,
  art: `Виждаш съществително и избираш ${L.quizArticles.join(', ')}.`,
}[d]);

function Seg({ value, onChange, options, tight }) {
  return (
    <div className={'seg' + (tight ? ' tight' : '')}>
      {options.map(([v, label]) => <button key={v} type="button" className={String(value) === v ? 'active' : ''} onClick={() => onChange(v)}>{label}</button>)}
    </div>
  );
}

export default function Home({ L, dir, store, update, sets, words, eligibleCount, setSel, onStart, onWords, onDict, onLang, dict }) {
  const s = store.settings;
  const set = (k, v) => update(n => { n.settings = { ...n.settings, [k]: v }; });
  const setSet = v => update(n => { n.setByLang = { ...n.setByLang, [L.code]: v }; });
  const X = L.code.toUpperCase();
  const cnt = id => words.filter(w => w.on && (!id || w.set === id)).length;
  const latest = sets[0];
  const setValue = setSel === 'all' || setSel === 'latest' || sets.some(x => x.id === setSel) ? setSel : 'all';
  const size = s.size === 'all' ? eligibleCount : Math.min(eligibleCount, +s.size);
  const modeDesc = s.mode === 'test'
    ? (dir === 'art' ? 'Един опит. При грешка виждаш верния член и продължаваш.' : 'Четири възможни отговора. При грешка виждаш верния и продължаваш.')
    : (dir === 'art' ? 'Избираш, докато уцелиш верния член. Не можеш да продължиш преди това.' : 'Пишеш отговора сам. Не можеш да продължиш, докато не го напишеш вярно.');

  return (
    <section>
      <header>
        <h1>{L.name} думи</h1>
        <div className="hlinks"><button className="link" onClick={onLang}>Език</button><button className="link" onClick={onWords}>Думи</button><button className="link" onClick={onDict}>Речник</button></div>
      </header>

      <div className="field"><div className="lbl">Списък с думи</div>
        <select className="sel" value={setValue} onChange={e => setSet(e.target.value)} aria-label="Списък с думи">
          <option value="all">Всички думи ({cnt(null)})</option>
          {latest && <option value="latest">Последни: {latest.name} ({cnt(latest.id)})</option>}
          {sets.map(x => <option key={x.id} value={x.id}>{x.name} ({cnt(x.id)})</option>)}
        </select>
      </div>

      <div className="field"><div className="lbl">Упражнение</div>
        <Seg value={dir} onChange={v => set('dir', v)} options={[['x-bg', `${X} → BG`], ['bg-x', `BG → ${X}`], ...(L.quizArticles.length ? [['art', 'Член']] : [])]} />
        <p className="desc">{dirDesc(L, dir)}</p>
      </div>

      <div className="field"><div className="lbl">Режим</div>
        <Seg value={s.mode} onChange={v => set('mode', v)} options={[['test', 'Тест (избор)'], ['open', 'Свободен отговор']]} />
        <p className="desc">{modeDesc}</p>
      </div>

      <div className="field"><div className="lbl">Думи</div>
        <Seg tight value={s.filter} onChange={v => set('filter', v)} options={[['all', 'Всички'], ['n', 'Същ.'], ['v', 'Глаголи'], ['other', 'Други'], ['weak', 'Грешени']]} />
      </div>

      <div className="field"><div className="lbl">Брой въпроси</div>
        <Seg value={s.size} onChange={v => set('size', v)} options={[['10', '10'], ['20', '20'], ['all', 'Всички']]} />
      </div>

      <div className="card toggles">
        {dir === 'bg-x' && L.articles.length > 0 && (
          <label className="tog"><span>Изисквай член при BG → {X}<br /><span className="small">напр. „{L.exampleNoun}“, не само „{L.exampleNoun.replace(/^\S+\s|^l'/, '')}“</span></span>
            <input type="checkbox" checked={s.reqArt} onChange={e => set('reqArt', e.target.checked)} /></label>
        )}
        <label className="tog"><span>Повтаряй грешните думи в кръга</span><input type="checkbox" checked={s.retry} onChange={e => set('retry', e.target.checked)} /></label>
        <label className="tog"><span>Произнасяй {L.adj}ата дума автоматично</span><input type="checkbox" checked={s.autoSpeak} onChange={e => set('autoSpeak', e.target.checked)} /></label>
      </div>

      <button className="primary wide" disabled={!eligibleCount} onClick={onStart}>
        {eligibleCount ? `Започни (${size} от ${eligibleCount} думи)` : (s.filter === 'weak' ? 'Още няма грешени думи' : 'Няма думи за тези настройки')}
      </button>
      <p className="small center">{dict ? `Речникът е обновен на ${new Date(dict.updatedAt).toLocaleDateString('bg-BG')}.` : 'Използва се речникът, вграден в приложението.'}</p>
    </section>
  );
}
