// Everything the learner owns lives in localStorage; dictionaries are cached copies of the remote CSV files.
import { DEFAULT_MATH } from './math.js';

const KEY = 'woerter.v1';
export const DEFAULT_DICT_BASE = import.meta.env.VITE_DICT_BASE ||
  'https://raw.githubusercontent.com/dshalvardjiev/wordopedia/main/dictionary/';
export const DEFAULT_SETTINGS = { dir: 'x-bg', mode: 'test', filter: 'all', size: 'all', reqArt: true, retry: true, autoSpeak: false };

// Version 1 ids never carry a language prefix, so every key gets one.
const prefixKeys = (o, l) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [l + ':' + k, v]));

// Version 1 (German only) -> version 2 (several languages). Old data becomes German data.
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
    extra: prefixKeys(s.extra, 'de'),
    off: prefixKeys(s.off, 'de'),
    userWords: (s.userWords || []).map(w => ({ ...w, lang: 'de', id: 'de:' + w.id })),
    userSets: (s.userSets || []).map(x => ({ ...x, lang: x.lang || 'de' })),
    dicts: s.dict ? { de: { csv: s.dict.csv, updatedAt: s.dict.updatedAt, problems: s.dict.problems } } : {},
    // The folder layout changed (one sub-folder per language), so an old custom address cannot be reused.
    dictBase: null,
  };
}

export function loadStore() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* storage unavailable */ }
  if (s && s.version !== 2) s = migrate(s);
  s = s || { version: 2 };
  return {
    version: 2,
    lang: s.lang || null,              // null until the learner picks a language
    settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) },
    setByLang: s.setByLang || {},      // lang -> 'all' | 'latest' | set id
    stats: s.stats || {},              // word id -> {c, w}; ids start with the language code
    extra: s.extra || {},              // word id -> {bg:[], alt:[]} synonyms accepted by the learner
    off: s.off || {},                  // word id -> true when switched off
    userWords: s.userWords || [],      // words added in the app (each has lang)
    userSets: s.userSets || [],        // sets created in the app (each has lang)
    dicts: s.dicts || {},              // lang -> {csv, updatedAt, problems}
    langConf: s.langConf || null,      // last downloaded dictionary/languages.json
    dictBase: s.dictBase || null,      // custom dictionary folder; null = default
    math: { ...DEFAULT_MATH, ...(s.math || {}) }, // maths settings: test, tables, order, size
  };
}
export function saveStore(st) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } }

// Dated sets ("2026-11") newest first, then undated sets, last one in the file first.
export function sortSets(sets) {
  const dated = sets.filter(s => /^\d/.test(s.id)).sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  const undated = sets.filter(s => !/^\d/.test(s.id)).reverse();
  return [...dated, ...undated];
}
