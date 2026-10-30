// core/actuals.js — the Ist: time actually spent, next to the plan (RULEBOOK A.4 "Actual"). Pure: no screen, no storage.
"use strict";
/* An actual is its own record: { id, date, startMin, endMin, eventId, occurrence, categoryId }.
   eventId + occurrence name the planned event (and which day of a series) it was for; both null when
   it happened without a plan. endMin null: it is running right now (started with the record button).
   A plan may have several actuals (interrupted work); an actual never moves when its plan moves. */
const RECORD_LEAD = 30;    // minutes: pressing record up to this long before a planned start still means that event

/* the one running actual, or null */
function runningActual(actuals){
  return (actuals || []).find(a => a.endMin == null) || null;
}

/* where an actual ends for drawing and counting: a running one ends now (on its own day), or at
   midnight if its day is over; never before it began */
function actualEnd(a, todayIso, nowMin){
  if(a.endMin != null) return a.endMin;
  const end = a.date < todayIso ? HOUR_END*60 : nowMin;
  return Math.max(end, a.startMin + 1);
}

/* which planned events "record" means at this moment: today's occurrences whose window
   [start − RECORD_LEAD, planned end] holds now, the closest start first */
function recordCandidates(events, todayIso, nowMin){
  return (events || [])
    .filter(ev => occursOn(ev, todayIso) && nowMin >= ev.startMin - RECORD_LEAD && nowMin < ev.endMin)
    .sort((a, b) => Math.abs(a.startMin - nowMin) - Math.abs(b.startMin - nowMin) || a.startMin - b.startMin);
}

/* a new running actual for an event (or for no plan: ev null) */
function newActual(ev, todayIso, nowMin, id){
  return { id, date: todayIso, startMin: nowMin, endMin: null,
           eventId: ev ? ev.id : null, occurrence: ev ? todayIso : null, categoryId: ev ? (ev.categoryId ?? null) : null };
}

/* stops the running actual at now. Returns "stopped", or "dropped" when it ran under a minute
   (an accidental tap leaves nothing behind), or null when nothing was running. Changes `plan`. */
function stopActual(plan, todayIso, nowMin){
  const a = runningActual(plan.actuals); if(!a) return null;
  const end = a.date < todayIso ? HOUR_END*60 : nowMin;     // ran past midnight: it ends with its day (corrected by hand)
  if(end - a.startMin < 1){ plan.actuals = plan.actuals.filter(x => x !== a); return "dropped"; }
  a.endMin = end;
  return "stopped";
}

/* the actuals drawn on a day */
function actualsOn(actuals, dayIso){
  return (actuals || []).filter(a => a.date === dayIso);
}

/* does this occurrence of a planned event have an actual? Then the plan is drawn as its outline only */
function hasActual(actuals, eventId, dayIso){
  return (actuals || []).some(a => a.eventId === eventId && a.occurrence === dayIso);
}

/* lays out things that overlap side by side: items { s, e } in start order get .col and .cols.
   Used once for the plans and once for the actuals, so a plan and its own actual never sit side by side. */
function packOverlaps(items){
  let group = [], groupEnd = -1;
  const flush = () => {
    const colsEnd = [];
    group.forEach(o => {
      let c = colsEnd.findIndex(end => end <= o.s);
      if(c === -1){ c = colsEnd.length; colsEnd.push(0); }
      colsEnd[c] = o.e; o.col = c;
    });
    group.forEach(o => { o.cols = colsEnd.length; });
    group = []; groupEnd = -1;
  };
  [...items].sort((a, b) => a.s - b.s || b.e - a.e).forEach(o => {
    if(group.length && o.s >= groupEnd) flush();
    group.push(o); groupEnd = Math.max(groupEnd, o.e);
  });
  if(group.length) flush();
  return items;
}
