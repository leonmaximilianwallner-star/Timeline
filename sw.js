// sw.js — the service worker: keeps the app on the device, and shows push reminders (ARCHITECTURE.md §5.2, §5.5).
"use strict";
/* ════════════════════════════════════════════════════════════
   The app on the device (Max, 20 Nov): the phone shows its own splash (the icon) until the page's
   first frame. Fetched from GitHub on every start, that frame came late, and offline never.
   Now the page and its files come from the device, and the network only updates them.
     the page            from the device at once; a fresh copy is fetched meanwhile and used from
                         the NEXT start, and only once every file it needs is stored too,
                         so a start offline never finds half a version
     files with ?v=      kept for good: their name changes whenever their content does
                         (tests/asset-version.mjs); a version no longer named by the page is removed
     icons, manifest     the network first, the device when offline
     the font            kept once fetched
     anything else       (Supabase, push) never touched: straight to the network
   ════════════════════════════════════════════════════════════ */
const SHELL = "timeline-shell";
const PAGE  = new URL("./", self.registration.scope).href;          // index.html and "./" are one page
const FONT_HOSTS = /^fonts\.(googleapis|gstatic)\.com$/;

/* stores a page and every versioned file it names; the page last, so it never points at missing files */
async function adopt(res){
  const html = await res.clone().text();
  const cache = await caches.open(SHELL);
  const files = [...html.matchAll(/(?:src|href)="([^"]+\?v=[0-9a-f]+)"/g)].map(m => new URL(m[1], PAGE).href);
  await Promise.all(files.map(async url => { if(!await cache.match(url)) await cache.add(url); }));
  await cache.put(PAGE, res);
  const version = (html.match(/\?v=([0-9a-f]+)/) || [])[1];
  if(version) for(const req of await cache.keys()){                  // earlier versions' files
    const v = new URL(req.url).searchParams.get("v");
    if(v && v !== version) await cache.delete(req);
  }
}
async function fetchPage(){
  const res = await fetch(PAGE, { cache:"no-cache" });              // ask GitHub, not the browser's own cache
  if(res.ok) await adopt(res.clone());
  return res;
}

self.addEventListener("install", e => { e.waitUntil(fetchPage().catch(()=>{})); self.skipWaiting(); });
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  const own = url.origin === self.location.origin;
  if(!own && !FONT_HOSTS.test(url.hostname)) return;

  if(req.mode === "navigate" && own){                                 // the page: the device's copy at once
    e.respondWith(caches.match(PAGE).then(stored => {
      const fresh = fetchPage();
      if(stored){ e.waitUntil(fresh.catch(()=>{})); return stored; }
      return fresh;
    }));
    return;
  }
  if(url.searchParams.has("v") || !own){                             // versioned files, the font: kept
    e.respondWith(caches.match(req).then(stored => stored || fetch(req).then(async res => {
      if(res.ok || res.type === "opaque") (await caches.open(SHELL)).put(req, res.clone());
      return res;
    })));
    return;
  }
  e.respondWith(fetch(req).then(async res => {                       // icons, manifest: fresh when possible
    if(res.ok) (await caches.open(SHELL)).put(req, res.clone());
    return res;
  }).catch(() => caches.match(req).then(stored => stored || Response.error())));
});

/* a reminder from the server function (supabase/functions/send-reminders) */
self.addEventListener("push", e => {
  let m = {};
  try{ m = e.data ? e.data.json() : {}; }catch(_){ m = { title: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(m.title || "Timeline", {
    body: m.body || "", tag: m.tag, icon: "icon-app-192.png", badge: "icon-badge-96.png", data: { day: m.day } }));
});

/* tapping it opens the app, or brings the open one to the front */
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url.startsWith(self.registration.scope));
    return open ? open.focus() : self.clients.openWindow("./");
  }));
});
