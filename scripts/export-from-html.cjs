// One-off: export the built-in word lists and recordings from the artifact HTML into dictionary/.
const fs = require('fs');
const s = fs.readFileSync(process.argv[2], 'utf8');
const a = s.indexOf('const WORDS_NOV'), b = s.indexOf('const DEFAULT_SETS');
eval(s.slice(a, b).replace(/const /g, 'var '));
const i = s.indexOf('const AUDIO = ') + 'const AUDIO = '.length, j = s.indexOf(';\n', i);
const AUDIO = JSON.parse(s.slice(i, j));
const slug = t => t.toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const q = v => /[",\n]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v;
const rows = [['set','article','german','bulgarian','type','plural','alt','note']];
const add = (list, set) => list.forEach(x => {
  const [art, de, bg, type, note, alt, pl] = x;
  rows.push([set, art||'', de, bg.join('; '), type||'n', pl||'', (alt||[]).join('; '), note||'']);
  const full = (art ? art + ' ' : '') + de;
  if (AUDIO[full]) fs.writeFileSync(`dictionary/audio/${slug(full)}.mp3`, Buffer.from(AUDIO[full].split(',')[1], 'base64'));
  else console.error('no audio', full);
});
add(WORDS_NOV, '2026-11 Ноември');
add(WORDS_OCT, '2026-10 Октомври');
fs.writeFileSync('dictionary/words.csv', rows.map(r => r.map(q).join(',')).join('\n') + '\n');
console.log('rows', rows.length - 1, 'audio', fs.readdirSync('dictionary/audio').length);
