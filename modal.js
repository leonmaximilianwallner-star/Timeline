/* ============================================================
   modal.js — Modal-System, Entwurfs-/Edit-Modale, Settings
   Escape-Hatches: Escape, Klick außerhalb, ×-Button.
   ============================================================ */
'use strict';

let modalEl = null;
let onModalClose = null;          // z. B. Blueprint entfernen

function openModal(html, wire, onClose) {
  closeModal();
  const back = el('div', 'backdrop');
  const m = el('div', 'modal', html);
  back.append(m);
  back.addEventListener('pointerdown', e => { if (e.target === back) closeModal(); });
  m.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeModal()));
  document.body.append(back);
  modalEl = back;
  onModalClose = onClose || null;
  if (wire) wire(m);
  const first = m.querySelector('input,select,[contenteditable]');
  if (first) setTimeout(() => first.focus(), 60);
  return m;
}
function closeModal() {
  if (modalEl) { modalEl.remove(); modalEl = null; }
  if (onModalClose) { const f = onModalClose; onModalClose = null; f(); }
}

/* ---------- gemeinsame Bausteine ---------- */
function catPickerHTML(sel) {
  return `<div class="cat-pick">` + S.categories.map(c =>
    `<button class="cp ${c.id === sel ? 'sel' : ''}" data-cat="${c.id}"
      style="background:${c.color}" title="${esc(c.name)}"></button>`).join('') + `</div>`;
}
function wireCatPicker(m, state) {
  m.querySelectorAll('.cp').forEach(b => b.addEventListener('click', () => {
    state.categoryId = b.dataset.cat;
    m.querySelectorAll('.cp').forEach(x => x.classList.toggle('sel', x === b));
  }));
}
function richtextHTML(html) {
  return `
    <div class="rt-tools">
      <button data-cmd="bold"><b>B</b></button>
      <button data-cmd="italic"><i>I</i></button>
      <button data-cmd="underline"><u>U</u></button>
      <button data-cmd="insertUnorderedList">≔</button>
    </div>
    <div class="richtext" contenteditable="true">${sanitizeHTML(html || '')}</div>`;
}
function wireRichtext(m) {
  m.querySelectorAll('[data-cmd]').forEach(b =>
    b.addEventListener('click', e => { e.preventDefault(); document.execCommand(b.dataset.cmd); }));
}

/* ---------- Phase: anlegen / bearbeiten ---------- */
function openPhaseModal(ph, isNew, onCancelNew) {
  const st = { categoryId: ph.categoryId };
  const m = openModal(`
    <h3>${isNew ? 'Neue Phase' : 'Phase bearbeiten'} <button class="x" data-close>×</button></h3>
    <div class="frow"><label>Name</label><input id="phName" value="${esc(ph.name)}"></div>
    <div class="frow"><label>Start</label><input id="phS" type="date" value="${ph.s}"></div>
    <div class="frow"><label>Ende</label><input id="phE" type="date" value="${addDays(ph.t, -1)}"></div>
    <div class="frow"><label>Kategorie</label>${catPickerHTML(st.categoryId)}</div>
    <label class="t10" style="color:var(--text2);letter-spacing:.04em;text-transform:uppercase">Beschreibung</label>
    ${richtextHTML(ph.details)}
    <div class="mbtns">
      <button class="btn primary grow" id="phSave">Speichern</button>
      ${isNew ? '' : '<button class="btn danger" id="phDel">Löschen</button>'}
    </div>
  `, mm => {
    wireCatPicker(mm, st);
    wireRichtext(mm);
    mm.querySelector('#phSave').addEventListener('click', () => {
      const name = mm.querySelector('#phName').value.trim() || 'Phase';
      const s = mm.querySelector('#phS').value, eIncl = mm.querySelector('#phE').value;
      if (!s || !eIncl || eIncl < s) return;
      snap();
      Object.assign(ph, { name, s, t: addDays(eIncl, 1), categoryId: st.categoryId,
                          details: sanitizeHTML(mm.querySelector('.richtext').innerHTML) });
      if (isNew) S.phases.push(ph);
      persist(); onModalClose = null; closeModal(); renderAll();
    });
    const delB = mm.querySelector('#phDel');
    if (delB) delB.addEventListener('click', () => {
      snap(); S.phases = S.phases.filter(x => x.id !== ph.id);
      persist(); onModalClose = null; closeModal(); renderAll();
    });
    mm.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !isNew && !/INPUT|DIV/.test(document.activeElement.tagName)) {
        snap(); S.phases = S.phases.filter(x => x.id !== ph.id);
        persist(); closeModal(); renderAll();
      }
    });
  }, isNew ? onCancelNew : null);
  return m;
}

/* ---------- Daily-Event: anlegen / bearbeiten ---------- */
function openEventModal(item, isNew, onCancelNew) {
  const st = { categoryId: item.categoryId };
  openModal(`
    <h3>${isNew ? 'Neues Ereignis' : 'Ereignis bearbeiten'} <button class="x" data-close>×</button></h3>
    <div class="frow"><label>Titel</label><input id="evTitle" value="${esc(item.title)}"></div>
    <div class="frow"><label>Tag</label><input id="evDay" type="date" value="${item.day}"></div>
    <div class="frow"><label>Von</label><input id="evS" type="time" value="${fmtTime(item.start)}" step="900">
                      <label style="width:auto">Bis</label><input id="evE" type="time" value="${fmtTime(item.end)}" step="900"></div>
    <div class="frow"><label>Kategorie</label>${catPickerHTML(st.categoryId)}</div>
    <div class="frow"><label>Wiederholen</label>
      <select id="evRep">
        ${['none', 'daily', 'weekly', 'monthly', 'weekdays'].map(r =>
          `<option value="${r}" ${item.repeat === r ? 'selected' : ''}>${r === 'none' ? 'nie' : repeatLabel(r)}</option>`).join('')}
      </select></div>
    <div class="frow"><label>Erinnerung</label>
      <select id="evRem">
        ${[['', 'keine'], [0, 'zum Start'], [5, '5 min vorher'], [15, '15 min vorher'], [60, '1 h vorher']].map(([v, l]) =>
          `<option value="${v}" ${String(item.reminder ?? '') === String(v) ? 'selected' : ''}>${l}</option>`).join('')}
      </select></div>
    <label class="t10" style="color:var(--text2);letter-spacing:.04em;text-transform:uppercase">Details</label>
    ${richtextHTML(item.details)}
    <div class="mbtns">
      <button class="btn primary grow" id="evSave">Speichern</button>
      ${isNew ? '' : '<button class="btn danger" id="evDel">Löschen</button>'}
    </div>
  `, mm => {
    wireCatPicker(mm, st);
    wireRichtext(mm);
    mm.querySelector('#evSave').addEventListener('click', () => {
      const [sh, sm] = mm.querySelector('#evS').value.split(':').map(Number);
      const [eh, em] = mm.querySelector('#evE').value.split(':').map(Number);
      let s = sh * 60 + sm, e2 = eh * 60 + em;
      if (e2 <= s) e2 = s + SNAP_MIN;
      snap();
      Object.assign(item, {
        title: mm.querySelector('#evTitle').value.trim() || 'Ereignis',
        day: mm.querySelector('#evDay').value || item.day,
        start: s, end: e2,
        categoryId: st.categoryId,
        repeat: mm.querySelector('#evRep').value,
        reminder: mm.querySelector('#evRem').value === '' ? null : Number(mm.querySelector('#evRem').value),
        details: sanitizeHTML(mm.querySelector('.richtext').innerHTML),
      });
      if (isNew) {
        carryOverPostponed(item);           // Locked Spec D
        S.dailyItems.push(item);
        if (item.reminder !== null) requestNotifPermission();
      }
      persist(); onModalClose = null; closeModal(); renderAll();
    });
    const delB = mm.querySelector('#evDel');
    if (delB) delB.addEventListener('click', () => {
      snap(); S.dailyItems = S.dailyItems.filter(x => x.id !== item.id);
      persist(); onModalClose = null; closeModal(); renderAll();
    });
  }, isNew ? onCancelNew : null);
}

/* Postponed-Carry-Over: Todos des jüngsten Events derselben Kategorie,
   die noch postponed sind, in das neue Event vorladen. Dedup: text.trim(). */
function carryOverPostponed(newItem) {
  const prev = S.dailyItems
    .filter(x => x.categoryId === newItem.categoryId &&
                 (x.day < newItem.day || (x.day === newItem.day && x.start < newItem.start)))
    .sort((a, b) => a.day === b.day ? a.start - b.start : (a.day < b.day ? -1 : 1))
    .at(-1);
  if (!prev) return;
  const post = (prev.todos || []).filter(t => t.state === 'postponed');
  if (!post.length) return;
  const have = new Set((newItem.todos || []).map(t => t.text.trim()));
  newItem.todos = newItem.todos || [];
  for (const t of post) {
    if (!have.has(t.text.trim())) {
      newItem.todos.push({ id: uid(), text: t.text.trim(), state: 'open' });
      have.add(t.text.trim());
    }
  }
}

/* ---------- Exam-Chip / Punkt ---------- */
function openExamModal(x, isNew, onCancelNew) {
  const st = { categoryId: x.categoryId };
  openModal(`
    <h3>${isNew ? 'Neuer Punkt' : 'Punkt bearbeiten'} <button class="x" data-close>×</button></h3>
    <div class="frow"><label>Label</label><input id="exL" value="${esc(x.label)}"></div>
    <div class="frow"><label>Tag</label><input id="exD" type="date" value="${x.day}"></div>
    <div class="frow"><label>Punkte</label><input id="exP" type="number" value="${x.points ?? ''}" placeholder="optional"></div>
    <div class="frow"><label>Kategorie</label>${catPickerHTML(st.categoryId)}</div>
    <div class="mbtns">
      <button class="btn primary grow" id="exSave">Speichern</button>
      ${isNew ? '' : '<button class="btn danger" id="exDel">Löschen</button>'}
    </div>
  `, mm => {
    wireCatPicker(mm, st);
    mm.querySelector('#exSave').addEventListener('click', () => {
      snap();
      Object.assign(x, { label: mm.querySelector('#exL').value.trim() || 'Punkt',
                         day: mm.querySelector('#exD').value || x.day,
                         points: mm.querySelector('#exP').value || null,
                         categoryId: st.categoryId });
      if (isNew) S.exams.push(x);
      persist(); onModalClose = null; closeModal(); renderAll();
    });
    const delB = mm.querySelector('#exDel');
    if (delB) delB.addEventListener('click', () => {
      snap(); S.exams = S.exams.filter(e2 => e2.id !== x.id);
      persist(); onModalClose = null; closeModal(); renderAll();
    });
  }, isNew ? onCancelNew : null);
}

/* ---------- Milestone ---------- */
function openMilestoneModal(p, m0) {
  openModal(`
    <h3>Milestone <button class="x" data-close>×</button></h3>
    <div class="frow"><label>Label</label><input id="msL" value="${esc(m0.label)}"></div>
    <div class="frow"><label>Tag</label><input id="msD" type="date" value="${m0.day}"></div>
    <div class="frow"><label>Ziel</label><input id="msE" type="checkbox" style="flex:none" ${m0.end ? 'checked' : ''}>
      <span class="t10" style="color:var(--text2)">Letzter Milestone (★)</span></div>
    <div class="mbtns">
      <button class="btn primary grow" id="msSave">Speichern</button>
      <button class="btn danger" id="msDel">Löschen</button>
    </div>
  `, mm => {
    mm.querySelector('#msSave').addEventListener('click', () => {
      snap();
      Object.assign(m0, { label: mm.querySelector('#msL').value.trim() || 'Milestone',
                          day: mm.querySelector('#msD').value || m0.day,
                          end: mm.querySelector('#msE').checked });
      persist(); closeModal(); renderAll();
    });
    mm.querySelector('#msDel').addEventListener('click', () => {
      snap(); p.milestones = p.milestones.filter(x => x.id !== m0.id);
      persist(); closeModal(); renderAll();
    });
  });
}

/* ---------- Settings-Panel ---------- */
function toggleSettings(open) {
  const p = $('settingsPanel'), b = $('settingsBackdrop');
  const willOpen = open ?? !p.classList.contains('open');
  p.classList.toggle('open', willOpen);
  b.classList.toggle('open', willOpen);
  if (willOpen) renderSettings();
}
function renderSettings() {
  const p = $('settingsPanel');
  p.innerHTML = `
    <h3 class="t14" style="display:flex;margin-bottom:16px">Einstellungen
      <button class="x" style="margin-left:auto;color:var(--muted);font-size:18px">×</button></h3>

    <div class="section-label" style="margin-top:0">Darstellung</div>
    <div class="set-row"><span style="flex:1">Theme</span>
      <div class="seg" id="setTheme">
        <button data-v="dark"  class="${S.settings.theme !== 'light' ? 'on' : ''}">Dunkel</button>
        <button data-v="light" class="${S.settings.theme === 'light' ? 'on' : ''}">Hell</button>
      </div></div>
    <div class="set-row"><span style="flex:1">Sichtbare Tage</span>
      <div class="seg" id="setDensity">
        ${[3, 5, 7].map(n => `<button data-v="${n}" class="${S.settings.density === n ? 'on' : ''}">${n}</button>`).join('')}
      </div></div>

    <div class="section-label">Zeitraum</div>
    <div class="set-row"><span style="width:46px;color:var(--text2)" class="t10">START</span>
      <input type="date" id="setRS" value="${S.settings.rangeStart}"></div>
    <div class="set-row"><span style="width:46px;color:var(--text2)" class="t10">ENDE</span>
      <input type="date" id="setRE" value="${S.settings.rangeEnd}"></div>

    <div class="section-label">Kategorien</div>
    <div id="setCats"></div>
    <button class="btn" id="setCatAdd" style="margin-top:4px">+ Kategorie</button>

    <div class="section-label">Gist-Sync</div>
    <div class="set-row"><input type="text" id="setGistId" placeholder="Gist-ID" value="${esc(S.settings.gistId)}"></div>
    <div class="set-row"><input type="password" id="setGistTok" placeholder="GitHub-Token (gist scope)" value="${esc(S.settings.gistToken)}"></div>
    <button class="btn" id="setGistPull">Jetzt laden</button>
    <p class="t10" style="color:var(--muted);margin-top:6px;line-height:1.5">
      Erinnerungen funktionieren nur bei geöffneter App — serverlos, kein Push bei geschlossener App.</p>
  `;
  p.querySelector('.x').addEventListener('click', () => toggleSettings(false));

  p.querySelector('#setTheme').addEventListener('click', e => {
    const v = e.target.dataset.v; if (!v) return;
    S.settings.theme = v;
    document.documentElement.dataset.theme = v;
    persist(); renderSettings();
  });
  p.querySelector('#setDensity').addEventListener('click', e => {
    const v = Number(e.target.dataset.v); if (!v) return;
    S.settings.density = v; persist(); renderDaily(); renderSettings();
  });
  p.querySelector('#setRS').addEventListener('change', e => { S.settings.rangeStart = e.target.value; persist(); renderAll(); });
  p.querySelector('#setRE').addEventListener('change', e => { S.settings.rangeEnd = e.target.value; persist(); renderAll(); });

  const catsBox = p.querySelector('#setCats');
  for (const c of S.categories) {
    const row = el('div', 'set-row');
    const sw = el('input'); sw.type = 'color'; sw.className = 'swatch'; sw.value = c.color;
    sw.addEventListener('change', () => { snap(); c.color = sw.value; persist(); renderAll(); });
    const name = el('input'); name.type = 'text'; name.value = c.name;
    name.addEventListener('change', () => { snap(); c.name = name.value.trim() || c.name; persist(); renderAll(); });
    const delB = el('button', 'del', '✕');
    delB.addEventListener('click', () => {
      if (S.categories.length <= 1) return;
      snap();
      S.categories = S.categories.filter(x => x.id !== c.id);
      const fb = S.categories[0].id;
      for (const coll of [S.phases, S.dailyItems, S.exams]) coll.forEach(it => { if (it.categoryId === c.id) it.categoryId = fb; });
      S.projects.forEach(pr => { if (pr.categoryId === c.id) pr.categoryId = fb; });
      persist(); renderAll(); renderSettings();
    });
    row.append(sw, name, delB);
    catsBox.append(row);
  }
  p.querySelector('#setCatAdd').addEventListener('click', () => {
    snap();
    S.categories.push({ id: uid(), name: 'Neu', color: '#6498c0' });
    persist(); renderSettings();
  });

  p.querySelector('#setGistId').addEventListener('change', e => { S.settings.gistId = e.target.value.trim(); persist(); });
  p.querySelector('#setGistTok').addEventListener('change', e => { S.settings.gistToken = e.target.value.trim(); persist(); });
  p.querySelector('#setGistPull').addEventListener('click', () => pullGist(true));
}
