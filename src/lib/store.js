// Everything the learner owns lives in localStorage, one key per instance (see content.js);
// dictionaries are cached copies of the remote CSV files.
import { DEFAULT_MATH } from './math.js';
import { STORE_KEY as KEY, LEGACY_STORE_KEY } from './content.js';

export const DEFAULT_DICT_BASE = import.meta.env.VITE_DICT_BASE ||
  'https://raw.githubusercontent.com/dshalvardjiev/wordopedia/main/dictionary/';
// conjMode: 'table' (forms revealed by tapping), 'test' (choice of four) or 'open' (typed) for the conjugation exercise.
const DEFAULT_SETTINGS = { dir: 'x-bg', mode: 'test', conjMode: 'table', filter: 'all', size: 'all', reqArt: true, retry: true, autoSpeak: false, track: true };

// Version 1 ids never carry a language prefix, so every key gets one.
const prefixKeys = (o, l) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [l + ':' + k, v]));

// Version 1 (German only) -> version 2 (several languages). Old progress becomes German progress.
// Own words, own synonyms and switched-off words of version 1 are dropped: learners no longer edit content.
function migrate(s) {
  if (s.version === 2) return s;
  const dirMap = { 'de-bg': 'x-bg', 'bg-de': 'bg-x', art: 'art' };
  const st = s.settings || {};
  return {
    version: 2,
    lang: 'de',
    settings: { ...st, dir: dirMap[st.dir] || 'x-bg' },
    setByLang: { de: st.set || 'all' },
    stats: prefixKeys(s.stats, 'de'),
    dicts: s.dict ? { de: { csv: s.dict.csv, updatedAt: s.dict.updatedAt, problems: s.dict.problems } } : {},
    // The folder layout changed (one sub-folder per language), so an old custom address cannot be reused.
    dictBase: null,
  };
}

export function loadStore() {
  let s = null;
  try {
    // First start of "production": take over the data of the former root app (the old key is left as it was).
    s = JSON.parse(localStorage.getItem(KEY) ?? (LEGACY_STORE_KEY && localStorage.getItem(LEGACY_STORE_KEY)));
  } catch (e) { /* storage unavailable */ }
  if (s && s.version !== 2) s = migrate(s);
  s = s || { version: 2 };
  return {
    version: 2,
    lang: s.lang || null,              // null until the learner picks a language
    settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) },
    setByLang: s.setByLang || {},      // lang -> 'all' | 'latest' | set id
    stats: s.stats || {},              // word id -> {c, w}; ids start with the language code
    dicts: s.dicts || {},              // lang -> {csv, updatedAt, problems}
    langConf: s.langConf || null,      // last downloaded dictionary/languages.json
    instConf: s.instConf || null,      // last downloaded dictionary/instances/<instance>.json
    dictBase: s.dictBase || null,      // dictionary folder override (no UI; used for testing); null = default
    math: { ...DEFAULT_MATH, ...(s.math || {}) }, // maths settings: test, tables, order, size
    syncAt: s.syncAt || {},            // course key -> time of the last automatic word update
    verbs: s.verbs || {},              // course key -> {csv, updatedAt}: downloaded verbs.csv
  };
}
export function saveStore(st) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } }

// Dated sets ("2026-11") newest first, then undated sets, last one in the file first.
export function sortSets(sets) {
  const dated = sets.filter(s => /^\d/.test(s.id)).sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  const undated = sets.filter(s => !/^\d/.test(s.id)).reverse();
  return [...dated, ...undated];
}
