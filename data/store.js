// data/store.js — state, loading, saving, undo/redo, category lookup. Moved from index.html lines 749–836 on 21 Oct 2026; names updated to the dictionary the same day.
"use strict";
/* ════════════════════════════════════════════════════════════
   state — mutable state object, persist(), undo stack
   ════════════════════════════════════════════════════════════ */
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
    if(raw){ const d = JSON.parse(raw); if(d && d.categories) return migrateData(d); }
  }catch(e){ console.warn("load failed", e); }
  return seedData();
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
  UI.undo.push(JSON.stringify(S));
  if(UI.undo.length > 60) UI.undo.shift();
  UI.redo.length = 0;
  fn(S);
  persist();
  if(!opts.skipRender) renderAll();
  updateUndoButtons();
}
function undo(){
  if(!UI.undo.length) return;
  UI.redo.push(JSON.stringify(S));
  S = JSON.parse(UI.undo.pop());
  persist(); renderAll(); updateUndoButtons(); toast("Rückgängig");
}
function redo(){
  if(!UI.redo.length) return;
  UI.undo.push(JSON.stringify(S));
  S = JSON.parse(UI.redo.pop());
  persist(); renderAll(); updateUndoButtons(); toast("Wiederholt");
}
function updateUndoButtons(){
  document.getElementById("btnUndo").toggleAttribute("disabled", !UI.undo.length);
  document.getElementById("btnRedo").toggleAttribute("disabled", !UI.redo.length);
}
const FREE_COLOR = "#90909a";
const cat = id => (id && S.categories.find(c=>c.id===id)) || { id:null, name:"frei", color:FREE_COLOR };

