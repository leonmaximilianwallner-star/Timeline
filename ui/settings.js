// ui/settings.js — settings: a panel below the app header with four pages (RULEBOOK Part C).
"use strict";
/* ════════════════════════════════════════════════════════════
   main      colours (projects and categories in one list), reminders, data, display
   colour    one project or category, its header in its colour: name, span, colour, its phases and milestones
   new       a new project or category
   sync      signing in and out
   No save button: every change applies at once through mutate (or setDevice); only "new" has a ✓.
   ════════════════════════════════════════════════════════════ */
const $set = document.getElementById("setPanel");
const GREY = FREE_COLOR;

function toggleSettings(on, page){
  UI.settingsOpen = on ?? !UI.settingsOpen;
  if(UI.settingsOpen){
    UI.settingsPage = page || { name:"main" };
    document.documentElement.style.setProperty("--below-header", document.getElementById("header").getBoundingClientRect().bottom + "px");
    renderSettings();
  }
  $set.classList.toggle("open", UI.settingsOpen);
  $setScrim.classList.toggle("open", UI.settingsOpen);
  document.getElementById("btnSettings").classList.toggle("open", UI.settingsOpen);   // its button fills while open (mockup)
}
/* the app below the header dims while settings are open; a tap on it closes them */
const $setScrim = document.createElement("div");
$setScrim.className = "set-scrim"; $set.before($setScrim);
document.addEventListener("pointerdown", e=>{
  if(UI.settingsOpen && !e.target.closest("#setPanel") && !e.target.closest("#btnSettings") && !e.target.closest("#editorOverlay")) toggleSettings(false);
}, true);
function goSettings(page){ UI.settingsPage = page; renderSettings(); $set.scrollTop = 0; }

/* colours: grey is "frei" and never a category; each colour belongs to one project or category */
const colourOwner = (colour, exceptId) => S.categories.find(c=>c.color===colour && c.id!==exceptId);
const freeColours = exceptId => PALETTE.filter(c=>c!==GREY && !colourOwner(c, exceptId));
function swatchesHTML(selected, exceptId){
  return `<div class="swatches" role="radiogroup" aria-label="Farbe">${PALETTE.filter(c=>c!==GREY).map(c=>{
    const owner = colourOwner(c, exceptId);
    return `<button type="button" class="swatch${c===selected?" on":""}" role="radio" aria-checked="${c===selected}" data-colour="${c}"
      style="background:${c}" ${owner?`disabled title="belegt von ${esc(owner.name)}"`:""} aria-label="${owner?"belegt von "+esc(owner.name):"frei"}"></button>`;
  }).join("")}</div>`;
}
const shortDate = iso => { const d = parseISO(iso); return String(d.getDate()).padStart(2,"0")+"."+String(d.getMonth()+1).padStart(2,"0")+"."; };
const headerHTML = ({ back, overline, name, nameId, nameLabel, actions="" }) => `<div class="set-header">
  ${back?`<button type="button" class="rbtn" id="sBack" title="Zurück">${icon("left")}</button>`:""}
  <div class="editor-name">${overline?`<span class="editor-kind">${overline}</span>`:""}
    ${nameId?`<input id="${nameId}" type="text" class="set-name" aria-label="${nameLabel}" value="${esc(name)}" placeholder="${nameLabel}" autocomplete="off">`
            :`<h2 class="set-title">${name}</h2>`}</div>
  ${actions}</div>`;

function renderSettings(){
  const page = UI.settingsPage || { name:"main" };
  const c = page.name==="colour" ? S.categories.find(x=>x.id===page.id) : null;
  if(page.name==="colour" && !c){ UI.settingsPage = { name:"main" }; return renderSettings(); }   // deleted meanwhile (undo, sync)
  const tinted = page.name==="colour" || page.name==="new";
  $set.classList.toggle("tinted", tinted);
  $set.style.setProperty("--ed-colour", c ? c.color : page.name==="new" ? page.colour : "");
  $set.innerHTML = page.name==="main" ? mainPage() : page.name==="colour" ? colourPage(c) : page.name==="new" ? newPage(page) : syncPage();
  wireSettings(page, c);
}

/* ── the pages ─────────────────────────────────────────────── */
function mainPage(){
  const projs = S.categories.filter(c=>c.start && c.end), cats = S.categories.filter(c=>!c.start && !c.end);
  const colourRow = c => rowHTML({ icon:`<span class="row-dot" style="background:${c.color}"></span>`, label:esc(c.name),
    value: c.start ? `${shortDate(c.start)} – ${shortDate(lastDay(c.end))}` : "", chev:true, attrs:`data-colour-page="${c.id}"` });
  return headerHTML({ name:"Einstellungen", actions:`<button type="button" class="rbtn outline" id="sClose" title="Schließen">${icon("close")}</button>` }) + `
  <div class="set-body">
    <div class="part"><h3 class="overline">Farben</h3>
      <div class="list">${projs.concat(cats).map(colourRow).join("")}
        <div class="row" aria-disabled="true" style="cursor:default"><span class="row-icon"><span class="row-dot" style="background:${GREY}"></span></span><span class="row-main"><span class="row-label">frei</span><span class="row-value">fix</span></span></div>
        ${rowHTML({ icon:"plus", label:"Projekt oder Kategorie", cls:"add", id:"sAdd" })}
      </div>
      <p class="hint">Jede Farbe gehört genau einem Eintrag. Grau bleibt „frei“.</p></div>

    <div class="part"><h3 class="overline">Erinnerungen</h3>
      <div class="list">
        <label class="row"><span class="row-icon">${icon("bell")}</span><span class="row-main"><span class="row-label">Push-Erinnerungen</span>
          ${pushState.supported?`<input type="checkbox" class="switch" id="sPush" ${pushState.on?"checked":""} ${pushState.busy || (!login && !pushState.on)?"disabled":""}>`:""}</span></label>
      </div>
      <p class="hint" id="pushStatus">${esc(pushStatusText())}</p></div>

    <div class="part"><h3 class="overline">Daten</h3>
      <div class="list">
        ${rowHTML({ icon:"sync", label:"Sync", value: login ? esc(login.user.email) : "Nicht verbunden", chev:true, id:"sSync" })}
        ${rowHTML({ icon:"export", label:"Exportieren", id:"sExport" })}
        ${rowHTML({ icon:"import", label:"Importieren", id:"sImport" })}
      </div>
      <input id="sFile" type="file" accept="application/json" hidden>
      <p class="hint">Alles liegt zuerst auf diesem Gerät; angemeldet wird es mit deinen anderen Geräten abgeglichen. Export = JSON-Sicherung.</p></div>

    <div class="part"><h3 class="overline">Darstellung</h3>
      <div class="list">
        ${rowHTML({ icon:"moon", label:"Thema", value: device.theme==="light" ? "Hell" : "Dunkel",
          pick:`<select id="sTheme" class="row-pick" aria-label="Thema">${optionsHTML([["dark","Dunkel"],["light","Hell"]], device.theme)}</select>` })}
        ${rowHTML({ icon:"columns", label:"Sichtbare Tage", value: String(device.density),
          pick:`<select id="sDens" class="row-pick" aria-label="Sichtbare Tage">${optionsHTML([[3,"3"],[5,"5"],[7,"7"]], device.density)}</select>` })}
      </div></div>
  </div>`;
}

function colourPage(c){
  const isProject = !!(c.start && c.end);
  let body = "";
  if(isProject){
    body += `<div class="when">
      <div class="when-top"><span class="when-big">${spanWords(c.start, c.end)}</span><span class="when-len">${daysWords(diffDays(c.start, c.end))}</span></div>
      <span class="when-sub"><input id="sStart" type="date" aria-label="Beginn" value="${c.start}">–<input id="sEnd" type="date" aria-label="Ende (letzter Tag)" value="${lastDay(c.end)}"></span></div>`;
  }
  body += `<div class="part"><h3 class="overline">Farbe</h3>${swatchesHTML(c.color, c.id)}</div>`;
  if(isProject){
    const phases = S.phases.filter(p=>p.categoryId===c.id).sort((a,b)=>a.start<b.start?-1:1);
    const stones = S.milestones.filter(m=>m.categoryId===c.id).sort((a,b)=>a.date<b.date?-1:1);
    body += `<div class="part"><h3 class="overline">Phasen und Meilensteine</h3>
      <div class="list">${phases.map(p=>rowHTML({ icon:`<span class="row-phase" style="background:${c.color}"></span>`, label:esc(p.title),
          value:`${shortDate(p.start)} – ${shortDate(lastDay(p.end))}`, chev:true, attrs:`data-open-phase="${p.id}"` })).join("")}
        ${stones.map(m=>rowHTML({ icon:`<span class="row-diamond"></span>`, label:esc(m.title)+(m.final?" ★":""),
          value:shortDate(m.date), chev:true, attrs:`data-open-milestone="${m.id}"` })).join("")}
        ${!phases.length && !stones.length ? `<div class="row" style="cursor:default"><span class="row-main"><span class="row-label" style="color:var(--fg-muted)">Noch keine; auf der Zeitleiste anlegen.</span></span></div>` : ""}
      </div></div>`;
  }
  return headerHTML({ back:true, overline: isProject ? "Projekt" : "Kategorie", name:c.name, nameId:"sName", nameLabel:"Name",
    actions:`<button type="button" class="rbtn" id="sDelete" title="${isProject?"Projekt":"Kategorie"} löschen">${icon("bin")}</button>` })
    + `<div class="set-body">${body}</div>`;
}

function newPage(page){
  return headerHTML({ back:true, overline:"Neu", name:page.title||"", nameId:"sNewName", nameLabel:page.kind==="project"?"Projektname":"Name der Kategorie",
    actions:`<button type="button" class="rbtn fill" id="sCreate" title="Anlegen" ${freeColours(null).length?"":"disabled"}>${icon("done")}</button>` }) + `
  <div class="set-body">
    <div class="choice" id="sNewKind"><button type="button" data-kind="category" class="${page.kind!=="project"?"on":""}">Kategorie</button><button type="button" data-kind="project" class="${page.kind==="project"?"on":""}">Projekt</button></div>
    ${page.kind==="project" ? `<div class="when"><span class="when-sub" style="font-size:16px; color:var(--text)">
      <input id="sNewStart" type="date" aria-label="Beginn" value="${page.start}">–<input id="sNewEnd" type="date" aria-label="Ende (letzter Tag)" value="${page.end}"></span>
      <span class="when-sub">${daysWords(diffDays(page.start, page.end)+1)}</span></div>` : ""}
    <div class="part"><h3 class="overline">Farbe</h3>${swatchesHTML(page.colour, null)}</div>
    ${freeColours(null).length ? "" : `<p class="hint" style="color:var(--text)">Alle sieben Farben sind belegt. Lösche eine Kategorie, um eine Farbe frei zu machen.</p>`}
    <p class="hint">${page.kind==="project" ? "Ein Projekt hat einen Zeitraum und wird auf der Zeitleiste als Linie mit seinen Meilensteinen gezeigt." : "Eine Kategorie ist eine benannte Farbe für Termine, Phasen und Meilensteine."}</p>
  </div>`;
}

function syncPage(){
  const body = login ? `<div class="list">
      <div class="row" style="cursor:default"><span class="row-icon">${icon("sync")}</span><span class="row-main"><span class="row-label">Konto</span><span class="row-value">${esc(login.user.email)}</span></span></div>
      ${rowHTML({ icon:"sync", label:"Jetzt synchronisieren", id:"sSyncNow" })}
      ${rowHTML({ icon:"out", label:"Abmelden", cls:"danger", id:"sSignOut" })}
    </div>`
    : SYNC_KEY ? `<div class="list">
      <div class="row"><span class="row-main"><input id="sEmail" class="row-input" type="email" placeholder="E-Mail" autocomplete="username"></span></div>
      <div class="row"><span class="row-main"><input id="sPassword" class="row-input" type="password" placeholder="Passwort" autocomplete="current-password"></span></div>
    </div>
    <button type="button" class="wide-btn" id="sSignIn">Anmelden</button>` : "";
  return headerHTML({ back:true, overline:"Daten", name:"Sync" }) + `<div class="set-body">${body}
    <p class="hint" id="syncStatus">${esc(syncStatusText())}</p></div>`;
}

/* ── wiring ────────────────────────────────────────────────── */
function wireSettings(page, c){
  const $ = sel => $set.querySelector(sel);
  const on = (sel, ev, fn) => { const el = $(sel); if(el) el.addEventListener(ev, fn); };
  on("#sClose", "click", ()=>toggleSettings(false));
  on("#sBack", "click", ()=>goSettings(page.name==="colour" || page.name==="new" || page.name==="sync" ? { name:"main" } : page));

  if(page.name==="main"){
    $set.querySelectorAll("[data-colour-page]").forEach(r=>r.onclick = ()=>goSettings({ name:"colour", id:r.dataset.colourPage }));
    on("#sAdd", "click", ()=>goSettings({ name:"new", kind:"category", colour:freeColours(null)[0] || PALETTE[0],
      start:todayISO(), end:isoDate(addDays(new Date(), 30)) }));
    on("#sSync", "click", ()=>goSettings({ name:"sync" }));
    on("#sPush", "change", e=>{ e.target.checked = pushState.on; togglePush(); });   // the switch shows what is, not what was tapped
    on("#sTheme", "change", e=>{ setDevice(dv=>{ dv.theme = e.target.value; }); renderSettings(); });
    on("#sDens", "change", e=>{ setDevice(dv=>{ dv.density = +e.target.value; }); renderSettings(); });
    on("#sExport", "click", ()=>{
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(S,null,2)], {type:"application/json"}));
      a.download = "timeline-export-"+todayISO()+".json"; a.click(); URL.revokeObjectURL(a.href);
    });
    on("#sImport", "click", ()=>$("#sFile").click());
    on("#sFile", "change", e=>{
      const f = e.target.files[0]; if(!f) return;
      f.text().then(t=>{
        const d = JSON.parse(t);
        if(!d || !d.categories || !d.events) throw 0;
        mutate(()=>{ S = toCurrentShape(d); });
        renderSettings(); toast("Import erfolgreich");
      }).catch(()=>toast("Import fehlgeschlagen: ungültige Datei"));
    });
  }

  $set.querySelectorAll(".when input").forEach(inp=>inp.addEventListener("click", ()=>{ try{ inp.showPicker(); }catch(_){} }));   // as in the editor
  if(page.name==="colour"){
    const id = c.id, isProject = !!(c.start && c.end);
    const change = fn => { mutate(s=>{ const x = s.categories.find(k=>k.id===id); if(x) fn(x); }); renderSettings(); };
    on("#sName", "change", e=>change(x=>{ x.name = e.target.value.trim() || (isProject ? "Projekt" : "Kategorie"); }));
    on("#sStart", "change", e=>change(x=>{ x.start = e.target.value; if(x.end <= x.start) x.end = dayAfter(x.start); }));   // stored end: the day after the last day
    on("#sEnd", "change", e=>change(x=>{ x.end = dayAfter(e.target.value); if(x.end <= x.start) x.end = dayAfter(x.start); }));
    $set.querySelectorAll(".swatch").forEach(b=>b.onclick = ()=>change(x=>{ x.color = b.dataset.colour; }));   // its things follow: they point at the category, not the colour
    $set.querySelectorAll("[data-open-phase]").forEach(r=>r.onclick = ()=>{
      const ph = S.phases.find(p=>p.id===r.dataset.openPhase); toggleSettings(false); if(ph) openEditor({ type:"phase", edit:ph }); });
    $set.querySelectorAll("[data-open-milestone]").forEach(r=>r.onclick = ()=>{
      const m = S.milestones.find(x=>x.id===r.dataset.openMilestone); toggleSettings(false); if(m) openEditor({ type:"milestone", edit:m }); });
    on("#sDelete", "click", ()=>{
      mutate(s=>{
        s.categories = s.categories.filter(k=>k.id!==id);
        if(isProject) s.milestones = s.milestones.filter(m=>m.categoryId!==id);   // a project's milestones go with it, as before
        else s.milestones.forEach(m=>{ if(m.categoryId===id) m.categoryId=null; });
        s.phases.forEach(p=>{ if(p.categoryId===id) p.categoryId=null; });
        s.events.forEach(e2=>{ if(e2.categoryId===id) e2.categoryId=null; });
      });
      toast(`„${c.name}“ gelöscht`);
      goSettings({ name:"main" });
    });
  }

  if(page.name==="new"){
    const keep = ()=>{ const n = $("#sNewName"); if(n) page.title = n.value; const a = $("#sNewStart"), b = $("#sNewEnd"); if(a) page.start = a.value || page.start; if(b) page.end = b.value || page.end; };
    $set.querySelectorAll("#sNewKind button").forEach(b=>b.onclick = ()=>{ keep(); page.kind = b.dataset.kind; renderSettings(); });
    $set.querySelectorAll(".swatch").forEach(b=>b.onclick = ()=>{ keep(); page.colour = b.dataset.colour; renderSettings(); });
    on("#sNewStart", "change", ()=>{ keep(); renderSettings(); });
    on("#sNewEnd", "change", ()=>{ keep(); renderSettings(); });
    const create = ()=>{
      keep();
      if(colourOwner(page.colour, null)){ toast("Keine Farbe mehr frei"); return; }
      const name = (page.title||"").trim() || (page.kind==="project" ? "Projekt" : "Kategorie");
      let { start, end } = page; if(end < start) [start, end] = [end, start];
      const id = uid();
      mutate(s=>s.categories.push(page.kind==="project" ? { id, name, color:page.colour, start, end:dayAfter(end) } : { id, name, color:page.colour }));
      goSettings({ name:"colour", id });
    };
    on("#sCreate", "click", create);
    on("#sNewName", "keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); create(); } });
    const n = $("#sNewName"); if(n) setTimeout(()=>n.focus(), 0);
  }

  if(page.name==="sync"){
    /* only the status line updates while signing in, so typed input stays */
    const signInBtn = $("#sSignIn");
    if(signInBtn){
      const go = ()=>{
        const email = $("#sEmail").value.trim(), password = $("#sPassword").value;
        if(!email || !password){ setSyncState("off", "E-Mail und Passwort eingeben"); return; }
        signInBtn.disabled = true; setSyncState("busy", "");
        signIn(email, password).then(()=>renderSettings())
          .catch(e=>{ signInBtn.disabled = false; setSyncState("off", e instanceof TypeError ? "Keine Verbindung" : e.message); });
      };
      signInBtn.onclick = go;
      $("#sPassword").addEventListener("keydown", e=>{ if(e.key==="Enter") go(); });
    }
    on("#sSyncNow", "click", ()=>syncNow());
    on("#sSignOut", "click", ()=>disablePush().catch(()=>{}).then(signOut).then(()=>renderSettings()));   // no reminders for a signed-out device
  }
}
