# Steward Ledger

> Kept by the timeline steward (the standing engineering partner). Findings, what Max accepted and rejected, and every run.
> Tiers: **A** just fix (pure consistency with a written rule, no feel impact) · **B** propose (small, touches behaviour, layout or a constant) · **C** decide (philosophy, naming, structure; options, no code).

## Open
| ID | Tier | Area | Finding | Rule / source | Since |
|---|---|---|---|---|---|
| S1 | C | hierarchy | Nothing links the day to the plan: no event, todo or day todo references a phase or step (`phaseId`/`stepId`: zero hits in the code). The principle ranked first exists only in the docs. | RULEBOOK B.1.1, B.2, B.6 "Scheduling a step"; ARCHITECTURE §8 | 2026-11-10 |
| S2 | B | loader | The wordmark gates every start: a fixed 1.8 s floor (`ui/loader.js`) plus a 1.6 s fade (`styles/loader.css`), ~3.4 s, though the app draws from local data at once. The comment says "2.9s draw + 0.4s hold" and no longer matches the timer. | C.5 "only a change of state animates"; brief: the app makes small decisions on your behalf | 2026-11-10 |
| S3 | B | time budget | Computes from **planned** events, while the dictionary calls it time actually spent, and actuals (Soll/Ist, #19) now exist: two measures of time that disagree. Still the older look. | RULEBOOK A.8, C.6; one strategy per mechanic | 2026-11-10 |
| S4 | C | todos | A todo has two homes (an event's occurrence, a day todo) and Fokus adds a third small store (free-time notes). A day todo can't be placed in the day grid. | B.8 "Day todos, next steps"; one strategy per mechanic | 2026-11-10 |
| S5 | B | motion | 10 easing curves and ~15 durations across the styles, incl. `ease`, `ease-out`, three ad-hoc cubic-beziers and an inline copy of `--spring`. C.5 names `--soft` (and `--spring` as identity). | RULEBOOK C.5; custom instructions (motion identity) | 2026-11-10 |
| S6 | A* | tokens | Raw hex in 9 style files outside `tokens.css` (focus.css 10, add-button.css 7, editor.css 4, timeline.css 3, others 1). *Tier A only for lines that duplicate an existing token; to verify line by line.* | ARCHITECTURE §10.6, §13.6 | 2026-11-10 |
| S7 | C | timeline view | Untouched since 22 Oct and without its design pass, while the last 7 PRs all went to the day view, editor and Fokus. The brief calls it the most important view. | Brief; RULEBOOK C.6 | 2026-11-10 |
| S8 | C | process | Trials marked "Max to judge by feel" are not recorded as judged: day snapping (#6), edge-pan speed-up (#11), the pull-up line (#22/#23), free-time notes stored with the next event (#24), Fokus not creating events (#24). Unjudged trials become defaults by convenience. | ways of working: feel-gated iteration | 2026-11-10 |

## Rejected (do not re-propose without new reason)
| ID | Idea | Max's reason | Date |
|---|---|---|---|

## Done
| ID | Change | PR | Date |
|---|---|---|---|

## Rule candidates (seen 2+ times → propose for guideline)
- *Tie-break for equal options:* when two options are equally good, pick the one that strengthens the hierarchy (B.1.1), then the one that removes a thing. Proposed 2026-11-10 because the same worry ("least terrible by convenience") recurs.

## Runs
| Date | Mode | Area | Summary | Jury scores (1–7) |
|---|---|---|---|---|
| 2026-11-10 | Jury | whole app | First Jury, baseline. Strong foundation (gate, sync, push, tests, dictionary); all recent work in the execution layer; the hierarchy link is still unbuilt. | 1 · 3 · 2 · 4 · 3 · 3 · 3 |
