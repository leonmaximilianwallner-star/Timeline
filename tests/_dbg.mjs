import { chromium } from 'playwright';
const b = await chromium.launch(); const c = await b.newContext({ viewport:{width:1440,height:900}, reducedMotion:'reduce' });
const p = await c.newPage(); await p.route(/fonts\./, r=>r.abort());
await p.clock.setSystemTime(new Date('2026-10-21T10:00:00+02:00'));
await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(500);
await p.evaluate(() => { const ev=S.events.find(e=>e.repeat==='none'); UI.range.days = dayIdx(ev.date)+7; renderAll(); scrollToToday(false); });
await p.waitForTimeout(300);
const st = () => p.evaluate(()=>({sl:$scene.scrollLeft, max:$scene.scrollWidth-$scene.clientWidth, days:UI.range.days, live:UI.dragLive}));
console.log('start', await st());
const t = await p.evaluate(() => { const ev=S.events.find(e=>e.repeat==='none'); const el=document.querySelector(`.event[data-ev="${ev.id}"]`); $scene.scrollTop=$dayWrap.offsetTop+el.offsetTop-120; const r=el.getBoundingClientRect(), s=$scene.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,right:s.right}; });
await p.mouse.move(t.x,t.y); await p.mouse.down(); await p.mouse.move(t.x+40,t.y,{steps:4}); await p.mouse.move(t.right-8,t.y,{steps:10});
await p.waitForTimeout(1500); console.log('held', await st());
await p.mouse.up(); for (const ms of [50,150,400]) { await p.waitForTimeout(ms); console.log('after', await st()); }
await b.close();
