// core/todos.js — which todos belong to which day of an event (RULEBOOK A.4 Todo, decided 21 Oct).
"use strict";
/* ════════════════════════════════════════════════════════════
   Todos belong to one occurrence of an event, never to the whole series.
   Stored as ev.todosByDate: { "2026-10-21": [todo, …], … }.
   - A plain event has at most one entry: its own date.
   - A repeating event's occurrences start empty — except that todos left
     "verschoben" (postponed) in the previous occurrence show up in the next
     one, marked as carried. They are only shown until something changes in
     that occurrence; then the list is stored for that day (setTodosOf).
   ════════════════════════════════════════════════════════════ */
function isSeries(ev){ return !!ev.repeat && ev.repeat !== "none"; }

function todosOf(ev, dateISO){
  const byDate = ev.todosByDate || {};
  if(byDate[dateISO]) return byDate[dateISO];
  if(!isSeries(ev)) return [];
  const prev = latestOccurrence(ev, lastDay(dateISO));        // the occurrence before this one
  const before = prev && byDate[prev];
  if(!before) return [];
  return before.filter(t=>t.state === "postponed")
               .map(t=>({ id: t.id + "@" + dateISO, text: t.text, state: "open", carried: true }));
}

/* stores an occurrence's list; call only inside mutate() */
function setTodosOf(ev, dateISO, list){
  ev.todosByDate = { ...(ev.todosByDate || {}), [dateISO]: list };
}

/* moves every occurrence's todos by n days — when an event or series is moved */
function shiftTodos(byDate, days){
  const out = {};
  Object.entries(byDate || {}).forEach(([d, list]) => { out[isoDate(addDays(parseISO(d), days))] = list; });
  return out;
}
