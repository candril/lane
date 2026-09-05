#!/usr/bin/env python3
"""Render tmux `capture-pane -e` dumps to a PNG, or a sequence of them to a GIF.

    python3 scripts/render-shot.py capture.txt out.png [--cols 140] [--rows 42]
    python3 scripts/render-shot.py --gif out.gif --frames frames.tsv

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


# Block Elements, as fractions of the cell (x0, y0, x1, y1) — or a blend weight for
# the shade characters. Menlo draws these as em-box glyphs a few pixels shorter than the
# line height, so a scrollbar stacked out of them comes out dashed; fill the cell
# geometry instead so runs tile seamlessly.
BLOCK_FILL = {
    "\u2580": (0, 0, 1, 1 / 2),  # ▀
    "\u2584": (0, 1 / 2, 1, 1),  # ▄
    "\u258c": (0, 0, 1 / 2, 1),  # ▌
    "\u2590": (1 / 2, 0, 1, 1),  # ▐
    "\u2588": (0, 0, 1, 1),  # █
}
for _i in range(1, 8):  # ▁▂▃▄▅▆▇ — eighths filled from the bottom
    BLOCK_FILL[chr(0x2580 + _i)] = (0, 1 - _i / 8, 1, 1)
for _i in range(1, 8):  # ▏▎▍▌▋▊▉ — eighths filled from the left
    BLOCK_FILL[chr(0x2590 - _i)] = (0, 0, _i / 8, 1)
BLOCK_FILL["\u2594"] = (0, 0, 1, 1 / 8)  # ▔
BLOCK_FILL["\u2595"] = (7 / 8, 0, 1, 1)  # ▕
BLOCK_FILL["\u2596"] = (0, 1 / 2, 1 / 2, 1)  # ▖
BLOCK_FILL["\u2597"] = (1 / 2, 1 / 2, 1, 1)  # ▗
BLOCK_FILL["\u2598"] = (0, 0, 1 / 2, 1 / 2)  # ▘
BLOCK_FILL["\u259d"] = (1 / 2, 0, 1, 1 / 2)  # ▝

SHADE_BLEND = {"\u2591": 0.25, "\u2592": 0.5, "\u2593": 0.75}


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
            if ch in BLOCK_FILL:
                fx0, fy0, fx1, fy1 = BLOCK_FILL[ch]
                draw.rectangle(
                    [x + round(fx0 * cw), y + round(fy0 * lh),
                     x + round(fx1 * cw) - 1, y + round(fy1 * lh) - 1],
                    fill=fg,
                )
                continue
            if ch in SHADE_BLEND:
                w = SHADE_BLEND[ch]
                blend = tuple(int(v * w + b * (1 - w)) for v, b in zip(fg, st.bg or BG))
                draw.rectangle([x, y, x + cw - 1, y + lh - 1], fill=blend)
                continue
            font = bold if st.bold else italic if st.italic else regular
            draw.text((x, y + baseline_pad), ch, font=font, fill=fg)
            if st.underline:
                uy = y + baseline_pad + ascent + 2
                draw.line([x, uy, x + cw - 1, uy], fill=fg, width=2)
            if st.strike:
                sy = y + baseline_pad + ascent * 2 // 3
                draw.line([x, sy, x + cw - 1, sy], fill=fg, width=2)
    return img


CAPTION_BG = (22, 22, 30)  # theme.modalBg
CAPTION_KEY = (122, 162, 247)  # theme.primary
CAPTION_TEXT = (192, 202, 245)  # theme.text


def captioned(img, keycap, text):
    """A strip under the frame naming the keys just pressed and what they did. Without
    it the demo is a board flickering through states nobody can name."""
    key_font = ImageFont.truetype(FONT, SIZE, index=1)
    font = ImageFont.truetype(FONT, SIZE, index=0)
    lh = int(round(SIZE * 1.2))
    strip = lh * 2
    out = Image.new("RGB", (img.width, img.height + strip), CAPTION_BG)
    out.paste(img, (0, 0))
    draw = ImageDraw.Draw(out)
    y = img.height + (strip - SIZE) // 2 - 2
    if keycap:
        draw.text((PAD, y), keycap, font=key_font, fill=CAPTION_KEY)
    # A fixed keycap column, so the caption text does not jitter frame to frame.
    draw.text((PAD + int(font.getlength("M" * 8)), y), text, font=font, fill=CAPTION_TEXT)
    return out


def gif(frames, out, cols, rows):
    """frames: (capture path, seconds, keycap, caption) tuples. Half-size and
    palette-quantised — a full-size truecolor frame sequence would be tens of
    megabytes for a README."""
    images = []
    durations = []
    for path, seconds, keycap, caption in frames:
        with open(path, encoding="utf-8", errors="replace") as f:
            img = image(parse(f.read(), cols, rows), cols, rows)
        if keycap or caption:
            img = captioned(img, keycap, caption)
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
    ap.add_argument("inputs", nargs="*", help="capture.txt out.png")
    ap.add_argument("--gif", metavar="OUT", help="assemble --frames into an animated GIF")
    ap.add_argument("--frames", metavar="TSV", help="path\\tseconds\\tkeycap\\tcaption per line")
    ap.add_argument("--cols", type=int, default=140)
    ap.add_argument("--rows", type=int, default=42)
    args = ap.parse_args()
    if args.gif:
        frames = []
        with open(args.frames, encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                path, seconds, keycap, caption = line.rstrip("\n").split("\t")
                frames.append((path, float(seconds), keycap, caption))
        gif(frames, args.gif, args.cols, args.rows)
        print(args.gif)
        return
    if len(args.inputs) != 2:
        ap.error("need capture.txt and out.png (or --gif with --frames)")
    capture, out = args.inputs
    with open(capture, encoding="utf-8", errors="replace") as f:
        text = f.read()
    render(parse(text, args.cols, args.rows), out, args.cols, args.rows)
    print(out)


if __name__ == "__main__":
    sys.exit(main())
