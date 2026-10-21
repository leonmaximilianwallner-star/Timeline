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
