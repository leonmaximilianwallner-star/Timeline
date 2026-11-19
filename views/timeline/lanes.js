// views/timeline/lanes.js — lane packing for everything on the timeline. Moved from index.html lines 879–889 on 21 Oct 2026; one function for every kind since 19 Nov 2026.
"use strict";
/* greedy interval packing: by start, each item takes the lowest lane whose last item has ended by then.
   span(item) → [start, end] in days, end exclusive (ending the day another starts is no overlap).
   Over all items, never a range: an item keeps its lane wherever the view is (RULEBOOK B.4.1).
   Returns the number of lanes and each item's lane; writes nothing into the items (drawing only reads). */
function packLanes(items, span){
  const ends = [], laneOf = new Map();
  items.map(it => [it, span(it)]).sort((a,b) => a[1][0] < b[1][0] ? -1 : 1).forEach(([it, [start, end]]) => {
    let lane = ends.findIndex(e => e <= start);
    if(lane < 0) lane = ends.length;
    ends[lane] = end; laneOf.set(it, lane);
  });
  return { count: ends.length, laneOf };
}
const spanOf = it => [dayIdx(it.start), dayIdx(it.end)];          // a phase's or a project's days
const CHIP_DAYS = 3;   // a milestone chip's room in days: its label's width at the rail's scale (120 px), so lanes are the same at every scale
const chipSpan = m => [dayIdx(m.date) + .5 - CHIP_DAYS / 2, dayIdx(m.date) + .5 + CHIP_DAYS / 2];
