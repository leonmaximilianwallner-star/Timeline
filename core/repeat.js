// core/repeat.js — on which days a repeating event occurs. Moved unchanged from index.html lines 890–926 on 21 Oct 2026.
"use strict";
/* repeat expansion: does event ev occur on dateISO?
   A series may end (`end`: the day after its last occurrence, exclusive like every stored end) and may
   leave out single days (`except`: deleted occurrences). RULEBOOK A.6. */
function occursOn(ev, dateISO){
  if(dateISO < ev.date) return false;
  if(ev.end && dateISO >= ev.end) return false;
  if(ev.except && ev.except.includes(dateISO)) return false;
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
/* a series moved by n days: its removed days and its end move with it (its todos: shiftTodos) */
function shiftSeries(ev, n){
  ev.date = isoDate(addDays(parseISO(ev.date), n));
  if(ev.end) ev.end = isoDate(addDays(parseISO(ev.end), n));
  if(ev.except) ev.except = ev.except.map(d=>isoDate(addDays(parseISO(d), n)));
  ev.todosByDate = shiftTodos(ev.todosByDate, n);
}
/* delete one occurrence, or this one and every later one. Returns what happened, for the toast. */
function deleteOccurrence(s, id, dateISO, following){
  const ev = s.events.find(x=>x.id===id); if(!ev) return null;
  const drop = d => { if(ev.todosByDate) delete ev.todosByDate[d]; };
  if(following){
    if(dateISO <= ev.date){ s.events = s.events.filter(x=>x.id!==id); return "all"; }   // from the first: the whole series
    ev.end = dateISO;
    Object.keys(ev.todosByDate||{}).filter(d=>d >= dateISO).forEach(drop);
    if(ev.except) ev.except = ev.except.filter(d=>d < dateISO);
    return "following";
  }
  ev.except = [...new Set([...(ev.except||[]), dateISO])].sort();
  drop(dateISO);
  return "one";
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
