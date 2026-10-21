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
