// Pictures for words: dictionary/<lang>/images.json lists them, the files are in dictionary/<lang>/img/.
// Shared by all courses of a language, like the recordings. Keyed by the word as it is shown, with its article
// ("die Katze") or as a verb's infinitive ("kochen"), so a word list and a verb table can share a picture.
// parseImages is pure (also used by scripts/check-content.mjs); the rest needs a browser.
const CACHE = 'wordopedia-img-v1';
export const imgBase = (dictBase, lang) => dictBase + lang + '/img/';
export const FILE_RE = /^[a-z0-9-]+\.(svg|png|jpg|webp)$/;
const TYPES = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

// { sources: {id: {name, license, url}}, images: {word: {file, source} | {file, author, license, url, title}} }
// -> { byWord: Map(word -> file), credits: [{word, author, license, url}], sources: [...used sources], problems: [] }.
// Each picture names a shared source (e.g. an emoji set) or its own author, licence and address.
export function parseImages(data) {
  const byWord = new Map(), credits = [], used = new Set(), problems = [];
  if (!data) return { byWord, credits, sources: [], problems };
  const src = data.sources && typeof data.sources === 'object' ? data.sources : {};
  const imgs = data.images && typeof data.images === 'object' ? data.images : null;
  if (!imgs) { problems.push('"images" must be an object'); return { byWord, credits, sources: [], problems }; }
  for (const [word, e] of Object.entries(imgs)) {
    if (!e || typeof e.file !== 'string' || !FILE_RE.test(e.file)) { problems.push(`${word}: "file" must be a file name such as die-katze.svg`); continue; }
    if (e.source) {
      const s = src[e.source];
      if (!s || !s.name || !s.license) { problems.push(`${word}: unknown source "${e.source}"`); continue; }
      used.add(e.source);
    } else if (!e.license || !e.url) { problems.push(`${word}: needs "source", or its own "license" and "url"`); continue; }
    else credits.push({ word, author: e.author || '', license: e.license, url: e.url });
    byWord.set(word, e.file);
  }
  return { byWord, credits, sources: [...used].map(k => ({ id: k, ...src[k] })), problems };
}

const ready = new Map(); // url -> blob URL
// The picture as a blob URL with an explicit type: raw.githubusercontent.com serves SVG as text/plain,
// which <img> would refuse. Cached on the device for offline use. null when it cannot be loaded.
export async function imageUrl(base, file) {
  const url = base + file;
  if (ready.has(url)) return ready.get(url);
  try {
    const c = 'caches' in window ? await caches.open(CACHE) : null;
    let r = c ? await c.match(url) : null;
    if (!r) { const f = await fetch(url); if (f.ok) { if (c) await c.put(url, f.clone()); r = f; } }
    if (!r) return null;
    const u = URL.createObjectURL(new Blob([await r.blob()], { type: TYPES[file.split('.').pop()] }));
    ready.set(url, u); return u;
  } catch (e) { return null; }
}
// Downloads the pictures that are not on the device yet, so they also show offline.
export async function prefetchImages(base, files) {
  if (!('caches' in window) || !files.length) return;
  const c = await caches.open(CACHE);
  let i = 0;
  const work = async () => {
    while (i < files.length) {
      const url = base + files[i++];
      try { if (!(await c.match(url))) { const f = await fetch(url, { cache: 'no-store' }); if (f.ok) await c.put(url, f); } } catch (e) { /* next time */ }
    }
  };
  await Promise.all(Array.from({ length: 4 }, work));
}
