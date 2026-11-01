// core/focus.js — the rules of the focus view: what one day shows, which event is open (RULEBOOK A.8 "Focus view"). Pure.
"use strict";
const FOCUS_GAP_MIN = 30;    // minutes: a pause between two events shorter than this is not offered as free time

/* the day's events in order of time: { ev, s, e } (start, end in minutes) */
function focusDay(events, dayIso){
  return (events || []).filter(ev => occursOn(ev, dayIso))
    .map(ev => ({ ev, s: ev.startMin, e: ev.endMin }))
    .sort((a, b) => a.s - b.s || a.e - b.e);
}

/* which event is open when the day is shown: today the one running now, else the next one, else the last;
   on any other day the first. Returns an event id, or null for an empty day. */
function focusOpen(day, isToday, nowMin){
  if(!day.length) return null;
  if(!isToday) return day[0].ev.id;
  const running = day.find(o => o.s <= nowMin && nowMin < o.e);
  if(running) return running.ev.id;
  const next = day.find(o => o.s > nowMin);
  return (next || day[day.length - 1]).ev.id;
}

/* free time between events, at least FOCUS_GAP_MIN long: [{ s, e }]. Before the first and after the last is not counted. */
function focusGaps(day){
  const gaps = [];
  let end = null;
  day.forEach(o => {
    if(end != null && o.s - end >= FOCUS_GAP_MIN) gaps.push({ s: end, e: o.s });
    end = end == null ? o.e : Math.max(end, o.e);
  });
  return gaps;
}

/* the seven days (Monday first) of the week a day belongs to */
function weekOf(dayIso){
  const d = parseISO(dayIso), back = (d.getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => isoDate(addDays(d, i - back)));
}
