// Builds the site for GitHub Pages.
//   --env production (default): the start page from landing/ at the root of the output folder, and one copy of the
//                               app per dictionary/instances/<id>.json in a subfolder (dist/production/, dist/lora/, ...),
//                               except "staging".
//   --env staging:              only the "staging" instance, directly into the output folder (the deploy workflow
//                               builds it from the staging branch and moves it to dist/staging/).
// Usage: node scripts/build-all.mjs [--out dist] [--env production|staging]
// Set VITE_DICT_BASE to point the builds at another dictionary folder (the deploy workflow does this for staging).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ID_RE, PRODUCTION, STAGING } from '../src/lib/courses.js';

const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const out = path.resolve(arg('out', 'dist'));
const env = arg('env', 'production');
if (env !== 'production' && env !== 'staging') { console.error('--env must be production or staging'); process.exit(1); }

const all = fs.readdirSync('dictionary/instances').filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();
const bad = all.filter(id => !ID_RE.test(id));
if (bad.length) { console.error('invalid instance ids: ' + bad.join(', ')); process.exit(1); }
const need = env === 'staging' ? STAGING : PRODUCTION;
if (!all.includes(need)) { console.error(`dictionary/instances/${need}.json is missing`); process.exit(1); }

function build(id, dir) {
  console.log(`\n== ${env}: ${id} -> ${path.relative(process.cwd(), dir)}`);
  const r = spawnSync('npx', ['vite', 'build', '--outDir', dir, '--emptyOutDir', '--logLevel', 'warn'],
    { stdio: 'inherit', env: { ...process.env, VITE_INSTANCE: id, VITE_ENV: env } });
  if (r.status !== 0) process.exit(r.status || 1);
}

fs.rmSync(out, { recursive: true, force: true });
if (env === 'staging') {
  build(STAGING, out);
} else {
  fs.cpSync('landing', out, { recursive: true });
  for (const f of ['favicon.svg', 'favicon.png']) fs.copyFileSync(path.join('public', f), path.join(out, f));
  const ids = all.filter(id => id !== STAGING);
  ids.forEach(id => build(id, path.join(out, id)));
  console.log(`\nBuilt ${ids.length} instance(s): ${ids.join(', ')}`);
}
