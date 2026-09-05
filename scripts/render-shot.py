#!/usr/bin/env python3
"""Render tmux `capture-pane -e` dumps to a PNG, or a sequence of them to a GIF.

    python3 scripts/render-shot.py capture.txt out.png [--cols 140] [--rows 42]
    python3 scripts/render-shot.py --gif out.gif frame1.txt:2.5 frame2.txt:1.0 …

The capture carries the terminal's SGR escapes (truecolor, bold, dim, italic,
underline, strikethrough), which is everything lane draws with. Pillow renders the
cells in Menlo on the board's own background, so the result is the screenshot a
terminal would show, minus the window chrome — and reproducible, since nothing
about it depends on which terminal or font happens to be installed.
"""

import argparse
import re
import sys

from PIL import Image, ImageDraw, ImageFont

FONT = "/System/Library/Fonts/Menlo.ttc"
SIZE = 30  # rendered at 2x and left that way; retina-friendly on the docs site
BG = (26, 27, 38)  # theme.bg
FG = (192, 202, 245)  # theme.text
PAD = 40

ANSI16 = [
    (26, 27, 38), (247, 118, 142), (158, 206, 106), (224, 175, 104),
    (122, 162, 247), (187, 154, 247), (125, 207, 255), (192, 202, 245),
    (65, 72, 104), (247, 118, 142), (158, 206, 106), (224, 175, 104),
    (122, 162, 247), (187, 154, 247), (125, 207, 255), (192, 202, 245),
]


def color256(n):
    if n < 16:
        return ANSI16[n]
    if n < 232:
        n -= 16
        return tuple(0 if v == 0 else 55 + v * 40 for v in (n // 36, (n // 6) % 6, n % 6))
    v = 8 + (n - 232) * 10
    return (v, v, v)


class Style:
    __slots__ = ("fg", "bg", "bold", "dim", "italic", "underline", "strike")

    def __init__(self):
        self.reset()

    def reset(self):
        self.fg, self.bg = None, None
        self.bold = self.dim = self.italic = self.underline = self.strike = False

    def copy(self):
        s = Style()
        s.fg, s.bg = self.fg, self.bg
        s.bold, s.dim, s.italic = self.bold, self.dim, self.italic
        s.underline, s.strike = self.underline, self.strike
        return s

    def apply(self, params):
        codes = [int(p) if p else 0 for p in params.split(";")] if params else [0]
        i = 0
        while i < len(codes):
            c = codes[i]
            if c == 0:
                self.reset()
            elif c == 1:
                self.bold = True
            elif c == 2:
                self.dim = True
            elif c == 3:
                self.italic = True
            elif c == 4:
                self.underline = True
            elif c == 9:
                self.strike = True
            elif c == 22:
                self.bold = self.dim = False
            elif c == 23:
                self.italic = False
            elif c == 24:
                self.underline = False
            elif c == 29:
                self.strike = False
            elif c == 39:
                self.fg = None
            elif c == 49:
                self.bg = None
            elif 30 <= c <= 37:
                self.fg = ANSI16[c - 30]
            elif 90 <= c <= 97:
                self.fg = ANSI16[c - 90 + 8]
            elif 40 <= c <= 47:
                self.bg = ANSI16[c - 40]
            elif 100 <= c <= 107:
                self.bg = ANSI16[c - 100 + 8]
            elif c in (38, 48):
                target = "fg" if c == 38 else "bg"
                if i + 1 < len(codes) and codes[i + 1] == 2 and i + 4 < len(codes):
                    setattr(self, target, tuple(codes[i + 2 : i + 5]))
                    i += 4
                elif i + 1 < len(codes) and codes[i + 1] == 5 and i + 2 < len(codes):
                    setattr(self, target, color256(codes[i + 2]))
                    i += 2
            i += 1


SGR = re.compile(r"\x1b\[([0-9;]*)m")
OTHER_ESC = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]|\x1b[()][A-Za-z0-9]|\x1b[=>]")


def parse(text, cols, rows):
    """Lines of (char, Style) cells, padded to the pane size."""
    lines = []
    for raw in text.split("\n")[:rows]:
        raw = OTHER_ESC.sub(lambda m: m.group(0) if m.group(0).endswith("m") else "", raw)
        style = Style()
        cells = []
        pos = 0
        for m in SGR.finditer(raw):
            for ch in raw[pos : m.start()]:
                cells.append((ch, style.copy()))
            style.apply(m.group(1))
            pos = m.end()
        for ch in raw[pos:]:
            cells.append((ch, style.copy()))
        cells = cells[:cols]
        cells += [(" ", Style())] * (cols - len(cells))
        lines.append(cells)
    while len(lines) < rows:
        lines.append([(" ", Style())] * cols)
    return lines


def render(lines, out, cols, rows):
    image(lines, cols, rows).save(out, optimize=True)


def image(lines, cols, rows):
    regular = ImageFont.truetype(FONT, SIZE, index=0)
    bold = ImageFont.truetype(FONT, SIZE, index=1)
    italic = ImageFont.truetype(FONT, SIZE, index=2)
    cw = int(round(regular.getlength("M")))
    lh = int(round(SIZE * 1.2))
    img = Image.new("RGB", (cols * cw + 2 * PAD, rows * lh + 2 * PAD), BG)
    draw = ImageDraw.Draw(img)
    ascent = regular.getmetrics()[0]
    baseline_pad = (lh - sum(regular.getmetrics())) // 2

    for r, cells in enumerate(lines):
        y = PAD + r * lh
        for c, (ch, st) in enumerate(cells):
            x = PAD + c * cw
            if st.bg:
                draw.rectangle([x, y, x + cw - 1, y + lh - 1], fill=st.bg)
            if ch == " ":
                continue
            fg = st.fg or FG
            if st.dim:
                fg = tuple(int(v * 0.6 + b * 0.4) for v, b in zip(fg, st.bg or BG))
            font = bold if st.bold else italic if st.italic else regular
            draw.text((x, y + baseline_pad), ch, font=font, fill=fg)
            if st.underline:
                uy = y + baseline_pad + ascent + 2
                draw.line([x, uy, x + cw - 1, uy], fill=fg, width=2)
            if st.strike:
                sy = y + baseline_pad + ascent * 2 // 3
                draw.line([x, sy, x + cw - 1, sy], fill=fg, width=2)
    return img


def gif(frames, out, cols, rows):
    """frames: (capture path, seconds) pairs. Half-size and palette-quantised — a
    full-size truecolor frame sequence would be tens of megabytes for a README."""
    images = []
    durations = []
    for path, seconds in frames:
        with open(path, encoding="utf-8", errors="replace") as f:
            img = image(parse(f.read(), cols, rows), cols, rows)
        img = img.resize((img.width // 2, img.height // 2), Image.LANCZOS)
        images.append(img.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
        durations.append(int(seconds * 1000))
    images[0].save(
        out,
        save_all=True,
        append_images=images[1:],
        duration=durations,
        loop=0,
        optimize=True,
        disposal=1,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="+", help="capture.txt out.png, or with --gif: capture.txt:seconds …")
    ap.add_argument("--gif", metavar="OUT", help="assemble the inputs into an animated GIF")
    ap.add_argument("--cols", type=int, default=140)
    ap.add_argument("--rows", type=int, default=42)
    args = ap.parse_args()
    if args.gif:
        frames = []
        for spec in args.inputs:
            path, _, seconds = spec.rpartition(":")
            frames.append((path, float(seconds)))
        gif(frames, args.gif, args.cols, args.rows)
        print(args.gif)
        return
    capture, out = args.inputs
    with open(capture, encoding="utf-8", errors="replace") as f:
        text = f.read()
    render(parse(text, args.cols, args.rows), out, args.cols, args.rows)
    print(out)


if __name__ == "__main__":
    sys.exit(main())
