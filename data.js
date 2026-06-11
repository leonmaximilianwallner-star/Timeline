/* ============================================================
   data.js — Konstanten, Farbpalette, Datums-Utilities, Defaults
   Keine Logik, kein State. Wird zuerst geladen.
   ============================================================ */
'use strict';

const STORE_KEY  = 'timeline.v2.data';
const NOTIF_STORE = 'timeline.v2.notified';
const UNDO_MAX   = 50;

/* Tagesraster der Daily-Ansicht */
const DAY_START_MIN = 7 * 60;     // 07:00
const DAY_END_MIN   = 23 * 60;    // 23:00
const SNAP_MIN      = 15;         // 15-Minuten-Raster
const HOUR_H        = 52;         // px pro Stunde
const RAIL_W        = 68;         // Stundenleiste links (sticky)

/* Timeline-Ansicht: komprimierte Tagesbreite */
const TL_DAY_W = 26;              // px pro Tag

/* Kategorie-Farbsystem — niemals isolierte Hexwerte ergänzen */
const PALETTE = [
  { id: 'amber',  name: 'Arbeit',     color: '#f4971f' },
  { id: 'red',    name: 'Prüfung',    color: '#e9473a' },
  { id: 'teal',   name: 'Seminar',    color: '#40838b' },
  { id: 'blue',   name: 'Meeting',    color: '#6498c0' },
  { id: 'green',  name: 'Erledigt',   color: '#8fc14e' },
  { id: 'gray',   name: 'Privat',     color: '#90909a' },
  { id: 'purple', name: 'Sonstiges',  color: '#a060c8' },
  { id: 'orange', name: 'Persönlich', color: '#d86e9a' },
];

const WD_SHORT = ['So','Mo','Di','Mi','Do','Fr','Sa'];
const MONTHS   = ['Januar','Februar','März','April','Mai','Juni','Juli','August',
                  'September','Oktober','November','Dezember'];

/* ---------- Datums-Utilities (alles lokale Zeit, Tagesschlüssel 'YYYY-MM-DD') ---------- */
function uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }

function pd(key) {               // parse day key -> Date (lokal, 12:00 gegen DST-Kanten)
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
function dk(date) {              // Date -> day key
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function todayKey() { return dk(new Date()); }
function addDays(key, n) { const d = pd(key); d.setDate(d.getDate() + n); return dk(d); }
function diffDays(a, b) { return Math.round((pd(b) - pd(a)) / 86400000); }   // b - a
function daysInMonth(y, m0) { return new Date(y, m0 + 1, 0).getDate(); }
function fmtDM(key) { const d = pd(key); return `${d.getDate()}.${d.getMonth() + 1}`; }
function fmtTime(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function snapMin(min) { return Math.round(min / SNAP_MIN) * SNAP_MIN; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* Wiederholungs-Logik inkl. Monats-Clamping (29.–31. -> letzter Tag kürzerer Monate) */
function occursOn(item, dayK) {
  if (dayK < item.day) return false;
  if (item.repeat === 'none' || !item.repeat) return item.day === dayK;
  if (item.day === dayK) return true;
  const base = pd(item.day), d = pd(dayK);
  switch (item.repeat) {
    case 'daily':    return true;
    case 'weekly':   return base.getDay() === d.getDay();
    case 'weekdays': return d.getDay() >= 1 && d.getDay() <= 5;
    case 'monthly': {
      const want = Math.min(base.getDate(), daysInMonth(d.getFullYear(), d.getMonth()));
      return d.getDate() === want;
    }
  }
  return false;
}

/* HTML-Sanitizer für Rich-Text-Details (DOMParser, Whitelist) */
const SAFE_TAGS = new Set(['B','I','U','S','EM','STRONG','BR','P','DIV','SPAN','UL','OL','LI','A','H3','H4','CODE']);
function sanitizeHTML(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  (function walk(node) {
    [...node.childNodes].forEach(ch => {
      if (ch.nodeType === 1) {
        if (!SAFE_TAGS.has(ch.tagName)) { ch.replaceWith(...ch.childNodes); walk(node); return; }
        [...ch.attributes].forEach(a => {
          if (ch.tagName === 'A' && a.name === 'href' && /^https?:/i.test(a.value)) return;
          ch.removeAttribute(a.name);
        });
        if (ch.tagName === 'A') { ch.setAttribute('target','_blank'); ch.setAttribute('rel','noopener'); }
        walk(ch);
      } else if (ch.nodeType !== 3) ch.remove();
    });
  })(doc.body);
  return doc.body.innerHTML;
}

/* ---------- Default-Daten (erster Start) ---------- */
function defaultData() {
  const t = todayKey();
  return {
    savedAt: 0,
    settings: {
      rangeStart: addDays(t, -7),
      rangeEnd:   addDays(t, 49),
      density: 7,
      theme: 'dark',
      gistId: '', gistToken: '',
    },
    categories: PALETTE.map(p => ({ ...p })),
    projects: [{
      id: uid(), name: 'Projekt', categoryId: 'teal',
      milestones: [
        { id: uid(), day: addDays(t, 14), label: 'Kontrolle' },
        { id: uid(), day: addDays(t, 42), label: 'Abgabe', end: true },
      ],
    }],
    phases: [
      { id: uid(), name: 'Vorbereitung', categoryId: 'teal', s: t, t: addDays(t, 10), details: '' },
    ],
    exams: [],
    dailyItems: [],
    openPoints: [{ id: uid(), title: 'Offene Punkte', items: [] }],
  };
}
