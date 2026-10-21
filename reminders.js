// reminders.js — reminders (notifications). Moved unchanged from index.html lines 2310–2336 on 21 Oct 2026.
"use strict";
/* ════════════════════════════════════════════════════════════
   reminders — Notification API while app is open / recently
   backgrounded; NOTIF_STORE prevents double-firing
   ════════════════════════════════════════════════════════════ */
function requestNotifPermission(){
  if("Notification" in window && Notification.permission==="default") Notification.requestPermission();
}
function checkReminders(){
  if(!("Notification" in window) || Notification.permission!=="granted") return;
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
      try{ new Notification(ev.title, { body:(ev.reminderMin?`In ${ev.reminderMin} min · `:"")+fmtMin(ev.startMin)+"–"+fmtMin(ev.endMin) }); }catch(_){}
    }
  });
  const arr = [...fired].slice(-200);
  localStorage.setItem(NOTIF_STORE, JSON.stringify(arr));
}
setInterval(checkReminders, 30000);

