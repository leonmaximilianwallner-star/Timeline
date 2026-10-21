"""Draws the dictionary's pictures (docs/dictionary/*.svg) in the app's own colours.

Run from the repo root:  python3 docs/dictionary/make_pictures.py
Every word drawn here is a word from RULEBOOK.md Part A. Change a word there, then here.
"""
from pathlib import Path

OUT = Path(__file__).parent

# Design tokens (Project brief §5, RULEBOOK B.3)
BASE, SURFACE, RAISED = '#111118', '#1a1a22', '#23232c'
FG, MUTED, LINE = '#ededec', '#8a8a96', '#2e2e38'
C = dict(amber='#f4971f', red='#e9473a', teal='#40838b', blue='#6498c0',
         green='#8fc14e', gray='#90909a', purple='#a060c8', pink='#d86e9a')
TODAY = '#e9473a'
FONT = "DM Sans, Helvetica Neue, Helvetica, Arial, sans-serif"


def wash(hex_):
    """The colour at 0x38 alpha, pre-blended on the base (RULEBOOK B.3)."""
    a = 0x38 / 255
    c = [int(hex_[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(BASE[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{round(x * a + y * (1 - a)):02x}' for x, y in zip(c, b))


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def text(x, y, s, size=12, fill=FG, weight=400, anchor='start', ls=0):
    extra = f' letter-spacing="{ls}"' if ls else ''
    return (f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" font-weight="{weight}" '
            f'text-anchor="{anchor}"{extra}>{esc(s)}</text>')


def rect(x, y, w, h, r, fill, stroke=None, dash=None, sw=1.5, opacity=None):
    s = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ''
    d = f' stroke-dasharray="{dash}"' if dash else ''
    o = f' opacity="{opacity}"' if opacity else ''
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}"{s}{d}{o}/>'


def pill(x, y, w, h, fill, **k):
    return rect(x, y, w, h, h / 2, fill, **k)


def circle(cx, cy, r, fill='none', stroke=None, sw=1.5, dash=None):
    s = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ''
    d = f' stroke-dasharray="{dash}"' if dash else ''
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}"{s}{d}/>'


def line(x1, y1, x2, y2, stroke=LINE, sw=1, dash=None, marker=None):
    d = f' stroke-dasharray="{dash}"' if dash else ''
    m = f' marker-end="url(#{marker})"' if marker else ''
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" stroke-width="{sw}"{d}{m}/>'


def note(x, y, word, code=None, anchor='start'):
    """An annotation: the dictionary word, and its code name below it."""
    out = text(x, y, word, 12, MUTED, 600, anchor)
    if code:
        out += text(x, y + 15, code, 12, MUTED, 400, anchor)
    return out


def check(cx, cy, state, colour=FG):
    """A todo or step mark (RULEBOOK A.7): circle with ✓, ✕ or →."""
    out = circle(cx, cy, 7, stroke=colour, sw=1.5)
    if state == 'done':
        out = circle(cx, cy, 7, fill=colour) + \
            f'<path d="M{cx-3.5} {cy} l2.5 2.5 l4.5 -5" stroke="{BASE}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    elif state == 'cancelled':
        out += f'<path d="M{cx-3} {cy-3} l6 6 M{cx+3} {cy-3} l-6 6" stroke="{colour}" stroke-width="1.6" stroke-linecap="round"/>'
    elif state == 'postponed':
        out += f'<path d="M{cx-3.5} {cy} h6 m-2.5 -2.5 l2.5 2.5 l-2.5 2.5" stroke="{colour}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    return out


def dot_grid(x, y, w, h, step=16):
    out = []
    for gy in range(y + step // 2, y + h, step):
        for gx in range(x + step // 2, x + w, step):
            out.append(f'<circle cx="{gx}" cy="{gy}" r="1" fill="{LINE}"/>')
    return ''.join(out)


def svg(w, h, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" '
            f'font-family="{FONT}" role="img" aria-label="{esc(title)}">'
            f'<title>{esc(title)}</title>'
            f'<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
            f'<path d="M0 0 L10 5 L0 10 z" fill="{MUTED}"/></marker></defs>'
            f'{rect(0, 0, w, h, 14, BASE)}{body}</svg>')


def heading(x, y, s):
    return text(x, y, s.upper(), 10, MUTED, 600, ls=1)


# ─────────────────────────────────────────────────────────────── pictures

def shapes():
    b = [heading(24, 32, 'Shapes — look words, never names of things')]
    cx = [24, 214, 404, 584]
    b.append(pill(cx[0], 70, 150, 32, C['teal']))
    b.append(text(cx[0] + 16, 91, 'Schreiben', 14, FG, 600))
    b.append(rect(cx[1], 54, 150, 64, 8, C['amber']))
    b.append(text(cx[1] + 12, 78, 'Einleitung', 14, FG, 600))
    b.append(circle(cx[2] + 24, 86, 18, fill=RAISED, stroke=LINE))
    b.append(f'<path d="M{cx[2]+24} {77} v18 M{cx[2]+15} 86 h18" stroke="{FG}" stroke-width="2" stroke-linecap="round"/>')
    b.append(circle(cx[3] + 12, 86, 5, fill=C['red']))
    labels = [('pill', 'ends are half circles', 'radius = height / 2'),
              ('squircle', 'rounded corners', 'radius 8 · 14 · 24'),
              ('circle', 'buttons, marks', 'always perfectly round'),
              ('dot', 'a point in time,', 'a zoomed-out thing')]
    for x, (a, l1, l2) in zip(cx, labels):
        b.append(text(x, 150, a, 14, FG, 600))
        b.append(text(x, 168, l1, 12, MUTED))
        b.append(text(x, 184, l2, 12, MUTED))
    b.append(line(24, 206, 696, 206))
    b.append(text(24, 230, '"The teal pill" describes a look.  "The phase" names the thing.', 12, MUTED))
    return svg(720, 250, ''.join(b), 'Shapes: pill, squircle, circle, dot')


def hierarchy():
    b = [heading(24, 32, 'The hierarchy — from goal to action')]
    rows = [('Project', 'project', 76), ('Milestone', 'milestone', 124), ('Phase', 'phase', 176),
            ('Block', 'block', 236), ('Step', 'step', 278), ('Event', 'event', 370), ('Todo', 'todo', 412)]
    for word, code, y in rows:
        b.append(text(24, y, word, 14, FG, 600))
        b.append(text(24, y + 16, code, 12, MUTED))
    # project spine with milestones
    x0, x1 = 180, 690
    b.append(line(x0, 82, x1 - 20, 82, C['teal'], 2))
    b.append(text(x0, 70, 'Seminararbeit', 12, C['teal'], 600))
    for mx, lab in [(330, 'Entwurf'), (470, 'Review')]:
        b.append(circle(mx, 82, 5, fill=C['teal']))
        b.append(text(mx, 102, lab, 12, MUTED, 400, 'middle'))
    b.append(f'<path d="M{x1-20} 74 l2.4 5 5.4 .6 -4 3.7 1.1 5.3 -4.9-2.8 -4.9 2.8 1.1-5.3 -4-3.7 5.4-.6z" fill="{C["green"]}"/>')
    b.append(text(x1 - 20, 102, 'Abgabe ★', 12, MUTED, 400, 'middle'))
    b.append('<g transform="translate(0,40)">')   # everything below the spine sits one row lower
    # phase pill
    b.append(pill(x0, 118, 300, 28, C['teal']))
    b.append(text(x0 + 14, 137, 'Schreiben', 14, FG, 600))
    b.append(text(x0 + 286, 137, '2/5', 12, FG, 400, 'end'))
    # blocks
    for i, (name, steps) in enumerate([('Einleitung', [('done', 'Forschungsfrage'), ('open', 'Gliederung')]),
                                       ('Hauptteil', [('open', 'Kapitel 2'), ('open', 'Kapitel 3')])]):
        bx = x0 + 8 + i * 168
        b.append(rect(bx, 168, 176, 98, 8, RAISED, stroke=C['teal'], sw=1))
        b.append(text(bx + 12, 190, name, 14, FG, 600))
        for j, (st, s) in enumerate(steps):
            sy = 214 + j * 24
            b.append(check(bx + 20, sy, st, C['teal'] if st == 'done' else FG))
            b.append(text(bx + 34, sy + 4, s, 12, FG))
    # step → event
    b.append(line(x0 + 108, 262, x0 + 108, 300, MUTED, 1.2, '3 3', 'arrow'))
    b.append(text(x0 + 118, 286, 'scheduled: a step gets an event', 12, MUTED))
    b.append(rect(x0, 306, 230, 102, 8, C['teal'] + 'D0'))
    b.append(text(x0 + 12, 326, 'Forschungsfrage', 14, FG, 600))
    b.append(text(x0 + 12, 344, 'Mi 21. · 09:00 – 10:00', 12, FG))
    for j, (st, s) in enumerate([('done', 'Quellen sammeln'), ('open', 'Frage formulieren')]):
        ty = 368 + j * 24
        b.append(check(x0 + 20, ty, st))
        b.append(text(x0 + 34, ty + 4, s, 12, FG))
    b.append(text(510, 136, '← a span of weeks', 12, MUTED))
    b.append(text(540, 210, '← chunks of the phase', 12, MUTED))
    b.append(text(540, 238, '← a step is one line', 12, MUTED))
    b.append(text(430, 344, '← a slot on one day', 12, MUTED))
    b.append(text(430, 384, '← the smallest action', 12, MUTED))
    b.append('</g>')
    b.append(text(180, 128, '↑ the dots on its spine', 12, MUTED))
    return svg(720, 470, ''.join(b), 'The hierarchy: project, milestone, phase, block, step, event, todo')


def milestone():
    b = [heading(24, 32, 'Milestone — a point in time')]
    b.append(line(24, 80, 520, 80, C['teal'], 2))
    b.append(text(24, 66, 'Seminararbeit  (project spine)', 12, C['teal'], 600))
    b.append(circle(200, 80, 5, fill=C['teal']))
    b.append(text(200, 100, 'Review', 12, FG, 400, 'middle'))
    b.append(f'<path d="M500 72 l2.4 5 5.4 .6 -4 3.7 1.1 5.3 -4.9-2.8 -4.9 2.8 1.1-5.3 -4-3.7 5.4-.6z" fill="{C["green"]}"/>')
    b.append(text(500, 100, 'Abgabe', 12, FG, 400, 'middle'))
    b.append(note(560, 76, 'on its project\'s spine', 'dot · final = ★'))
    b.append(line(24, 132, 696, 132))
    b.append(pill(24, 152, 190, 32, C['red']))
    b.append(text(40, 166, 'Präsentation', 12, FG, 600))
    b.append(text(40, 179, '30 Punkte', 10, FG))
    b.append(line(119, 184, 119, 204, C['red'], 1.5))
    b.append(note(240, 166, 'milestone chip', 'no project → a chip'))
    b.append(note(440, 166, 'not an exam', 'exam is a topic, not a kind'))
    return svg(720, 224, ''.join(b), 'Milestone: a dot on a project spine, or a chip')


def phase():
    b = [heading(24, 32, 'Phase — one thing, three looks')]
    # timeline view
    b.append(text(24, 64, 'timeline view', 12, MUTED, 600))
    b.append(pill(24, 76, 320, 28, wash(C['teal'])))
    b.append(pill(24, 76, 150, 28, C['teal']))
    b.append(circle(40, 90, 7, fill=RAISED))
    b.append(f'<path d="M38 87 l4 3 -4 3" stroke="{FG}" stroke-width="1.6" fill="none" stroke-linecap="round"/>')
    b.append(text(54, 95, 'Schreiben', 14, FG, 600))
    b.append(note(360, 88, 'phase pill · fill = progress', 'the arrow opens the phase dropdown'))
    # canvas closed
    b.append(text(24, 140, 'canvas view, closed', 12, MUTED, 600))
    b.append(pill(24, 152, 220, 32, C['teal']))
    b.append(f'<path d="M38 164 l4 4 4 -4" stroke="{FG}" stroke-width="1.8" fill="none" stroke-linecap="round"/>')
    b.append(text(56, 173, 'Schreiben', 14, FG, 600))
    b.append(text(230, 173, '2/5', 12, FG, 400, 'end'))
    b.append(note(360, 166, 'count = steps done / total', 'open: false'))
    # canvas open
    b.append(text(24, 220, 'canvas view, open', 12, MUTED, 600))
    ox, oy = 24, 232
    b.append(rect(ox, oy, 480, 196, 24, C['teal']))
    b.append(text(ox + 20, oy + 24, 'PHASE · 28.9. – 1.11.', 10, FG, 600, ls=1))
    b.append(text(ox + 20, oy + 48, 'Schreiben', 18, FG, 600))
    b.append(text(ox + 420, oy + 48, '2/5', 12, FG, 400, 'end'))
    b.append(circle(ox + 448, oy + 40, 14, fill=C['teal'], stroke=FG, sw=1))
    b.append(f'<path d="M{ox+443} {oy+43} l5 -5 5 5" stroke="{FG}" stroke-width="1.8" fill="none" stroke-linecap="round"/>')
    for i in [2, 1, 0]:   # drawn right to left, so the leftmost block lies on top
        name = ['Einleitung', 'Hauptteil', 'Schluss'][i]
        bx = ox + 8 + i * 142
        b.append(rect(bx, oy + 68, 174, 120, 14, RAISED, stroke=C['teal'], sw=2))
        inset = 14 if i == 0 else 14 + 32   # clear of the 32px the block to its left covers
        b.append(text(bx + inset, oy + 92, name, 14, FG, 600))
        b.append(check(bx + inset + 8, oy + 116, 'done' if i == 0 else 'open', C['teal'] if i == 0 else FG))
        b.append(text(bx + inset + 22, oy + 120, 'Schritt', 12, FG))
    b.append(note(520, oy + 48, 'open phase', 'a squircle, radius 24'))
    b.append(note(520, oy + 110, 'its blocks inside', 'each covers the next'))
    b.append(note(520, oy + 140, '', 'one cell; leftmost on top'))
    return svg(720, 448, ''.join(b), 'Phase: a pill on the timeline view; closed or open on the canvas view')


def block():
    b = [heading(24, 32, 'Block — an idea a phase lists')]
    bx, by = 24, 52
    b.append(rect(bx, by, 260, 220, 14, RAISED, stroke=C['teal'], sw=2))
    b.append(text(bx + 16, by + 30, 'Einleitung', 14, FG, 600))
    b.append(text(bx + 240, by + 30, '1/3', 12, MUTED, 400, 'end'))
    lines = [('heading', 'RECHERCHE'), ('step-done', 'Forschungsfrage'), ('step-sched', 'Gliederung'),
             ('heading', 'TEXT'), ('step', 'Erster Absatz'), ('point', 'Ton: sachlich')]
    y = by + 62
    for kind, s in lines:
        if kind == 'heading':
            b.append(text(bx + 16, y, s, 10, MUTED, 600, ls=1))
            y += 24
            continue
        if kind == 'point':
            b.append(text(bx + 20, y + 4, '–', 12, MUTED))
            b.append(text(bx + 36, y + 4, s, 12, FG))
        else:
            st = 'done' if kind == 'step-done' else 'open'
            b.append(check(bx + 22, y, st, C['teal'] if st == 'done' else FG))
            if kind == 'step-sched':
                b.append(circle(bx + 22, y, 10.5, stroke=FG, sw=1))
            b.append(text(bx + 40, y + 4, s, 12, FG))
        y += 26
    notes = [(by + 62, by + 40, 'heading', '# line · groups, not a level'),
             (by + 88, by + 86, 'step', '[ ] line · the unit you schedule'),
             (by + 114, by + 132, 'step with events', 'second ring · ticked by its events'),
             (by + 190, by + 190, 'point', '- line · a plain note')]
    for ly, ny, w, c in notes:
        b.append(f'<polyline points="{bx+268},{ly-4} 316,{ly-4} 330,{ny-4} 336,{ny-4}" fill="none" stroke="{LINE}" stroke-dasharray="2 3"/>')
        b.append(note(344, ny, w, c))
    return svg(720, 292, ''.join(b), 'Block: headings, steps and points inside')


def event():
    b = [heading(24, 32, 'Event — a slot of time on one day')]
    # day header + hour rail
    b.append(rect(24, 48, 340, 30, 8, SURFACE))
    for i, (wd, d) in enumerate([('Mo', 19), ('Di', 20)]):
        x = 92 + i * 136 + 68
        b.append(text(x, 60, wd.upper(), 10, MUTED, 600, 'middle'))
        if d == 20:
            b.append(circle(x, 70, 9, fill=TODAY))
        b.append(text(x, 74, str(d), 12, FG, 600, 'middle'))
    for i, h in enumerate(['08:00', '09:00', '10:00', '11:00', '12:00']):
        y = 96 + i * 44
        b.append(text(76, y + 4, h, 10, MUTED, 400, 'end'))
        b.append(line(84, y, 364, y))
    b.append(line(228, 84, 228, 280))
    ex, ey = 232, 140
    b.append(rect(ex, ey, 128, 88, 8, C['amber'] + 'D0'))
    b.append(text(ex + 10, ey + 20, 'Tutorium', 14, FG, 600))
    b.append(text(ex + 10, ey + 38, '09:00 – 11:00', 12, FG))
    b.append(check(ex + 18, ey + 64, 'done'))
    b.append(text(ex + 32, ey + 68, '2/3', 12, FG))
    b.append(note(24, 300, 'day header · hour rail', ''))
    b.append(note(232, 300, 'event', 'a squircle, radius 8'))
    # todo panel
    px, py = 396, 112
    b.append(line(ex + 128, ey + 40, px, py + 40, MUTED, 1, '3 3'))
    b.append(rect(px, py, 300, 160, 14, RAISED, stroke=LINE))
    b.append(rect(px, py, 300, 40, 14, C['amber']))
    b.append(rect(px, py + 26, 300, 14, 0, C['amber']))
    b.append(text(px + 14, py + 25, 'Tutorium', 14, FG, 600))
    for j, (st, s) in enumerate([('done', 'Folien hochladen'), ('done', 'Anwesenheit'), ('postponed', 'Fragen beantworten')]):
        ty = py + 62 + j * 28
        b.append(check(px + 22, ty, st))
        b.append(text(px + 38, ty + 4, s, 12, FG))
    b.append(note(px, 300, 'todo panel', 'never "popover" or "pop"'))
    return svg(720, 336, ''.join(b), 'Event in the day view, with its todo panel')


def todo_states():
    b = [heading(24, 32, 'Todo states')]
    rows = [('open', 'offen', 'click → done'), ('done', 'erledigt', 'click → cancelled'),
            ('cancelled', 'abgesagt', 'click → open'), ('postponed', 'verschoben', 'right-click toggles · carries over')]
    for i, (st, de, how) in enumerate(rows):
        x = 24 + i * 174
        b.append(rect(x, 52, 160, 92, 8, SURFACE))
        b.append(check(x + 24, 78, st))
        b.append(text(x + 42, 82, de, 14, FG, 600))
        b.append(text(x + 16, 108, st, 12, MUTED))
        b.append(text(x + 16, 126, how if len(how) < 22 else 'right-click', 12, MUTED))
    b.append(text(24, 172, 'Changing a state is ticking: tickTodo.  Postponed todos come along to the next event (carry-over).', 12, MUTED))
    return svg(720, 192, ''.join(b), 'Todo states: open, done, cancelled, postponed')


def canvas_things():
    b = [heading(24, 32, 'Canvas view — things that organise thinking'), dot_grid(16, 44, 688, 300)]
    # group hull
    b.append(rect(32, 60, 316, 140, 24, 'none', stroke=MUTED, dash='4 4', sw=1))
    b.append(text(48, 80, 'OPTIONEN', 10, MUTED, 600, ls=1))
    b.append(rect(48, 92, 136, 92, 8, C['blue']))
    b.append(text(60, 114, 'Master', 14, FG, 600))
    b.append(rect(196, 92, 136, 92, 8, wash(C['blue']), stroke=C['blue'], dash='5 4'))
    b.append(text(208, 114, 'Fristen?', 14, FG, 600))
    b.append(note(40, 222, 'group', 'within one cell · named'))
    b.append(note(196, 222, 'idea, certainty: Frage', 'title ends in ? → dashed'))
    b.append(rect(400, 92, 136, 92, 8, C['purple'], stroke=FG, dash='5 4', sw=1.5))
    b.append(text(412, 114, 'Geld reicht', 14, FG, 600))
    b.append(note(400, 222, 'Annahme', 'dashed rim'))
    # links
    ly = 282
    b.append(line(40, ly, 180, ly, MUTED, 1.5))
    b.append(note(40, ly + 24, 'Bezug', 'relates to'))
    b.append(line(240, ly, 380, ly, MUTED, 1.5, None, 'arrow'))
    b.append(note(240, ly + 24, 'Folge', 'leads to · feeds progress'))
    b.append(line(440, ly, 580, ly, MUTED, 1.5, '6 4'))
    b.append(note(440, ly + 24, 'Spannung', 'in tension with'))
    b.append(text(24, 344, 'Links: the three types (drawing schematic).', 12, MUTED))
    return svg(720, 360, ''.join(b), 'Canvas view: ideas, group, certainty, links')


def views():
    b = []
    W = 720
    # canvas view
    b.append(rect(16, 16, 560, 120, 14, SURFACE))
    b.append(dot_grid(16, 16, 560, 120))
    b.append(rect(48, 40, 120, 60, 8, C['amber']))
    b.append(text(60, 62, 'Idee', 14, FG, 600))
    b.append(pill(200, 56, 180, 28, C['teal']))
    b.append(text(214, 75, 'Schreiben', 14, FG, 600))
    # rail
    b.append(rect(16, 140, 560, 22, 8, RAISED))
    b.append(pill(200, 148, 120, 6, C['teal']))
    b.append(circle(420, 151, 3, fill=C['red']))
    # timeline view
    b.append(rect(16, 168, 560, 160, 14, SURFACE))
    for i, m in enumerate(['Oktober', 'November']):
        b.append(text(32 + i * 280, 190, m, 12, FG, 600))
    for i, k in enumerate(['KW 43', 'KW 44', 'KW 45', 'KW 46']):
        b.append(text(32 + i * 140, 206, k, 10, MUTED))
    b.append(line(32, 230, 540, 230, C['teal'], 2))
    b.append(circle(250, 230, 4, fill=C['teal']))
    b.append(pill(60, 246, 200, 24, C['teal']))
    b.append(text(74, 263, 'Schreiben', 12, FG, 600))
    b.append(pill(280, 246, 160, 24, C['teal']))
    b.append(pill(120, 276, 150, 24, C['amber']))
    b.append(pill(400, 300, 110, 22, C['red']))
    b.append(text(412, 315, 'Präsentation', 12, FG, 600))
    b.append(line(220, 168, 220, 328, TODAY, 1.5))
    # day header + day view
    b.append(rect(16, 334, 560, 30, 8, RAISED))
    for i, (wd, d) in enumerate([('Mo', 19), ('Di', 20), ('Mi', 21), ('Do', 22), ('Fr', 23)]):
        x = 96 + i * 96 + 48
        b.append(text(x, 346, wd.upper(), 10, MUTED, 600, 'middle'))
        if d == 20:
            b.append(circle(x, 356, 9, fill=TODAY))
        b.append(text(x, 360, str(d), 12, FG, 600, 'middle'))
    b.append(rect(16, 368, 560, 150, 14, SURFACE))
    for i, h in enumerate(['09:00', '10:00', '11:00']):
        y = 392 + i * 44
        b.append(text(80, y + 4, h, 10, MUTED, 400, 'end'))
        b.append(line(88, y, 572, y))
    b.append(rect(194, 394, 90, 84, 8, C['amber'] + 'D0'))
    b.append(text(202, 412, 'Tutorium', 12, FG, 600))
    b.append(rect(290, 438, 90, 44, 8, C['teal'] + 'D0'))
    b.append(text(298, 456, 'Kapitel 2', 12, FG, 600))
    # labels on the right
    lab = [(70, 'canvas view', 'canvas · Leinwand'), (154, 'rail', 'the timeline, docked'),
           (196, 'timeline view', 'timeline · Zeitleiste'), (230, 'spine', 'project + milestones'),
           (270, 'lane', 'one row of pills'), (316, 'milestone chip', 'no project'),
           (352, 'day header', 'today = red circle'), (420, 'day view', 'day · Tagesansicht'),
           (466, 'hour rail', 'sticky, left')]
    for y, w, c in lab:
        b.append(line(580, y - 4, 592, y - 4, LINE))
        b.append(note(598, y, w, c))
    return svg(W, 532, ''.join(b), 'The views, stacked: canvas view, rail, timeline view, day view')


def editor():
    b = [heading(24, 32, 'Editors — one shell, named after the thing')]

    def shell(x, y, colour, over, name, rows):
        out = [rect(x, y, 300, 70, 24, colour)]
        out.append(text(x + 20, y + 26, over, 10, FG, 600, ls=1))
        out.append(text(x + 20, y + 50, name, 18, FG, 600))
        for i, ic in enumerate(['delete', 'close', 'done']):
            cx = x + 204 + i * 34
            out.append(circle(cx, y + 34, 13, fill=RAISED + '80'))
        out.append(f'<path d="M{x+199} {y+30} h10 M{x+201} {y+30} v9 h6 v-9" stroke="{FG}" stroke-width="1.4" fill="none"/>')
        out.append(f'<path d="M{x+234} {y+30} l8 8 M{x+242} {y+30} l-8 8" stroke="{FG}" stroke-width="1.6" stroke-linecap="round"/>')
        out.append(f'<path d="M{x+267} {y+34} l3.5 3.5 6-7" stroke="{FG}" stroke-width="1.8" fill="none" stroke-linecap="round"/>')
        out.append(rect(x, y + 56, 300, 30 + 44 * len(rows), 24, RAISED))
        for i, (k, v) in enumerate(rows):
            ry = y + 86 + i * 44
            out.append(text(x + 20, ry, k, 14, FG))
            out.append(text(x + 280, ry, v, 14, MUTED, 400, 'end'))
            if i < len(rows) - 1:
                out.append(line(x + 20, ry + 18, x + 280, ry + 18))
        return ''.join(out)

    b.append(shell(24, 52, C['amber'], 'ARBEIT', 'Tutorium',
                   [('Di 20. Okt', '09:00 – 11:00'), ('Wiederholung', 'Wöchentlich'), ('Erinnerung', 'Keine')]))
    b.append(shell(372, 52, C['teal'], 'SEMINARARBEIT › PHASE', 'Schreiben',
                   [('Beginn', 'In 3 Tagen'), ('Bis', 'So 1. Nov'), ('Farbe', 'Seminararbeit')]))
    b.append(note(24, 292, 'event editor', 'openEventEditor(event)'))
    b.append(note(372, 292, 'phase editor', 'openPhaseEditor(phase)'))
    b.append(text(24, 336, 'Same shell (editor): header in the thing\'s colour — overline, name, delete · close · done — over a raised body.', 12, MUTED))
    b.append(text(24, 354, 'Never "modal", "draft" or "popup".', 12, MUTED))
    return svg(720, 374, ''.join(b), 'Editors: the event editor and the phase editor share one shell')


PICTURES = dict(shapes=shapes, hierarchy=hierarchy, milestone=milestone, phase=phase, block=block,
                event=event, **{'todo-states': todo_states, 'canvas-things': canvas_things},
                views=views, editor=editor)

if __name__ == '__main__':
    for name, fn in PICTURES.items():
        (OUT / f'{name}.svg').write_text(fn(), encoding='utf-8')
        print('wrote', name + '.svg')
