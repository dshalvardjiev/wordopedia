import { Flag, Icon, Seg } from './ui.jsx';
import { isLearned, isWeak } from '../lib/progress.js';
import { PER_ROUND, ROUNDS } from '../lib/pairs.js';

export default function Home({ L, dir, store, update, sets, words, eligibleCount, setSel, verbs = [], conjAll = [], conjGroups = [], conjSel = 'all', conjCount = 0, onStart, onPractise }) {
  const conj = dir === 'conj', match = dir === 'match';
  const s = store.settings;
  // Conjugation as a table (forms revealed by tapping) or as an exercise with questions (cq).
  const cmode = s.conjMode || 'table', cq = conj && cmode !== 'table';
  const set = (k, v) => update(n => { n.settings = { ...n.settings, [k]: v }; });
  const setSet = v => update(n => { n.setByLang = { ...n.setByLang, [L.key]: v }; });
  const setConjSet = v => update(n => { n.setByLang = { ...n.setByLang, [L.key + ':conj']: v }; });
  const X = L.code.toUpperCase();
  const latest = sets[0];
  const current = setSel === 'all' || setSel === 'latest' || sets.some(x => x.id === setSel) ? setSel : 'all';
  const inSet = id => w => w.on && (!id || w.set === id);
  const scopeId = current === 'latest' ? (latest && latest.id) : current === 'all' ? null : current;
  const scope = cq ? conjAll.filter(f => conjSel === 'all' || f.set === conjSel) : words.filter(inSet(scopeId));
  const learned = scope.filter(w => isLearned(store.stats[w.id])).length;
  const weak = scope.filter(w => isWeak(store.stats[w.id]));
  const count = cq ? conjCount : eligibleCount;
  const size = s.size === 'all' ? count : Math.min(count, +s.size);
  const conjHint = cmode === 'test' ? 'Избор на вярната форма от четири. При грешка се показва вярната.'
    : cmode === 'open' ? 'Формата се въвежда, със или без местоимението. Следващият въпрос идва след верен отговор.'
    : `Глаголи: ${verbs.map(v => v.verb).join(', ')}. Формите са скрити. Всяка форма се казва на глас и се проверява с докосване.`;

  const tiles = [
    // Direction shown with flags; the text form stays as the accessible name.
    ['x-bg', <span key="xb" className="dirflags"><Flag code={L.code} size={30} /><span aria-hidden="true">→</span><Flag code="bg" size={30} /></span>, 'Превод на български', `${X} → BG`],
    ['bg-x', <span key="bx" className="dirflags"><Flag code="bg" size={30} /><span aria-hidden="true">→</span><Flag code={L.code} size={30} /></span>, `Превод на ${L.adj}и`, `BG → ${X}`],
    ...(L.quizArticles.length ? [['art', <span key="a">{L.quizArticles.slice(0, 3).map((a, i) => <span key={a} className={'a-' + a.replace("'", '')}>{i ? ' ' : ''}{a}</span>)}</span>, 'Членове']] : []),
    ...(verbs.length ? [['conj', `${L.pronouns[0][1]}, ${L.pronouns[1][1]}…`, 'Спрежение на глаголи']] : []),
    ['match', <span key="m" className="matchicon" aria-hidden="true"><i /><b>⇄</b><i /></span>, 'Свързване на двойки', 'Свързване'],
  ];
  // Matching: boards of 10 words; fewer boards when the list is short.
  const rounds = Math.max(1, Math.min(+(s.rounds || 1), Math.ceil(count / PER_ROUND)));
  const artName = L.quizArticles.length ? L.quizArticles.slice(0, 3).join('/') : 'a/an';
  const modeHint = s.mode === 'test'
    ? (dir === 'art' ? 'Един опит. При грешка се показва верният член.' : 'Избор от четири отговора. При грешка се показва верният.')
    : (dir === 'art' ? 'Опитите продължават до верния член.' : 'Отговорът се въвежда. Следващата дума идва след верен отговор.');

  return (
    <section>
      {(!conj || cq) && <div className="progress">
        <div className="progress-top">
          <span className="progress-num">{learned} <span>от {scope.length} научени</span></span>
          <span className="small">{cq ? (conjSel === 'all' ? 'всички глаголи' : conjSel) : current === 'all' ? 'всички думи' : current === 'latest' ? (latest ? latest.name : '') : (sets.find(x => x.id === current) || {}).name}</span>
        </div>
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={scope.length} aria-valuenow={learned}><i style={{ width: (scope.length ? learned / scope.length * 100 : 0) + '%' }} /></div>
        {weak.length > 0 && (
          <div className="weak">
            <span><b>{weak.length}</b> {cq ? (weak.length === 1 ? 'форма често се обърква' : 'форми често се объркват') : weak.length === 1 ? 'дума често се обърква' : 'думи често се объркват'}</span>
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

      {cq && conjGroups.length > 1 && <div className="section">
        <label className="label" htmlFor="verbset">Глаголи</label>
        <div className="select">
          <select id="verbset" value={conjSel} onChange={e => setConjSet(e.target.value)}>
            <option value="all">Всички глаголи ({verbs.length})</option>
            {conjGroups.map(g => <option key={g} value={g}>{g} ({verbs.filter(v => v.set === g).length})</option>)}
          </select>
          <Icon name="chevron" />
        </div>
      </div>}

      <div className="section">
        <p className="label">Упражнение</p>
        <div className={'tiles' + (tiles.length >= 4 ? ' two' : '')} role="radiogroup" aria-label="Упражнение">
          {tiles.map(([v, big, sub, name]) => (
            <button key={v} role="radio" aria-checked={dir === v} aria-label={name ? `${name}, ${sub}` : undefined} className={'tile' + (dir === v ? ' on' : '')} onClick={() => set('dir', v)}>
              <span className="tile-big">{big}</span><span className="tile-sub">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      {conj && <div className="section">
        <p className="label">Формат</p>
        <Seg label="Формат" value={cmode} onChange={v => set('conjMode', v)} options={[['table', 'Таблица'], ['test', 'Тест'], ['open', 'Свободен отговор']]} />
        <p className="hint">{conjHint}</p>
      </div>}

      {match && <div className="section">
        <p className="label">Брой кръгове</p>
        <Seg label="Брой кръгове" value={s.rounds || '1'} onChange={v => set('rounds', v)} options={ROUNDS.map(r => [r, r])} />
        <p className="hint">{PER_ROUND} думи в кръг. Всяка дума се свързва с превода си, а съществителните получават и член ({artName}). Верен ход: +1 точка; грешна двойка или грешен член: −1 точка. Членът се избира с един опит.</p>
      </div>}

      {!conj && !match && <div className="section">
        <p className="label">Формат</p>
        <Seg label="Формат" value={s.mode} onChange={v => set('mode', v)} options={[['test', 'Тест'], ['open', 'Свободен отговор']]} />
        <p className="hint">{modeHint}</p>
      </div>}

      {(!conj || cq) && <details className="more">
        <summary>Още настройки <Icon name="chevron" /></summary>
        <div className="more-body">
          {!cq && <div>
            <p className="label">Кои думи</p>
            <Seg label="Кои думи" value={s.filter} onChange={v => set('filter', v)} options={[['all', 'Всички'], ['n', 'Същ.'], ['v', 'Глаголи'], ['other', 'Други'], ['weak', 'Грешени']]} />
          </div>}
          {!match && <div>
            <p className="label">Брой въпроси</p>
            <Seg label="Брой въпроси" value={s.size} onChange={v => set('size', v)} options={[['10', '10'], ['20', '20'], ['all', 'Всички']]} />
          </div>}
          <div className="toggles">
            {L.articles.length > 0 && !cq && !match && (
              <label className="tog"><span>Член задължителен при BG → {X}<br /><span className="small">„{L.exampleNoun}“, а не само „{L.exampleNoun.replace(/^\S+\s|^l'/, '')}“</span></span>
                <input type="checkbox" checked={s.reqArt} onChange={e => set('reqArt', e.target.checked)} /></label>
            )}
            {!match && <label className="tog"><span>{cq ? 'Сгрешените форми се връщат в същия кръг' : 'Сгрешените думи се връщат в същия кръг'}</span><input type="checkbox" checked={s.retry} onChange={e => set('retry', e.target.checked)} /></label>}
            <label className="tog"><span>{cq ? `Автоматично произнасяне на формата след отговор` : `Автоматично произнасяне на думата на ${L.adj}и`}</span><input type="checkbox" checked={s.autoSpeak} onChange={e => set('autoSpeak', e.target.checked)} /></label>
          </div>
        </div>
      </details>}

      <div className="startbar">
        <button className="primary" disabled={match ? count < 2 : (!conj || cq) && !count} onClick={onStart}>
          {match ? (count >= 2 ? `Начало: ${rounds} ${rounds === 1 ? 'кръг' : 'кръга'}, ${Math.min(count, rounds * PER_ROUND)} думи` : 'Нужни са поне две думи')
            : cq ? (count ? `Начало: ${size} ${size === 1 ? 'въпрос' : 'въпроса'}` : 'Няма глаголи') : conj ? `Начало: ${verbs.length} ${verbs.length === 1 ? 'глагол' : 'глагола'}` : eligibleCount ? `Начало: ${size} ${size === 1 ? 'дума' : 'думи'}` : (s.filter === 'weak' ? 'Още няма грешени думи' : 'Няма думи с тези настройки')}
        </button>
      </div>
    </section>
  );
}
