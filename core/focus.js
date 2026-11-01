// core/focus.js — the rules of the focus view: what one day shows, which event is open (RULEBOOK A.8 "Focus view"). Pure.
"use strict";
const FOCUS_GAP_MIN = 15;    // minutes: a pause between two events shorter than this is not shown as free time

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

/* free time between events, at least FOCUS_GAP_MIN long: [{ s, e, next }] (next: the event it leads to, which holds
   its note: gapNoteOf). Before the first and after the last is not counted. */
function focusGaps(day){
  const gaps = [];
  let end = null;
  day.forEach(o => {
    if(end != null && o.s - end >= FOCUS_GAP_MIN) gaps.push({ s: end, e: o.s, next: o.ev.id });
    end = end == null ? o.e : Math.max(end, o.e);
  });
  return gaps;
}

/* the note of the free time before an event, on one day ("Pause", "Anfahrt"): stored with the event it leads to,
   so it moves with it (Max, 1 Nov: leave the house in time for a meeting). Per occurrence, as todos are. */
function gapNoteOf(ev, dayIso){ return (ev.gapNotes && ev.gapNotes[dayIso]) || ""; }
function setGapNote(ev, dayIso, text){
  const notes = { ...(ev.gapNotes || {}) };
  if(text) notes[dayIso] = text; else delete notes[dayIso];
  if(Object.keys(notes).length) ev.gapNotes = notes; else delete ev.gapNotes;
}

/* the seven days (Monday first) of the week a day belongs to */
function weekOf(dayIso){
  const d = parseISO(dayIso), back = (d.getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => isoDate(addDays(d, i - back)));
}
