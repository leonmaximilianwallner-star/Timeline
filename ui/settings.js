// ui/settings.js — settings. Moved unchanged from index.html lines 2136–2309 on 21 Oct 2026.
"use strict";
/* ════════════════════════════════════════════════════════════
   settings — slide-in panel; no save button, persist() applies live
   ════════════════════════════════════════════════════════════ */
const $set = document.getElementById("setPanel");
function toggleSettings(on){
  UI.settingsOpen = on ?? !UI.settingsOpen;
  if(UI.settingsOpen) renderSettings();
  $set.classList.toggle("open", UI.settingsOpen);
}
function renderSettings(){
  const grey = "#90909a";
  const projs = S.categories.filter(c=>c.start && c.end);
  const cats  = S.categories.filter(c=>!c.start && !c.end);
  const colorPicker = exceptId => {
    const claimed = new Map(S.categories.filter(c=>c.id!==exceptId).map(c=>[c.color, c.name]));
    return `<div class="cpicker">${PALETTE.filter(c=>c!==grey).map(c=>{
      const taken = claimed.has(c);
      return `<button type="button" class="csw${taken?" taken":""}" data-col="${c}" ${taken?`disabled title="belegt von ${esc(claimed.get(c))}"`:""} style="background:${c}"></button>`;
    }).join("")}</div>`;
  };
  const projForm = `<div class="add-form" id="sNewProjForm">
    ${colorPicker(null)}
    <input id="sNewProjName" type="text" placeholder="Projektname" autocomplete="off">
    <div class="af-dates">
      <input id="sNewProjStart" type="date" value="${todayISO()}">
      <input id="sNewProjEnd" type="date" value="${isoDate(addDays(new Date(), 30))}">
    </div>
    <div class="af-actions">
      <button class="btn" data-act="cancel">Abbrechen</button>
      <button class="btn primary" data-act="save-proj">Speichern</button>
    </div></div>`;
  const catForm = `<div class="add-form" id="sNewCatForm">
    ${colorPicker(null)}
    <input id="sNewCatName" type="text" placeholder="Kategorie-Name" autocomplete="off">
    <div class="af-actions">
      <button class="btn" data-act="cancel">Abbrechen</button>
      <button class="btn primary" data-act="save-cat">Speichern</button>
    </div></div>`;

  $set.innerHTML = `<div style="display:flex;align-items:center;gap:10px"><h2 style="flex:1">Einstellungen</h2>
    <button class="cbtn small" id="sClose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>

    <section><h3>Darstellung</h3><div class="seg" id="sTheme">
      <button data-t="dark" class="${device.theme==="dark"?"on":""}">Dunkel</button>
      <button data-t="light" class="${device.theme==="light"?"on":""}">Hell</button></div></section>

    <section><h3>Sichtbare Tage (Zoom)</h3><div class="seg" id="sDens">
      ${[3,5,7].map(d=>`<button data-d="${d}" class="${device.density===d?"on":""}">${d}</button>`).join("")}</div></section>

    <section><h3>Projekte</h3>
      <div id="sProjs">${projs.map(p=>`<div class="catRow" data-pid="${p.id}">
        <span class="colDot" style="background:${p.color}"></span>
        <input type="text" value="${esc(p.name)}" data-f="name">
        <input type="date" value="${p.start}" data-f="start">
        <input type="date" value="${lastDay(p.end)}" data-f="end">
        <button class="cbtn small" data-del title="Löschen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button></div>`).join("")}</div>
      <button class="btn" id="sAddProj" style="margin-top:4px">+ Projekt</button>
      ${UI.settingsForm==="proj" ? projForm : ""}</section>

    <section><h3>Kategorien</h3>
      <div id="sCats">${cats.map(c=>`<div class="catRow" data-cid="${c.id}">
        <span class="colDot" style="background:${c.color}"></span>
        <input type="text" value="${esc(c.name)}" data-f="name">
        <button class="cbtn small" data-del title="Löschen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button></div>`).join("")}</div>
      <button class="btn" id="sAddCat" style="margin-top:4px">+ Kategorie</button>
      ${UI.settingsForm==="cat" ? catForm : ""}
      <p class="note" style="margin-top:8px">Grau ist fix für „frei". Jede Farbe gehört nur einem Projekt oder einer Kategorie.</p></section>

    <section><h3>Daten</h3><div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" id="sExport">Exportieren</button>
      <button class="btn" id="sImport">Importieren</button>
      <input id="sFile" type="file" accept="application/json" style="display:none"></div>
      <p class="note" style="margin-top:8px">Alles liegt lokal in diesem Browser (localStorage). Export = JSON-Sicherung.</p></section>

    <section><h3>Erinnerungen</h3><p class="note">Benachrichtigungen funktionieren, solange die App offen oder (auf Android) kürzlich im Hintergrund ist. Es gibt keinen Server — bei geschlossener App kann kein Push zugestellt werden.</p></section>`;

  $set.querySelector("#sClose").onclick = ()=>toggleSettings(false);
  $set.querySelectorAll("#sTheme button").forEach(b=>b.onclick=()=>{ setDevice(dv=>{ dv.theme=b.dataset.t; }); renderSettings(); });
  $set.querySelectorAll("#sDens button").forEach(b=>b.onclick=()=>{ setDevice(dv=>{ dv.density=+b.dataset.d; }); renderSettings(); });

  $set.querySelectorAll(".cpicker").forEach(pk=>pk.addEventListener("click", e=>{
    const sw = e.target.closest(".csw"); if(!sw || sw.classList.contains("taken")) return;
    pk.querySelectorAll(".csw").forEach(x=>x.classList.remove("on"));
    sw.classList.add("on");
  }));

  $set.querySelectorAll("#sProjs .catRow").forEach(row=>{
    const pid = row.dataset.pid;
    row.querySelector('[data-f="name"]').addEventListener("change", e=>mutate(s=>{
      const p = s.categories.find(c=>c.id===pid); if(p) p.name = e.target.value.trim() || "Projekt";
    }));
    row.querySelector('[data-f="start"]').addEventListener("change", e=>mutate(s=>{
      const p = s.categories.find(c=>c.id===pid); if(!p) return;
      p.start = e.target.value; if(p.end <= p.start) p.end = dayAfter(p.start);   // stored end: the day after the last day
    }));
    row.querySelector('[data-f="end"]').addEventListener("change", e=>mutate(s=>{
      const p = s.categories.find(c=>c.id===pid); if(!p) return;
      p.end = dayAfter(e.target.value); if(p.end <= p.start) p.end = dayAfter(p.start);
    }));
    row.querySelector("[data-del]").onclick = ()=>{
      mutate(s=>{
        s.categories = s.categories.filter(c=>c.id!==pid);
        s.milestones = s.milestones.filter(m=>m.categoryId!==pid);   // a project's milestones go with it, as before
        s.phases.forEach(p=>{ if(p.categoryId===pid) p.categoryId=null; });
        s.events.forEach(e2=>{ if(e2.categoryId===pid) e2.categoryId=null; });
      });
      renderSettings();
    };
  });

  $set.querySelectorAll("#sCats .catRow").forEach(row=>{
    const cid = row.dataset.cid;
    row.querySelector('[data-f="name"]').addEventListener("change", e=>mutate(s=>{
      const c = s.categories.find(x=>x.id===cid); if(c) c.name = e.target.value.trim() || "Kategorie";
    }));
    row.querySelector("[data-del]").onclick = ()=>{
      mutate(s=>{
        s.categories = s.categories.filter(c=>c.id!==cid);
        s.milestones.forEach(m=>{ if(m.categoryId===cid) m.categoryId=null; });
        s.phases.forEach(p=>{ if(p.categoryId===cid) p.categoryId=null; });
        s.events.forEach(e2=>{ if(e2.categoryId===cid) e2.categoryId=null; });
      });
      renderSettings();
    };
  });

  $set.querySelector("#sAddProj").onclick = ()=>{ UI.settingsForm = "proj"; renderSettings(); };
  $set.querySelector("#sAddCat").onclick  = ()=>{ UI.settingsForm = "cat";  renderSettings(); };

  const openForm = $set.querySelector(".add-form");
  if(openForm){
    openForm.querySelector('[data-act="cancel"]').onclick = ()=>{ UI.settingsForm = null; renderSettings(); };
    const saveProj = openForm.querySelector('[data-act="save-proj"]');
    const saveCat  = openForm.querySelector('[data-act="save-cat"]');
    if(saveProj){
      saveProj.onclick = ()=>{
        const sw = openForm.querySelector(".csw.on");
        if(!sw){ toast("Farbe wählen"); return; }
        const name  = openForm.querySelector("#sNewProjName").value.trim() || "Projekt";
        let start = openForm.querySelector("#sNewProjStart").value || todayISO();
        let end   = openForm.querySelector("#sNewProjEnd").value   || start;
        if(end < start) [start, end] = [end, start];
        mutate(s=>s.categories.push({ id:uid(), name, color:sw.dataset.col, start, end:dayAfter(end) }));   // end field shows the last day
        UI.settingsForm = null; renderSettings();
      };
    }
    if(saveCat){
      saveCat.onclick = ()=>{
        const sw = openForm.querySelector(".csw.on");
        if(!sw){ toast("Farbe wählen"); return; }
        const name = openForm.querySelector("#sNewCatName").value.trim() || "Kategorie";
        mutate(s=>s.categories.push({ id:uid(), name, color:sw.dataset.col }));
        UI.settingsForm = null; renderSettings();
      };
    }
    const nameInp = openForm.querySelector('input[type="text"]');
    if(nameInp) setTimeout(()=>nameInp.focus(), 0);
  }

  $set.querySelector("#sExport").onclick = ()=>{
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S,null,2)], {type:"application/json"}));
    a.download = "timeline-export-"+todayISO()+".json"; a.click(); URL.revokeObjectURL(a.href);
  };
  $set.querySelector("#sImport").onclick = ()=>$set.querySelector("#sFile").click();
  $set.querySelector("#sFile").addEventListener("change", e=>{
    const f = e.target.files[0]; if(!f) return;
    f.text().then(t=>{
      const d = JSON.parse(t);
      if(!d || !d.categories || !d.events) throw 0;
      mutate(()=>{ S = toCurrentShape(d); });
      renderSettings(); toast("Import erfolgreich");
    }).catch(()=>toast("Import fehlgeschlagen: ungültige Datei"));
  });
}

