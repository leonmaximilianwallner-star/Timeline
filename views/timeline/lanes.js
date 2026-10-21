// views/timeline/lanes.js — packs phases into lanes. Moved from index.html lines 879–889 on 21 Oct 2026; names updated to the dictionary the same day.
"use strict";
/* greedy interval lane packing for phase pills */
function packLanes(items){
  const lanes = [];
  items.slice().sort((a,b)=> a.start<b.start?-1:1).forEach(it=>{
    let lane = lanes.find(l => l[l.length-1].end < it.start);
    if(!lane){ lane = []; lanes.push(lane); }
    lane.push(it); it._lane = lanes.indexOf(lane);
  });
  return lanes.length;
}

