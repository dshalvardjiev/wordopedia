import { Flag, Icon, Seg } from './ui.jsx';

// A word counts as learned after two correct answers and more correct than wrong ones.
export const isLearned = st => !!st && st.c >= 2 && st.c > st.w;
export const isWeak = st => !!st && st.w > 0 && st.w >= st.c;

export default function Home({ L, dir, store, update, sets, words, eligibleCount, setSel, verbs = [], onStart, onPractise }) {
  const conj = dir === 'conj';
  const s = store.settings;
  const set = (k, v) => update(n => { n.settings = { ...n.settings, [k]: v }; });
  const setSet = v => update(n => { n.setByLang = { ...n.setByLang, [L.key]: v }; });
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
    // Direction shown with flags; the text form stays as the accessible name.
    ['x-bg', <span key="xb" className="dirflags"><Flag code={L.code} size={30} /><span aria-hidden="true">→</span><Flag code="bg" size={30} /></span>, 'Превод на български', `${X} → BG`],
    ['bg-x', <span key="bx" className="dirflags"><Flag code="bg" size={30} /><span aria-hidden="true">→</span><Flag code={L.code} size={30} /></span>, `Превод на ${L.adj}и`, `BG → ${X}`],
    ...(L.quizArticles.length ? [['art', <span key="a">{L.quizArticles.slice(0, 3).map((a, i) => <span key={a} className={'a-' + a.replace("'", '')}>{i ? ' ' : ''}{a}</span>)}</span>, 'Членове']] : []),
    ...(verbs.length ? [['conj', 'ich, du…', 'Спрежение на глаголи']] : []),
  ];
  const modeHint = s.mode === 'test'
    ? (dir === 'art' ? 'Един опит. При грешка се показва верният член.' : 'Избор от четири отговора. При грешка се показва верният.')
    : (dir === 'art' ? 'Опитите продължават до верния член.' : 'Отговорът се въвежда. Следващата дума идва след верен отговор.');

  return (
    <section>
      {!conj && <div className="progress">
        <div className="progress-top">
          <span className="progress-num">{learned} <span>от {scope.length} научени</span></span>
          <span className="small">{current === 'all' ? 'всички думи' : current === 'latest' ? (latest ? latest.name : '') : (sets.find(x => x.id === current) || {}).name}</span>
        </div>
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={scope.length} aria-valuenow={learned}><i style={{ width: (scope.length ? learned / scope.length * 100 : 0) + '%' }} /></div>
        {weak.length > 0 && (
          <div className="weak">
            <span><b>{weak.length}</b> {weak.length === 1 ? 'дума често се обърква' : 'думи често се объркват'}</span>
            <button className="small-btn" onClick={() => onPractise(weak.map(w => w.id))}>Упражнение</button>
          </div>
        )}
      </div>}

      {!conj && <div className="section">
        <label className="label" htmlFor="wordset">Списък с думи</label>
        <div className="select">
          <select id="wordset" value={current} onChange={e => setSet(e.target.value)}>
            <option value="all">Всички думи ({words.filter(inSet(null)).length})</option>
            {latest && <option value="latest">Последни: {latest.name} ({words.filter(inSet(latest.id)).length})</option>}
            {sets.length > 1 && <optgroup label="Списъци">
              {sets.map(x => <option key={x.id} value={x.id}>{x.name} ({words.filter(inSet(x.id)).length})</option>)}
            </optgroup>}
          </select>
          <Icon name="chevron" />
        </div>
      </div>}

      <div className="section">
        <p className="label">Упражнение</p>
        <div className={'tiles' + (tiles.length === 4 ? ' two' : '')} role="radiogroup" aria-label="Упражнение">
          {tiles.map(([v, big, sub, name]) => (
            <button key={v} role="radio" aria-checked={dir === v} aria-label={name ? `${name}, ${sub}` : undefined} className={'tile' + (dir === v ? ' on' : '')} onClick={() => set('dir', v)}>
              <span className="tile-big">{big}</span><span className="tile-sub">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      {conj && <p className="hint" style={{ marginTop: -8, marginBottom: 20 }}>Глаголи: {verbs.map(v => v.verb).join(', ')}. Формите са скрити. Всяка форма се казва на глас и се проверява с докосване.</p>}

      {!conj && <div className="section">
        <p className="label">Формат</p>
        <Seg label="Формат" value={s.mode} onChange={v => set('mode', v)} options={[['test', 'Тест'], ['open', 'Свободен отговор']]} />
        <p className="hint">{modeHint}</p>
      </div>}

      {!conj && <details className="more">
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
            <label className="tog"><span>Автоматично произнасяне на думата на {L.adj}и</span><input type="checkbox" checked={s.autoSpeak} onChange={e => set('autoSpeak', e.target.checked)} /></label>
          </div>
        </div>
      </details>}

      <div className="startbar">
        <button className="primary" disabled={!conj && !eligibleCount} onClick={onStart}>
          {conj ? `Начало: ${verbs.length} ${verbs.length === 1 ? 'глагол' : 'глагола'}` : eligibleCount ? `Начало: ${size} ${size === 1 ? 'дума' : 'думи'}` : (s.filter === 'weak' ? 'Още няма грешени думи' : 'Няма думи с тези настройки')}
        </button>
      </div>
    </section>
  );
}
