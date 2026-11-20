// ui/header-icons.js — the header's icons and the add button's: filled pills and dots on one measure (Max, 20 Nov 2026).
"use strict";
/* ════════════════════════════════════════════════════════════
   One measure, the settings icon's: 16 thick, 12 apart, on a 72 box, drawn at 20 px (styles/header-icons.css).
   Every end is round, except the time icon's pie at rest. Ported from the reference timeline-header-icons.html.
     mountIcon(el, name)   puts the icon into a button
     setIcon(el, on)       a two-state icon follows its thing's state (settings open, the time budget open, add mode,
                           the selection's mode). Called where that state changes, so it follows every route there
                           (a tap outside, Escape), not only its own button. Only a change moves it.
     playIcon(el)          a one-shot icon plays when its action runs (undo, redo, now), from the button or a key
   Every motion is tween (ui/motion.js) or a CSS transition in var(--ease); a new one stops the one running,
   from where it is. Reduced motion: each lands at once.
   ════════════════════════════════════════════════════════════ */
const ICON_W = 16, ICON_STEP = 28;                     // thickness; one row to the next (16 + 12)
const iconRad = d => d * Math.PI / 180;
const iconAt = (r, a) => [36 + r * Math.cos(iconRad(a)), 36 + r * Math.sin(iconRad(a))];
const f2 = n => n.toFixed(2);

/* a thick arc whose ends morph from cut (k 0: a pie's straight edge) to round (k 1: a pill's end).
   rc: radius of its centre line · w: thickness · a0→a1: angles (screen, clockwise) */
function iconArc(rc, w, a0, a1, k){
  const h = w / 2, ro = rc + h, ri = Math.max(0, rc - h), big = (a1 - a0) > 180 ? 1 : 0, cap = f2(h * k);
  const [ox0, oy0] = iconAt(ro, a0), [ox1, oy1] = iconAt(ro, a1), [ix1, iy1] = iconAt(ri, a1), [ix0, iy0] = iconAt(ri, a0);
  return `M${f2(ox0)} ${f2(oy0)} A${f2(ro)} ${f2(ro)} 0 ${big} 1 ${f2(ox1)} ${f2(oy1)}`
       + ` A${f2(h)} ${cap} ${f2(a1)} 0 1 ${f2(ix1)} ${f2(iy1)}`
       + ` A${f2(ri)} ${f2(ri)} 0 ${big} 0 ${f2(ix0)} ${f2(iy0)}`
       + ` A${f2(h)} ${cap} ${f2(a0)} 0 1 ${f2(ox0)} ${f2(oy0)} Z`;
}

/* Zeit: a bold pie (¾, its corners softly rounded by a 6-wide stroke) ⇄ a ring of arc and dot, after most of a turn.
   The gap never ends at the top (a ring open at the top with a dot in it reads as a face), and the arc is two thirds,
   not half (half a ring over a dot reads as a question mark). The dot grows only once the turn is under way */
const TIME_PIE  = { rc:16.5, w:33, a0:0,   span:270, k:0, sw:6, dr:22, da:315 };
const TIME_RING = { rc:28,   w:16, a0:195, span:240, k:1, sw:0, dr:28, da:495 };
function drawTime(g, t){
  const s = {}; for(const k in TIME_PIE) s[k] = lerp(TIME_PIE[k], TIME_RING[k], t);
  const arc = g.querySelector(".arc");
  arc.setAttribute("d", iconArc(s.rc, s.w, s.a0, s.a0 + s.span, s.k));
  arc.setAttribute("stroke-width", f2(s.sw));
  const [x, y] = iconAt(s.dr, s.da), dot = g.querySelector(".dot");
  dot.setAttribute("cx", f2(x)); dot.setAttribute("cy", f2(y)); dot.setAttribute("r", f2(8 * Math.max(0, (t - .3) / .7)));
}

/* Jetzt: a dot inside a ring, "where you are". Played: the ring closes in on the dot, like focusing, and opens again */
function drawNow(g, t){
  const ring = g.querySelector(".ring");
  ring.setAttribute("r", f2(lerp(28, 22, t))); ring.setAttribute("stroke-width", f2(lerp(16, 12, t)));
}

/* Auswahl: at rest two crossing corners (touching selects); active, the selection frame, four corners with uneven legs,
   14 ahead and 6 behind, all the same way round, as if caught mid-march (enclosing selects). Legs 14 + 6 leave 28
   between corners: 12 clear, the set's gap. Nothing loops */
const SELECT_REST = [
  [[16, 8], [16, 56], [64, 56]],   // bottom-left corner, its upright end crossing the top line
  [[ 8, 16], [56, 16], [56, 64]],  // top-right corner, its flat end crossing the left line
  [[16, 16], [16, 16], [16, 16]],  // hidden where they cross, top left
  [[56, 56], [56, 56], [56, 56]],  // and bottom right
];
const SELECT_ON = [
  [[12, 46], [12, 60], [18, 60]],
  [[54, 12], [60, 12], [60, 26]],
  [[12, 18], [12, 12], [26, 12]],
  [[60, 54], [60, 60], [46, 60]],
];
function drawSelect(g, t){
  g.querySelectorAll(".sel").forEach((el, i) => {
    const pts = SELECT_REST[i].map((p, j) => [lerp(p[0], SELECT_ON[i][j][0], t), lerp(p[1], SELECT_ON[i][j][1], t)]);
    el.setAttribute("d", "M" + pts.map(p => f2(p[0]) + " " + f2(p[1])).join(" L"));
  });
}

/* Hinzufügen: four arms from the centre, a plus ⇄ an X: the arms draw back into the centre (a dot), then grow out
   again on the diagonals. The settings icon's move */
function drawPlus(g, len, turn){
  g.querySelectorAll(".arm4").forEach((a, i) => {
    const ang = iconRad(i * 90 + turn);
    a.setAttribute("d", `M36 36 L${f2(36 + len * Math.cos(ang))} ${f2(36 + len * Math.sin(ang))}`);
  });
}

/* Rückgängig / Wiederholen: the head alone, a 45° chevron. Played: its lines draw back toward the point while it
   nudges the way it points, then grow out again (styles/header-icons.css) */
const ARROW_LINES = `<path class="stroke ln" pathLength="1" d="M22 36 L46 12"/><path class="stroke ln" pathLength="1" d="M22 36 L46 60"/>`;
const arrowSVG = mirror => `<svg class="glyph arrow" viewBox="0 0 72 72" aria-hidden="true"><g${mirror ? ' transform="translate(72 0) scale(-1 1)"' : ""}><g class="nudge">${ARROW_LINES}</g></g></svg>`;

const HEADER_ICON = {
  undo: { html: arrowSVG(false), play: g => { g.classList.remove("go"); void g.getBoundingClientRect(); g.classList.add("go"); } },
  redo: { html: arrowSVG(true),  play: g => HEADER_ICON.undo.play(g) },
  now:  { html: `<svg class="glyph now" viewBox="0 0 72 72" aria-hidden="true"><circle class="stroke ring" cx="36" cy="36"/><circle cx="36" cy="36" r="8"/></svg>`,
          init: g => drawNow(g, 0),
          play: (g, st) => { st.stop(); st.stop = tween(240, t => drawNow(g, t), () => { st.stop = tween(320, t => drawNow(g, 1 - t)); }); } },
  time: { html: `<svg class="glyph time" viewBox="0 0 72 72" aria-hidden="true"><path class="arc"/><circle class="dot"/></svg>`,
          draw: drawTime, ms: 720 },
  select: { html: `<svg class="glyph select" viewBox="0 0 72 72" aria-hidden="true">${'<path class="stroke sel"/>'.repeat(4)}</svg>`,
          draw: drawSelect, ms: 460 },
  add:  { html: `<svg class="glyph add" viewBox="0 0 72 72" aria-hidden="true">${'<path class="stroke arm4"/>'.repeat(4)}</svg>`,
          init: g => drawPlus(g, 28, 0),
          set: (g, on, st) => {                                    // back into the centre from wherever it is, then out
            const len0 = st.len ?? 28, turn0 = st.turn ?? 0, turn = on ? 45 : 0;
            st.stop(); st.stop = tween(220 * len0 / 28, t => { st.len = len0 * (1 - t); st.turn = turn0; drawPlus(g, st.len, turn0); },
              () => { st.stop = tween(280, t => { st.len = 28 * t; st.turn = turn; drawPlus(g, st.len, turn); }); });
          } },
  /* Einstellungen: three pills, rows (closed) ⇄ columns (open, as the panel that comes in as a column), passing
     through three diagonal dots. Its pieces move by CSS transitions (styles/header-icons.css) */
  settings: { html: `<span class="glyph settings" data-pose="rows" aria-hidden="true"><span class="piece p1"></span><span class="piece p2"></span><span class="piece p3"></span></span>`,
          set: (g, on, st) => {
            clearTimeout(st.timer);
            if(reducedMotion()){ g.dataset.pose = on ? "cols" : "rows"; return; }
            g.dataset.pose = "dots"; st.timer = setTimeout(() => { g.dataset.pose = on ? "cols" : "rows"; }, 240);
          } },
};
/* a two-state icon drawn by draw(g, p): from where it is to where it goes, in the share of the time that is left */
function setDrawn(def, g, on, st){
  const from = st.p ?? 0, to = on ? 1 : 0;
  st.stop(); st.stop = tween(def.ms * Math.abs(to - from), t => { st.p = lerp(from, to, t); def.draw(g, st.p); });
}

const iconState = new WeakMap();                       // per button: its name, whether it is on, what it is doing
function mountIcon(el, name){
  const def = HEADER_ICON[name];
  el.insertAdjacentHTML("afterbegin", def.html);
  const g = el.firstElementChild;
  iconState.set(el, { name, g, on:false, stop: () => {} });
  if(def.init) def.init(g); else if(def.draw) def.draw(g, 0);
  return g;
}
function setIcon(el, on){
  const st = iconState.get(el); if(!st || st.on === !!on) return;   // only a change moves it
  st.on = !!on;
  const def = HEADER_ICON[st.name];
  def.set ? def.set(st.g, st.on, st) : setDrawn(def, st.g, st.on, st);
}
function playIcon(el){
  const st = iconState.get(el); if(st && !el.disabled) HEADER_ICON[st.name].play(st.g, st);
}

/* the header's buttons and the add button get theirs at once; the canvas tabs' + takes the add icon at rest (views/canvas/tabs.js) */
[["btnUndo", "undo"], ["btnRedo", "redo"], ["btnToday", "now"], ["btnBudget", "time"], ["btnSettings", "settings"], ["fab", "add"]]
  .forEach(([id, name]) => mountIcon(document.getElementById(id), name));
const addIconHTML = () => { const b = document.createElement("span"); mountIcon(b, "add"); return b.innerHTML; };
