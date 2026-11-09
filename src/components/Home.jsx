import { Icon, Seg } from './ui.jsx';

// A word counts as learned after two correct answers and more correct than wrong ones.
export const isLearned = st => !!st && st.c >= 2 && st.c > st.w;
export const isWeak = st => !!st && st.w > 0 && st.w >= st.c;

export default function Home({ L, dir, store, update, sets, words, eligibleCount, setSel, onStart, onPractise }) {
  const s = store.settings;
  const set = (k, v) => update(n => { n.settings = { ...n.settings, [k]: v }; });
  const setSet = v => update(n => { n.setByLang = { ...n.setByLang, [L.code]: v }; });
  const X = L.code.toUpperCase();
  const latest = sets[0];
  const current = setSel === 'all' || setSel === 'latest' || sets.some(x => x.id === setSel) ? setSel : 'all';
  const inSet = id => w => w.on && (!id || w.set === id);
  const scopeId = current === 'latest' ? (latest && latest.id) : current === 'all' ? null : current;
  const scope = words.filter(inSet(scopeId));
  const learned = scope.filter(w => isLearned(store.stats[w.id])).length;
  const weak = scope.filter(w => isWeak(store.stats[w.id]));
  const size = s.size === 'all' ? eligibleCount : Math.min(eligibleCount, +s.size);

  const tiles = [
    ['x-bg', `${X} → BG`, 'превеждаш на български'],
    ['bg-x', `BG → ${X}`, `превеждаш на ${L.adj}и`],
    ...(L.quizArticles.length ? [['art', <span key="a">{L.quizArticles.slice(0, 3).map((a, i) => <span key={a} className={'a-' + a.replace("'", '')}>{i ? ' ' : ''}{a}</span>)}</span>, 'учиш члена']] : []),
  ];
  const modeHint = s.mode === 'test'
    ? (dir === 'art' ? 'Един опит. При грешка виждаш верния член.' : 'Избираш от четири отговора. При грешка виждаш верния.')
    : (dir === 'art' ? 'Опитваш, докато уцелиш верния член.' : 'Пишеш отговора. Продължаваш, когато е верен.');

  return (
    <section>
      <div className="progress">
        <div className="progress-top">
          <span className="progress-num">{learned} <span>от {scope.length} научени</span></span>
          <span className="small">{current === 'all' ? 'всички думи' : current === 'latest' ? (latest ? latest.name : '') : (sets.find(x => x.id === current) || {}).name}</span>
        </div>
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={scope.length} aria-valuenow={learned}><i style={{ width: (scope.length ? learned / scope.length * 100 : 0) + '%' }} /></div>
        {weak.length > 0 && (
          <div className="weak">
            <span><b>{weak.length}</b> {weak.length === 1 ? 'дума често се обърква' : 'думи често се объркват'}</span>
            <button className="small-btn" onClick={() => onPractise(weak.map(w => w.id))}>Упражни ги</button>
          </div>
        )}
      </div>

      <div className="section">
        <p className="label">Списък</p>
        <div className="chips" role="radiogroup" aria-label="Списък с думи">
          <button role="radio" aria-checked={current === 'all'} className={'chip' + (current === 'all' ? ' on' : '')} onClick={() => setSet('all')}>Всички <span className="n">{words.filter(inSet(null)).length}</span></button>
          {latest && <button role="radio" aria-checked={current === 'latest'} className={'chip' + (current === 'latest' ? ' on' : '')} onClick={() => setSet('latest')}>Последни: {latest.name} <span className="n">{words.filter(inSet(latest.id)).length}</span></button>}
          {sets.map(x => <button key={x.id} role="radio" aria-checked={current === x.id} className={'chip' + (current === x.id ? ' on' : '')} onClick={() => setSet(x.id)}>{x.name} <span className="n">{words.filter(inSet(x.id)).length}</span></button>)}
        </div>
      </div>

      <div className="section">
        <p className="label">Упражнение</p>
        <div className="tiles" role="radiogroup" aria-label="Упражнение">
          {tiles.map(([v, big, sub]) => (
            <button key={v} role="radio" aria-checked={dir === v} className={'tile' + (dir === v ? ' on' : '')} onClick={() => set('dir', v)}>
              <span className="tile-big">{big}</span><span className="tile-sub">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <p className="label">Как отговаряш</p>
        <Seg label="Как отговаряш" value={s.mode} onChange={v => set('mode', v)} options={[['test', 'Избираш'], ['open', 'Пишеш']]} />
        <p className="hint">{modeHint}</p>
      </div>

      <details className="more">
        <summary>Още настройки <Icon name="chevron" /></summary>
        <div className="more-body">
          <div>
            <p className="label">Кои думи</p>
            <Seg label="Кои думи" value={s.filter} onChange={v => set('filter', v)} options={[['all', 'Всички'], ['n', 'Същ.'], ['v', 'Глаголи'], ['other', 'Други'], ['weak', 'Грешени']]} />
          </div>
          <div>
            <p className="label">Брой въпроси</p>
            <Seg label="Брой въпроси" value={s.size} onChange={v => set('size', v)} options={[['10', '10'], ['20', '20'], ['all', 'Всички']]} />
          </div>
          <div className="toggles">
            {L.articles.length > 0 && (
              <label className="tog"><span>Член задължителен при BG → {X}<br /><span className="small">„{L.exampleNoun}“, а не само „{L.exampleNoun.replace(/^\S+\s|^l'/, '')}“</span></span>
                <input type="checkbox" checked={s.reqArt} onChange={e => set('reqArt', e.target.checked)} /></label>
            )}
            <label className="tog"><span>Сгрешените думи се връщат в същия кръг</span><input type="checkbox" checked={s.retry} onChange={e => set('retry', e.target.checked)} /></label>
            <label className="tog"><span>Произнасяй думата на {L.adj}и автоматично</span><input type="checkbox" checked={s.autoSpeak} onChange={e => set('autoSpeak', e.target.checked)} /></label>
          </div>
        </div>
      </details>

      <div className="startbar">
        <button className="primary" disabled={!eligibleCount} onClick={onStart}>
          {eligibleCount ? `Започни: ${size} ${size === 1 ? 'дума' : 'думи'}` : (s.filter === 'weak' ? 'Още няма грешени думи' : 'Няма думи с тези настройки')}
        </button>
      </div>
    </section>
  );
}
