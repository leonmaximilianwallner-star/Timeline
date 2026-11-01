# Timeline — Decisions

> Append-only log: newest at the bottom. Each entry says what was decided, why, and who decided. Earlier decisions (June–October 2026) live in the project's merge logs and are summarised in `RULEBOOK.md`; this log starts with the restructure.
> **Max** = Max decided. **Claude** = Claude's call, flagged for Max to overrule.

## 20 Oct 2026 — the restructure

- **Data storage first, then rebuild step by step.** Sync broke when the GitHub token leaked; the old app saves only in the browser. *Max*
- **One page, views stacked** (canvas → timeline → day → single day), not frames. Frames doubled the state, undo, styles and sync. *Max*
- **Restructure the live app (`index.html`), don't rewrite.** Start from what's in daily use; bring later features (canvas, steps) back one at a time. *Max*
- **Agents later.** First the app has to work for Max. When built, agents get database permissions, not only instructions. *Max (later); Claude (permissions)*
- **One dictionary, enforced by a test.** Unclear words had leaked into the code. `RULEBOOK.md` Part A; `tests/vocabulary.test.mjs`. *Max (the need); Claude (the mechanism)*
- **No migration of the phone's data.** It isn't worth new code; the few events are re-entered by hand. *Max*
- **The leaked token was revoked; no token in the repo's history.** All 87 commits scanned. The old Gist sync was removed in June. *Checked by Claude*

## 21 Oct 2026 — the dictionary, the split, the way of working

- **Names are built, not invented:** thing + part (event editor, todo panel), verb + thing (`openEventEditor`). Shape words (pill, squircle, circle, dot) never name a thing. "Card" is retired: the canvas thing is an *idea*. *Max*
- **Split by moving only.** Nothing inside the code changes; renaming and the store come as separate pull requests. *Max*
- **No preview links.** A merged change is tested in the live app and reverted if wrong. Revisit once the app holds data Max relies on. *Max*
- **GitHub is the only copy of the code.** Claude works through pull requests; Max reviews, tests and merges. No hand-managed desktop copy. *Max*
- **The split uses classic scripts, not modules, for now.** Only classic scripts allow a split with zero code changes; modules follow with the store (ARCHITECTURE §2.1). *Claude*
- **Cut only along consecutive lines, in the old order,** so the split can be proven line by line. Some file names are therefore narrower than the target layout (e.g. `views/range.js`), and a few misfits stay where they were (ARCHITECTURE §12.1). *Claude*

## 21 Oct 2026 — the rename pass

- **Rename only the names that survive the restructure.** Code names, IDs, CSS classes, animation names and comments: modal/draft → editor, pop/popover → todo panel, evcard/card → event, bubble → dropdown, topbar → header, cluster → overlap, track → category / follow. The full list is `tests/rename-2026-10-21.py`. Old words in the code: 276 → 45. *Max (go); Claude (scope)*
- **Left for step 3, on purpose:** stored data names (`exams`, `details`, `expanded`) and the German text on screen ("Prüfung"). The new store replaces the stored names anyway; renaming them now would be renaming code about to be deleted. *Claude*
- **Two new words.** *Window*: a squircle shown centred over a dimmed backdrop; the editor and the time budget are windows (code: `.overlay-window`). *Initial values*: the starting values of a thing being created in the editor, the counterpart of `edit` (code: `ctx.initial`, was `ctx.draft`). *Claude*
- **One word, three meanings, found on the way:** `pop` was the todo panel, an "appear" animation shared by several panels (now `appear`), and JavaScript's own `.pop()` for taking the last item off a list (unchanged; the vocabulary test ignores it). A blind search-and-replace would have broken undo. *Claude*

## 21 Oct 2026 — step 3, the data layer

- **Keep it simple: build on the gate that exists.** Every change already went through `mutate()`. Step 3 makes it complete and has it stamp what changed. Dropped from the plan as not needed now: named commands, IndexedDB, modules. *Max (simplest solution); Claude (what to drop)*
- **Records are stamped, deletions remembered.** Each category, phase, exam and event carries `updatedAt`; removed ones go to `deleted`. Sync can then send only what changed, and a deleted record can't come back. *Claude*
- **Device state is separate from the plan:** theme, number of days, open dropdowns. A phone and a laptop want different ones; synced, they would flip each other. No longer undoable. *Claude*
- **The editor works on a copy of an event's todos.** Before, todos added to an existing event went straight into the plan, even when cancelled, and would never have reached sync. *Claude (bug found)*
- **The phone's V2 data comes along.** On first start the new version copies it into the new shape (`timeline.data.v3`); the V2 copy stays untouched. Supersedes "no migration" from 20 Oct: copying turned out simpler than starting empty. *Claude*
- **Stored names change in a separate step (3b)**, before Supabase. *Claude*

## 21 Oct 2026 — step 3b, stored names

- **Exams and project milestones are one list.** `milestones`: `{ title, date, categoryId, final, note }`; an exam's points became its `note`. One editor; the "Prüfung | Meilenstein" switch is gone. With a project's category a milestone sits on the spine, otherwise it is a chip. *Max (30 Sept, "exams are milestones"); Claude (the shape)*
- **A chip without a category stays red**, as exams were, until colour and category are aligned. *Claude*
- **Deleting a project still deletes its milestones** (before, they were stored inside it); deleting a plain category frees them, like its phases and events. *Claude (kept old behaviour)*
- **End dates are stored as the day after the last day.** Screens still show the last day. Helpers `lastDay`/`dayAfter`. *Max (rulebook, Sept)*
- **No mono font, ever.** The font download and all four rules are gone (the drag/hover time labels in the day view and the time-budget numbers); numbers that change while you watch use DM Sans with tabular figures. The vocabulary test bans "mono". *Max*
- **Deferred:** phase descriptions as plain lines (with the canvas), categories keyed by colour (open). *Claude*
- **A flaw in the fingerprint test, found and fixed.** Since the split's last commit, every screenshot was black, so pull requests #2 and #3 were compared by positions only, not pixels as claimed. Fixed, and a blank screenshot now fails the test. Rechecked afterwards: #2 and #3 changed nothing visible except the undo button's state when opening a dropdown (intended, step 3). *Claude*

## 21 Oct 2026 — the audit (pull request #5)

Max asked for a thorough check before Supabase. Every file was read; his five issues and what turned up:

- **Todos belong to one occurrence of an event.** A repeating event's later occurrences start empty (`todosByDate`, data version 5). Before, a weekly event had one list for every week, so ticking a todo ticked it everywhere. Existing lists of a series went to its current occurrence. *Max (the rule)*
- **Postponed todos of a series come along to the next occurrence**, shown until changed there, one step only. *Max (chose this); Claude (shown, stored on first change)*
- **The editor no longer resets fields.** Changing the category of a new event rebuilt the whole form to refresh carried-over todos, losing title, time and date typed before. Now only the todo list refreshes. *Claude (cause)*
- **A tap outside the editor saves; ✕ and Escape cancel.** *Max*
- **Phase dropdowns that don't overlap share a row** instead of each taking its own. *Max*
- **Found in the audit:** loading more past days moved the view by up to 6 days (re-anchored by 180 days, but the start then snaps to a Monday); the week number in the corner was read one day too far right (a Sunday showed next week's number). Both fixed. *Claude*
- **Removed dead code:** an unused colour-dot picker and its styles, two unused style classes, two unused variables, an editor branch for a "project" type nothing opens. The pink token is `--c-pink` (was `--c-orange`). *Claude*
- **Day snapping** (the stutter when moving again right after stopping) gets its own pull request, because it changes how scrolling feels and must be judged on the phone. *Claude*

## 21 Oct 2026 — day snapping (pull request #6)

- **Days snap by the browser's own scroll snapping**, not a timer. Before, a timer started a smooth scroll after scrolling stopped; moving again during that scroll made the two fight (the stutter Max felt). Native snapping settles momentum and gives way the moment a new gesture starts. Paused while a drag auto-pans at the screen edge; the view settles on a day at the drop. *Claude (cause and fix); Max (to judge the feel on the phone, revert on its own if wrong)*

## 21 Oct 2026 — step 4, Supabase sync (pull request #8)

- **One `records` table, the record as JSON**, not a table per kind: new or renamed fields never need a database change. *Claude*
- **The server decides two things**: when a row arrived (its own clock, so no device's clock can make it miss something) and that an older version never overwrites a newer one. *Claude*
- **Login: email and password, one account made in the dashboard, sign-ups off.** No email links (they open the browser, not the installed app). *Max (set up); Claude (method)*
- **First device uploads; later devices take the server's plan**, keeping their own as a backup on the device. Max signs in on the phone first. *Claude*
- **Changes from another device clear undo.** Undoing across them would bring back what the other device changed. *Claude*
- **Tested against a simulated Supabase** (two devices, offline, conflicts, deletions, expired login); this environment can't reach supabase.co, so the first real sync is on Max's phone. *Claude*
- **Found while looking into the missing app icon:** sync didn't stop when the token leaked. The V2 rewrite of 12 June dropped the old Gist sync, along with the manifest link (pull request #7). *Claude*

## 21 Oct 2026 — version tags on every file (pull request #9)

- **Every file index.html loads carries `?v=<version>`, computed from all files' content.** GitHub Pages lets browsers reuse a file for 10 minutes; right after #8, Max's browser ran the new index.html with the old settings file, so the Sync section was missing. With mixed data code that could do real harm. Now any change gives every file a new address, so they are fetched together. `tests/asset-version.mjs` fails if a change wasn't tagged. *Claude*

## 21 Oct 2026 — step 5, push reminders (pull request #10)

- **Web push, no native app.** Android Chrome and installed iPhone web apps (iOS 16.4+) receive push like a native app; a native wrapper would add an app store and a second codebase for nothing. *Max (asked); Claude (checked)*
- **A Supabase function, run every minute, decides what is due** and sends it. The alternative, the phone scheduling its own alarms, doesn't exist on the web. *Claude*
- **Switched on per device, not per account.** You may want reminders on the phone and not on the laptop. *Claude*
- **Never both push and in-app reminders on one device**, so nothing arrives twice. *Claude*
- **Whether push is on is read from the browser, not stored.** A stored flag could disagree with reality (permission revoked, browser data cleared). *Claude*
- **The server reads times in the device's time zone**, sent along on every start. *Claude*
- **A reminder more than 10 minutes late is dropped**, not sent hours later after an outage. *Claude*
- **Found on the way:** the in-app reminders used `new Notification(...)`, which Android Chrome refuses; the error was swallowed, so they probably never worked on the phone. They now go through the service worker. *Claude*
- **Tested here:** due-time rules (clock changes, repeats, midnight), sending once, gone devices; real encryption and signature, decrypted independently as a phone would; the switch in a browser against a simulated Supabase. **Not testable here:** the real push services and the real Supabase. The first real push is on Max's phone. *Claude*

## 22 Oct 2026 — dragging events across weeks (pull request #11)

- **Moving an event to the screen edge slides the days by again**, as on the timeline. It was lost in the V2 rewrite: the day view's drag never used the edge pan. Only moving pans; resizing stays vertical. *Max (asked); Claude (cause)*
- **Held longer at the edge, the pan speeds up to 4× within 3 s**, so weeks are reachable, not just days (at the old speed, two weeks took about 6 s). Applies to every drag, timeline included. *Claude (Max to judge the feel)*
## 22 Oct 2026 — the editor and settings in the mockup's design (pull request #12)

- **Part C of the rulebook: stack, don't scatter.** Options are rows in a few lists, the value at the end of the row, instead of a heading and a field each. The philosophy for the whole interface, applied view by view. *Max (the philosophy); Claude (written down)*
- **White text on category colours stays**, even where it is below 4.5:1; revisited if the editor headers fail the eye test. *Max*
- **No note on events for now.** The mockup shows one; it would be a new stored field. *Max*
- **Settings: one panel with pages.** The main page lists projects and categories together; each has its own page in its colour (span, colour, its phases and milestones); Sync has its own page. Clicking a project's name on the timeline opens its page. *Max (mockup); Claude (Sync as a page)*
- **Rows are changed in place with the phone's own pickers** (an invisible select over the row), not custom menus: less code, and the picker every phone user knows. *Claude*
- **A typed todo is kept when saving**, even without pressing Enter: the "+" button is gone, and typed input is never lost (as with a tap outside). *Claude*
- **The closed settings panel is hidden completely.** Its shadow showed at the right edge, and it could be reached with Tab while closed. *Claude (found by the fingerprint test)*
- **The settings dim the app below the header**, and a tap there closes them, as in the mockup. *Max (mockup)*
- **Kept as they were:** every input's id, so the existing behaviour tests prove nothing but the look changed; the editor's rules (a tap outside saves, ✕ and Escape cancel). *Claude*

## 22 Oct 2026 — one scale: buttons, edges, type; the todo panel goes (pull request #13)

- **An audit measured the interface instead of eyeballing it:** 5 round-button sizes (18, 26, 34, 36, 54 px), 6 different shadows, 3 dim layers, 7 radii, 11 font sizes, two colour vocabularies side by side. *Max (asked for the scrape); Claude (measured)*
- **The todo panel is gone; a click on an event opens its editor.** Two views of the same thing, the first with less in it, cost a second click. The celebration (all todos done) moved to the editor. *Max*
- **Todos apply at once; cancelling discards only the event's own changes.** Reverses "cancel drops todo changes" (step 3) for todos only, now that the editor is where todos are ticked: tick-then-slide-down must not lose the tick. *Max*
- **The editor never starts typing by itself on a phone**; pulled down by its header, it closes without saving. *Max*
- **Round buttons: one size (36), three looks; the add button 44 as the one exception**, filled light like done, no blue, no glow. *Max (one scale, the add button too large and too blue); Claude (44 for the thumb)*
- **No soft shadows, one dim layer without blur.** Edges and lighter surfaces separate floating panels; hard rings where something must stand off. *Max*
- **The current time is amber, today is just brighter** (the mockup); the red was a category's. Blue hover lines and focus rings became grey. *Claude (from the mockup)*
- **One token set.** The old near-duplicate colours merged into the mockup's; the faint grey (3:1) is gone, so hour and weekday labels read better. Five font sizes, weights up to 600, radii 8 · 16 · 24 · round. *Claude*
- **Events show what their height holds**, words broken at syllables (the browser's German hyphenation), the start time alone in narrow columns, line icons instead of emoji. *Max (the problem); Claude (from the mockup's "Detail nach Höhe")*
- **Not checked here:** hyphenation (the test browser lacks the German dictionary). Max checks on the phone. *Claude*

## 22 Oct 2026 — series, the editor's body, motion (pull request #14)

- **Max's test notes, triaged:** what breaks or annoys daily use now (the todo overflow, series deletion, the stutter, the time field, motion); what needs a design decision next session (the editor header with the category drop-up; the day view's hours); what is a concept to design first (the full-screen lookup view). *Claude (triage); Max (notes)*
- **Deleting from a series asks: this occurrence, or this and all following.** Stored as `except` (removed days) and `end` (exclusive) on the series, read only by `occursOn`, so every view and the reminder server agree. *Max (the feature); Claude (the storage)*
- **The editor keeps the height it opened with; its body scrolls.** A full todo list had squeezed repeat and reminder to 0px (a flex layout let them shrink). *Max (found); Claude (cause)*
- **Typing into a row shows the cursor, not a frame.** *Max*
- **Whatever opens with a motion closes with it, reversed** (rulebook C.5): editor, time budget, phase dropdown. Redraws never replay an opening. *Max*
- **A click on a time or date opens its picker.** *Max*
- **Found on the way:** the ✕ button handed its click to the close function as "close instantly", which would have skipped the closing motion. Fixed and tested. *Claude*

## 22 Oct 2026 — the category list, one header bar, the thin night (pull request #15)

- **The category list rises from the editor's header**, plain text over the deepened dim layer, as Max drew it; no window of its own. On a desktop the editor glides down to make room, so the list rises everywhere. *Max (the idea, the place); Claude (the room)*
- **One header bar:** the overline is the category ("Frei" without), the title's placeholder is the kind ("Termin"). The old "TERMIN" over "Neuer Termin" said the same thing twice. *Max*
- **The soft start is a thin night, not a stop.** Hours before the day's start (6:00 by default, a setting) are a quarter tall. A stop you can push past would fight native scrolling (Max suspected it). Proven: at 0:00 the day view is pixel-identical to before. *Max (soft start); Claude (thin, not stopped)*

## 29 Oct 2026 — the category list always rises (pull request #16)

- **Found by Max on his phone:** the list opened downward on a grey surface. Cause: a fallback for "not enough room above", which a phone editor with a few todos always hit. The test and the screenshots covered only an editor without todos. *Max (found); Claude (cause, own mistake)*
- **Fix:** the editor glides down as far as its header if needed; the list always rises, and scrolls if longer than the room. The fallback is gone. Tested with 0, 3, 8 and 20 todos; the new tests fail on the previous code. *Claude*

## 29 Oct 2026 — push: the setup that didn't take, and "on stays on" (pull request #17)

- **The error "Could not find the table public.push_devices":** push.sql's tables were never created. Likely cause: run as one script, a failing extension line undid all of it. push.sql is now safe to run again and in two parts (tables first, the schedule second). *Max (found); Claude (cause, fix)*
- **On stays on:** the device remembers that push was wanted; if the browser drops the subscription on its own, the next start renews it. Only "Ausschalten" or signing out forgets it. *Max*
- **Server errors appear in words**, not as raw JSON. *Claude*
## 29 Oct 2026 — todos without events (pull request #18)

- **A todo can stand on a day without an event**, as events stand without phases and phases without projects: the user builds as much structure as they want, none is forced. *Max*
- **Shown as up to three dots under the weekday** (one per category with open todos, then "+"), a tap on the day opens its todos in the editor's shell. *Max (dots, place, at most three); Claude (the whole header cell as tap target, the panel)*
- **Open todos of past days come along to today** until ticked, keeping their own day. *Max*
- **Day todos first; undated ones later**, with the canvas. *Max*
- **Stored as their own records** (`dayTodos`, data version 6), synced like the rest; an older app version leaves them on the server untouched. Changes apply at once and undo, as todos in the editor. *Claude*
- **Holding a day todo moves it to tomorrow** (a right click on a desktop): a phone has no right click. *Claude*

## 30 Oct 2026 — Soll/Ist, part 1: actuals and recording (pull request #19)

- **What really happened is stored apart from the plan:** `actuals`, a record of its own (data version 7), not a field of the event. Covers interrupted work (two actuals, one plan), unplanned time (no plan) and work done on another day. An actual never moves or disappears with its plan. *Max (the flexibility); Claude (the shape)*
- **Words:** plan and actual (*Soll und Ist*), actual (*Ist*, `actual`), running (*läuft*, `endMin` null), recording (*Aufnahme*), add menu. RULEBOOK A.6, A.8. *Claude (names); Max (to adopt)*
- **The look:** plan top-left, actual bottom-right, 3px each way, the boxes otherwise time-true; a plan with an actual is only its coloured outline, solid. *Max (the rule, outline not dashed); Claude (3px, both boxes keep their full height: shrinking the plan cost 30-minute events their title, found by the editor-phone test)*
- **Plans and actuals pack separately**, so a plan and its own actual never sit side by side as if they were two appointments. *Claude*
- **Record says what it assumes before you press it:** a row per planned event "now" can mean (from 30 min before its start to its planned end, closest first, at most two), then *Ohne Plan*. A guess you can see instead of a silent one. *Claude*
- **A running actual is stored in the plan**, so it survives closing the app and can be stopped on another device. A stop under a minute leaves nothing. *Claude*
- **Now is red again**, its line and a running recording (the dot on the + button). Amber (22 Oct) came from the mockup; red was the original meaning. A brighter red than the red category's. *Max*
- **Actuals are not touchable yet**: taps reach the plan behind them. Correcting by drag is the next pull request. *Claude (scope); Max (functional first, step by step)*
- **Found on the way:** the minute tick that grows a running actual redrew the day view after placing the now line, which hid the line. Fixed before merging. *Claude (own mistake)*

## 1 Nov 2026 — three fixes from Max's tests (pull request #20)

- **Todos lost between devices: an editor left open wrote its old copy back.** The editor works on its own copy of an event's todos. Changes from the other device reached the plan, not that copy; the next tick, new todo or tap outside then stored the old list as the newest change, on both devices. Reproduced with two simulated devices. Now an open editor takes the new data when it arrives (`editorTakeRemote`); deleted elsewhere, it closes. Phases and events hid it: they are rarely open in an editor while the other device changes them. *Max (found); Claude (cause)*
- **A tap on an actual opens the actual**, in the editor's shell (kind *Ist*). Before, actuals let taps through to the plan behind. A finger still scrolls over an actual; dragging it is correction mode, next. *Max*
- **The editor's time row never slides sideways.** A phone's own time and date fields bring their own width (Android, 12-hour times) and pushed the row past the editor. They now shrink to the row, and the body scrolls only down. The phase editor's odd gap after the first date went with it. *Max (found); Claude (cause)*

## 1 Nov 2026 — the focus view, part 1 (pull request #21)

- **Fokus: one day, about the now.** The highest level of detail: the event of now open with its todos, the rest of the day as rows, the week as pills. After the mockup "Tag, ruhig" where it doesn't touch earlier logic. *Max (the view, the name); Claude (the rules for which event is open)*
- **A layer over the app, not a fourth band of the page.** It needs no shared horizontal scale, so it doesn't wait for the viewport module. *Max*
- **Todos unchanged.** The mockup's two levels (a todo with sub-items and notes) come with steps, later. *Max*
- **From the mockup, left out on purpose:** location and per-category icons (fields that don't exist; Max: no note on events for now); its amber now (now is red); its radii 20/23 (ours: 16, 24, round); its 28px heading (ours: 20); dashed free time (dashed is a drag preview, so plain). *Claude*
- **The phone's back gesture closes Fokus**, through one history step, instead of leaving the app. *Claude*
- **Reached by an expand button in the editor's header** for now; the pull-up gesture with a rubber band and the morph is the next pull request (commit on release, Claude's recommendation; Max to judge by feel). *Claude*

## 1 Nov 2026 — from the editor to Fokus: pull up, one motion (pull request #22)

- **A container transform, not a fade** (Google's Material pattern): the editor's squircle reshapes into the open event while every shared element travels to where it lands (the date up into the header, the time into the open event, each todo to its row); what only the editor has leaves, what only Fokus has arrives, nearest first. *Max (the idea: every element moves to its new place); Claude (the map of elements, RULEBOOK C.5)*
- **Shared elements cross over** rather than morph letter by letter: one path, the editor's copy fading out over the first half, Fokus's fading in over the second. Identical text reads as one thing moving; different text (12-hour time → 24-hour, *3h* → *noch 1h 50min*) changes on the way. *Claude*
- **The pull up is a rubber band, armed past a line, committed on release** (Max left the choice open; Claude's recommendation): until the finger lifts, it can still be undone by moving back. A tick and the filled expand button say "let go now". *Claude; Max to judge by feel*
- **Plain Web Animations, measured in place**: Fokus is built under the editor, both are measured, then everything moves at once. The browser's own View Transitions were considered: less code, but they can't start from where a finger left the editor, and older phones lack them. *Claude*
- **Only the way in moves for now.** Closing Fokus still fades to the week. *Claude (scope)*

## 1 Nov 2026 — the motion, second pass: the way back, the threshold, the edges (pull request #23)

- **Fokus closes with a container transform into the week**, the same grammar as the way in: each event reshapes into its squircle in the day grid, the weekdays and dates travel into the day header, the rest leaves or arrives. *Max (every motion the same feeling in reverse, RULEBOOK C.5); Claude (the map)*
- **Only what can be seen travels.** An event above or below the visible hours, or a day outside the visible columns, leaves instead of flying under the day header. The date travels into the app's header only where that header shows a date (not on a phone). *Claude (found in the frames)*
- **Pulling up grows the editor from the bottom edge** instead of lifting it, so nothing behind it shows. On a phone its coloured bottom line is gone (border-bottom 0), as when the category list opens: the editor sits 1px lower. *Max (found); Claude (cause)*
- **The pull has two phases**: it holds back before the line, springs forward at it, follows loosely after. The old rubber band asked the same strength for every pixel. *Max*
- **Corners round off in the first 40 % of the motion**, not along all of it (the "beat" before the squircle). *Max (found)*
- **While the week is moving into place, it doesn't extend or redraw itself** (the drag guard `UI.dragLive`), so nothing is swapped out mid-motion. *Claude*

## 1 Nov 2026 — Fokus: the day's todos, notes on free time (pull request #24)

- **The day's own todos stand at the top of Fokus**, before the first event, plain rows with a thin line under them. They had no place there before; the dots in the week stand for events. *Max*
- **Free time is three dots, its length and a note** ("Pause", "Anfahrt"), without an event's surface. *Max*
- **The note is stored with the event the free time leads to**, per day, so it moves with that event: "leave 30 min earlier" belongs to the meeting. Not its own record: free time isn't stored, it follows from the events. *Claude (where); Max to veto*
- **Fokus no longer creates events** from free time or an empty day. Max was unsure it's needed; the week view creates events, Fokus is about the now. Easy to bring back. *Claude (recommendation), Max (unsure)*
- **Free time from 15 min on** (was 30): a short walk between two rooms can need a note too. *Claude*
- **A new todo of the day in Fokus takes the category last chosen in the day's panel** (or frei); choosing one in Fokus comes later if needed. *Claude*
- **A redraw while typing keeps what is typed** (a sync arriving mid-word), for every field in Fokus. *Claude*
