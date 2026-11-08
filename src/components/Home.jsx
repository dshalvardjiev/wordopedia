const DIR_DESC = {
  'de-bg': 'Виждаш немската дума и отговаряш на български.',
  'bg-de': 'Виждаш българската дума и отговаряш на немски.',
  art: 'Виждаш съществително и избираш der, die или das.',
};

function Seg({ value, onChange, options, tight }) {
  return (
    <div className={'seg' + (tight ? ' tight' : '')}>
      {options.map(([v, label]) => <button key={v} type="button" className={String(value) === v ? 'active' : ''} onClick={() => onChange(v)}>{label}</button>)}
    </div>
  );
}

export default function Home({ store, update, sets, words, eligibleCount, onStart, onWords, onDict, dict }) {
  const s = store.settings;
  const set = (k, v) => update(n => { n.settings = { ...n.settings, [k]: v }; });
  const cnt = id => words.filter(w => w.on && (!id || w.set === id)).length;
  const latest = sets[0];
  const setValue = s.set === 'all' || s.set === 'latest' || sets.some(x => x.id === s.set) ? s.set : 'all';
  const size = s.size === 'all' ? eligibleCount : Math.min(eligibleCount, +s.size);
  const modeDesc = s.mode === 'test'
    ? (s.dir === 'art' ? 'Един опит. При грешка виждаш верния член и продължаваш.' : 'Четири възможни отговора. При грешка виждаш верния и продължаваш.')
    : (s.dir === 'art' ? 'Избираш, докато уцелиш верния член. Не можеш да продължиш преди това.' : 'Пишеш отговора сам. Не можеш да продължиш, докато не го напишеш вярно.');

  return (
    <section>
      <header>
        <h1>Немски думи</h1>
        <div className="hlinks"><button className="link" onClick={onWords}>Думи</button><button className="link" onClick={onDict}>Речник</button></div>
      </header>

      <div className="field"><div className="lbl">Списък с думи</div>
        <select className="sel" value={setValue} onChange={e => set('set', e.target.value)} aria-label="Списък с думи">
          <option value="all">Всички думи ({cnt(null)})</option>
          {latest && <option value="latest">Последни: {latest.name} ({cnt(latest.id)})</option>}
          {sets.map(x => <option key={x.id} value={x.id}>{x.name} ({cnt(x.id)})</option>)}
        </select>
      </div>

      <div className="field"><div className="lbl">Упражнение</div>
        <Seg value={s.dir} onChange={v => set('dir', v)} options={[['de-bg', 'DE → BG'], ['bg-de', 'BG → DE'], ['art', 'Член']]} />
        <p className="desc">{DIR_DESC[s.dir]}</p>
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
        {s.dir === 'bg-de' && (
          <label className="tog"><span>Изисквай член при BG → DE<br /><span className="small">напр. „der Affe“, не само „Affe“</span></span>
            <input type="checkbox" checked={s.reqArt} onChange={e => set('reqArt', e.target.checked)} /></label>
        )}
        <label className="tog"><span>Повтаряй грешните думи в кръга</span><input type="checkbox" checked={s.retry} onChange={e => set('retry', e.target.checked)} /></label>
        <label className="tog"><span>Произнасяй немската дума автоматично</span><input type="checkbox" checked={s.autoSpeak} onChange={e => set('autoSpeak', e.target.checked)} /></label>
      </div>

      <button className="primary wide" disabled={!eligibleCount} onClick={onStart}>
        {eligibleCount ? `Започни (${size} от ${eligibleCount} думи)` : (s.filter === 'weak' ? 'Още няма грешени думи' : 'Няма думи за тези настройки')}
      </button>
      <p className="small center">{dict ? `Речникът е обновен на ${new Date(dict.updatedAt).toLocaleDateString('bg-BG')}.` : 'Използва се речникът, вграден в приложението.'}</p>
    </section>
  );
}
