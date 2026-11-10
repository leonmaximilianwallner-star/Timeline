# Steward Ledger

> Kept by the timeline steward (the standing engineering partner). Findings, what Max accepted and rejected, and every run.
> Tiers: **A** just fix (pure consistency with a written rule, no feel impact) · **B** propose (small, touches behaviour, layout or a constant) · **C** decide (philosophy, naming, structure; options, no code).

## Open
| ID | Tier | Area | Finding | Rule / source | Since |
|---|---|---|---|---|---|
| S1 | C → accepted | hierarchy | **Accepted 10 Nov (Max: "a core principle, not an add-on"); step 1 in PR #27 (event ↔ phase), steps next.** Nothing links the day to the plan: no event, todo or day todo references a phase or step (`phaseId`/`stepId`: zero hits in the code). The principle ranked first exists only in the docs. | RULEBOOK B.1.1, B.2, B.6 "Scheduling a step"; ARCHITECTURE §8 | 2026-11-10 |
| S2 | B | loader | The wordmark gates every start: a fixed 1.8 s floor (`ui/loader.js`) plus a 1.6 s fade (`styles/loader.css`), ~3.4 s, though the app draws from local data at once. The comment says "2.9s draw + 0.4s hold" and no longer matches the timer. | C.5 "only a change of state animates"; brief: the app makes small decisions on your behalf | 2026-11-10 |
| S3 | B | time budget | Computes from **planned** events, while the dictionary calls it time actually spent, and actuals (Soll/Ist, #19) now exist: two measures of time that disagree. Still the older look. | RULEBOOK A.8, C.6; one strategy per mechanic | 2026-11-10 |
| S4 | C | todos | A todo has two homes (an event's occurrence, a day todo) and Fokus adds a third small store (free-time notes). A day todo can't be placed in the day grid. | B.8 "Day todos, next steps"; one strategy per mechanic | 2026-11-10 |
| S5 | B | motion | 10 easing curves and ~15 durations across the styles, incl. `ease`, `ease-out`, three ad-hoc cubic-beziers and an inline copy of `--spring`. C.5 names `--soft` (and `--spring` as identity). | RULEBOOK C.5; custom instructions (motion identity) | 2026-11-10 |
| S6 | A* | tokens | Raw hex in 9 style files outside `tokens.css` (focus.css 10, add-button.css 7, editor.css 4, timeline.css 3, others 1). *Tier A only for lines that duplicate an existing token; to verify line by line.* | ARCHITECTURE §10.6, §13.6 | 2026-11-10 |
| S7 | C | timeline view | Untouched since 22 Oct and without its design pass, while the last 7 PRs all went to the day view, editor and Fokus. The brief calls it the most important view. | Brief; RULEBOOK C.6 | 2026-11-10 |
| S8 | C | process | Trials marked "Max to judge by feel" are not recorded as judged: day snapping (#6), edge-pan speed-up (#11), the pull-up line (#22/#23), free-time notes stored with the next event (#24), Fokus not creating events (#24). Unjudged trials become defaults by convenience. | ways of working: feel-gated iteration | 2026-11-10 |
| S9 | B | done | Four definitions of "event done" disagreed (day view, editor, Fokus, phase count); events without todos couldn't be ticked. **Fixed in PR #28** (one rule, hand tick). | B.1.4; one strategy per mechanic | 2026-11-10 |
| S10 | C | visual | The hierarchy now exists in data but is drawn only as lists and counts; the phone's room is getting scarce (Max). Needs its own design pass: what each view must show, so the same information isn't repeated three ways. | B.8; Max 10 Nov | 2026-11-10 |
| S11 | B | steps | Steps and todos can't be renamed or reordered; names don't follow between a step and its events (B.6.7). | B.2.3 "not yet" | 2026-11-10 |
| S12 | B | process | Stacked PRs merged into their bases, not `main` (#28, #29), and a ledger commit pushed after its PR merged: three times in one day, live app silently behind. **Fixed:** #30 brought them in; every PR now targets `main`, dependencies said in words. | ways of working | 2026-11-10 |
| S13 | C | canvas | Open after the canvas's first step: cell 40px vs. 32px block geometry; touch entry on the phone; which view opens at start; zoom levels (B.5). | RULEBOOK B.8 | 2026-11-10 |
| S14 | B | tests | The fingerprint compared positions one by one, so any new invisible element failed every later step; it now skips what can't be seen and wrappers. Also: `desktop · event-click` differs by 2px between identical builds about 1 run in 8 (existing noise). | ARCHITECTURE §10.2 | 2026-11-10 |

## Rejected (do not re-propose without new reason)
| ID | Idea | Max's reason | Date |
|---|---|---|---|

## Done
| ID | Change | PR | Date |
|---|---|---|---|

## Rule candidates (seen 2+ times → propose for guideline)
- *A dictionary word that isn't in the list the test reads isn't enforced:* "board" was banned in A.8, not in A.11, and the canvas's first draft used it. Proposed: every "Never say" in Part A goes into A.11. (10 Nov)
- **Adopted 10 Nov as RULEBOOK B.2.3 (Max): one mechanic for every level.** A new level or feature reuses how the app already makes, ticks, schedules and moves things; it adds no logic of its own. Check every proposal against it.
- **Adopted 10 Nov as RULEBOOK B.1.8 (Max):** structure supports, never demands; links from either end, may skip levels.
- *Tie-break for equal options:* when two options are equally good, pick the one that strengthens the hierarchy (B.1.1), then the one that removes a thing. Proposed 2026-11-10 because the same worry ("least terrible by convenience") recurs.

## Runs
| Date | Mode | Area | Summary | Jury scores (1–7) |
|---|---|---|---|---|
| 2026-11-10 | Jury | whole app | First Jury, baseline. Strong foundation (gate, sync, push, tests, dictionary); all recent work in the execution layer; the hierarchy link is still unbuilt. | 1 · 3 · 2 · 4 · 3 · 3 · 3 |
| 2026-11-10 | — | hierarchy | S1 accepted; PR #27 builds its first link (parentId, event ↔ phase). Opened B.8 "one way to say belongs to" (blocks list vs parentId). | — |
| 2026-11-10 | — | hierarchy | Max: one rule for done (Word headings), one mechanic per action. PR #28 (hand tick, S9), PR #29 (steps as records). Opened S10 (visual pass), S11. | — |
| 2026-11-10 | — | canvas | Canvas first step (PR #31): grid, rail (timeline at canvas scale), pull in/out reusing the editor's pull, morph in the Fokus grammar. Week pixel-identical. Opened S12–S14. | — |
