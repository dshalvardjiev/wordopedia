// Build-time context: which instance this build is (VITE_INSTANCE), which environment (VITE_ENV: production or
// staging), the instance file built into the app, and where the learner's data is stored.
const INSTANCES = import.meta.glob('../../dictionary/instances/*.json', { eager: true, import: 'default' });

export const INSTANCE = import.meta.env.VITE_INSTANCE || 'production';
export const ENV = import.meta.env.VITE_ENV || 'production';
export const BUNDLED_INSTANCE = INSTANCES[`../../dictionary/instances/${INSTANCE}.json`] || { courses: [] };
// Question banks are built into the app (not downloaded): bank key (file name) -> content of dictionary/quiz/<key>.json.
const BANK_FILES = import.meta.glob('../../dictionary/quiz/*.json', { eager: true, import: 'default' });
export const BUNDLED_BANKS = Object.fromEntries(Object.entries(BANK_FILES).map(([p, v]) => [p.slice(p.lastIndexOf('/') + 1, -5), v]));

// localStorage key, one per instance: all instances share one origin, never each other's data.
export const STORE_KEY = 'wordopedia.' + INSTANCE;
// The app used to live at the root address under this key; "production" copies that data on its first start.
export const LEGACY_STORE_KEY = INSTANCE === 'production' ? 'woerter.v1' : null;
