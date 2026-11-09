// Language rules. Bulgarian is always the learner's language; each entry is the foreign side.
// Which languages are switched on comes from dictionary/languages.json, so a language can be activated without a release.
export const LANGS = {
  de: {
    code: 'de', name: 'Немски', native: 'Deutsch', adj: 'немск', tts: 'de',
    articles: ['der', 'die', 'das'],     // accepted in the CSV and in typed answers
    quizArticles: ['der', 'die', 'das'], // buttons in the article exercise
    keys: ['ä', 'ö', 'ü', 'ß'], capNouns: true, placeholder: 'напр. der Hund', exampleNoun: 'der Affe', exampleAlt: 'das Bild',
    exampleRow: '2026-12 Декември,der,Hund,куче; кученце,n,die Hunde,,',
  },
  fr: {
    code: 'fr', name: 'Френски', native: 'Français', adj: 'френск', tts: 'fr',
    articles: ['le', 'la', "l'", 'les'],
    quizArticles: ['le', 'la', "l'", 'les'],
    keys: ['é', 'è', 'ê', 'à', 'â', 'ç', 'î', 'ô', 'ù', 'û', 'ë', 'œ'], capNouns: false, placeholder: 'напр. le chien', exampleNoun: 'le chat', exampleAlt: 'la photo',
    exampleRow: "2026-12 Декември,le,chien,куче,n,les chiens,,",
  },
  en: {
    code: 'en', name: 'Английски', native: 'English', adj: 'английск', tts: 'en-GB',
    articles: [], quizArticles: [],      // no article exercise for English
    optionalPrefixes: { n: ['the', 'a', 'an'], v: ['to'] }, // "to eat" = "eat", "the dog" = "dog"
    keys: [], capNouns: false, placeholder: 'напр. dog', exampleNoun: 'dog', exampleAlt: 'picture',
    exampleRow: '2026-12 Декември,,dog,куче; кученце,n,dogs,,',
  },
};
export const LANG_ORDER = ['de', 'fr', 'en'];
export const DEFAULT_LANG_CONF = { languages: [{ code: 'de', active: true }, { code: 'fr', active: false }, { code: 'en', active: false }] };

// "l'" joins without a space: l'eau; other articles take one: der Affe, le chat.
export const joinArt = (art, word) => (!art ? word : /'$/.test(art) ? art + word : art + ' ' + word);
export const normApos = s => String(s).replace(/[’`´ʼ]/g, "'");

// Split a typed answer into article and word for this language: "L’eau" -> {art:"l'", word:"eau"}.
export function splitArticle(L, raw) {
  const v = normApos(raw).trim().replace(/\s+/g, ' ');
  for (const a of [...L.articles].sort((x, y) => y.length - x.length)) {
    const elided = /'$/.test(a);
    const re = elided ? new RegExp('^' + a.replace("'", "'") + '\\s*(.+)$', 'i') : new RegExp('^' + a + '\\s+(.+)$', 'i');
    const m = re.exec(v);
    if (m) return { art: a, word: m[1] };
  }
  return { art: '', word: v };
}

// Spelling-insensitive key used for comparing answers in this language.
export function norm(L, s) {
  let x = normApos(s).toLowerCase();
  if (L.code === 'de') x = x.replace(/ß/g, 'ss').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue');
  x = x.replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '');
  return x.replace(/[.,!?;:"'„“”]/g, '').replace(/\s+/g, ' ').trim();
}
