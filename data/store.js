// data/store.js — state, loading, saving, undo/redo, category lookup. Moved from index.html lines 749–836 on 21 Oct 2026; names updated to the dictionary the same day.
"use strict";
/* ════════════════════════════════════════════════════════════
   state — mutable state object, persist(), undo stack
   S holds the plan (synced later); `device` holds this screen's state (data/device.js).
   ════════════════════════════════════════════════════════════ */
let device = loadDevice();
let S = loadFromStorage();
const UI = {
  addMode:false, range:{ start:null, days:0 },
  undo:[], redo:[],
  settingsOpen:false, settingsForm:null, budgetOpen:false, budgetDays:7,
  editor:null,          // the open editor's context
  todoPanel:null,       // the open todo panel's context
  dragLive:false,
};

function loadFromStorage(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(raw){ const d = JSON.parse(raw); if(d && d.categories) return toCurrentShape(d); }
    /* first start of this version: copy the V2 app's data, which stays untouched under its old key */
    const old = localStorage.getItem(OLD_STORE_KEY);
    if(old){ const d = JSON.parse(old); if(d && d.categories) return saved(toCurrentShape(d, true)); }
  }catch(e){ console.warn("load failed", e); }
  return saved(toCurrentShape(seedData()));
}
function saved(d){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(d)); }catch(e){ console.warn("save failed", e); }
  return d;
}
/* brings any older data (V2 store, V2 export) to today's shape; harmless on data already current.
   takeDeviceState: move V2's theme, density and open dropdowns into this device's state. */
function toCurrentShape(d, takeDeviceState){
  d = migrateData(d);
  if(takeDeviceState){
    if(d.settings){ device.theme = d.settings.theme || device.theme; device.density = d.settings.density || device.density; }
    device.openPhases = (d.phases||[]).filter(p=>p.expanded).map(p=>p.id);
    saveDevice();
  }
  delete d.settings;                                       // device state, not plan
  (d.phases||[]).forEach(p=>{ delete p.expanded; delete p._lane; });
  const now = new Date().toISOString();
  if(!(d.version >= 4)){                                    // version 4 (21 Oct): stored names follow the dictionary
    /* exams and project milestones become one list of milestones */
    const milestones = (d.exams||[]).map(x=>({ id:x.id, title:x.title, date:x.date, categoryId:null, final:false, note:x.points||"" }));
    (d.categories||[]).forEach(c=>{
      (c.milestones||[]).forEach(m=>milestones.push({ id:m.id, title:m.label, date:m.date, categoryId:c.id, final:!!m.end, note:"" }));
      delete c.milestones;
      if(c.end) c.end = dayAfter(c.end);                     // ends become exclusive: the day after the last day
    });
    (d.phases||[]).forEach(p=>{ if(p.end) p.end = dayAfter(p.end); });
    d.milestones = milestones;
    delete d.exams;
    Object.values(d.deleted||{}).forEach(x=>{ if(x.in === "exams") x.in = "milestones"; });
    RECORD_LISTS.forEach(list => (d[list]||[]).forEach(r => { r.updatedAt = now; }));   // all reshaped: all changed
    d.version = 4;
  }
  RECORD_LISTS.forEach(list => (d[list]||[]).forEach(r => { if(!r.updatedAt) r.updatedAt = now; }));
  d.deleted = d.deleted || {};
  return d;
}
/* migrate older shape (separate categories+projects, projectId on phases) to unified categories (with a span: projects) */
function migrateData(d){
  if(Array.isArray(d.projects) && d.projects.length){
    d.projects.forEach(p=>{
      const c = d.categories && d.categories.find(c=>c.id===p.categoryId);
      if(!c) return;
      c.name = p.name;
      c.milestones = p.milestones || [];
      const dates = [
        ...(d.phases||[]).filter(ph=>ph.projectId===p.id).flatMap(ph=>[ph.start, ph.end]),
        ...(p.milestones||[]).map(m=>m.date),
      ].filter(Boolean);
      if(dates.length){
        c.start = dates.reduce((a,b)=> a<b?a:b);
        c.end   = dates.reduce((a,b)=> a>b?a:b);
      } else {
        c.start = todayISO();
        c.end   = isoDate(addDays(new Date(), 30));
      }
      (d.phases||[]).forEach(ph=>{ if(ph.projectId===p.id) ph.categoryId = c.id; });
    });
    delete d.projects;
  }
  if(Array.isArray(d.categories)){
    const grey = "#90909a";
    const dropIds = new Set(d.categories.filter(c=>c.color===grey).map(c=>c.id));
    if(dropIds.size){
      d.categories = d.categories.filter(c=>!dropIds.has(c.id));
      (d.phases||[]).forEach(p=>{ if(dropIds.has(p.categoryId)) p.categoryId = null; });
      (d.events||[]).forEach(e=>{ if(dropIds.has(e.categoryId)) e.categoryId = null; });
    }
  }
  (d.phases||[]).forEach(p=>delete p.projectId);
  return d;
}
function persist(){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
  catch(e){ console.warn("persist failed", e); toast("Speichern fehlgeschlagen"); }
}
/* every mutation goes through mutate(): snapshot → change → persist → render */
function mutate(fn, opts={}){
  const before = JSON.stringify(S);
  UI.undo.push(before);
  if(UI.undo.length > 60) UI.undo.shift();
  UI.redo.length = 0;
  fn(S);
  stampChanges(JSON.parse(before), S, new Date().toISOString());
  persist();
  if(!opts.skipRender) renderAll();
  updateUndoButtons();
}
function undo(){
  if(!UI.undo.length) return;
  UI.redo.push(JSON.stringify(S));
  const before = S;
  S = JSON.parse(UI.undo.pop());
  stampChanges(before, S, new Date().toISOString());       // what undo brings back counts as changed now
  persist(); renderAll(); updateUndoButtons(); toast("Rückgängig");
}
function redo(){
  if(!UI.redo.length) return;
  UI.undo.push(JSON.stringify(S));
  const before = S;
  S = JSON.parse(UI.redo.pop());
  stampChanges(before, S, new Date().toISOString());
  persist(); renderAll(); updateUndoButtons(); toast("Wiederholt");
}
function updateUndoButtons(){
  document.getElementById("btnUndo").toggleAttribute("disabled", !UI.undo.length);
  document.getElementById("btnRedo").toggleAttribute("disabled", !UI.redo.length);
}
const FREE_COLOR = "#90909a";
const cat = id => (id && S.categories.find(c=>c.id===id)) || { id:null, name:"frei", color:FREE_COLOR };

