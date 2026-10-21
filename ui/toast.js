// ui/toast.js — toast message. Moved unchanged from index.html lines 743–748 on 21 Oct 2026.
"use strict";
function toast(msg){
  const el = document.getElementById("toast");
  el.textContent = msg; el.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(()=>el.classList.remove("show"), 1900);
}

