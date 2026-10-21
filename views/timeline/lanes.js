// views/timeline/lanes.js — packs phases into lanes. Moved from index.html lines 879–889 on 21 Oct 2026; names updated to the dictionary the same day.
"use strict";
/* greedy interval lane packing for phase pills.
   Returns the number of lanes and each phase's lane; writes nothing into the phases (drawing only reads). */
function packLanes(items){
  const lanes = [], laneOf = new Map();
  items.slice().sort((a,b)=> a.start<b.start?-1:1).forEach(it=>{
    let lane = lanes.find(l => l[l.length-1].end <= it.start);   // ends are exclusive: ending the day another starts is no overlap
    if(!lane){ lane = []; lanes.push(lane); }
    lane.push(it); laneOf.set(it, lanes.indexOf(lane));
  });
  return { count: lanes.length, laneOf };
}

