import { useEffect, useRef } from 'react';

// Reward: a short confetti burst with a label, e.g. after every 10 correct answers. Drawn on a canvas over the whole
// screen that never takes taps or focus, so a typed answer and a phone keyboard are not disturbed.
// With "reduce motion" switched on, only the label shows.
const COLORS = ['#2747D0', '#2563EB', '#DC2626', '#15803D', '#FFC83D', '#F70A8D', '#00A6ED'];
const DURATION = 2200;

export default function Confetti({ label, pieces = 140, onDone }) {
  const ref = useRef(null);
  useEffect(() => {
    const done = setTimeout(onDone, DURATION + 300);
    let still = false;
    try { still = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* keep the animation */ }
    const c = ref.current;
    if (still || !c || !c.getContext) return () => clearTimeout(done);
    const dpr = Math.min(window.devicePixelRatio || 1, 2), W = window.innerWidth, H = window.innerHeight;
    c.width = W * dpr; c.height = H * dpr;
    const g = c.getContext('2d'); g.scale(dpr, dpr);
    // Two bursts from the lower corners, aimed up and towards the middle.
    const bits = Array.from({ length: pieces }, (_, i) => {
      const left = i % 2 === 0, a = (left ? -60 : -120) + (Math.random() - 0.5) * 40, v = 9 + Math.random() * 7;
      return { x: left ? 0 : W, y: H * 0.85, vx: Math.cos(a * Math.PI / 180) * v * (W / 400), vy: Math.sin(a * Math.PI / 180) * v * 1.6,
        w: 6 + Math.random() * 6, h: 4 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        color: COLORS[i % COLORS.length], round: Math.random() < 0.3 };
    });
    const t0 = performance.now();
    let raf = 0;
    const frame = now => {
      const t = now - t0;
      g.clearRect(0, 0, W, H);
      g.globalAlpha = t > DURATION - 500 ? Math.max(0, (DURATION - t) / 500) : 1;
      for (const b of bits) {
        b.vy += 0.32; b.vx *= 0.985; b.vy *= 0.985; b.x += b.vx; b.y += b.vy; b.r += b.vr;
        g.save(); g.translate(b.x, b.y); g.rotate(b.r); g.fillStyle = b.color;
        if (b.round) { g.beginPath(); g.arc(0, 0, b.h / 2 + 1, 0, Math.PI * 2); g.fill(); }
        else g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.r * 2)) + 1);
        g.restore();
      }
      if (t < DURATION) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); clearTimeout(done); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="confetti" aria-hidden="true">
      <canvas ref={ref} />
      {label && <div className="confetti-label">{label}</div>}
    </div>
  );
}
