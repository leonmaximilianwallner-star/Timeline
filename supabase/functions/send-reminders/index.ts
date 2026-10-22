// @ts-nocheck — plain JavaScript in a .ts file: Supabase runs it as is, Node tests it as is.
// supabase/functions/send-reminders — runs every minute (Supabase Cron, see supabase/push.sql).
// Sends a push notification for every reminder that is due, once per registered device.
// ARCHITECTURE.md §5.5. The rules below mirror the app's: core/repeat.js (occursOn) and reminders.js.

import * as webpush from "jsr:@negrel/webpush@0.5.0";   // in the tests: tests/vendor/webpush.bundle.mjs (tests/vendor/hooks.mjs)

const LATE_OK_MIN = 10;          // a reminder up to 10 min late still goes out (a missed or slow run)
const KEEP_SENT_DAYS = 3;        // how long "already sent" marks are kept

/* ── dates, as in core/dates.js and core/repeat.js ─────────────────────────────── */
const parseISO = s => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const isoDate  = d => d.toISOString().slice(0, 10);
export const addDaysISO = (iso, n) => { const d = parseISO(iso); d.setUTCDate(d.getUTCDate() + n); return isoDate(d); };

/* does the event occur on this day? — the same rule as core/repeat.js occursOn (tests/reminders.test.mjs compares them) */
export function occursOn(ev, dateISO){
  if(dateISO < ev.date) return false;
  if(ev.end && dateISO >= ev.end) return false;              // the series ended
  if(ev.except && ev.except.includes(dateISO)) return false; // this occurrence was deleted
  if(ev.repeat === "none" || !ev.repeat) return ev.date === dateISO;
  const base = parseISO(ev.date), d = parseISO(dateISO);
  switch(ev.repeat){
    case "daily":    return true;
    case "weekly":   return base.getUTCDay() === d.getUTCDay();
    case "weekdays": return d.getUTCDay() >= 1 && d.getUTCDay() <= 5;
    case "monthly": {
      const want = base.getUTCDate();
      const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      return d.getUTCDate() === Math.min(want, last);
    }
  }
  return false;
}

/* event times are minutes after local midnight in the device's time zone; this gives the moment */
function zoneOffsetMs(utcMs, timeZone){
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(utcMs)).map(p => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}
export function localTimeToUtc(dateISO, minutes, timeZone){
  const guess = parseISO(dateISO).getTime() + minutes * 60000;          // as if the zone were UTC
  const first = guess - zoneOffsetMs(guess, timeZone);
  return guess - zoneOffsetMs(first, timeZone);                          // second pass: right across a clock change
}
export function todayIn(timeZone, nowMs){
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(nowMs));
}

const hhmm = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
function whenText(reminderMin){
  if(reminderMin === 0) return "Jetzt";
  if(reminderMin < 60) return `In ${reminderMin} min`;
  if(reminderMin === 1440) return "Morgen";
  if(reminderMin % 60 === 0) return `In ${reminderMin / 60} h`;
  return `In ${reminderMin} min`;
}

/* every reminder due at `nowMs` for one device: fired, and not more than LATE_OK_MIN ago */
export function dueReminders(events, nowMs, timeZone){
  const today = todayIn(timeZone, nowMs), out = [];
  events.forEach(ev => {
    if(ev.reminderMin == null) return;
    for(let i = -1; i <= 2; i++){                                         // reminders reach up to a day ahead
      const day = addDaysISO(today, i);
      if(!occursOn(ev, day)) continue;
      const fireAt = localTimeToUtc(day, ev.startMin, timeZone) - ev.reminderMin * 60000;
      if(fireAt <= nowMs && nowMs - fireAt < LATE_OK_MIN * 60000){
        out.push({ key: `${ev.id}@${day}`, eventId: ev.id, day,
          title: ev.title || "Termin",
          body: `${whenText(ev.reminderMin)} · ${hhmm(ev.startMin)}–${hhmm(ev.endMin)}` });
      }
    }
  });
  return out;
}

/* one run. `db` and `push` are passed in, so tests can run it without Supabase. */
export async function run({ db, push, nowMs = Date.now() }){
  const devices = await db.devices();
  if(!devices.length) return { devices: 0, sent: 0 };
  const eventsByUser = await db.events([...new Set(devices.map(d => d.user_id))]);
  let sent = 0, removed = 0;
  for(const device of devices){
    const due = dueReminders(eventsByUser[device.user_id] || [], nowMs, device.time_zone || "Europe/Vienna");
    if(!due.length) continue;
    const fresh = await db.claim(device.endpoint, due.map(r => r.key));    // only keys not sent before
    for(const r of due.filter(r => fresh.includes(r.key))){
      try{
        await push(device, { title: r.title, body: r.body, tag: r.key, day: r.day });
        sent++;
      }catch(e){
        if(e && e.gone){ await db.removeDevice(device.endpoint); removed++; break; }   // the device unsubscribed
        console.error("push failed", device.endpoint.slice(0, 40), String(e));
      }
    }
  }
  await db.forgetSentBefore(new Date(nowMs - KEEP_SENT_DAYS * 86400000).toISOString());
  return { devices: devices.length, sent, removed };
}

/* ── on Supabase ──────────────────────────────────────────────────────────────── */
/* the project's secret key — Supabase hands it to every function; it reads all accounts' rows, so it never leaves the server */
function serverKey(){
  try{ const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"); if(keys.default) return keys.default; }catch(_){}
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");     // older projects
}
export function supabaseDb(url, key){
  const headers = { apikey: key, "Content-Type": "application/json", ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}) };
  const rest = async (path, options = {}) => {
    const res = await fetch(`${url}/rest/v1/${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    if(!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.status === 204 ? null : res.json().catch(() => null);
  };
  return {
    devices: () => rest("push_devices?select=endpoint,user_id,p256dh,auth,time_zone"),
    async events(userIds){
      const rows = await rest(`records?select=user_id,data&list=eq.events&deleted=eq.false&user_id=in.(${userIds.join(",")})`);
      const byUser = {};
      rows.forEach(r => (byUser[r.user_id] = byUser[r.user_id] || []).push({ ...r.data, id: r.data.id }));
      return byUser;
    },
    async claim(endpoint, keys){
      const rows = await rest("reminders_sent?on_conflict=endpoint,key", { method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify(keys.map(key => ({ endpoint, key }))) });
      return (rows || []).map(r => r.key);
    },
    removeDevice: endpoint => rest(`push_devices?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: "DELETE" }),
    forgetSentBefore: iso => rest(`reminders_sent?sent_at=lt.${encodeURIComponent(iso)}`, { method: "DELETE" }),
  };
}
export async function webPusher(lib, vapidKeysJson, contact){
  const vapidKeys = await lib.importVapidKeys(JSON.parse(vapidKeysJson), { extractable: false });
  const server = await lib.ApplicationServer.new({ contactInformation: contact, vapidKeys });
  return async (device, message) => {
    try{
      await server.subscribe({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } })
        .pushTextMessage(JSON.stringify(message), { ttl: 3600, urgency: "high" });
    }catch(e){
      if(e && e.response && (e.response.status === 404 || e.response.status === 410)) throw { gone: true };
      throw e;
    }
  };
}

if(globalThis.Deno){
  Deno.serve(async () => {
    try{
      const push = await webPusher(webpush, Deno.env.get("VAPID_KEYS"), Deno.env.get("VAPID_CONTACT") || "mailto:timeline@example.com");
      const result = await run({ db: supabaseDb(Deno.env.get("SUPABASE_URL"), serverKey()), push });
      return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
    }catch(e){
      console.error(e);
      return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  });
}
