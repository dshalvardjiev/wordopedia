// Dialogue exercise: short conversations whose lines are put in order. Content: dictionary/<course path>/dialogues.json;
// pictures of people and scenes: dictionary/dialogues/images.json and img/ (shared by all languages).
// Pure: no React, no browser (also used by scripts/check-content.mjs).
import { shuffle } from './match.js';

// { people: {key: {name, img}}, dialogues: [{id, title, img, lines: [{who, text, bg}]}] }
// -> { list: [{id: "<course key>:dlg:<id>", key, title, img, lines: [{who, name, img, text, bg}]}], problems: [] }.
// Progress is stored under the list's id (e.g. "fr:dlg:bonjour"), so a dialogue id must not change once published.
export function parseDialogues(data, L) {
  const list = [], problems = [];
  if (!data) return { list, problems };
  const people = data.people && typeof data.people === 'object' ? data.people : {};
  if (!Array.isArray(data.dialogues)) { problems.push('"dialogues" must be a list'); return { list, problems }; }
  const ids = new Set();
  for (const d of data.dialogues) {
    const at = d && d.id ? `dialogue "${d.id}"` : 'a dialogue without "id"';
    if (!d || typeof d.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(d.id)) { problems.push(`${at}: "id" must be lower case letters, digits and -`); continue; }
    if (ids.has(d.id)) { problems.push(`${at} is listed twice`); continue; }
    if (!d.title || !Array.isArray(d.lines) || d.lines.length < 3 || d.lines.length > 8) { problems.push(`${at}: needs a "title" and 3 to 8 "lines"`); continue; }
    const lines = [];
    for (const [i, x] of d.lines.entries()) {
      const p = x && people[x.who];
      if (!p || !p.name) { problems.push(`${at}, line ${i + 1}: "who" must be one of "people"`); break; }
      if (!x.text || !x.bg) { problems.push(`${at}, line ${i + 1}: needs "text" and "bg"`); break; }
      lines.push({ who: x.who, name: p.name, img: p.img || '', text: String(x.text).trim(), bg: String(x.bg).trim() });
    }
    if (lines.length !== d.lines.length) continue;
    if (new Set(lines.map(x => x.text)).size !== lines.length) { problems.push(`${at}: two lines have the same text, so the order is not unique`); continue; }
    ids.add(d.id);
    list.push({ id: `${L.key}:dlg:${d.id}`, key: d.id, title: String(d.title), img: d.img || '', lines });
  }
  return { list, problems };
}

// The lines' indexes in a random order that is not the right one.
export function shuffledOrder(n) {
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let k = 0; k < 10; k++) { shuffle(idx); if (idx.some((v, i) => v !== i)) break; }
  return idx;
}
// Per position: is the line there the right one?
export const placed = order => order.map((v, i) => v === i);
// The line in the result list ("За повторение").
export const dialogueText = d => `${d.title}: ${d.lines[0].text} …`;
// Texts recorded for the dialogue (scripts/make_audio.py reads the same files).
export const dialogueTexts = list => list.flatMap(d => d.lines.map(x => x.text));
