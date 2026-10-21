// data/sync.js — keeps this device and Supabase in step (ARCHITECTURE.md §5, step 4).
"use strict";
/* ════════════════════════════════════════════════════════════
   One sync = pull, then push:
   - pull: every row the server received since we last looked (by the server's clock, synced_at),
     merged into the plan by data/merge.js — the newer stamp wins;
   - push: every record stamped on this device since the last push, deletions included.
   The plan always lives on the device first; sync only reconciles. Offline, nothing changes
   for the user; the next sync catches up.
   First sign-in on a device: if the server is empty, this device's plan goes up; if the server
   already has a plan (another device came first), this device takes it — the local copy is kept
   under BACKUP_KEY, never deleted.
   Talks to Supabase with plain fetch (no library). The key below is public by design: the
   database shows each account only its own rows (supabase/schema.sql).
   ════════════════════════════════════════════════════════════ */
const SYNC_URL      = "https://vkdrhvnpmuelckwnafpu.supabase.co";
const SYNC_KEY      = "sb_publishable_0GeBfnRUVWl8sU1aqygttg_JfGH02NU";   // publishable key — public by design, safe to commit
const LOGIN_KEY     = "timeline.login.v1";             // who is signed in on this device (never synced)
const BACKUP_KEY    = "timeline.data.before-sync";     // the local plan a device had before taking the server's
const SYNC_DELAY    = 1500;                            // ms after a change before it is sent
const SYNC_POLL     = 60000;                           // ms between checks for changes from other devices
const PAGE_ROWS     = 1000;                            // rows per request when pulling
const PUSH_ROWS     = 500;                             // rows per request when pushing (fewer than a pull page)

const sync = { state: "off", lastOk: null, message: "", busy: false, again: false, timer: null };

/* ── the login ─────────────────────────────────────────────── */
function loadLogin(){ try{ return JSON.parse(localStorage.getItem(LOGIN_KEY) || "null"); }catch(_){ return null; } }
function saveLogin(s){ try{ s ? localStorage.setItem(LOGIN_KEY, JSON.stringify(s)) : localStorage.removeItem(LOGIN_KEY); }catch(_){} }
let login = loadLogin();

async function authRequest(grant, body){
  const res = await fetch(`${SYNC_URL}/auth/v1/token?grant_type=${grant}`, {
    method: "POST", headers: { apikey: SYNC_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out = await res.json().catch(()=>({}));
  if(!res.ok) throw Object.assign(new Error(out.error_description || out.msg || out.message || "Anmeldung fehlgeschlagen"), { status: res.status });
  return { access_token: out.access_token, refresh_token: out.refresh_token,
           expires_at: Date.now() + (out.expires_in || 3600) * 1000, user: { id: out.user.id, email: out.user.email } };
}
async function signIn(email, password){
  login = await authRequest("password", { email, password });
  saveLogin(login);
  setDevice(dv=>{ dv.syncSentUpTo = null; dv.syncSeenUpTo = null; });   // a new login starts fresh
  await syncNow();
}
async function signOut(){
  await syncNow().catch(()=>{});                        // send what's left first
  saveLogin(login = null);
  setDevice(dv=>{ dv.syncSentUpTo = null; dv.syncSeenUpTo = null; });
  setSyncState("off", "");
}
async function freshToken(){
  if(login && Date.now() > login.expires_at - 60000){
    try{ login = await authRequest("refresh_token", { refresh_token: login.refresh_token }); saveLogin(login); }
    catch(e){ if(e.status >= 400 && e.status < 500){ saveLogin(login = null); } throw e; }
  }
  return login && login.access_token;
}

/* ── the table ─────────────────────────────────────────────── */
async function api(path, options = {}){
  const token = await freshToken();
  if(!token) throw Object.assign(new Error("Nicht angemeldet"), { status: 401 });
  const res = await fetch(`${SYNC_URL}/rest/v1/${path}`, { ...options,
    headers: { apikey: SYNC_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) } });
  if(!res.ok) throw Object.assign(new Error((await res.text().catch(()=>"")) || res.statusText), { status: res.status });
  return res.status === 204 || options.method === "POST" ? null : res.json();
}
/* server times come back as "…+00:00"; the plan's stamps are "…Z": make them comparable */
const asStamp = t => new Date(t).toISOString();

async function pullRows(since){
  /* Rows sent together get the same synced_at, so a full page may end inside such a group: the next
     page starts AT the last time (gte) and drops the rows already received. */
  const rows = [], seen = new Set();
  let op = "gt";
  for(;;){
    const after = since ? `&synced_at=${op}.${encodeURIComponent(since)}` : "";
    const page = await api(`records?select=id,list,data,updated_at,deleted,synced_at${after}&order=synced_at.asc,id.asc&limit=${PAGE_ROWS}`);
    page.forEach(r => { if(!seen.has(r.id + "@" + r.synced_at)){ seen.add(r.id + "@" + r.synced_at); rows.push(r); } });
    if(page.length < PAGE_ROWS) return rows;
    const last = page[page.length - 1].synced_at;
    if(op === "gte" && last === since) throw new Error("Zu viele gleichzeitige Änderungen");   // a whole page with one time: never loops
    since = last; op = "gte";
  }
}
async function pushRows(rows){
  for(let i = 0; i < rows.length; i += PUSH_ROWS){
    await api("records?on_conflict=user_id,id", { method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows.slice(i, i + PUSH_ROWS).map(r => ({ ...r, user_id: login.user.id }))) });
  }
}

/* ── one sync ──────────────────────────────────────────────── */
async function syncNow(){
  if(!SYNC_KEY || !login){ setSyncState("off", ""); return; }
  if(sync.busy){ sync.again = true; return; }
  sync.busy = true; setSyncState("busy", "");
  try{
    const rows = (await pullRows(device.syncSeenUpTo)).map(r => ({ ...r, updated_at: asStamp(r.updated_at) }));
    const firstTime = device.syncSeenUpTo == null && device.syncSentUpTo == null;
    if(rows.length) device.syncSeenUpTo = rows[rows.length - 1].synced_at;

    if(firstTime && rows.length){
      /* another device came first: take the server's plan, keep ours as a backup */
      try{ localStorage.setItem(BACKUP_KEY, JSON.stringify(S)); }catch(_){}
      S = planFromRows(rows);
      device.syncSentUpTo = new Date().toISOString();  // nothing of the old local plan goes up
      afterRemoteChange();
    } else if(applyRows(S, rows)){
      afterRemoteChange();
    }

    const outgoing = rowsToSend(S, device.syncSentUpTo);
    if(outgoing.length){
      await pushRows(outgoing);
      device.syncSentUpTo = outgoing.reduce((m, r) => r.updated_at > m ? r.updated_at : m, device.syncSentUpTo || "");
    }
    saveDevice();
    sync.lastOk = Date.now();
    setSyncState("ok", "");
  }catch(e){
    if(e instanceof TypeError) setSyncState("offline", "");                 // no network: try again later
    else if(!login) setSyncState("off", "Anmeldung abgelaufen: bitte neu anmelden");
    else setSyncState("error", e.message);
  }finally{
    sync.busy = false;
    if(sync.again){ sync.again = false; scheduleSync(); }
  }
}
/* changes from another device: save, redraw; undo can't step back across them */
function afterRemoteChange(){
  persist();
  UI.undo.length = 0; UI.redo.length = 0; updateUndoButtons();
  renderAll();
}
/* called by the gate after every change: send it shortly, bundled with whatever follows */
function scheduleSync(){
  clearTimeout(sync.timer);
  sync.timer = setTimeout(syncNow, SYNC_DELAY);
}

/* ── what the user sees (settings → Daten) ──────────────────── */
function setSyncState(state, message){
  sync.state = state; sync.message = message;
  const el = document.getElementById("syncStatus");
  if(el) el.textContent = syncStatusText();
}
function syncStatusText(){
  if(!SYNC_KEY) return "Sync ist noch nicht eingerichtet.";
  if(!login) return sync.message || "Nicht angemeldet: alles bleibt nur auf diesem Gerät.";
  const who = login.user.email;
  if(sync.state === "busy") return `${who} · synchronisiert …`;
  if(sync.state === "offline") return `${who} · offline, wird nachgeholt`;
  if(sync.state === "error") return `${who} · Fehler: ${sync.message}`;
  if(sync.lastOk) return `${who} · synchronisiert um ${new Date(sync.lastOk).toLocaleTimeString("de-AT", { hour:"2-digit", minute:"2-digit" })}`;
  return who;
}

/* when to sync besides after changes: on start, back online, back to the app, and every minute */
window.addEventListener("online", syncNow);
window.addEventListener("focus", syncNow);
document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState === "visible") syncNow(); });
setInterval(()=>{ if(document.visibilityState === "visible") syncNow(); }, SYNC_POLL);
