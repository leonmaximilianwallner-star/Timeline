"""The split of 21 Oct 2026 (ARCHITECTURE.md §11, step 2): cuts index.html into files, changing no code.

Kept in the repo as the record of exactly how each file came out of the old index.html.
Run once, from the repo root, on the old single-file index.html:  python3 tests/split-2026-10-21.py
Then prove the result:                                            python3 tests/split-2026-10-21.py --prove <old index.html>

Every file is a run of consecutive lines of the old file, in the old order. So the files, read in the
order index.html loads them, are the old code line for line. The only additions are one comment line on
top of each file saying where it came from, and "use strict"; on each script file whose code was strict
before (all but the loader).
"""
import sys
from pathlib import Path

# (file, first line, last line, what it holds) — line numbers in the old index.html, inclusive.
STYLES = [
    ('styles/tokens.css',        13,  37, 'design tokens: colours, radii, springs, light theme'),
    ('styles/base.css',          38, 100, 'reset, hidden scrollbars, app frame, header'),
    ('styles/timeline.css',     101, 197, 'timeline view'),
    ('styles/day.css',          198, 272, 'day view'),
    ('styles/add-button.css',   273, 285, 'the + button'),
    ('styles/editor.css',       286, 374, 'editor'),
    ('styles/todos.css',        375, 471, 'todo rows, todo panel, completion celebration'),
    ('styles/settings.css',     472, 498, 'settings'),
    ('styles/time-budget.css',  499, 510, 'time budget'),
    ('styles/toast.css',        511, 520, 'toast message'),
    ('styles/device.css',       521, 528, 'adjustments for reduced motion and small screens'),
    ('styles/loader.css',       534, 563, 'loading screen (the drawn wordmark)'),
]
SCRIPTS = [
    # (file, first, last, what it holds, strict)
    ('ui/loader.js',              617,  628, 'loading screen: fades out once the app is ready', False),
    ('core/model.js',             665,  715, 'constants, colour palette, starting data', True),
    ('core/dates.js',             716,  730, 'date and time helpers', True),
    ('core/text.js',              731,  742, 'escaping and cleaning text', True),
    ('ui/toast.js',               743,  748, 'toast message', True),
    ('data/store.js',             749,  836, 'state, loading, saving, undo/redo, category lookup', True),
    ('views/range.js',            837,  878, 'which days are drawn, pixels per day', True),
    ('views/timeline/lanes.js',   879,  889, 'packs phases into lanes', True),
    ('core/repeat.js',            890,  926, 'on which days a repeating event occurs', True),
    ('views/render-all.js',       930,  953, 'draws everything (renderAll)', True),
    ('views/timeline/render.js',  954, 1082, 'draws the timeline view', True),
    ('views/day/render.js',      1083, 1237, 'draws the day view', True),
    ('views/viewport.js',        1238, 1321, 'the one scroll container', True),
    ('input/pointer.js',         1325, 1374, 'pointer helpers and edge auto-pan', True),
    ('input/add-mode.js',        1375, 1391, 'add mode (the + button)', True),
    ('input/day-drag.js',        1392, 1579, 'creating, moving and resizing events by drag', True),
    ('input/timeline-drag.js',   1580, 1708, 'creating and resizing phases, opening editors on the timeline', True),
    ('ui/editor.js',             1712, 1985, 'editor and its todo list', True),
    ('ui/todo-panel.js',         1986, 2084, 'todo panel and completion celebration', True),
    ('ui/time-budget.js',        2088, 2135, 'time budget', True),
    ('ui/settings.js',           2136, 2309, 'settings', True),
    ('reminders.js',             2310, 2336, 'reminders (notifications)', True),
    ('app.js',                   2337, 2374, 'keyboard shortcuts and start-up', True),
]
# Lines of the old file that become the new index.html, and what replaces the rest.
DATE = '21 Oct 2026'


def header(comment, path, a, b, what):
    text = f'{path} — {what}. Moved unchanged from index.html lines {a}–{b} on {DATE}.'
    return f'/* {text} */\n' if comment == 'css' else f'// {text}\n'


def split(old_path='index.html'):
    old = Path(old_path).read_text(encoding='utf-8').split('\n')
    line = lambda a, b: '\n'.join(old[a - 1:b]) + '\n'

    for path, a, b, what in STYLES:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_text(header('css', path, a, b, what) + line(a, b), encoding='utf-8')
    for path, a, b, what, strict in SCRIPTS:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_text(header('js', path, a, b, what) + ('"use strict";\n' if strict else '') + line(a, b), encoding='utf-8')

    links = ''.join(f'<link rel="stylesheet" href="{p}">\n' for p, *_ in STYLES)
    app_scripts = ''.join(f'<script src="{p}"></script>\n' for p, *_ in SCRIPTS[1:])
    page = (line(1, 11)                  # head: meta, title, icon, fonts
            + links
            + line(530, 532)             # </head>, <body>, loader comment
            + line(565, 615)             # loader markup
            + f'<script src="{SCRIPTS[0][0]}"></script>\n'
            + line(630, 662)             # app markup
            + app_scripts
            + line(2376, len(old)).rstrip('\n') + '\n')
    Path('index.html').write_text(page, encoding='utf-8')


def prove(old_path):
    """The new files, read in load order without their added lines, must equal the old code exactly."""
    old = Path(old_path).read_text(encoding='utf-8').split('\n')
    ok = True
    for kind, items in (('styles', STYLES), ('scripts', [s[:4] for s in SCRIPTS])):
        for path, a, b, _ in items:
            new = Path(path).read_text(encoding='utf-8').split('\n')[1:]
            if new and new[0] == '"use strict";':
                new = new[1:]
            if new[:-1] != old[a - 1:b]:
                ok = False
                print(f'✗ {path} differs from old lines {a}–{b}')
    # every old line is accounted for: in a file, kept in index.html, or a removed <style>/<script> wrapper
    covered = set()
    for path, a, b, *_ in STYLES + SCRIPTS:
        covered |= set(range(a, b + 1))
    kept = set(range(1, 12)) | set(range(530, 533)) | set(range(565, 616)) | set(range(630, 663)) | set(range(2376, len(old) + 1))
    wrappers = {n for n in range(1, len(old) + 1) if old[n - 1].strip() in
                ('<style>', '</style>', '<script>', '</script>', '"use strict";')}
    counts = {}
    for path, a, b, *_ in STYLES + SCRIPTS:
        for n in range(a, b + 1):
            counts[n] = counts.get(n, 0) + 1
    twice = sorted(n for n, c in counts.items() if c > 1) + sorted(covered & kept)
    if twice:
        ok = False
        print('✗ old lines used twice:', twice[:20])
    missing = [n for n in range(1, len(old) + 1) if n not in covered | kept | wrappers]
    if missing:
        ok = False
        print('✗ old lines not accounted for:', missing[:20])
    print('Split proof passed: every old line is in exactly one place, unchanged.' if ok else 'Split proof FAILED.')
    return ok


if __name__ == '__main__':
    if sys.argv[1:2] == ['--prove']:
        sys.exit(0 if prove(sys.argv[2]) else 1)
    split()
