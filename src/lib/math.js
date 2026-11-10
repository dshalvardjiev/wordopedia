// Maths section. Each test produces "facts" that run through the same session engine as words.
export const MATH = 'math';
export const TESTS = {
  mul: {
    id: 'mul', name: 'Таблица за умножение', short: 'Умножение до 12',
    // All facts a × b for the chosen tables a and b = 1..12.
    facts: tables => tables.flatMap(a => Array.from({ length: 12 }, (_, i) => ({ id: `math:mul:${a}x${i + 1}`, a, b: i + 1, answer: a * (i + 1) }))),
  },
};
export const DEFAULT_MATH = { test: 'mul', tables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], order: 'mixed', size: '20' };
export const factText = f => `${f.a} × ${f.b}`;

// Feedback that points at the likely mistake rather than only saying "wrong".
export function explain(f, n) {
  if (n === f.a + f.b) return `Това е ${f.a} + ${f.b}. Тук умножаваме.`;
  for (const [x, y] of [[f.a, f.b - 1], [f.a, f.b + 1], [f.a - 1, f.b], [f.a + 1, f.b]]) {
    if (x >= 1 && y >= 1 && n === x * y) return `Близо: това е ${x} × ${y}.`;
  }
  return 'Не е вярно. Опитай пак.';
}
// Hint: build the answer from the previous fact (7 × 8 = 6 × 8 + 8).
export function hintFor(f) {
  if (f.a === 1) return `1 × ${f.b} е самото ${f.b}.`;
  if (f.b === 1) return `${f.a} × 1 е самото ${f.a}.`;
  if (f.b === 10) return `Умножение по 10: добави 0 към ${f.a}.`;
  if (f.a === 10) return `Умножение по 10: добави 0 към ${f.b}.`;
  const prev = (f.a - 1) * f.b;
  return `${f.a - 1} × ${f.b} = ${prev}. Добави още ${f.b}.`;
}
export const fmtTime = ms => { const s = Math.round(ms / 1000); return s < 60 ? `${s} сек.` : `${Math.floor(s / 60)} мин. ${String(s % 60).padStart(2, '0')} сек.`; };
