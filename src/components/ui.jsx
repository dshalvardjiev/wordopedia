import { useId } from 'react';

// Flags drawn as SVG so they look the same on every phone (Windows and some Androids do not render flag emoji).
export function Flag({ code, size = 28 }) {
  const id = useId().replace(/:/g, '');
  const h = Math.round(size * 0.7);
  const body = {
    de: <><rect width="60" height="10" y="0" fill="#000" /><rect width="60" height="10" y="10" fill="#DD0000" /><rect width="60" height="10" y="20" fill="#FFCE00" /></>,
    fr: <><rect width="20" height="30" x="0" fill="#0055A4" /><rect width="20" height="30" x="20" fill="#fff" /><rect width="20" height="30" x="40" fill="#EF4135" /></>,
    en: <>
      <clipPath id={'t' + id}><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" /></clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#t${id})`} stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </>,
  }[code];
  return (
    <svg className="flag" width={size} height={h} viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{body}</svg>
  );
}

const paths = {
  pencil: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M14 6l4 4" /></>,
  book: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h11" /></>,
  sync: <><path d="M20 11a8 8 0 0 0-14.9-3.4L4 9" /><path d="M4 4v5h5" /><path d="M4 13a8 8 0 0 0 14.9 3.4L20 15" /><path d="M20 20v-5h-5" /></>,
  close: <><path d="M6 6l12 12M18 6L6 18" /></>,
  chevron: <path d="M6 9l6 6 6-6" />,
  speaker: <><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></>,
  check: <path d="M5 12l5 5L20 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></>,
  repeat: <><path d="M17 2l3 3-3 3" /><path d="M4 11V9a4 4 0 0 1 4-4h12" /><path d="M7 22l-3-3 3-3" /><path d="M20 13v2a4 4 0 0 1-4 4H4" /></>,
};
export function Icon({ name, size = 20 }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function Seg({ value, onChange, options, label }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={String(value) === v} className={String(value) === v ? 'on' : ''} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  );
}

// Same footprint as a flag, so the maths entry lines up with the languages in menus.
export function MathBadge({ size = 28 }) {
  return (
    <svg className="flag" width={size} height={Math.round(size * 0.7)} viewBox="0 0 60 42" aria-hidden="true">
      <rect width="60" height="42" fill="#fff" />
      <path d="M0 14h60M0 28h60M15 0v42M30 0v42M45 0v42" stroke="#D9E1EF" strokeWidth="1.5" />
      <path d="M22 13l16 16M38 13L22 29" stroke="#2747D0" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
