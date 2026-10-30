// ui/recording.js — the add menu above the add button, and recording an actual live (RULEBOOK A.8 "Add menu", "Recording").
"use strict";
/* The add menu opens with add mode and closes with it. Its rows (the red dot says "record"): record (for each planned event "now" can
   mean, closest first, then "ohne Plan"), or stop while an actual is running. Starting and stopping go
   through mutate, so both sync and undo like any change. The rules live in core/actuals.js. */
const $addMenu = document.getElementById("addMenu");
const MAX_RECORD_ROWS = 2;       // planned events offered at once; more would bury the button

const nowMinutes = () => { const d = new Date(); return d.getHours()*60 + d.getMinutes(); };
const lateBy = min => min === 0 ? "pünktlich" : (min > 0 ? "+" : "−") + fmtDur(Math.abs(min));

function renderAddMenu(){
  const today = todayISO(), now = nowMinutes();
  const run = runningActual(S.actuals);
  let rows;
  if(run){
    const plan = run.eventId && S.events.find(ev=>ev.id===run.eventId);
    rows = [{ act:"stop", title: plan ? plan.title : "Ohne Plan", meta: fmtDur(actualEnd(run, today, now) - run.startMin) }];
  } else {
    rows = recordCandidates(S.events, today, now).slice(0, MAX_RECORD_ROWS)
      .map(ev=>({ act:"record", id:ev.id, title:ev.title || "Termin", meta: lateBy(now - ev.startMin), color: cat(ev.categoryId).color }));
    rows.push({ act:"record", id:"", title:"Ohne Plan", meta:"" });
  }
  $addMenu.innerHTML = rows.map(r=>
    `<button type="button" class="add-menu-item" data-act="${r.act}" data-id="${r.id ?? ""}" title="${r.act === "stop" ? "Aufnahme stoppen" : "Aufnehmen: " + esc(r.title)}">
       <span class="rec-mark ${r.act}"></span>
       ${r.act === "stop" ? `<span class="am-label">Stopp</span>` : ""}
       <span class="am-title">${r.color ? `<span class="dot" style="background:${r.color}"></span>` : ""}${esc(r.title)}</span>
       ${r.meta ? `<span class="am-meta">${esc(r.meta)}</span>` : ""}
     </button>`).join("");
}

$addMenu.addEventListener("click", e=>{
  const b = e.target.closest(".add-menu-item"); if(!b) return;
  const today = todayISO(), now = nowMinutes();
  if(b.dataset.act === "stop"){
    let result = null;
    mutate(s=>{ result = stopActual(s, today, now); });
    toast(result === "dropped" ? "Aufnahme verworfen (unter 1 min)" : "Ist gespeichert");
  } else {
    const ev = b.dataset.id ? S.events.find(x=>x.id===b.dataset.id) : null;
    mutate(s=>{
      stopActual(s, today, now);                                   // only one runs at a time
      s.actuals.push(newActual(ev, today, now, uid()));
    });
    toast("Aufnahme läuft" + (ev ? " · " + ev.title : ""));
  }
  setAddMode(false);
});

/* the add button shows a running recording, also while the menu is closed (re-applied on every redraw) */
function showRecording(){
  $fab.classList.toggle("recording", !!runningActual(S.actuals));
}
