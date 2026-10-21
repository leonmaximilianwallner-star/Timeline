// core/dates.js — date and time helpers. Moved unchanged from index.html lines 716–730 on 21 Oct 2026.
"use strict";
/* ════════════════════════════════════════════════════════════
   utils — dates, misc
   ════════════════════════════════════════════════════════════ */
const DAY_MS = 86400000;
function isoDate(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function parseISO(s){ const [y,m,dd]=s.split("-").map(Number); return new Date(y,m-1,dd); }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function diffDays(a,b){ return Math.round((parseISO(b)-parseISO(a))/DAY_MS); }
function todayISO(){ const t=new Date(); return isoDate(t); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function fmtMin(m){ return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0"); }
function snapMin(m){ return clamp(Math.round(m/SNAP)*SNAP, HOUR_START*60, HOUR_END*60); }
const WD = ["So","Mo","Di","Mi","Do","Fr","Sa"];
const MONTHS = ["Jänner","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
function fmtDateLong(s){ const d=parseISO(s); return WD[d.getDay()]+", "+d.getDate()+". "+MONTHS[d.getMonth()]+" "+d.getFullYear(); }
