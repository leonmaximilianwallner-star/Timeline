"""The rename pass of 21 Oct 2026: old words in code names → the dictionary's words (RULEBOOK.md Part A).

Kept in the repo as the record of exactly which name became which. Run once from the repo root.
Renamed: names in code, IDs, CSS classes, animation names and comments.
Not renamed, on purpose:
  - stored data fields (exams, details, expanded, categoryId …): step 3 replaces them with the new store
  - German text on screen ("Prüfung" etc.)
  - JavaScript's own list method .pop()
"""
import re
from pathlib import Path

# (file glob, pattern, replacement). Applied in order; patterns are regular expressions.
EVERYWHERE = ['*.js', '*/*.js', '*/*/*.js', '*.css', '*/*.css', 'index.html']

RULES = [
    # ── editor (was: modal / draft / m-prefix) ──────────────────────────────
    (r'\bopenModal\b', 'openEditor'),
    (r'\bcloseModal\b', 'closeEditor'),
    (r'\brenderModalBody\b', 'renderEditorBody'),
    (r'\bsaveModal\b', 'saveEditor'),
    (r'\bUI\.modal\b', 'UI.editor'),
    (r'\bmodal:null, +// current draft modal context', 'editor:null,          // the open editor\'s context'),
    (r'\bmodalOv\b', 'editorOverlay'),
    (r'\bmTitleBox\b', 'editorTitleBox'),
    (r'\bmTitle\b', 'editorTitle'),
    (r'\bmClose\b', 'editorClose'),
    (r'\bmDelete\b', 'editorDelete'),
    (r'\bmSave\b', 'editorSave'),
    (r'\bmBody\b', 'editorBody'),
    (r'\bmTodos\b', 'editorTodos'),
    # the window shell shared by the editor and the time budget
    (r'\bmcard\b', 'overlay-window'),
    (r'\bmhead\b', 'overlay-window-header'),
    (r'\bmbody\b', 'overlay-window-body'),
    # a new thing's starting values (the counterpart of ctx.edit)
    (r'\bdraft\b(?=\s*:)', 'initial'),            # { draft: … } in openEditor calls
    (r'\bctx\.draft\b', 'ctx.initial'),
    (r'\bctx\.draft\b', 'ctx.initial'),
    (r'ed\|\|ctx\.draft\|\|', 'ed||ctx.initial||'),

    # ── todo panel (was: pop / popover) ─────────────────────────────────────
    (r'@keyframes pop\{', '@keyframes appear{'),
    (r'animation:pop ', 'animation:appear '),
    (r'@keyframes pop-pulse\{', '@keyframes todo-panel-pulse{'),
    (r'animation:pop-pulse ', 'animation:todo-panel-pulse '),
    (r'\bopenTodoPop\b', 'openTodoPanel'),
    (r'\bclosePop\b', 'closeTodoPanel'),
    (r'\bUI\.pop\b', 'UI.todoPanel'),
    (r'\bpop:null, +// todo popover context', 'todoPanel:null,       // the open todo panel\'s context'),
    (r'#pop\b', '#todoPanel'),
    (r'\(\"pop\"\)', '("todoPanel")'),
    (r'\.id="pop"', '.id="todoPanel"'),
    (r'\bpopEdit\b', 'todoPanelEdit'),
    (r'\bpopNew\b', 'todoPanelNew'),
    (r'\bpopAdd\b', 'todoPanelAdd'),
    (r'\bpopTodos\b', 'todoPanelTodos'),
    (r'\bphead-actions\b', 'panel-actions'),
    (r'\bphead\b', 'panel-header'),
    (r'\bppill\b', 'panel-category'),
    (r'\bpclose\b', 'panel-close'),
    (r'(class="|#todoPanel \.)pt\b', r'\1panel-title'),
    (r'(class="|#todoPanel \.)pm\b', r'\1panel-meta'),

    # ── event in the day view (was: card / evcard) ──────────────────────────
    (r'\bevcard\b', 'event'),
    (r'\bcardPointerDown\b', 'eventPointerDown'),
    (r'\bcardEl\b', 'eventEl'),
    (r'\beventCard\b', 'renderEvent'),
    (r'--r-card\b', '--r-panel'),
    (r'\bGAP_ABOVE_CARD\b', 'GAP_ABOVE_PANEL'),

    # ── phase dropdown on the timeline (was: bubble) ────────────────────────
    (r'\bbubbleRow\b', 'dropdown-row'),
    (r'\bbubbleAnchor\b', 'dropdown-anchor'),
    (r'\bbubble\b', 'dropdown'),

    # ── header (was: topbar) ────────────────────────────────────────────────
    (r'\btopbar\b', 'header'),

    # ── category / follow (was: track) ──────────────────────────────────────
    (r'\btrackPicker\b', 'categoryPicker'),
    (r'\bpanTrack\b', 'panFollow'),

    # ── overlap in the day view (was: cluster) ──────────────────────────────
    (r'\bclusterEnd\b', 'overlapEnd'),
    (r'\bcluster\b', 'overlap'),
]

# Local variables and comments, file by file (too specific for the global list).
LOCAL = {
    'ui/todo-panel.js': [
        (r'todo popover — click a card: quick todo panel in the daily view', 'todo panel — click an event: quick todo panel in the day view'),
        (r'mutate without tearing the popover down', 'mutate without tearing the todo panel down'),
        (r'(?<!\.)\bpop\b(?!\()', 'panel'),             # the local variable; never .pop()
        (r'\bconst card = ', 'const panel = '),
        (r'(?<![\w.-])card(?=[.\s;)])', 'panel'),
        (r"card's top edge", "panel's top edge"),
        (r'text and card', 'text and panel'),
    ],
    'ui/editor.js': [
        (r'modal — draft modal \(preview persists behind it\), todo editor,', 'editor — the editor (a preview stays behind it), its todo list,'),
        (r'unified track dropdown: paints color swatch \+ \(event modal\) refreshes carry-over',
         'category picker: paints the colour swatch and (event editor) refreshes carry-over'),
        (r'preview persisted behind the modal until now', 'preview persisted behind the editor until now'),
    ],
    'app.js': [(r'layer order: budget > modal > popover > settings > add-mode', 'layer order: time budget > editor > todo panel > settings > add mode')],
    'input/timeline-drag.js': [
        (r'release → modal', 'release → editor'),
        (r'resize handles on phase bars', 'resize handles on phase pills'),
        (r'original bar stays put', 'original pill stays put'),
        (r'as real phase bars', 'as real phase pills'),
    ],
    'input/day-drag.js': [
        (r'release → modal\.', 'release → editor.'),
        (r'existing card: move / resize / copy-move', 'existing event: move / resize / copy-move'),
        (r'(?<![\w.-])card(?=[ ;)])', 'eventEl'),
        (r'a solid duplicate of the card floats', 'a solid duplicate of the event floats'),
        (r'then track the ghost', 'then follow the ghost'),
    ],
    'views/day/render.js': [
        (r'event cards with overlap clustering', 'events, overlapping ones side by side'),
        (r'overlap transitively overlapping, assign columns greedily', 'group events that overlap (directly or via others), assign columns greedily'),
        (r'sticky day-of-week bar', 'sticky day header'),
    ],
    'views/timeline/render.js': [
        (r'each lane row owns its own dropdown rows', 'each lane row owns its own phase dropdown rows'),
        (r'dropdown rows for this lane\'s expanded phases', "phase dropdown rows for this lane's open phases"),
        (r'so the popup always sits under its parent bar', 'so the dropdown always sits under its phase'),
        (r'const bar = lab\.parentElement;', 'const phaseEl = lab.parentElement;'),
        (r'const avail = bar\.clientWidth', 'const avail = phaseEl.clientWidth'),
    ],
    'views/timeline/lanes.js': [(r'lane packing for phase bars', 'lane packing for phase pills')],
    'views/viewport.js': [(r'We track _snapping', 'We keep _snapping')],
    'styles/timeline.css': [
        (r'\(month / project / phase / dropdown\)', '(month / project / phase / dropdown)'),
        (r'scope sticky to the bar', 'scope sticky to the pill'),
    ],
    'styles/editor.css': [(r'/\* ---------- modal ---------- \*/', '/* ---------- editor (and the window shell it shares with the time budget) ---------- */')],
    'styles/todos.css': [(r'/\* todo popover on event card click \*/', '/* todo panel, opened by clicking an event */')],
    'styles/base.css': [(r'/\* ---------- top bar ---------- \*/', '/* ---------- header ---------- */')],
    'styles/time-budget.css': [(r'/\* ---------- budget overlay ---------- \*/', '/* ---------- time budget ---------- */')],
    'data/store.js': [(r'to unified tracks \*/', 'to unified categories (with a span: projects) */')],
    'core/model.js': [(r'unified tracks: entries with start&end', 'unified categories: entries with start&end')],
}


def main():
    files = sorted({p for g in EVERYWHERE for p in Path('.').glob(g)
                    if 'node_modules' not in p.parts and 'tests' not in p.parts and 'docs' not in p.parts})
    for f in files:
        text = old = f.read_text(encoding='utf-8')
        for pat, rep in RULES:
            text = re.sub(pat, rep, text)
        for pat, rep in LOCAL.get(str(f), []):
            text, n = re.subn(pat, rep, text)
            if n == 0:
                print(f'  note: no match in {f} for {pat!r}')
        if text != old:
            f.write_text(text, encoding='utf-8')
            print('renamed in', f)


if __name__ == '__main__':
    main()
