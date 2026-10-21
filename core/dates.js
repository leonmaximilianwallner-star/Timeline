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
/* stored ends are exclusive: the day AFTER a span's last day (RULEBOOK A.6). Screens show the last day. */
function lastDay(endISO){ return isoDate(addDays(parseISO(endISO), -1)); }
function dayAfter(dateISO){ return isoDate(addDays(parseISO(dateISO), 1)); }
function todayISO(){ const t=new Date(); return isoDate(t); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function fmtMin(m){ return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0"); }
function snapMin(m){ return clamp(Math.round(m/SNAP)*SNAP, HOUR_START*60, HOUR_END*60); }
const WD = ["So","Mo","Di","Mi","Do","Fr","Sa"];
const MONTHS = ["Jänner","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const WD_LONG = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
/* a day in words, relative to today (RULEBOOK B.4): Heute · Morgen · Gestern · In n Tagen · Vor n Tagen */
function dayWords(iso){
  const n = diffDays(todayISO(), iso);
  return n===0 ? "Heute" : n===1 ? "Morgen" : n===-1 ? "Gestern" : n>0 ? `In ${n} Tagen` : `Vor ${-n} Tagen`;
}
/* where today stands in a span [start, end): In n Tagen · Noch n Tage · Vor n Tagen zu Ende */
function spanWords(start, end){
  const t = todayISO();
  if(t < start) return dayWords(start);
  if(t < end){ const n = diffDays(t, end); return n===1 ? "Noch heute" : `Noch ${n} Tage`; }
  return dayWords(lastDay(end)) + " zu Ende";
}
/* a length of days in words: 1 Tag · 5 Tage · 3 Wochen (whole weeks from 14 days) */
function daysWords(n){ return n===1 ? "1 Tag" : n>=14 && n%7===0 ? `${n/7} Wochen` : `${n} Tage`; }
function fmtDateLong(s){ const d=parseISO(s); return WD[d.getDay()]+", "+d.getDate()+". "+MONTHS[d.getMonth()]+" "+d.getFullYear(); }
