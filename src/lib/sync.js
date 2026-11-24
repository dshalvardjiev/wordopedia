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
// The instance file: which courses this instance offers.
export async function fetchInstance(base, id) {
  const j = await (await get(base + 'instances/' + id + '.json')).json();
  if (!j || !(j.courses === 'all' || Array.isArray(j.courses))) throw new Error(`instances/${id}.json е в грешен формат`);
  return j;
}
// verbs.csv is optional: null when the course has none.
export async function fetchVerbs(base, L) {
  try { return await (await get(base + L.path + '/verbs.csv')).text(); }
  catch (e) { if (/404/.test(e.message)) return null; throw e; }
}
// images.json is optional: null when the language has no pictures.
export async function fetchImages(base, L) {
  try { return await (await get(base + L.code + '/images.json')).json(); }
  catch (e) { if (/404/.test(e.message)) return null; throw e; }
}
// dialogues.json is optional: null when the course has none.
export async function fetchDialogues(base, L) {
  try { return await (await get(base + L.path + '/dialogues.json')).json(); }
  catch (e) { if (/404/.test(e.message)) return null; throw e; }
}
// Pictures of the dialogues' people and scenes, shared by all languages: dictionary/dialogues/images.json.
export async function fetchDialogueImages(base) {
  try { return await (await get(base + 'dialogues/images.json')).json(); }
  catch (e) { if (/404/.test(e.message)) return null; throw e; }
}
export async function fetchDictionary(base, L) {
  const text = await (await get(base + L.path + '/words.csv')).text();
  return { text, parsed: parseDictionary(text, L) };
}
