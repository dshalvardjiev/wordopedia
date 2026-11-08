// German pronunciation: recorded mp3 files next to the dictionary, cached on the device; device voice as fallback.
const CACHE = 'woerter-audio-v1';
export const slug = t => t.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const audioBase = dictUrl => { try { const u = new URL(dictUrl); if (!/\.csv$/i.test(u.pathname)) return null; u.pathname = u.pathname.replace(/[^/]*$/, '') + 'audio/'; u.search = ''; return u.toString(); } catch (e) { return null; } };
const urlFor = (base, text) => (base ? base + slug(text) + '.mp3' : null);

const player = typeof Audio !== 'undefined' ? new Audio() : null;
const ready = new Map(); // text -> blob URL, prepared before the tap so play() runs inside the gesture (iOS)

async function getBlobUrl(base, text, allowNetwork = true) {
  if (ready.has(text)) return ready.get(text);
  const url = urlFor(base, text); if (!url) return null;
  try {
    const c = 'caches' in window ? await caches.open(CACHE) : null;
    let r = c ? await c.match(url) : null;
    if (!r && allowNetwork) { const f = await fetch(url); if (f.ok) { if (c) await c.put(url, f.clone()); r = f; } }
    if (!r) return null;
    const u = URL.createObjectURL(await r.blob()); ready.set(text, u); return u;
  } catch (e) { return null; }
}
export function prepare(base, text) { getBlobUrl(base, text); }

function germanVoice() {
  try { const vs = speechSynthesis.getVoices(); return vs.find(v => /^de[-_]DE/i.test(v.lang)) || vs.find(v => /^de/i.test(v.lang)) || null; } catch (e) { return null; }
}
try { speechSynthesis.getVoices(); } catch (e) { /* no speech API */ }
function tts(text, toast) {
  const v = germanVoice();
  if (!v) { toast && toast('Няма запис за тази дума и на устройството няма немски глас.'); return; }
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.voice = v; u.lang = v.lang; u.rate = 0.9; speechSynthesis.speak(u); } catch (e) { /* ignore */ }
}
function playUrl(u) { try { speechSynthesis.cancel(); } catch (e) {} try { player.pause(); player.src = u; player.currentTime = 0; const p = player.play(); if (p) p.catch(() => {}); } catch (e) {} }

export function speak(base, text, toast) {
  const u = ready.get(text);
  if (u) { playUrl(u); return; }
  // Not prepared yet: try once more, then fall back to the device voice (German only).
  getBlobUrl(base, text).then(x => (x ? playUrl(x) : tts(text, toast)));
}

// Download recordings for all words so they work offline. Returns {have, missing}.
export async function prefetchAll(base, texts, onProgress) {
  if (!base || !('caches' in window)) return { have: 0, missing: texts.length };
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
export async function clearAudioCache() { ready.clear(); try { await caches.delete(CACHE); } catch (e) {} }
