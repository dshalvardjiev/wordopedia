// Progress of one question (word, verb form or maths fact) from its stats entry {c: correct, w: wrong}.
// Pure module: used by the screens and by the achievements (ach.js).
// A word counts as learned after two correct answers and more correct than wrong ones.
export const isLearned = st => !!st && st.c >= 2 && st.c > st.w;
export const isWeak = st => !!st && st.w > 0 && st.w >= st.c;
