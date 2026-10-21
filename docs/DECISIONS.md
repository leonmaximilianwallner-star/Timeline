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
