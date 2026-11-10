// core/hierarchy.js — what belongs to what, and how far it is done (RULEBOOK B.1.8, B.2; Max, 10 Nov 2026).
"use strict";
/* ════════════════════════════════════════════════════════════
   Structure supports, it never demands. A thing may belong to one thing above it,
   however far up, or to nothing; the link can be given, changed or removed
   at any time, from either end. It is stored on the lower thing: `parentId`.
     step  → its phase
     event → a step, or straight to a phase
   Like headings in a text: a phase is a heading, its steps subheadings, events
   the paragraphs, under a subheading or straight under the heading.
   A link to something that no longer exists (deleted on another device) reads as none.
   ════════════════════════════════════════════════════════════ */

/* the thing a thing belongs to (a phase or a step), or null */
function parentOf(plan, thing){
  if(!thing || !thing.parentId) return null;
  return (plan.phases || []).find(p => p.id === thing.parentId) || (plan.steps || []).find(s => s.id === thing.parentId) || null;
}

/* the phase a thing sits in, however far up: itself under a phase, or through its step */
function phaseOf(plan, thing){
  const parent = parentOf(plan, thing);
  if(!parent) return null;
  return (plan.phases || []).includes(parent) ? parent : phaseOf(plan, parent);
}

/* a phase's steps, in their order */
function stepsOf(plan, phase){
  return (plan.steps || []).filter(s => s.parentId === phase.id).sort((a, b) => (a.order || 0) - (b.order || 0));
}
/* the order for a step added at the end of its phase */
function nextStepOrder(plan, phaseId){
  return (plan.steps || []).filter(s => s.parentId === phaseId).reduce((m, s) => Math.max(m, s.order || 0), 0) + 1;
}

/* the occurrences of the events directly under a parent: [{ ev, day }], by day and time.
   A plain event counts wherever it is (it was put there on purpose);
   a series counts only on its days inside the phase's span, which keeps it finite. */
function occurrencesUnder(plan, parentId, phase){
  const out = [];
  (plan.events || []).filter(ev => ev.parentId === parentId).forEach(ev => {
    if(!ev.repeat || ev.repeat === "none"){ out.push({ ev, day: ev.date }); return; }
    if(!phase) return;
    const n = diffDays(phase.start, phase.end);
    for(let i = 0; i < n; i++){
      const day = isoDate(addDays(parseISO(phase.start), i));
      if(occursOn(ev, day)) out.push({ ev, day });
    }
  });
  return out.sort((a, b) => a.day !== b.day ? (a.day < b.day ? -1 : 1) : a.ev.startMin - b.ev.startMin);
}
const phaseOccurrences = (plan, phase) => occurrencesUnder(plan, phase.id, phase);           // straight under the phase
const stepOccurrences  = (plan, step)  => occurrencesUnder(plan, step.id, phaseOf(plan, step));

/* ── done: the one rule (RULEBOOK B.2; Max, 10 Nov) ──────────────────────────────
   A thing with children to count takes its state from them; a thing without is ticked by hand,
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

/* a step: by its events (every occurrence done), or, without any, by its hand tick (done) */
function stepDone(plan, step){
  const occ = stepOccurrences(plan, step);
  return occ.length ? occ.every(o => eventDone(o.ev, o.day)) : !!step.done;
}
/* whether a step's state comes from its events (then a tap on its mark can't tick it) */
const stepHasEvents = (plan, step) => stepOccurrences(plan, step).length > 0;

/* inside mutate(): tick a step by hand, or untick it */
function tickStep(step, done){ if(done) step.done = true; else delete step.done; }

/* a phase's progress: its children, each the same weight (B.1.4): its steps, and the
   occurrences of the events straight under it */
function phaseProgress(plan, phase){
  const steps = stepsOf(plan, phase), occ = phaseOccurrences(plan, phase);
  return { done: steps.filter(s => stepDone(plan, s)).length + occ.filter(o => eventDone(o.ev, o.day)).length,
           total: steps.length + occ.length };
}

/* what an event can belong to, for its editor, like a table of contents: each phase with its steps under it.
   The phases on its day first, then the ones not yet over; its current parent is always offered. */
function parentChoices(plan, dayIso, todayIso, currentId){
  const by = (a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0;
  const current = parentOf(plan, { parentId: currentId });
  const currentPhase = current && ((plan.phases || []).includes(current) ? current : phaseOf(plan, current));
  const all = plan.phases || [];
  const onDay = all.filter(p => p.start <= dayIso && dayIso < p.end).sort(by);
  const later = all.filter(p => !onDay.includes(p) && (p.end > todayIso || p === currentPhase)).sort(by);
  const withSteps = p => ({ phase: p, steps: stepsOf(plan, p) });
  return { onDay: onDay.map(withSteps), later: later.map(withSteps) };
}

/* inside mutate(): delete a step; its events become free (they stay on their days) */
function deleteStep(plan, stepId){
  plan.steps = (plan.steps || []).filter(s => s.id !== stepId);
  (plan.events || []).forEach(ev => { if(ev.parentId === stepId) delete ev.parentId; });
}
/* inside mutate(): delete a phase with its steps (they have nowhere else to be shown until the canvas
   returns); every event under it becomes free. Undo brings all of it back. (B.7) */
function deletePhase(plan, phaseId){
  plan.phases = (plan.phases || []).filter(p => p.id !== phaseId);
  (plan.steps || []).filter(s => s.parentId === phaseId).forEach(s => deleteStep(plan, s.id));
  (plan.events || []).forEach(ev => { if(ev.parentId === phaseId) delete ev.parentId; });
}

/* inside mutate(): everything under a phase wears its colour, so a recoloured phase takes it along (B.3) */
function carryCategory(plan, phaseId, categoryId){
  const under = new Set([phaseId, ...(plan.steps || []).filter(s => s.parentId === phaseId).map(s => s.id)]);
  (plan.events || []).forEach(ev => { if(under.has(ev.parentId)) ev.categoryId = categoryId; });
}
