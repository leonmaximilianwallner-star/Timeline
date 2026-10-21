// sw.js — the service worker: the browser wakes it when a push arrives, even with the app closed.
// It only shows reminders (ARCHITECTURE.md §5.5); it caches nothing, so the app loads exactly as without it.
"use strict";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

/* a reminder from the server function (supabase/functions/send-reminders) */
self.addEventListener("push", e => {
  let m = {};
  try{ m = e.data ? e.data.json() : {}; }catch(_){ m = { title: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(m.title || "Timeline", {
    body: m.body || "", tag: m.tag, icon: "icon-app-192.png", badge: "icon-app-192.png", data: { day: m.day } }));
});

/* tapping it opens the app, or brings the open one to the front */
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url.startsWith(self.registration.scope));
    return open ? open.focus() : self.clients.openWindow("./");
  }));
});
