// core/text.js — escaping and cleaning text. Moved unchanged from index.html lines 731–742 on 21 Oct 2026.
"use strict";
function esc(s){ return String(s??"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function sanitize(html){
  const ALLOW = new Set(["B","I","U","EM","STRONG","UL","OL","LI","BR","P","DIV","SPAN"]);
  const box = document.createElement("div"); box.innerHTML = html;
  (function walk(node){
    [...node.children].forEach(ch=>{
      if(!ALLOW.has(ch.tagName)){ ch.replaceWith(...ch.childNodes); walk(node); }
      else { [...ch.attributes].forEach(a=>ch.removeAttribute(a.name)); walk(ch); }
    });
  })(box);
  return box.innerHTML;
}
