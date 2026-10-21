// reminders.js — reminders: push from the server when switched on, in the app as a fallback (ARCHITECTURE.md §5.5).
"use strict";
/* ════════════════════════════════════════════════════════════
   Two ways a reminder reaches you:
   - push (switched on per device, in Settings → Erinnerungen): the server function
     supabase/functions/send-reminders sends it, even with the app closed. Needs the sync login,
     because the server reads the events from the synced plan.
   - in the app (push off): checked every 30 s while the app is open; NOTIF_STORE prevents doubles.
   Never both on one device. Whether push is on is read from the browser itself, not stored.
   ════════════════════════════════════════════════════════════ */
const PUSH_KEY = "BJutIHHJERt1KYApO1alIvbwoE82-oTIpPb7EnsC1BDEIxNoDqAgagL7K1DrGqZXXR8yMWwwTjL2XY-uxaLMZ0o";   // public half of the server's key pair — safe to commit
const pushState = { supported: "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
               on: false, busy: false, message: "" };
const worker = pushState.supported ? navigator.serviceWorker.register("sw.js").catch(e=>{ console.warn("service worker", e); return null; }) : Promise.resolve(null);

function requestNotifPermission(){
  if("Notification" in window && Notification.permission==="default") Notification.requestPermission();
}

/* ── push ──────────────────────────────────────────────────── */
const b64ToBytes = s => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"=")), c=>c.charCodeAt(0));
const bytesToB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");

/* tell the server where to reach this device (again on every start: the time zone may have changed) */
function registerPushDevice(sub){
  return api("push_devices?on_conflict=endpoint", { method:"POST",
    headers:{ Prefer:"resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ endpoint: sub.endpoint, p256dh: bytesToB64(sub.getKey("p256dh")), auth: bytesToB64(sub.getKey("auth")),
                           time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone, user_id: login.user.id }) });
}
async function enablePush(){
  if(!login) throw new Error("Erst bei Sync anmelden");
  if(await Notification.requestPermission() !== "granted") throw new Error("Benachrichtigungen sind blockiert (Browser-Einstellungen)");
  const reg = await worker;
  if(!reg) throw new Error("Service Worker nicht verfügbar");
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(PUSH_KEY) });
  try{ await registerPushDevice(sub); }
  catch(e){ await sub.unsubscribe().catch(()=>{}); throw e; }
  pushState.on = true;
}
async function disablePush(){
  const reg = await worker, sub = reg && await reg.pushManager.getSubscription();
  if(sub){
    if(login) await api(`push_devices?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, { method:"DELETE" }).catch(()=>{});   // gone anyway once unsubscribed
    await sub.unsubscribe();
  }
  pushState.on = false;
}
async function checkPush(){
  const reg = await worker, sub = reg && await reg.pushManager.getSubscription();
  pushState.on = !!sub;
  if(sub && login) registerPushDevice(sub).catch(e=>console.warn("push device", e));
  setPushState("");
}

/* what the user sees (settings → Erinnerungen) */
function setPushState(message){
  pushState.message = message;
  const el = document.getElementById("pushStatus"); if(el) el.textContent = pushStatusText();
  const sw = document.getElementById("sPush");     // the switch in settings
  if(sw){ sw.checked = pushState.on; sw.disabled = pushState.busy || (!login && !pushState.on); }
}
function pushStatusText(){
  if(pushState.message) return pushState.message;
  if(!pushState.supported) return "Dieser Browser kann keine Push-Erinnerungen empfangen. Auf dem iPhone: zuerst zum Home-Bildschirm hinzufügen und von dort öffnen.";
  if(pushState.on) return "An: Erinnerungen kommen auch bei geschlossener App.";
  if(!login) return "Für Push zuerst bei Sync anmelden. Bis dahin erinnert die App nur, solange sie offen ist.";
  return "Aus: die App erinnert nur, solange sie offen ist.";
}
function togglePush(){
  pushState.busy = true; setPushState(pushState.on ? "Wird ausgeschaltet …" : "Wird eingeschaltet …");
  (pushState.on ? disablePush() : enablePush())
    .then(()=>{ pushState.busy = false; setPushState(""); })
    .catch(e=>{ pushState.busy = false; setPushState(e instanceof TypeError ? "Keine Verbindung" : e.message); });
}

/* ── in the app (push off) ─────────────────────────────────── */
function checkReminders(){
  if(pushState.on || !("Notification" in window) || Notification.permission!=="granted") return;
  let fired;
  try{ fired = new Set(JSON.parse(localStorage.getItem(NOTIF_STORE)||"[]")); }catch(_){ fired = new Set(); }
  const now = Date.now(), today = todayISO(), tom = isoDate(addDays(parseISO(today),1));
  occurrencesIn(today, tom).forEach(({ev,date})=>{
    if(ev.reminderMin==null) return;
    const d = parseISO(date); d.setMinutes(ev.startMin);
    const fireAt = d.getTime() - ev.reminderMin*60000;
    const key = ev.id+"@"+date;
    if(now >= fireAt && now < d.getTime() && !fired.has(key)){
      fired.add(key);
      showReminder(ev.title, (ev.reminderMin?`In ${ev.reminderMin} min · `:"")+fmtMin(ev.startMin)+"–"+fmtMin(ev.endMin), key);
    }
  });
  const arr = [...fired].slice(-200);
  localStorage.setItem(NOTIF_STORE, JSON.stringify(arr));
}
/* through the service worker where there is one: Android refuses `new Notification` */
function showReminder(title, body, tag){
  worker.then(reg=>{
    if(reg) return reg.showNotification(title, { body, tag, icon:"icon-app-192.png" });
    new Notification(title, { body, tag });
  }).catch(()=>{});
}
setInterval(checkReminders, 30000);
