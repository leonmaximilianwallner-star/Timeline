// ui/motion.js — the one tween for drawn motion: the header's icons and the settings rows' icons (Max, 20 Nov 2026).
"use strict";
/* ════════════════════════════════════════════════════════════
   Motion the browser can't animate by itself (a path's shape, a circle's radius) is drawn frame by frame:
   tween(ms, draw) calls draw(t) with t from 0 to 1, eased by the loader's curve (--ease in styles/tokens.css, the
   same four numbers). Reduced motion: draw(1) at once. Returns stop(): a new motion on the same thing stops the old
   one first, so two never write the same shape (gesture-motion: one source of truth).
   CSS transitions and keyframes use var(--ease) directly.
   ════════════════════════════════════════════════════════════ */
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const lerp = (a, b, t) => a + (b - a) * t;
const easeMotion = (() => {                                       // cubic-bezier(0.65, 0, 0.35, 1), solved for x
  const B = (a, b, t) => 3*a*(1-t)*(1-t)*t + 3*b*(1-t)*t*t + t*t*t;
  return x => { let lo = 0, hi = 1; for(let i = 0; i < 22; i++){ const m = (lo + hi) / 2; B(.65, .35, m) < x ? lo = m : hi = m; } return B(0, 1, (lo + hi) / 2); };
})();
function tween(ms, draw, done){
  if(reducedMotion() || ms <= 0){ draw(1); done && done(); return () => {}; }
  let raf = 0, t0 = 0;
  const step = now => {
    if(!t0) t0 = now;
    const u = Math.min(1, (now - t0) / ms);
    draw(easeMotion(u));
    if(u < 1) raf = requestAnimationFrame(step); else { raf = 0; done && done(); }
  };
  raf = requestAnimationFrame(step);
  return () => { if(raf) cancelAnimationFrame(raf); raf = 0; };
}
