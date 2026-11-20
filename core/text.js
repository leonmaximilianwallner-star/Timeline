// core/text.js — escaping and cleaning text. Moved unchanged from index.html lines 731–742 on 21 Oct 2026.
"use strict";
function esc(s){ return String(s??"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function sanitize(html){
  const ALLOW = new Set(["B","I","U","EM","STRONG","UL","OL","LI","BR","P","DIV","SPAN"]);
  const KEEP = { UL:"data-check", LI:"data-done" };                // the only attributes: a checklist and its ticks
  const t = document.createElement("template"); t.innerHTML = html;   // inert: nothing in it loads or runs (a div would load an <img> and run its onerror)
  const box = t.content;
  (function walk(node){
    [...node.children].forEach(ch=>{
      if(!ALLOW.has(ch.tagName)){ ch.replaceWith(...ch.childNodes); walk(node); }
      else { [...ch.attributes].forEach(a=>{ if(KEEP[ch.tagName] !== a.name) ch.removeAttribute(a.name); }); walk(ch); }
    });
  })(box);
  const out = document.createElement("div"); out.append(box);    // only allowed tags and markers are left now
  return out.innerHTML;
}
