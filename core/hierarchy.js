// core/hierarchy.js — what belongs to what, and how far it is done (RULEBOOK B.1.8, B.2; Max, 10 Nov 2026).
"use strict";
/* ════════════════════════════════════════════════════════════
   Structure supports, it never demands. A thing may belong to one thing above it,
   however far up, or to nothing; the link can be given, changed or removed
   at any time, from either end. It is stored on the lower thing: `parentId`.
   Today: an event may belong to a phase. Steps (between them) come next and use
   the same field, so an event then belongs to a step or straight to a phase.
   A link to something that no longer exists (deleted on another device) reads as none.
   ════════════════════════════════════════════════════════════ */

/* the phase an event belongs to, or null */
function phaseOf(plan, ev){
  return (ev && ev.parentId && (plan.phases || []).find(p => p.id === ev.parentId)) || null;
}

/* the occurrences of a phase's events: [{ ev, day }], by day and time.
   A plain event counts wherever it is (it was put there on purpose);
   a series counts only on its days inside the phase's span, which keeps it finite. */
function phaseOccurrences(plan, phase){
  const out = [];
  (plan.events || []).filter(ev => ev.parentId === phase.id).forEach(ev => {
    if(!ev.repeat || ev.repeat === "none"){ out.push({ ev, day: ev.date }); return; }
    const n = diffDays(phase.start, phase.end);
    for(let i = 0; i < n; i++){
      const day = isoDate(addDays(parseISO(phase.start), i));
      if(occursOn(ev, day)) out.push({ ev, day });
    }
  });
  return out.sort((a, b) => a.day !== b.day ? (a.day < b.day ? -1 : 1) : a.ev.startMin - b.ev.startMin);
}

/* ── done: the one rule (RULEBOOK B.2; Max, 10 Nov) ──────────────────────────────
   A thing with children takes its state from them; a thing without is ticked by hand,
   like a section without subheadings that is complete on its own. Every view asks here. */

/* a list of todos: true when every one that counts is done, false when one is still to do,
   null when none counts (none at all, or all cancelled): then the hand tick decides */
function todosDone(list){
  const counted = (list || []).filter(t => t.state !== "cancelled");
  return counted.length ? counted.every(t => t.state === "done") : null;
}

/* one occurrence of an event: by its todos, or, without any to count, by its hand tick (doneByDate) */
function eventDone(ev, day){
  const byTodos = todosDone(todosOf(ev, day));
  return byTodos === null ? !!(ev.doneByDate && ev.doneByDate[day]) : byTodos;
}

/* inside mutate(): tick an occurrence by hand, or untick it */
function tickEvent(ev, day, done){
  const m = { ...(ev.doneByDate || {}) };
  if(done) m[day] = true; else delete m[day];
  if(Object.keys(m).length) ev.doneByDate = m; else delete ev.doneByDate;
}

/* a phase's progress from its events: equal weight per occurrence (B.1.4) */
function phaseProgress(plan, phase){
  const occ = phaseOccurrences(plan, phase);
  return { done: occ.filter(o => eventDone(o.ev, o.day)).length, total: occ.length };
}

/* the phases an event can belong to, for its editor: those on its day first, then the ones not yet over.
   Its current phase is always offered, even if long past. */
function phaseChoices(plan, dayIso, todayIso, currentId){
  const by = (a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0;
  const all = plan.phases || [];
  const onDay = all.filter(p => p.start <= dayIso && dayIso < p.end).sort(by);
  const later = all.filter(p => !onDay.includes(p) && (p.end > todayIso || p.id === currentId)).sort(by);
  return { onDay, later };
}

/* inside mutate(): the events of a deleted phase become free again; nothing else is deleted with it (B.7) */
function freeChildren(plan, phaseId){
  (plan.events || []).forEach(ev => { if(ev.parentId === phaseId) delete ev.parentId; });
}

/* inside mutate(): a phase's events wear its colour, so a recoloured phase takes them along (B.3) */
function carryCategory(plan, phaseId, categoryId){
  (plan.events || []).forEach(ev => { if(ev.parentId === phaseId) ev.categoryId = categoryId; });
}
