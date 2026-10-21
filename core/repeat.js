// core/repeat.js — on which days a repeating event occurs. Moved unchanged from index.html lines 890–926 on 21 Oct 2026.
"use strict";
/* repeat expansion: does event ev occur on dateISO? */
function occursOn(ev, dateISO){
  if(dateISO < ev.date) return false;
  if(ev.repeat === "none" || !ev.repeat) return ev.date === dateISO;
  const base = parseISO(ev.date), d = parseISO(dateISO);
  switch(ev.repeat){
    case "daily":    return true;
    case "weekly":   return base.getDay() === d.getDay();
    case "weekdays": return d.getDay() >= 1 && d.getDay() <= 5;
    case "monthly": {
      const want = base.getDate();
      const last = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
      return d.getDate() === Math.min(want, last);   // 29/30/31 clamp
    }
  }
  return false;
}
/* all occurrences (ev × date) in [fromISO, toISO] inclusive */
function occurrencesIn(fromISO, toISO){
  const out = [];
  const n = diffDays(fromISO, toISO);
  for(let i=0;i<=n;i++){
    const d = isoDate(addDays(parseISO(fromISO), i));
    S.events.forEach(ev=>{ if(occursOn(ev,d)) out.push({ ev, date:d }); });
  }
  return out;
}
/* latest occurrence date of an event up to a given date */
function latestOccurrence(ev, uptoISO){
  if(ev.repeat==="none" || !ev.repeat) return ev.date <= uptoISO ? ev.date : null;
  for(let i=0;i<730;i++){
    const d = isoDate(addDays(parseISO(uptoISO), -i));
    if(d < ev.date) return null;
    if(occursOn(ev,d)) return d;
  }
  return null;
}
