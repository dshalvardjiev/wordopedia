// Pronunciation: recorded mp3 files in dictionary/<lang>/audio/, cached on the device; the device voice as fallback.
const CACHE = 'woerter-audio-v1';

// Must match scripts/make_audio.py: "der Affe" -> der-affe, "l'élève" -> l-eleve, "Größe" -> groesse.
export const slug = t => t.toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/œ/g, 'oe').replace(/æ/g, 'ae')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const audioBase = (dictBase, lang) => dictBase + lang + '/audio/';
const urlFor = (base, text) => base + slug(text) + '.mp3';

const player = typeof Audio !== 'undefined' ? new Audio() : null;
const ready = new Map(); // url -> blob URL, prepared before the tap so play() runs inside the gesture (iOS)

async function getBlobUrl(base, text) {
  const url = urlFor(base, text);
  if (ready.has(url)) return ready.get(url);
  try {
    const c = 'caches' in window ? await caches.open(CACHE) : null;
    let r = c ? await c.match(url) : null;
    if (!r) { const f = await fetch(url); if (f.ok) { if (c) await c.put(url, f.clone()); r = f; } }
    if (!r) return null;
    // Explicit type: iOS Safari may refuse a blob served as application/octet-stream.
    const u = URL.createObjectURL(new Blob([await r.blob()], { type: 'audio/mpeg' }));
    ready.set(url, u); return u;
  } catch (e) { return null; }
}
export function prepare(base, text) { getBlobUrl(base, text); }

function voiceFor(tts) {
  try {
    const vs = speechSynthesis.getVoices(), want = tts.toLowerCase();
    return vs.find(v => v.lang.toLowerCase().replace('_', '-') === want) || vs.find(v => v.lang.toLowerCase().startsWith(want.slice(0, 2))) || null;
  } catch (e) { return null; }
}
try { speechSynthesis.getVoices(); } catch (e) { /* no speech API */ }
function tts(L, text, toast) {
  // Never read a foreign word with a voice of another language.
  const v = voiceFor(L.tts);
  if (!v) { toast && toast(`Няма запис за тази дума и на устройството няма ${L.adj}и глас.`); return; }
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.voice = v; u.lang = v.lang; u.rate = 0.9; speechSynthesis.speak(u); } catch (e) { /* ignore */ }
}
function playUrl(u) { try { speechSynthesis.cancel(); } catch (e) {} try { player.pause(); player.src = u; player.currentTime = 0; const p = player.play(); if (p) p.catch(() => {}); } catch (e) {} }

export function speak(L, base, text, toast) {
  const u = ready.get(urlFor(base, text));
  if (u) { playUrl(u); return; }
  getBlobUrl(base, text).then(x => (x ? playUrl(x) : tts(L, text, toast)));
}

// Download recordings for all words so they work offline. Returns {have, missing}.
export async function prefetchAll(base, texts, onProgress) {
  if (!('caches' in window)) return { have: 0, missing: texts.length };
  const c = await caches.open(CACHE);
  let done = 0, have = 0, missing = 0, i = 0;
  const work = async () => {
    while (i < texts.length) {
      const t = texts[i++], url = urlFor(base, t);
      try {
        if (await c.match(url)) have++;
        else { const f = await fetch(url, { cache: 'no-store' }); if (f.ok) { await c.put(url, f); have++; } else missing++; }
      } catch (e) { missing++; }
      onProgress && onProgress(++done, texts.length);
    }
  };
  await Promise.all(Array.from({ length: 6 }, work));
  return { have, missing };
}
export function resetPrepared() { ready.forEach(u => URL.revokeObjectURL(u)); ready.clear(); }
