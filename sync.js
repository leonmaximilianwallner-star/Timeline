/* ============================================================
   sync.js — loadFromStorage(), Gist-Sync, Konflikt-Guard.
   Newest-wins über savedAt. Bei Fehlern wird NIE blind gepusht
   (dataDirty-Guard verhindert destruktive Overwrites).
   ============================================================ */
'use strict';

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      S = Object.assign(defaultData(), data);
      S.settings = Object.assign(defaultData().settings, data.settings || {});
    }
  } catch (e) { console.warn('load failed, using defaults', e); }
  document.documentElement.dataset.theme = S.settings.theme || 'dark';
}

const GIST_FILE = 'timeline-data.json';

async function pullGist(manual) {
  const { gistId, gistToken } = S.settings;
  if (!gistId || !gistToken) { if (manual) alert('Gist-ID und Token in den Einstellungen setzen.'); return; }
  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: { Authorization: `Bearer ${gistToken}` },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const gist = await res.json();
    const file = gist.files[GIST_FILE];
    if (!file) { if (manual) alert('Datei nicht im Gist gefunden — wird beim nächsten Speichern angelegt.'); return; }
    const remote = JSON.parse(file.content);

    /* Newest-wins. Lokale ungespeicherte Änderungen + älteres Remote => Konflikt-Guard. */
    if ((remote.savedAt || 0) > (S.savedAt || 0)) {
      if (dataDirty && !manual) { conflict = true; updateSyncBadge(); return; }
      const keep = S.settings;
      S = Object.assign(defaultData(), remote);
      S.settings = Object.assign(defaultData().settings, remote.settings || {}, {
        gistId: keep.gistId, gistToken: keep.gistToken,
      });
      localStorage.setItem(STORE_KEY, JSON.stringify(S));
      conflict = false;
      renderAll();
    } else if (manual) {
      conflict = false; updateSyncBadge();
    }
  } catch (e) {
    console.warn('Gist pull failed', e);
    if (manual) alert('Gist-Laden fehlgeschlagen: ' + e.message);
  }
}

async function pushGist() {
  const { gistId, gistToken } = S.settings;
  if (!gistId || !gistToken || conflict) return;
  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${gistToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(S) } } }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
  } catch (e) {
    console.warn('Gist push failed', e);
    conflict = true;                       // kein Auto-Push mehr — Nutzer entscheidet
    updateSyncBadge();
  }
}

/* Konflikt-Button: bewusst auflösen */
function resolveConflict() {
  openModal(`
    <h3>Sync-Konflikt <button class="x" data-close>×</button></h3>
    <p class="t12" style="line-height:1.6;color:var(--text2);margin-bottom:14px">
      Cloud und lokaler Stand sind auseinandergelaufen. Welche Version soll gelten?</p>
    <div class="mbtns" style="flex-direction:column">
      <button class="btn primary" id="cfLocal">Lokal behalten → Cloud überschreiben</button>
      <button class="btn" id="cfRemote">Cloud laden → Lokal überschreiben</button>
    </div>
  `, m => {
    m.querySelector('#cfLocal').addEventListener('click', async () => {
      conflict = false; await pushGist(); updateSyncBadge(); closeModal();
    });
    m.querySelector('#cfRemote').addEventListener('click', async () => {
      conflict = false; dataDirty = false; await pullGist(true); updateSyncBadge(); closeModal();
    });
  });
}
