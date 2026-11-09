// Downloads from the dictionary folder: languages.json (which languages are on) and <lang>/words.csv.
import { parseDictionary } from './dictionary.js';

const fresh = u => u + (u.includes('?') ? '&' : '?') + 't=' + Date.now();
async function get(url) {
  let r;
  try { r = await fetch(fresh(url), { cache: 'no-store' }); } catch (e) { throw new Error('няма връзка или адресът е недостъпен'); }
  if (!r.ok) throw new Error(r.status === 404 ? 'файлът не е намерен (404)' : 'грешка ' + r.status);
  return r;
}
export async function fetchLangConf(base) {
  const j = await (await get(base + 'languages.json')).json();
  if (!j || !Array.isArray(j.languages)) throw new Error('languages.json е в грешен формат');
  return j;
}
export async function fetchDictionary(base, L) {
  const text = await (await get(base + L.code + '/words.csv')).text();
  return { text, parsed: parseDictionary(text, L) };
}
