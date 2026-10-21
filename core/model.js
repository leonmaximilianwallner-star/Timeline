// core/model.js — constants, colour palette, starting data. Moved unchanged from index.html lines 665–715 on 21 Oct 2026.
"use strict";
/* ════════════════════════════════════════════════════════════
   data — types, constants, palette, seed data
   ════════════════════════════════════════════════════════════ */
const STORE_KEY  = "timeline.app.v2";
const NOTIF_STORE= "timeline.notif.v2";
const HOUR_START = 0, HOUR_END = 24, HOUR_PX = 52;
const GRID_H     = (HOUR_END - HOUR_START) * HOUR_PX;
let   TL_PPD     = 160;              // unified px/day — both views share one grid
const SNAP       = 15;               // minutes
const PALETTE    = ["#f4971f","#e9473a","#40838b","#6498c0","#8fc14e","#90909a","#a060c8","#d86e9a"];

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

function seedData(){
  const t = new Date(); t.setHours(0,0,0,0);
  const d = n => isoDate(addDays(t, n));
  return {
    /* unified tracks: entries with start&end are projects (get a spine); dateless entries are categories. Grey is reserved for "frei". */
    categories: [
      { id:"seminar", name:"Seminararbeit", color:"#40838b",
        start:d(-14), end:d(28),
        milestones:[
          { id:uid(), date:d(4),  label:"Entwurf fertig", end:false },
          { id:uid(), date:d(11), label:"Review",         end:false },
          { id:uid(), date:d(18), label:"Abgabe + Präsentation", end:true },
        ] },
      { id:"work",    name:"Arbeit",     color:"#f4971f" },
      { id:"exam",    name:"Prüfung",    color:"#e9473a" },
      { id:"meeting", name:"Meeting",    color:"#6498c0" },
      { id:"done",    name:"Bestätigt",  color:"#8fc14e" },
      { id:"misc",    name:"Sonstiges",  color:"#a060c8" },
      { id:"personal",name:"Persönlich", color:"#d86e9a" },
    ],
    phases: [
      { id:uid(), title:"Schreiben §2–§3", categoryId:"seminar", start:d(-3), end:d(4),  details:"", expanded:false },
      { id:uid(), title:"Folien & Probevortrag", categoryId:"seminar", start:d(5), end:d(17), details:"<b>Fokus:</b> LOS als Brückenvariable sauber erzählen.<ul><li>Evidenzstärke pro Variable kennzeichnen</li><li>max. 12 Folien</li></ul>", expanded:false },
      { id:uid(), title:"Viewer: Cache & Kompression", categoryId:"work", start:d(1), end:d(14), details:"", expanded:false },
    ],
    exams: [
      { id:uid(), title:"Präsentation", date:d(18), points:"30 Punkte" },
    ],
    events: [
      { id:uid(), title:"Tutorium", categoryId:"work", date:d(0), startMin:9*60,  endMin:11*60, repeat:"weekly", reminderMin:null, todos:[] },
      { id:uid(), title:"Seminararbeit Schreibblock", categoryId:"seminar", date:d(0), startMin:13*60, endMin:16*60, repeat:"none", reminderMin:null,
        todos:[ {id:uid(),text:"Abschnitt 2.1 Absätze 3–5",state:"open"}, {id:uid(),text:"Quellenliste prüfen",state:"postponed"} ] },
      { id:uid(), title:"Bachata", categoryId:"personal", date:d(1), startMin:19*60, endMin:20*60+30, repeat:"weekly", reminderMin:60, todos:[] },
    ],
    settings: { theme:"dark", density:5 },
  };
}

