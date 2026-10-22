// core/model.js — constants, colour palette, starting data. Moved from index.html lines 665–715 on 21 Oct 2026; names updated to the dictionary the same day.
"use strict";
/* ════════════════════════════════════════════════════════════
   data — types, constants, palette, seed data
   ════════════════════════════════════════════════════════════ */
const STORE_KEY  = "timeline.data.v3";   // the plan (data/store.js)
const OLD_STORE_KEY = "timeline.app.v2";  // the V2 app's data: read once, never changed
const DEVICE_KEY = "timeline.device.v1";  // this device's state (data/device.js)
const DATA_VERSION = 5;                    // the shape of the plan (data/store.js toCurrentShape)
const NOTIF_STORE= "timeline.notif.v2";
const HOUR_START = 0, HOUR_END = 24, HOUR_PX = 52;
let   TL_PPD     = 160;              // unified px/day — both views share one grid
const SNAP       = 15;               // minutes
const PALETTE    = ["#f4971f","#e9473a","#40838b","#6498c0","#8fc14e","#90909a","#a060c8","#d86e9a"];

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

/* starting data, in today's shape (version 5): ends exclusive, milestones in one list, todos per occurrence */
function seedData(){
  const t = new Date(); t.setHours(0,0,0,0);
  const d = n => isoDate(addDays(t, n));
  return {
    version: DATA_VERSION,
    /* unified categories: entries with start&end are projects (get a spine); dateless entries are categories. Grey is reserved for "frei". */
    categories: [
      { id:"seminar", name:"Seminararbeit", color:"#40838b",
        start:d(-14), end:d(29) },
      { id:"work",    name:"Arbeit",     color:"#f4971f" },
      { id:"tests",   name:"Prüfung",    color:"#e9473a" },
      { id:"meeting", name:"Meeting",    color:"#6498c0" },
      { id:"done",    name:"Bestätigt",  color:"#8fc14e" },
      { id:"misc",    name:"Sonstiges",  color:"#a060c8" },
      { id:"personal",name:"Persönlich", color:"#d86e9a" },
    ],
    phases: [
      { id:uid(), title:"Schreiben §2–§3", categoryId:"seminar", start:d(-3), end:d(5),  details:"" },
      { id:uid(), title:"Folien & Probevortrag", categoryId:"seminar", start:d(5), end:d(18), details:"<b>Fokus:</b> LOS als Brückenvariable sauber erzählen.<ul><li>Evidenzstärke pro Variable kennzeichnen</li><li>max. 12 Folien</li></ul>" },
      { id:uid(), title:"Viewer: Cache & Kompression", categoryId:"work", start:d(1), end:d(15), details:"" },
    ],
    milestones: [
      { id:uid(), title:"Entwurf fertig",        date:d(4),  categoryId:"seminar", final:false, note:"" },
      { id:uid(), title:"Review",                date:d(11), categoryId:"seminar", final:false, note:"" },
      { id:uid(), title:"Abgabe + Präsentation", date:d(18), categoryId:"seminar", final:true,  note:"" },
      { id:uid(), title:"Präsentation",          date:d(18), categoryId:null,      final:false, note:"30 Punkte" },
    ],
    events: [
      { id:uid(), title:"Tutorium", categoryId:"work", date:d(0), startMin:9*60,  endMin:11*60, repeat:"weekly", reminderMin:null, todosByDate:{} },
      { id:uid(), title:"Seminararbeit Schreibblock", categoryId:"seminar", date:d(0), startMin:13*60, endMin:16*60, repeat:"none", reminderMin:null,
        todosByDate:{ [d(0)]: [ {id:uid(),text:"Abschnitt 2.1 Absätze 3–5",state:"open"}, {id:uid(),text:"Quellenliste prüfen",state:"postponed"} ] } },
      { id:uid(), title:"Bachata", categoryId:"personal", date:d(1), startMin:19*60, endMin:20*60+30, repeat:"weekly", reminderMin:60, todosByDate:{} },
    ],
  };
}

