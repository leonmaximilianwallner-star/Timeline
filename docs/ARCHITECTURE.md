# Timeline — Architecture

> **Draft 5, 21 Oct 2026 (after step 3). Author: Claude, for Max.** Draft 1 asked four questions; Max's answers are recorded below and in `DECISIONS.md`. Lines marked **Max** are his decisions; everything else is a proposal with its reasoning attached. Max can veto any of it.
>
> **How the documents divide the work.**
> - `RULEBOOK.md` says **what** the product is: its words, its levels, its rules for progress and time. It is also the project's dictionary (§9).
> - This file says **how the code is built** so those rules can live in it without breaking.
> - `DECISIONS.md` records **why** something was chosen, with a date. It is append-only.
>
> **Every coding session, human or AI, reads this file and the rulebook first.** Code that breaks a rule here is wrong even if it works.

---

## 0. The problem this file solves

Each version so far worked until it didn't. The pattern was the same each time:

1. Everything lived in one big file, so every part could reach every other part.
2. A new feature touched the data directly from wherever it was convenient: a render function saved, a gesture handler rewrote a field.
3. Words drifted. One thing got several names ("Aufgabe", "Schritt", `task`, "Todo" for the same line), and one name meant several things ("phase", "Punkt"). People and AIs then wrote code for the wrong thing, and similar code ended up written twice.
4. Storage was the browser itself. The one sync that ever existed (a GitHub Gist, opened with a personal token typed into settings) was dropped when V2 replaced the old app in June, so V2 only ever saved on the device it ran on. The token later leaked and was revoked.

None of this is about skill or the size of the app. It's about **boundaries**: who may talk to whom, who may change what, and which word means what. A 10,000-line app with clear boundaries is safer to change than a 2,000-line app without them.

---

## 1. Decisions at a glance

| # | Decision | Status |
|---|---|---|
| 1 | Plain JavaScript, no framework, no build step. Classic scripts; modules only when a present problem needs them | proposed |
| 2 | Layers that only depend downward: **core → data → views** | proposed |
| 3 | **One gate for every change:** `mutate()` stamps what changed. Named commands: dropped (§4) | **Claude, 21 Oct**, after Max asked for the simplest solution |
| 4 | One page, one scroll container; the levels stack like a website | **Max, 20 Oct** |
| 5 | Supabase, one row per record (not one blob), offline-first on the device's localStorage. No secret in the app | proposed |
| 6 | Where steps live (in a block's body, or their own table) | deferred until the canvas returns |
| 7 | Agent access | **Max, 20 Oct: later.** Design kept possible, nothing built |
| 8 | Restructure the live app (`index_v2_7`), then bring features back one at a time | **Max, 20 Oct** |
| 9 | One dictionary, enforced by a test | **Max, 20 Oct** (the need); mechanism proposed |
| 10 | Safety net: tests, branches, backups, size limits | proposed |
| 11 | Split by moving only; nothing inside changes | **Max, 21 Oct** |
| 12 | No preview links: a merged change is tested in the live app; revert if wrong | **Max, 21 Oct** (revisit once the app holds data he relies on) |
| 13 | GitHub is the only copy of the code; Claude works through pull requests | **Max, 21 Oct** |

---

## 2. Platform: plain JavaScript, native modules, no build step

**Decision.** The app stays plain HTML, CSS and JavaScript, hosted on GitHub Pages. The one change is that it's split into files that load each other with the browser's own module system (`<script type="module">`, `import … from './core/dates.js'`). There is no framework (React, Vue) and no build tool (Vite, webpack).

**Why.**
- **You can't maintain a toolchain, and you shouldn't have to.** A build step means Node versions, package updates and a compile step between "edit" and "see it". Every one of those is a place where an AI session can break something you can't diagnose. Native modules give the file split with zero tooling: what's in the repo is what runs.
- **A framework doesn't help with what makes this app hard.** The hard parts are custom: sticky pins, a unified pointer pipeline, two time scales, drag between levels. Frameworks help with forms and lists. They often fight hand-tuned scroll and gesture code like yours, and you'd be learning their rules on top of your own.
- **It's the stack the app already runs on**, so the existing code can move over in pieces instead of being rewritten.

**What it costs.**
- Modules don't load from a double-clicked file (`file://`); they need a tiny local web server. Claude Code starts one with one command. GitHub Pages works as-is.
- No automatic type checking. This is mitigated by the `core/` tests (§10) and by validation at the store's gate (§4).
- **Revisit if** other people ever use it seriously. A framework and a build step might then earn their cost. Not before.

### 2.1 Today: classic scripts (21 Oct)

The split (step 2) loads the files as **classic scripts** (`<script src="…">`), not yet as modules. *(Claude's call, flagged here.)*

- **Why.** The old file was already five script blocks sharing one namespace: every function and variable was visible everywhere. Classic scripts keep exactly that, so the split could move code without changing a single line, which is what "move only" asked for. Modules would have forced changes inside the code (import lines, and a different way to update `S` and `TL_PPD`, which several files reassign).
- **What it means.** The files depend on load order: `index.html` lists them in the old file's order, and that order must not change without a reason. The layer rule (§3) can't yet be checked by a test, because nothing declares its imports.
- **When it changes.** Only when a present problem needs it. Step 3 turned out not to (§4), so the files stay classic scripts. Revisit if load order causes a real bug, or when the layer rule (§3) needs to be checked by a test.
- **A side effect.** Classic scripts still work when `index.html` is opened directly from disk.

---

## 3. The layers, and the one rule that matters most

Like a building, the app has structure, services and fit-out. They change at different speeds, so they mustn't be cast into each other.

```
  views/        canvas · timeline · day · (single day)   ← changes weekly (looks, interactions)
  ui/           editor shell · settings · pickers
  input/        the one pointer pipeline
  ────────────────────────────────────────────────
  data/         store (the gate) · changes · device · undo · sync      ← changes rarely
  ────────────────────────────────────────────────
  core/         model · dates · body/steps · progress · colours       ← almost never
```

**The rule: imports only point downward.**
- `core/` imports nothing. It's pure logic: given these items, what's the phase's progress? What's the last day of an exclusive end? No screen, no storage, no clock it doesn't receive.
- `data/` imports only `core/`.
- `views/`, `ui/` and `input/` import `data/` and `core/`, **never each other's internals**.
  - The canvas never reaches into the timeline. If both need something, it moves down a layer.
  - Views talk to each other only through the store: the timeline changes an item, the store announces it, and the day view redraws.

**Why this is the fix for "it always broke at some point".**
- **A new look** is a change in `views/` or `styles/`. By construction it can't corrupt data, because views can't write data except through the gate (§4).
- **A data bug** lives in `core/` or `data/`, both small and both tested. It's found there instead of being hunted through thousands of lines.
- **An AI session can be told "only touch `views/timeline/`"**, and you can check that it did by looking at which files changed.

**What it costs.** More files. And sometimes a small detour: a view that wants to "just set a field" must go through `mutate` instead. That detour is the point.

---

## 4. One gate for every change *(as built, 21 Oct)*

**Every change to the plan goes through `mutate(fn)`** (`data/store.js`). It already existed; step 3 made it complete and gave it one more job. In order, it:

1. **remembers** the plan as it was, for undo;
2. **applies** the change (`fn`);
3. **stamps what changed** (`data/changes.js`): it compares before and after, record by record (one category, phase, exam or event), and gives every new or changed record `updatedAt` = now. A record that disappears is remembered in `deleted` (its id, list and time), so a device that was offline can't bring it back;
4. **saves** to the device;
5. **redraws**.

Undo and redo stamp the same way: whatever they bring back counts as changed *now*.

**The rules that keep the gate honest:**
- Nothing writes to `S` outside `mutate`. The editor works on a **copy** of an event's todos, so cancelling really cancels.
- Drawing only reads. The timeline keeps its lane numbers to itself; nothing it computes is stored.
- **Device state is not the plan.** Theme, number of days and open dropdowns live in `device` (`data/device.js`): saved per device, never synced, not undoable.

**Why not the "commands" system planned in draft 1.** It would have given undo, small sync updates and a log, but the app already had undo (snapshots), and stamping records gives sync the same small updates without rewriting every change in the app as a command. That would have been 23 rewritten call sites and a new layer for no present problem. **Revisit** when agents arrive (step 6): an agent's proposal is easiest to check as a list of named changes.

---

## 5. Where the data lives

### 5.1 Supabase, one row per thing

**Decision.** The truth lives in a Supabase (Postgres) database with one table per entity, using the rulebook's names (RULEBOOK §7). Each row carries `user_id`, `updated_at` and `deleted_at`.

```
items       id, user_id, kind, title, body, cat, time_start, time_end, final, reached,
            (canvas fields added when the canvas returns: x, y, w, h, blocks, certainty, …),
            updated_at, deleted_at
events      id, user_id, title, cat, date, start_min, end_min, repeat, reminder_min, todos,
            updated_at, deleted_at
categories  colour, user_id, name, span_start, span_end, updated_at
settings    user_id, density, theme, time_zone, …
```

Phases and milestones are `items` from day one, even though v2_7 has no canvas. That way the canvas can return later without a second migration. Per-device state, such as which phase details are open and the scroll position, stays on the device and is never synced.

**Why rows, not one blob.**
- **A blob loses data.** It's last-write-wins on *everything*: two devices editing offline means one device's work silently disappears. With rows, only edits to the *same thing* can conflict.
- **It can be read in pieces**, by the app, by an export, and later by agents ("all phases in teal ending this month").
- **Photos get a home later**: Supabase Storage, one file per photo.

**Security: why this can't leak the way the GitHub token did.**
- A GitHub token *is* the permission: whoever holds it can act on your GitHub account. Kept in the app, it sits wherever the app's data sits, and one leak gives it away.
- The browser holds only Supabase's *public* key, which permits nothing by itself. Every table has **Row Level Security**: the database refuses any row whose `user_id` isn't the person logged in. The permission is your login, checked by the database.
- Rule: **no secret ever goes in the repo or the app.** The `service_role` key exists only in Supabase's dashboard and server functions.

**Deletes are soft.** A delete sets `deleted_at` instead of removing the row. Otherwise a device that was offline would see "that item is missing, let me upload it" and bring deleted things back to life. Old tombstones can be cleaned up after 90 days.

### 5.2 Offline-first

The phone must keep working on the U-Bahn and must never lose a tick. So:

1. The full working copy lives on the device in **localStorage**, as it always has. *(IndexedDB, planned in draft 1, isn't needed: the plan is text, far below localStorage's limit. Revisit if photos arrive.)*
2. Every change is saved there first. The screen updates instantly, with no waiting for the network.
3. When online, `sync.js` sends every record stamped after the last sync, plus the new entries in `deleted`, then fetches everything changed elsewhere since then. The stamps make a separate outbox unnecessary.
4. Conflicts are resolved per record: the newer `updatedAt` wins. For one person on two devices this is almost always right. It relies on the devices' clocks being roughly right, which phones and laptops keep automatically.

**What it costs.** Sync is the most delicate code in the app. That's why it sits in one file behind the store, where no view can touch it, and why it gets the most tests.

### 5.3 Migrations and backups

- The local copy carries a `schemaVersion`. `data/migrate.js` holds an ordered list of upgrade functions, and each runs once.
- **No migration of v2_7's data** (Max, 20 Oct: the phone's data isn't worth it). The new store starts empty. If an old export is ever wanted, an importer can translate it then; the rules were worked out in the naming audit (30 Sept).
- **Migrations copy; they never edit or delete the old data** until you've confirmed the result on every device.
- **Export** writes everything to one JSON file. **Import** reads it back. It's always reachable in settings, and every big change starts with an export.
- **Automatic local snapshot**: once a day, the last 7 kept on the device.

### 5.4 Dates and time

- One date module, `core/dates.js`. The same helpers must never exist twice: the merge found two versions with *different day zeros*.
- Stored dates are ISO day strings (`2026-10-20`). **Ends are exclusive everywhere** (last day + 1). Displays show the last day.
- Event times are minutes since local midnight, read in the time zone stored in settings (`Europe/Vienna`). That's what keeps a 9:00 event at 9:00 across the clock change.

---

## 6. Views: one page, one scroll container — **Max, 20 Oct**

**Decided.** The levels live in one page and stack like a website, top to bottom:

1. **Canvas**: the free, endless dot grid. The page's "header".
2. **Timeline**: months and weeks, endless horizontally.
3. **Day grid**: hours by days, horizontally tied to the timeline.
4. **Single day**: one day at a time. Not designed yet; the layout leaves room for it.

**Why one page (and what it replaces).** The merge's frames let two finished apps meet without either losing anything. As a foundation, they're a second architecture: two copies of the state, the undo, the styles and the sync, kept in step by messages. One page has one store, one undo, one set of design tokens. A step dragged into the day becomes an ordinary drag instead of a message between pages. It also matches what fixed mobile lag before: a single scroll container.

**The known risk.** The 29 Sept one-page build lost the timeline's sticky mechanics. That's why the timeline is restructured first and alone (§11). A fingerprint test compares every sticky pin against today's live app, and nothing is added until it matches.

**The hard part, contained.** Vertically, the levels scroll natively. Horizontally, the levels share one date but not one scale: the timeline compresses (weeks across the screen), the day grid expands (3/5/7 days across), and the canvas zooms. One native horizontal scroller can't serve several scales. So everything about horizontal position lives in **one module, `views/viewport.js`**: the date at the left edge, the zoom, each level's scale, and how a pan on one level moves the others. Views ask it where a date is; none of them calculate it. Its design is prototyped and tried on the phone before any view depends on it.

In v2_7 the timeline and day grid already share one scroller and one scale relationship. Step 2 keeps that exactly as it is. The viewport question becomes real only when the canvas returns.

---

## 7. Agents — **Max, 20 Oct: later**

**Decided.** First the app has to work for Max. Agent access comes after sync works.

**What the architecture keeps possible** (nothing here is built now):
- The gate (§4) is where an agent's changes would enter, so they get the same stamps and undo as your own. Named commands may come back for this (§4).
- Supabase rows can be read in pieces, so an agent can ask for "this month's phases" without downloading everything.

**Recorded for when it's built (Claude's recommendation, not yet decided):** give agents their own database permissions, not only instructions. A prompt is a request, not a limit. An agent can misread it, and text it reads elsewhere (an email, a web page) can steer it. A database role that can only read, or only write proposals, is a limit no wording can talk around. It's cheap to set up when the time comes.

---

## 8. Steps — deferred

v2_7 has no steps: they come from the canvas's blocks. The question of where they're stored (inside a block's body with permanent ids, as in the step-D build, or as rows of their own) is decided when the canvas returns. Recommendation on record: inside the body, because it's already built and tested and keeps "nothing stored twice" true.

---

## 9. One dictionary — **Max, 20 Oct**

**The need (Max).** Every human and every AI on this project must know exactly what "phase", "block", "step", "event" and "todo" mean, and which code means it. Unclear words have already leaked into the code: the same thing named several ways, so similar or contradicting code got written twice.

**The dictionary is `RULEBOOK.md`.** It already defines the levels (§2), the things outside the hierarchy (§4) and the naming rules (§8). It becomes the one place, and gets:
1. **One row per concept** with: the German UI word, the one English code word, the stored field names, a small picture of how it looks, what it is *not*, and **the words never to use for it** (for example: Event, never "session", "termin" in code, or "dailyItem"; Step, never "task" or "Aufgabe").
2. **Pictures**: a small drawing of each level's shape, so "block" can't be confused with "event" at a glance.

**Enforced by a test, not by memory.** `tests/vocabulary.test.js` reads the never-say list from the rulebook and fails if any of those words appears in new code (names, comments, UI text). Code still carrying v2_7's old words is listed in an allow-list that only ever shrinks: each restructure step removes the words in the files it touched.

**Where v2_7 stands.** The live app predates the rulebook. It says `exams`, stores phase ends inclusively, and keeps descriptions as HTML. Bringing those to the dictionary is part of the restructure (§11), not a separate clean-up.

---

## 10. The safety net: how features get added without breaking things

1. **Branches and pull requests** *(Max, 21 Oct: GitHub is the only copy; no preview links).*
   - `main` is what your phone runs.
   - Every assignment happens on its own branch. Claude opens a pull request with a plain-language summary: what changed and why, which files, test results, and what to try on the phone.
   - Max merges; about a minute later it's live on GitHub Pages. Max tests in the live app.
   - If something is wrong, the pull request's **Revert** button undoes it in one click.
   - **Revisit** when the app holds data Max relies on: then a change should be tried somewhere other than the live app first (preview links or a second site), with its own storage.
2. **Tests, run by Claude Code before every merge.**
   - **Fingerprints** (`tests/fingerprint.mjs`, built 21 Oct): the old and the new build are opened side by side at a fixed date, on a phone and a desktop screen, and go through the same 16 steps (scrolling, opening the editors, the todo panel, settings, the time budget, ticking, undo). Every step is compared pixel by pixel, and every element's position. This is how "nothing visible changed" gets proven. *A screenshot of one flat colour fails the test:* from the split until 21 Oct the screenshots were silently black (a freeze rule clashing with reduced motion), so only positions were compared. Rechecked afterwards: the only visible change in that period was the undo button's state (§4).
   - `core/` rules: dates, carry-over, repeats, progress, migrations.
   - Sync: two simulated devices, offline edits, deletes. Nothing may be lost or come back.
   - Vocabulary (§9).
   - **A failing test blocks the merge**, whoever wrote the code.
3. **Size limits.** No file over ~600 lines. Hitting the limit means the file is doing two jobs, so it's split before anything is added.
4. **One feature per session**, with an entry in `DECISIONS.md`: date, decision, why, who decided.
5. **Tunables at the top** of their module, named (`PAN_ZONE`, `RESIZE_HOLD`): your existing rule, kept.
6. **Design tokens in one file** (`styles/tokens.css`). Colours, washes, type scale, radii and springs are defined once; no other file may write a raw hex or font size.

---

## 11. Build order — **Max, 20 Oct: restructure the live app**

**Decided.** Start from the app on GitHub (`index_v2_7`), the version in daily use. Give it the new structure and storage, and only then bring features back, the canvas included. Proven parts of the later builds (step ids, the rollup, the editor shell, migrations) are reused as parts when their feature returns, not imported wholesale.

**Why this order (Claude).** The split comes *before* Supabase. Sync written into the 2,400-line file would have to be written a second time during the split. Until sync works, v2_7's own Export (settings → Daten) is the backup.

**Each step ends with a working app on your phone, and stops for your check.**

0. **Secure and rescue. Done, 20 Oct.**
   - The leaked token is revoked. It was never in the repo: all 87 commits were scanned.
   - The live app (`index.html`, last changed 17 June) has no sync and no secret in it.
   - Max chose not to migrate the phone's data; the few events are re-entered by hand.
1. **Dictionary. Done, 20 Oct:** words, pictures (`docs/dictionary/`) and the vocabulary test.
2. **Split, no behaviour change. Built 21 Oct** as classic scripts (§2.1): 12 style files and 23 script files, each a run of consecutive lines of the old file. Proven line by line (`tests/split-2026-10-21.py --prove`) and pixel by pixel (fingerprint test); the loading screen was checked separately.
   *Original plan:* v2_7 moves into the file layout (§12): core, data, input, views/timeline, views/day, styles. Fingerprint tests prove it looks and behaves exactly as before. Old names may survive this step (allow-listed).
   **Rename pass. Built 21 Oct:** the names that survive the restructure now follow the dictionary (old words 276 → 45); the rest go with step 3. See `DECISIONS.md`.
3. **Data layer. Built 21 Oct** (§4), simpler than planned: one gate stamps every change; deletions are remembered; device state is separate; the editor's cancel really cancels. The plan is now stored under `timeline.data.v3`; the V2 data is copied over on first start and stays untouched under its old key.
   **3b. Stored names. Built 21 Oct:** exams and project milestones are one `milestones` list (one editor); end dates are stored exclusive (`lastDay`/`dayAfter` in `core/dates.js`); the mono font is gone. Data version 4; older data converts on load. *Deferred on purpose:* phase descriptions as plain lines (with the canvas), categories keyed by colour (open question, RULEBOOK B.8).
4. **Supabase.** Login, tables with Row Level Security, sync by stamps, export/import. Two devices in sync again.
5. **Notifications.** Reminders from a scheduled Supabase function by web push; a native wrapper only if Android web push proves insufficient.
6. **Then features, one at a time**: the viewport prototype → the canvas → blocks and steps → step → event drag → the single-day view → agents.

---

## 12. File layout

### 12.1 As built (21 Oct)

What exists now. Every file starts with one comment line saying what it holds and which lines of the old `index.html` it came from. `index.html` loads them in this order.

```
index.html                  page skeleton: meta, fonts, loading screen, app frame; loads everything below
app.js                      keyboard shortcuts and start-up
reminders.js                reminders (notifications)

core/                       rules with no screen
  model.js                  constants, colour palette, starting data
  dates.js                  date and time helpers
  text.js                   escaping and cleaning text
  repeat.js                 on which days a repeating event occurs

data/
  device.js                 device state: theme, days, open dropdowns (never synced)
  changes.js                stamps what changed; remembers deletions
  store.js                  the plan, loading, saving, the one gate (mutate), undo/redo, category lookup

views/
  range.js                  which days are drawn, pixels per day
  render-all.js             draws everything (renderAll)
  viewport.js               the one scroll container
  timeline/lanes.js         packs phases into lanes
  timeline/render.js        draws the timeline view
  day/render.js             draws the day view

input/
  pointer.js                pointer helpers and edge auto-pan
  add-mode.js               add mode (the + button)
  day-drag.js               creating, moving and resizing events by drag
  timeline-drag.js          creating and resizing phases, opening editors on the timeline

ui/
  loader.js                 loading screen
  toast.js                  toast message
  editor.js                 editor and its todo list
  todo-panel.js             todo panel and completion celebration
  time-budget.js            time budget
  settings.js               settings

styles/   tokens · base · timeline · day · add-button · editor · todos · settings · time-budget · toast · device · loader

docs/     ARCHITECTURE.md · RULEBOOK.md · DECISIONS.md · dictionary/
tests/    vocabulary · fingerprint · the split's record
package.json                lists the tools the tests use; the app itself needs no install
```

**Known misfits, left on purpose** (move only): `ui/toast.js` is called from `core/` and `data/`; `data/store.js` calls `renderAll`; `views/range.js` reads the screen width. Each is fixed when step 3 introduces the store.

### 12.2 Target

Where the layout is heading once the store exists (step 3) and the canvas returns.

```
index.html              the page: loads styles and app.js; no logic
app.js                  boot: open store → migrate → mount views → register service worker
manifest.json · sw.js · icons/

core/                   pure rules, no DOM, no storage — tested
  model.js              entity shapes, kinds, defaults, validation
  dates.js              the one date library (exclusive ends, KW, Jänner, time zone)
  todos.js              todo states, carry-over, repeats
  progress.js           the one rollup rule
  colours.js            the 8 colours, their washes, category lookup

data/                   the only code that holds or saves data
  store.js              the plan, the one gate (mutate), undo
  changes.js            stamps what changed, remembers deletions
  device.js             device state (never synced)
  sync.js               Supabase push/pull, login
  migrate.js            schema versions (each upgrade copies; never edits the old data)
  backup.js             export / import JSON

input/
  pointer.js            the one Pointer Events pipeline; which gesture owns the pointer

views/
  viewport.js           shared date at the left edge, scales, zoom, level scrolling
  timeline/             spines, lanes, bars, chips, details bubble
  day/                  columns, hour rail, events, todo panel
  canvas/               (returns in step 6)

ui/                     shared pieces any view may use
  editor.js             the one editor shell
  settings.js

styles/
  tokens.css            colours, washes, type scale, radii, springs — the only place
  base.css · editor.css · timeline.css · day.css

supabase/
  schema.sql            tables
  policies.sql          row level security

tests/                  fingerprints, core, sync, vocabulary
docs/
  ARCHITECTURE.md       this file
  RULEBOOK.md           the dictionary and the product's rules
  dictionary/           the dictionary's pictures (SVG) and the script that draws them
  DECISIONS.md          dated log of decisions
```

**Why this split and not the one in the Project brief §4.1.** The brief splits by *technical job* (`render.js`, `input.js`, `layout.js`). That was right for one view. With three or four views it puts all rendering into one `render.js`, which would be the 3,000-line file again. This layout splits **by layer at the bottom** (`core`, `data`, `input`: shared by everyone) and **by view at the top** (`views/timeline`, `views/day`, later `views/canvas`). Each view folder is split by job inside once it grows. The brief's instinct is kept; it's just applied per view.

---

## 13. Rules for any coding session (the short version)

1. Read this file and the rulebook first. State which layer and which files you'll touch.
2. Use the rulebook's words. If a word you need isn't there, add it to the rulebook first.
3. Change the plan only through `mutate`. Never call persist, never write state from a render. Device state goes through `setDevice`.
4. Imports point down. Views never import each other.
5. New behaviour in `core/` gets a test. Existing tests must pass before merge.
6. No raw colours or font sizes outside `tokens.css`. No secret keys anywhere, ever.
7. Pointer Events only: no parallel mouse or touch handlers.
8. Stored names change only with a migration that copies.
9. When the right fix is structural, say so before patching.
