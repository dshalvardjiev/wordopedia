// Everything the learner owns lives in localStorage; the dictionary itself is a cached copy of the remote CSV.
const KEY = 'woerter.v1';
export const DEFAULT_DICT_URL = import.meta.env.VITE_DICT_URL ||
  'https://raw.githubusercontent.com/dshalvardjiev/deutsch-woerter/main/dictionary/words.csv';
export const DEFAULT_SETTINGS = { set: 'all', dir: 'de-bg', mode: 'test', filter: 'all', size: 'all', reqArt: true, retry: true, autoSpeak: false };

export function loadStore() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* storage unavailable */ }
  s = s || {};
  return {
    settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) },
    stats: s.stats || {},          // word id -> {c, w}
    extra: s.extra || {},          // word id -> {bg:[], alt:[]} synonyms accepted by the learner
    off: s.off || {},              // word id -> true when switched off
    userWords: s.userWords || [],  // words added in the app
    userSets: s.userSets || [],    // sets created in the app
    dict: s.dict || null,          // {csv, url, updatedAt, problems}
    dictUrl: s.dictUrl || DEFAULT_DICT_URL,
  };
}
export function saveStore(st) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } }

// Dated sets ("2026-11") newest first, then undated sets, last one in the file first.
export function sortSets(sets) {
  const dated = sets.filter(s => /^\d/.test(s.id)).sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  const undated = sets.filter(s => !/^\d/.test(s.id)).reverse();
  return [...dated, ...undated];
}
